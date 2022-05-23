const map = new Map()

function set(key) {
  let entry = map.get(key)
  if (!entry) {
    entry = new Set()
    map.set(key, entry)
  }
  return entry
}

const key = '/main.js'

const result = set(key)
console.log(result)
