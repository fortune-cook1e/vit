import { sayHello } from './other.js'
import { hot } from '/@hmr'

sayHello()

hot.accept('./other.js', ({ sayHello }) => {
  sayHello()
})
