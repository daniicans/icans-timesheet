#!/usr/bin/env node
// Generates PWA icons as PNG files using Canvas API (node-canvas)
// Run: node scripts/gen-icons.js
// If you don't have node-canvas, the SVG fallback icons will work for most browsers.

import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/icons')
mkdirSync(outDir, { recursive: true })

function drawIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const r = size * 0.18 // border radius ratio

  // Navy background
  ctx.fillStyle = '#1e2a4a'
  roundRect(ctx, 0, 0, size, size, r)
  ctx.fill()

  // Green "i"
  ctx.fillStyle = '#22c55e'
  ctx.font = `800 ${size * 0.58}px "Arial Black", Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('i', size / 2, size * 0.54)

  return canvas.toBuffer('image/png')
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

for (const size of [192, 512]) {
  const buf = drawIcon(size)
  writeFileSync(join(outDir, `icon-${size}.png`), buf)
  console.log(`✓ icon-${size}.png`)
}
console.log('Icons generated!')
