import chokidar from 'chokidar'
import chalk from 'chalk'
import path from 'path'

interface Notification {
  filePath: string
}

export const createWatcher = (cwd: string, notify: (file: string) => void) => {
  const watcher = chokidar.watch(cwd, {
    ignored: [/node_modules/]
  })

  watcher.on('change', async file => {
    const resourcePath = '/' + path.relative(cwd, file)
    console.log({ resourcePath })
    console.log(chalk.blue(`${file} has changed!`))
    notify(resourcePath)
  })
  return
}
