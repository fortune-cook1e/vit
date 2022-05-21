import { Plugin } from '../types'
import path from 'path'
import WebSocket from 'ws'
import chokidar from 'chokidar'
import { importerMap } from './modules'

const HMR_CLIENT_FILE_PATH = path.resolve(__dirname, '../../client/client.ts')

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
      ctx.body = await import(HMR_CLIENT_FILE_PATH)
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
    console.log(`[hmr] ${stringified}`)
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
      const jsHotImporters = new Set<string>()
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
