declare var io: any

const socket = io({
  auth: {
    token: 'token'
  }
})

socket.on('connect', () => {
  console.log('socket.in connected')
  socket.emit('recevie')
})

socket.on('reload', (file: string) => {
  location.reload()
})
