/**
 * Copies Windows Desktop shortcut artifacts into dist/ on build.
 */
import { copyFileSync, mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const scripts = join(root, 'scripts')

mkdirSync(dist, { recursive: true })

const urlContents = `[InternetShortcut]
URL=http://127.0.0.1:5173/
`

writeFileSync(join(dist, 'Agent-Console.url'), urlContents, 'utf8')
writeFileSync(join(scripts, 'Agent-Console.url'), urlContents, 'utf8')
writeFileSync(join(scripts, 'Agent Console.url'), urlContents, 'utf8')

for (const name of [
  'install-desktop-shortcut.ps1',
  'create-desktop-shortcut.ps1',
]) {
  const src = join(scripts, name)
  if (existsSync(src)) copyFileSync(src, join(dist, name))
}

console.log('Windows shortcut artifacts:', readdirSync(dist).filter((f) =>
  f.endsWith('.url') || f.endsWith('.ps1'),
))
