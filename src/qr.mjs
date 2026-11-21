/**
 * QR codes for the pairing link. Uses the small MIT-licensed generator in vendor/ (see THIRD-PARTY.md).
 * The link is short (about 70 characters), so a medium error-correction level keeps the code easy to scan.
 */

import qrcode from './vendor/qrcode.mjs'

/** The dark/light squares of the code as an array of rows of booleans. */
export function qrModules(text, level = 'M') {
  const q = qrcode(0, level)
  q.addData(String(text))
  q.make()
  const n = q.getModuleCount()
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)))
}

/** An SVG picture of the code with a quiet border, so any camera can read it. */
export function qrToSvg(text, { border = 4, color = '#000', background = '#fff' } = {}) {
  const m = qrModules(text)
  const size = m.length + border * 2
  const cells = []
  for (let r = 0; r < m.length; r++) {
    // One rectangle per run of dark squares keeps the file small.
    let c = 0
    while (c < m.length) {
      if (!m[r][c]) {
        c++
        continue
      }
      const start = c
      while (c < m.length && m[r][c]) c++
      cells.push(`M${start + border} ${r + border}h${c - start}v1h-${c - start}z`)
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${background}"/><path d="${cells.join('')}" fill="${color}"/></svg>`
}

/**
 * The code drawn with block characters for the console: two rows of squares per line of text.
 * Drawn as black on white (dark squares are spaces on a white background) so phones read it
 * the right way round on a dark console too.
 */
export function qrToConsole(text, { border = 2 } = {}) {
  const m = qrModules(text)
  const size = m.length + border * 2
  const at = (r, c) => {
    const rr = r - border
    const cc = c - border
    return rr >= 0 && cc >= 0 && rr < m.length && cc < m.length && m[rr][cc]
  }
  const lines = []
  for (let r = 0; r < size; r += 2) {
    let line = ''
    for (let c = 0; c < size; c++) {
      const top = at(r, c)
      const bottom = at(r + 1, c)
      // White background: a character is "lit" where the square is LIGHT.
      line += !top && !bottom ? '█' : !top && bottom ? '▀' : top && !bottom ? '▄' : ' '
    }
    lines.push(line)
  }
  return lines.join('\n')
}
