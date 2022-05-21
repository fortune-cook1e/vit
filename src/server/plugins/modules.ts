import { Readable } from 'stream'
import path from 'path'
import { Plugin } from '../types'
import { parse as parseImports } from 'es-module-lexer'
import MagicString from 'magic-string'
import { HMR_CLIENT_PUBLIC_PATH } from './hmr'

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
      return ctx.body
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
        const id = source.slice(start, end)
        // 处理非动态import引入
        if (dynamicIndex === -1) {
          if (/^[^\/\.]/.test(id)) {
            magicString.overwrite(start, end, `/@modules/${id}`)
            hasReplaced = true
          } else if (id === HMR_CLIENT_PUBLIC_PATH) {
            // TODO: 待处理HMR情况
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
            console.log({ importee, importer })
            currentImportees.add(importee)
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
