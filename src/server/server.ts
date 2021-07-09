import koa, { Context, Next } from 'koa'
import chalk from 'chalk'

import fs from 'fs-extra'
interface CreateServerConfig {
  port: number
  cwd: string
}

export const createServer = ({ port, cwd }: CreateServerConfig) => {
  const htmlContent = fs.readFileSync(cwd + '/index.html', 'utf-8')

  const app = new koa()

  app.use(async (ctx: Context, next: Next) => {})

  app.listen(port, () => {
    console.log(chalk.blue(`http://localhost:${port}`))
  })
}
