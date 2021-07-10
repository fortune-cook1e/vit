import koa, { Context, Next } from 'koa'
import chalk from 'chalk'
import path from 'path'
import fs from 'fs-extra'
import http from 'http'
import SocketIo, { Socket } from 'socket.io'
import { createWatcher } from './utils/watcher'
import { hmrMiddleware } from './middlewares/hmr'
import { socketMiddleware } from './middlewares/socket'

interface CreateServerConfig {
  port: number
  cwd: string
}

export const createServer = ({ port, cwd }: CreateServerConfig) => {
  const app = new koa()

  const server = http.createServer(app.callback())
  // FIXBUG: 这里Socket实例必须在外部创建 在中间件创建会报错
  const io = new SocketIo.Server(server)

  // middlewares
  app.use(hmrMiddleware({ cwd, app, server }))
  app.use(socketMiddleware({ cwd, io }))

  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      console.log(chalk.blue(`http://localhost:${port}`))
      resolve(server)
    })
  })
}
