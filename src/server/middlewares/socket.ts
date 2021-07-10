import { Context, Next } from 'koa'
import { Socket } from 'socket.io'
import { createWatcher } from '../utils/index'

interface SocketConfig {
  cwd: string
  io: any
}

export const socketMiddleware = ({ cwd, io }: SocketConfig) => {
  return async (ctx: Context, next: Next) => {
    io.on('connection', function (socket: Socket) {
      const token = socket.handshake.auth.token

      if (token !== 'token') {
        console.error('token is invalid')
      }

      // 监听文件修改，修改的时候将文件发送到client
      createWatcher(cwd, (file: string) => {
        socket.emit('reload', JSON.stringify(file))
      })

      socket.on('recevie', () => {
        console.log('receive from client')
      })
    })
    await next()
  }
}
