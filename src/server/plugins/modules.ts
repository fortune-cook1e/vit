import { Readable } from 'stream'
import path from 'path'
import { Plugin } from '../types'
import { parse as parseImports } from 'es-module-lexer'
import MagicString from 'magic-string'
import { HMR_CLIENT_PUBLIC_PATH } from './hmr'
import { parse } from '@babel/parser'
import { StringLiteral } from '@babel/types'

// while we lex the files for imports we also build a import graph
// so that we can determine what files to hot reload
type HMRStateMap = Map<string, Set<string>>

export const importerMap: HMRStateMap = new Map()
export const importeeMap: HMRStateMap = new Map()
export const hmrBoundariesMap: HMRStateMap = new Map()

export const modulesPlugin: Plugin = ({ root, app }) => {
  // rewrite named module imports to `/@modules/:id` requests
  app.use(async (ctx, next) => {
    await next()
    // if (ctx.status === 304) return
    if (ctx.url === '/index.html') {
      const html = await readBody(ctx.body)
      ctx.body = html.replace(
        /(<script\b[^>]*>)([\s\S]*?)<\/script>/gm,
        (_, openTag, script) => {
          // 这里以test/demo/index.html 为例
          // openTag拿到的结果为 <script type="module" src="./main.js">
          // script 拿到的是script标签中的内容
          return `${openTag}${rewriteImports(script, '/index.html')}</script>`
        }
      )
    }

    // 处理 js 文件
    if (ctx.response.is('js')) {
      ctx.body = rewriteImports(
        await readBody(ctx.body),
        ctx.url.replace(/(&|\?)t=\d+/, ''),
        ctx.query.t as string
      )
    }
  })
}

function rewriteImports(source: string, importer: string, timestamp?: string) {
  try {
    // 用于解析当前文件顶部的import语句
    const [imports] = parseImports(source)

    // for imports
    // s: start e:end ss:statement start se:statement end
    // TIP: 当前file顶部有import语句才进入此逻辑
    // 这里以 test/demo/main.js 为例
    // main.js 为 importer other.js 为 importee
    if (imports.length) {
      const magicString = new MagicString(source)
      let hasReplaced = false

      const prevImportees = importeeMap.get(importer)
      const currentImportees = new Set<string>()
      importeeMap.set(importer, currentImportees)

      imports.forEach(({ s: start, e: end, d: dynamicIndex }) => {
        // 截取引入的模块 例如 import {xx} from '/@hmr'，那么下面的值就是 /@hmr
        const id = source.slice(start, end)
        // 处理非动态import引入
        if (dynamicIndex === -1) {
          if (/^[^\/\.]/.test(id)) {
            magicString.overwrite(start, end, `/@modules/${id}`)
            hasReplaced = true
          } else if (id === HMR_CLIENT_PUBLIC_PATH) {
            // TIP: 初始化js热更新
            if (importer.endsWith('.js')) {
              console.log('js reload init~', { id, importer })
              // TIP: 这里已经把使用 hot.accept的代码已经修改
              parseAcceptedDeps(source, importer, magicString)
              hasReplaced = true
            }
          } else {
            if (timestamp) {
              magicString.overwrite(
                start,
                end,
                `${id}${/\?/.test(id) ? `&` : `?`}t=${timestamp}`
              )
              hasReplaced = true
            }
            // TODO: 干到这里了～
            const importee = path.join(path.dirname(importer), id)
            ensureMapEntry(importerMap, importee).add(importer)
          }
        }
      })

      // since the importees may have changed due to edits,
      // check if we need to remove this importer from certain importees
      if (prevImportees) {
        prevImportees.forEach(importee => {
          if (!currentImportees.has(importee)) {
            const importers = importerMap.get(importee)
            if (importers) {
              importers.delete(importer)
            }
          }
        })
      }

      return hasReplaced ? magicString.toString() : source
    }
    return source
  } catch (e) {
    console.log(`[vit]: module imports rewrite errror in ${importer}`)
  }
}

// 读文件内容
async function readBody(stream: Readable | string): Promise<string> {
  if (stream instanceof Readable) {
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks).toString()
  } else {
    return stream
  }
}

const ensureMapEntry = (map: HMRStateMap, key: string): Set<string> => {
  let entry = map.get(key)
  if (!entry) {
    entry = new Set<string>()
    map.set(key, entry)
  }
  return entry
}

// 检测代码中是否有 hot.accept，并且完成热更新依赖注入
function parseAcceptedDeps(source: string, importer: string, s: MagicString) {
  const ast = parse(source, {
    sourceType: 'module',
    plugins: [
      // by default we enable proposals slated for ES2020.
      // full list at https://babeljs.io/docs/en/next/babel-parser#plugins
      // this should be kept in async with @vue/compiler-core's support range
      'bigInt',
      'optionalChaining',
      'nullishCoalescingOperator'
    ]
  }).program.body

  const registerDep = (e: StringLiteral) => {
    const deps = ensureMapEntry(hmrBoundariesMap, importer)
    const depPublicPath = path.join(path.dirname(importer), e.value)
    deps.add(depPublicPath)
    s.overwrite(e.start!, e.end!, JSON.stringify(depPublicPath))
  }

  ast.forEach((node: any) => {
    if (
      node.type === 'ExpressionStatement' &&
      node.expression.type === 'CallExpression' &&
      node.expression.callee.type === 'MemberExpression' &&
      node.expression.callee.object.type === 'Identifier' &&
      node.expression.callee.object.name === 'hot' &&
      node.expression.callee.property.name === 'accept'
    ) {
      const args = node.expression.arguments
      // inject the imports's own path so it becomes
      // hot.accept('/foo.js', ['./bar.js'], () => {})
      s.appendLeft(args[0].start!, JSON.stringify(importer) + ', ')
      // register the accepted deps
      if (args[0].type === 'ArrayExpression') {
        args[0].elements.forEach((e: any) => {
          if (e && e.type !== 'StringLiteral') {
            console.error(
              `[vite] HMR syntax error in ${importer}: hot.accept() deps list can only contain string literals.`
            )
          } else if (e) {
            registerDep(e)
          }
        })
      } else if (args[0].type === 'StringLiteral') {
        registerDep(args[0])
      } else {
        console.error(
          `[vite] HMR syntax error in ${importer}: hot.accept() expects a dep string or an array of deps.`
        )
      }
    }
  })
}
