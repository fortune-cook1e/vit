import fs from 'fs-extra'

export const rewriteHtml = (htmlPath: string) => {
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8')
  //  console.log({ htmlContent })
  return htmlContent
}
