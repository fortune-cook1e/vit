import { Plugin } from '../types'
import path from 'path'
import WebSocket from 'ws'
import chokidar from 'chokidar'
import { importerMap, hmrBoundariesMap } from './modules'
import { promises as fs } from 'fs'

const HMR_CLIENT_FILE_PATH = path.resolve(__dirname, '../../client/client.js')

export const HMR_CLIENT_PUBLIC_PATH = '/@hmr'

interface HMRPayload {
  type: string
  timestamp: number
  path?: string
  id?: string
  index?: number
}

export const hmrPlugin: Plugin = ({ root, app, server }) => {
  app.use(async (ctx, next) => {
    if (ctx.path === HMR_CLIENT_PUBLIC_PATH) {
      ctx.type = 'js'
      ctx.body = await fs.readFile(HMR_CLIENT_FILE_PATH, 'utf-8')
      // ctx.body = await import(HMR_CLIENT_FILE_PATH)
    } else {
      await next()
    }
  })

  // start a websocket server to send hmr notifications to the client
  const wss = new WebSocket.Server({ server })
  const sockets = new Set<WebSocket>()

  wss.on('connection', socket => {
    sockets.add(socket)
    socket.send(JSON.stringify({ type: 'connected' }))
    socket.on('close', () => {
      sockets.delete(socket)
    })
  })

  wss.on('error', (e: Error & { code: string }) => {
    if (e.code !== 'EADDRINUSE') {
      console.error(e)
    }
  })

  // 当文件发生变化时，通知客户端
  const notify = (payload: HMRPayload) => {
    const stringified = JSON.stringify(payload)
    console.log(`[hmr notify~] ${stringified}`)
    sockets.forEach(socket => {
      socket.send(stringified)
    })
  }

  // 监听root文件下的改变
  const watcher = chokidar.watch(root, { ignored: /node_modules/ })

  watcher.on('change', async (file: string) => {
    const timestamp = Date.now()
    const servedPath = '/' + path.relative(root, file)
    // TIP: 目前只处理js结尾类型文件
    handleJSReload(servedPath, timestamp)
  })

  // 通知js更新
  function handleJSReload(servedPath: string, timestamp: number) {
    const importers = importerMap.get(servedPath)
    if (importers) {
      const vueImporters = new Set<string>()
      const jsHotImporters = new Set<string>()
      const hasDeadEnd = walkImportChain(
        servedPath,
        importers,
        vueImporters,
        jsHotImporters
      )
      if (hasDeadEnd) {
        notify({
          type: 'full-reload',
          timestamp
        })
      } else {
        jsHotImporters.forEach(jsImporter => {
          notify({
            type: 'js-update',
            path: jsImporter,
            timestamp
          })
        })
      }
    }
  }
}

function walkImportChain(
  importee: string,
  currentImporters: Set<string>,
  vueImporters: Set<string>,
  jsHotImporters: Set<string>
): boolean {
  let hasDeadEnd = false
  for (const importer of currentImporters) {
    if (importer.endsWith('.vue')) {
      vueImporters.add(importer)
    } else if (isHMRBoundary(importer, importee)) {
      jsHotImporters.add(importer)
    } else {
      const parentImpoters = importerMap.get(importer)
      if (!parentImpoters) {
        hasDeadEnd = true
      } else {
        hasDeadEnd = walkImportChain(
          importer,
          parentImpoters,
          vueImporters,
          jsHotImporters
        )
      }
    }
  }
  return hasDeadEnd
}

function isHMRBoundary(importer: string, dep: string): boolean {
  const deps = hmrBoundariesMap.get(importer)
  return deps ? deps.has(dep) : false
}
