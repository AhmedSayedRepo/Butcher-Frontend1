// v3.1 follow-up 10 — Code 39 barcode encoder for the printed receipt.
//
// Why hand-rolled rather than a library: this needs ~40 lines and a lookup
// table, and every barcode package on npm pulls in a canvas/DOM abstraction we
// don't need to emit an SVG. Adding a dependency to this backend-light frontend
// for that is a poor trade — especially given this project has already had one
// npm-audit fire drill (nodemailer) over a dependency doing more than we asked.
//
// Why Code 39 rather than Code 128:
//   - Code 39 is *self-checking* — no checksum digit to compute, so there's no
//     silent-corruption failure mode where a wrong check character produces a
//     barcode that scans as the wrong string.
//   - Its alphabet (0-9, A-Z, and a few symbols) exactly covers what
//     `backend/src/lib/receiptCode.ts` generates: 8 uppercase alphanumerics,
//     already stripped of visually ambiguous characters.
//   - Every handheld scanner reads it out of the box; Code 128 sometimes needs
//     enabling.
// The trade is width — Code 39 is roughly 30% wider per character — which is
// affordable for an 8-character code even on a 57mm roll.
//
// Encoding: each character is 9 elements, alternating bar/space, of which
// exactly 3 are wide. `*` delimits both ends. A narrow gap separates characters.

const NARROW = 1
const WIDE = 3
const QUIET_ZONE = 10 // narrow-units of blank margin each side, per the spec

// 'n'/'w' per element, in bar-space-bar-space… order (9 elements, bar first).
const PATTERNS: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw',
  E: 'wnnnwwnnn', F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn',
  I: 'nnwnnwwnn', J: 'nnnnwwwnn', K: 'wnnnnnnww', L: 'nnwnnnnww',
  M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn',
  Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
  U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn', Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn',
  $: 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn'
}

export type BarcodeBar = { x: number, width: number }
export type BarcodeGeometry = { bars: BarcodeBar[], totalWidth: number }

/**
 * Returns the bar rectangles for `value` in narrow-unit coordinates, plus the
 * total width in those units. Returns null if any character can't be encoded —
 * callers should fall back to printing the code as text rather than emitting a
 * barcode that's silently missing characters.
 */
export function encodeCode39(value: string): BarcodeGeometry | null {
  const normalized = value.trim().toUpperCase()
  if (normalized === '') return null

  const chars = ['*', ...normalized.split(''), '*']
  if (chars.some((c) => !(c in PATTERNS))) return null

  const bars: BarcodeBar[] = []
  let x = QUIET_ZONE

  for (const [charIndex, char] of chars.entries()) {
    const pattern = PATTERNS[char]
    if (pattern === undefined) return null
    for (const [i, element] of pattern.split('').entries()) {
      const width = element === 'w' ? WIDE : NARROW
      // Even indices are bars, odd are spaces — only bars get drawn.
      if (i % 2 === 0) bars.push({ x, width })
      x += width
    }
    // Inter-character gap, omitted after the final character.
    if (charIndex < chars.length - 1) x += NARROW
  }

  return { bars, totalWidth: x + QUIET_ZONE }
}
