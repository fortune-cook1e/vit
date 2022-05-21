const socket = new WebSocket(`ws://${location.host}`)

console.log('[vit] connecting...')

socket.addEventListener('message', ({ data }) => {
  const { type, path, timestamp } = JSON.parse(data)

  switch (type) {
    // JS 更新
    case 'js-update':
      const update = jsUpdateMap.get(path)
      if (update) {
        update(timestamp)
        console.log(`[vit]:js module reloaded`, path)
      }
      break
    case 'full-reload':
      location.reload()
  }
})

// ping server
socket.addEventListener('close', () => {
  console.log(`[vit] server connection lost. polling for restart...`)
  setInterval(() => {
    new WebSocket(`ws://${location.host}`).addEventListener('open', () => {
      location.reload()
    })
  }, 1000)
})

const jsUpdateMap = new Map<string, (timestamp: number) => void>()

export const hot = {
  accept(
    importer: string,
    deps: string | string[],
    callback: (module: object | object[]) => void
  ) {
    jsUpdateMap.set(importer, (timestamp: number) => {
      if (Array.isArray(deps)) {
        Promise.all(deps.map(dep => import(dep + `?t=${timestamp}`))).then(
          callback
        )
      } else {
        import(deps + `?t=${timestamp}`).then(callback)
      }
    })
  }
}
