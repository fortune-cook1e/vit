import { Context, Next } from 'koa'
import path from 'path'
import fs from 'fs-extra'
import { Server } from 'http'
import { rewriteHtml, sendJs } from '../utils/index'

interface HmrConfig {
  cwd: string
  server: Server
  app: any
}

export const hmrMiddleware = ({ app, cwd, server }: HmrConfig) => {
  return async (ctx: Context, next: Next) => {
    const url = ctx.url

    console.log({ url })

    if (url === '/') {
      const html = rewriteHtml(cwd + '/index.html')
      ctx.type = 'html'
      ctx.body = html
    } else if (url.endsWith('hmr')) {
      sendJs(ctx, path.resolve(__dirname, '../../client/socket.js'))
    } else if (url.endsWith('.js')) {
      const jsFilePath = path.resolve(cwd + url)
      sendJs(ctx, jsFilePath)
    }
    await next()
  }
}
