/**
 * Generates pwa-192.png and pwa-512.png from public/pb-icon.svg
 * Run: node scripts/gen-icons.mjs
 */
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root      = resolve(__dirname, '..')
const svgPath   = resolve(root, 'public', 'pb-icon.svg')
const svg       = readFileSync(svgPath, 'utf8')

const sizes = [
  { file: 'pwa-192.png', px: 192 },
  { file: 'pwa-512.png', px: 512 },
]

for (const { file, px } of sizes) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: px },
    font:  { loadSystemFonts: true },    // use Windows Georgia/Times if available
  })
  const rendered  = resvg.render()
  const pngBuffer = rendered.asPng()

  const outPath = resolve(root, 'public', file)
  writeFileSync(outPath, pngBuffer)
  console.log(`✓  ${file}  (${px}×${px})  —  ${(pngBuffer.length / 1024).toFixed(1)} KB`)
}

console.log('\nDone. Rebuild the app (npm run build) so Vite re-bundles the new icons.')
