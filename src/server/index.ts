import http, { Server } from 'http'
import Koa from 'koa'
import { hmrPlugin } from './plugins/hmr'
import { servePlugin } from './plugins/serve'
import { modulesPlugin } from './plugins/modules'
import { ServerConfig, Plugin } from './types'

const internalPlugins: Plugin[] = [modulesPlugin, hmrPlugin, servePlugin]

export function createServer({
  root = process.cwd(),
  plugins = []
}: ServerConfig = {}): Server {
  const app = new Koa()
  const server = http.createServer(app.callback())

  // 初始化插件
  ;[...internalPlugins, ...plugins].forEach(plugin =>
    plugin({ root, app, server })
  )

  return server
}
