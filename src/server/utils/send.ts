import { Context } from 'koa'
import fs from 'fs-extra'

export const sendJs = (ctx: Context, filePath: string) => {
  ctx.type = 'js'
  const fileContent = fs.readFileSync(filePath, 'utf-8')
  ctx.body = fileContent
}

export const sendJsStream = (ctx: Context, filePath: string) => {
  ctx.type = 'js'
  const stream = fs.createReadStream(filePath)
  ctx.body = stream
}
