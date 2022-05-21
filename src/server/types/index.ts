import Koa from 'koa'
import { Server } from 'http'

export interface PluginContext {
  root: string
  app: Koa
  server: Server
}

export type Plugin = (ctx: PluginContext) => void

export interface ServerConfig {
  root?: string
  plugins?: Plugin[]
}
