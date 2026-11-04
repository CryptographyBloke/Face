/**
 * Deterministic 5×5 mirrored identicon for wallets without an avatar.
 * Output is a self-contained SVG with no user-controlled text.
 */
export function identiconSvg(seed: string, size = 256) {
  const bytes = fnvBytes(seed.toLowerCase(), 32)
  const hue = Math.round((bytes[0] / 255) * 360)
  const fg = `hsl(${hue} 65% 52%)`
  const bg = `hsl(${(hue + 180) % 360} 35% 94%)`
  const cell = 100 / 5

  const rects: string[] = []
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if (bytes[1 + row * 3 + col] % 2 === 0) continue
      const x = col * cell
      const mirror = (4 - col) * cell
      const y = row * cell
      rects.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}"/>`)
      if (col < 2) rects.push(`<rect x="${mirror}" y="${y}" width="${cell}" height="${cell}"/>`)
    }
  }

  const px = Math.max(16, Math.min(1024, Math.round(size)))
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="-10 -10 120 120">` +
    `<rect x="-10" y="-10" width="120" height="120" fill="${bg}"/>` +
    `<g fill="${fg}">${rects.join('')}</g></svg>`
  )
}

/** Small non-cryptographic byte stream (FNV-1a + xorshift) for visual seeding. */
function fnvBytes(input: string, length: number) {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  const out = new Uint8Array(length)
  let state = hash || 1
  for (let i = 0; i < length; i++) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    out[i] = state & 0xff
  }
  return out
}
