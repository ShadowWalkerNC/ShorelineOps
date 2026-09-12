/**
 * Minimal QR Code encoder — byte mode, error-correction level M, versions 1–9.
 *
 * Dependency-free and self-contained: encodes short ASCII payloads (e.g. the
 * engine's signed tray-card tokens "ticketId:profileVersion:hash") into a
 * scannable module matrix. Auto-selects the smallest version that fits.
 *
 * Implements ISO/IEC 18004 byte-mode encoding: Reed–Solomon error correction
 * over GF(256), standard data placement, all 8 mask patterns with the four
 * penalty rules, and BCH format/version information.
 */

/** Error-correction level M only (2 bits: 00). */
const EC_LEVEL_BITS = 0b00

interface VersionInfo {
  /** Data codewords available for payload. */
  dataCodewords: number
  /** EC codewords per block. */
  ecPerBlock: number
  /** [group1Blocks, group1DataLen, group2Blocks, group2DataLen] */
  groups: [number, number, number, number]
  /** Alignment pattern centers (empty for version 1). */
  alignment: number[]
  /** Remainder bits appended after data. */
  remainderBits: number
}

/** Versions 1–9, EC level M. Data codewords = total − blocks × ecPerBlock. */
const VERSIONS: VersionInfo[] = [
  { dataCodewords: 16,  ecPerBlock: 10, groups: [1, 16, 0, 0],  alignment: [],           remainderBits: 0 },
  { dataCodewords: 28,  ecPerBlock: 16, groups: [1, 28, 0, 0],  alignment: [6, 18],      remainderBits: 7 },
  { dataCodewords: 44,  ecPerBlock: 26, groups: [1, 44, 0, 0],  alignment: [6, 22],      remainderBits: 7 },
  { dataCodewords: 64,  ecPerBlock: 18, groups: [2, 32, 0, 0],  alignment: [6, 26],      remainderBits: 7 },
  { dataCodewords: 86,  ecPerBlock: 24, groups: [2, 43, 0, 0],  alignment: [6, 30],      remainderBits: 7 },
  { dataCodewords: 108, ecPerBlock: 16, groups: [4, 27, 0, 0],  alignment: [6, 34],      remainderBits: 7 },
  { dataCodewords: 124, ecPerBlock: 18, groups: [4, 31, 0, 0],  alignment: [6, 22, 38],  remainderBits: 0 },
  { dataCodewords: 154, ecPerBlock: 22, groups: [2, 38, 2, 39], alignment: [6, 24, 42],  remainderBits: 0 },
  { dataCodewords: 182, ecPerBlock: 22, groups: [3, 36, 2, 37], alignment: [6, 26, 46],  remainderBits: 0 },
]

// ── GF(256) arithmetic (x^8 + x^4 + x^3 + x^2 + 1) ────────────────────────────
const GF_EXP = new Array<number>(512)
const GF_LOG = new Array<number>(256)
;(function initGaloisField() {
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]
})()

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]]
}

// ── Reed–Solomon ─────────────────────────────────────────────────────────────
/** Generator polynomial of the given degree; coefficients high-degree first.
 * g(x) = (x + α^0)(x + α^1)…(x + α^{degree-1}); note subtraction = addition in GF(256). */
function rsGeneratorPolynomial(degree: number): number[] {
  let poly = [1]
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j] // multiply by x
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]) // multiply by α^i
    }
    poly = next
  }
  return poly
}

function rsRemainder(data: number[], degree: number): number[] {
  const gen = rsGeneratorPolynomial(degree)
  const result = [...data, ...new Array<number>(degree).fill(0)]
  for (let i = 0; i < data.length; i++) {
    const factor = result[i]
    if (factor !== 0) {
      for (let j = 1; j <= degree; j++) result[i + j] ^= gfMul(gen[j], factor)
    }
  }
  return result.slice(data.length)
}

// ── Data encoding (byte mode) ────────────────────────────────────────────────
function encodeDataBytes(text: string, version: number): number[] {
  const info = VERSIONS[version - 1]
  const bytes = Array.from(new TextEncoder().encode(text))
  const capacityBits = info.dataCodewords * 8
  if (4 + 8 + bytes.length * 8 > capacityBits) {
    throw new Error(`Payload too long for QR version ${version} (level M)`)
  }

  const bits: number[] = []
  const pushBits = (value: number, count: number) => {
    for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1)
  }
  pushBits(0b0100, 4) // byte mode indicator
  pushBits(bytes.length, 8) // character count (versions 1–9)
  for (const b of bytes) pushBits(b, 8)

  // Terminator (up to 4 zero bits), then pad to a byte boundary.
  const terminator = Math.min(4, capacityBits - bits.length)
  for (let i = 0; i < terminator; i++) bits.push(0)
  while (bits.length % 8 !== 0) bits.push(0)

  const codewords: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let cw = 0
    for (let j = 0; j < 8; j++) cw = (cw << 1) | bits[i + j]
    codewords.push(cw)
  }
  // Pad codewords 0xEC, 0x11 alternating.
  for (let pad = 0xEC; codewords.length < info.dataCodewords; pad ^= 0xEC ^ 0x11) {
    codewords.push(pad)
  }

  // Split into blocks, compute EC per block, then interleave.
  const [g1Count, g1Len, g2Count, g2Len] = info.groups
  const blocks: number[][] = []
  let offset = 0
  for (let i = 0; i < g1Count; i++) { blocks.push(codewords.slice(offset, offset + g1Len)); offset += g1Len }
  for (let i = 0; i < g2Count; i++) { blocks.push(codewords.slice(offset, offset + g2Len)); offset += g2Len }
  const ecBlocks = blocks.map(b => rsRemainder(b, info.ecPerBlock))

  const interleaved: number[] = []
  const maxDataLen = Math.max(g1Len, g2Len)
  for (let i = 0; i < maxDataLen; i++) {
    for (const b of blocks) if (i < b.length) interleaved.push(b[i])
  }
  for (let i = 0; i < info.ecPerBlock; i++) {
    for (const e of ecBlocks) interleaved.push(e[i])
  }
  return interleaved
}

// ── Format / version information (BCH) ──────────────────────────────────────
/** 15-bit format info: 5 data bits → BCH(15,5), XOR mask 0x5412. */
function formatInfoBits(mask: number): number {
  const data = (EC_LEVEL_BITS << 3) | mask
  let bits = data << 10
  const GEN = 0b10100110111
  while (bits >= 0b10000000000) {
    const shift = Math.floor(Math.log2(bits)) - 10
    bits ^= GEN << shift
  }
  return ((data << 10) | bits) ^ 0b101010000010010
}

/** 18-bit version info for versions ≥ 7: BCH(18,6) with generator 0x1F25. */
function versionInfoBits(version: number): number {
  let bits = version << 12
  const GEN = 0b1111100100101
  while (bits >= 0b1000000000000) {
    const shift = Math.floor(Math.log2(bits)) - 12
    bits ^= GEN << shift
  }
  return (version << 12) | bits
}

// ── Matrix construction ──────────────────────────────────────────────────────
function drawFinder(modules: boolean[][], isFunction: boolean[][], x: number, y: number) {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const xx = x + dx
      const yy = y + dy
      if (xx < 0 || yy < 0 || xx >= modules.length || yy >= modules.length) continue
      const dark =
        (dx >= 0 && dx <= 6 && (dy === 0 || dy === 6)) ||
        (dy >= 0 && dy <= 6 && (dx === 0 || dx === 6)) ||
        (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
      modules[yy][xx] = dark
      isFunction[yy][xx] = true
    }
  }
}

function drawAlignment(modules: boolean[][], isFunction: boolean[][], x: number, y: number) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const dark = Math.max(Math.abs(dx), Math.abs(dy)) !== 1
      modules[y + dy][x + dx] = dark
      isFunction[y + dy][x + dx] = true
    }
  }
}

function drawFunctionPatterns(
  modules: boolean[][],
  isFunction: boolean[][],
  version: number,
  alignment: number[],
): void {
  const size = modules.length
  // Timing patterns
  for (let i = 0; i < size; i++) {
    const dark = i % 2 === 0
    if (!isFunction[6][i]) { modules[6][i] = dark; isFunction[6][i] = true }
    if (!isFunction[i][6]) { modules[i][6] = dark; isFunction[i][6] = true }
  }
  // Finder patterns (+ separators)
  drawFinder(modules, isFunction, 0, 0)
  drawFinder(modules, isFunction, size - 7, 0)
  drawFinder(modules, isFunction, 0, size - 7)
  // Alignment patterns (skip overlaps with finders)
  for (const ay of alignment) {
    for (const ax of alignment) {
      const overlapsFinder =
        (ax === 6 && ay === 6) ||
        (ax === 6 && ay === alignment[alignment.length - 1]) ||
        (ax === alignment[alignment.length - 1] && ay === 6)
      if (!overlapsFinder) drawAlignment(modules, isFunction, ax, ay)
    }
  }
  // Reserve format-info areas (both copies + dark module). modules[y][x].
  for (let i = 0; i <= 5; i++) isFunction[8][i] = true
  isFunction[8][7] = true
  isFunction[8][8] = true
  isFunction[7][8] = true
  for (let i = 9; i < 15; i++) isFunction[14 - i][8] = true
  for (let i = 0; i < 7; i++) isFunction[size - 1 - i][8] = true
  for (let i = 7; i < 15; i++) isFunction[8][size - 15 + i] = true
  isFunction[size - 8][8] = true // dark module
  // Reserve version-info areas (versions ≥ 7)
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        isFunction[i][size - 11 + j] = true
        isFunction[size - 11 + j][i] = true
      }
    }
  }
}

function placeDataBits(
  modules: boolean[][],
  isFunction: boolean[][],
  codewords: number[],
  remainderBits: number,
): void {
  const size = modules.length
  const bits: number[] = []
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1)
  for (let i = 0; i < remainderBits; i++) bits.push(0)

  let bitIndex = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5 // vertical timing column carries no data
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vert : vert
        if (!isFunction[y][x] && bitIndex < bits.length) {
          modules[y][x] = bits[bitIndex] === 1
          bitIndex++
        }
      }
    }
  }
}

function maskCondition(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0: return (row + col) % 2 === 0
    case 1: return row % 2 === 0
    case 2: return col % 3 === 0
    case 3: return (row + col) % 3 === 0
    case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0
    case 5: return ((row * col) % 2) + ((row * col) % 3) === 0
    case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0
    default: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0
  }
}

function applyMask(modules: boolean[][], isFunction: boolean[][], mask: number): void {
  const size = modules.length
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isFunction[y][x] && maskCondition(mask, y, x)) modules[y][x] = !modules[y][x]
    }
  }
}

/** Standard four penalty rules; lower is better. */
function maskPenalty(modules: boolean[][]): number {
  const size = modules.length
  let penalty = 0

  // N1: runs of ≥5 same-color modules in rows/columns.
  for (let y = 0; y < size; y++) {
    let runColor = modules[y][0]
    let runLen = 1
    for (let x = 1; x <= size; x++) {
      const c = x < size ? modules[y][x] : !runColor
      if (c === runColor) runLen++
      else {
        if (runLen >= 5) penalty += 3 + (runLen - 5)
        runColor = c
        runLen = 1
      }
    }
  }
  for (let x = 0; x < size; x++) {
    let runColor = modules[0][x]
    let runLen = 1
    for (let y = 1; y <= size; y++) {
      const c = y < size ? modules[y][x] : !runColor
      if (c === runColor) runLen++
      else {
        if (runLen >= 5) penalty += 3 + (runLen - 5)
        runColor = c
        runLen = 1
      }
    }
  }

  // N2: 2×2 blocks of the same color.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = modules[y][x]
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) penalty += 3
    }
  }

  // N3: finder-like patterns 10111010000 / 00001011101 in rows/columns.
  const checkLine = (line: boolean[]) => {
    for (let i = 0; i <= line.length - 11; i++) {
      const seg = line.slice(i, i + 11).map(b => (b ? '1' : '0')).join('')
      if (seg === '10111010000' || seg === '00001011101') penalty += 40
    }
  }
  for (let y = 0; y < size; y++) checkLine(modules[y])
  for (let x = 0; x < size; x++) checkLine(modules.map(row => row[x]))

  // N4: dark-module proportion.
  let dark = 0
  for (const row of modules) for (const b of row) if (b) dark++
  const total = size * size
  penalty += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10

  return penalty
}

function drawFormatInfo(modules: boolean[][], mask: number): void {
  const size = modules.length
  const info = formatInfoBits(mask)
  // Format bits are placed MSB first (bit 14 at position k=0 … bit 0 at k=14).
  const bit = (k: number): boolean => ((info >>> (14 - k)) & 1) === 1
  // Copy 1 snakes around the top-left finder.
  const copy1: Array<[number, number]> = []
  for (let i = 0; i <= 5; i++) copy1.push([8, i])
  copy1.push([8, 7], [8, 8], [7, 8])
  for (let i = 5; i >= 0; i--) copy1.push([i, 8])
  // Copy 2 runs down the left side and across the top-right.
  const copy2: Array<[number, number]> = []
  for (let i = 0; i < 7; i++) copy2.push([size - 1 - i, 8])
  for (let i = 0; i < 8; i++) copy2.push([8, size - 8 + i])
  for (let k = 0; k < 15; k++) {
    const [y1, x1] = copy1[k]
    const [y2, x2] = copy2[k]
    modules[y1][x1] = bit(k)
    modules[y2][x2] = bit(k)
  }
  // Dark module — always dark
  modules[size - 8][8] = true
}

function drawVersionInfo(modules: boolean[][], version: number): void {
  const size = modules.length
  const info = versionInfoBits(version)
  for (let i = 0; i < 18; i++) {
    const bit = ((info >>> i) & 1) === 1
    const x = size - 11 + (i % 3)
    const y = Math.floor(i / 3)
    modules[y][x] = bit
    modules[x][y] = bit
  }
}

// ── Public API ───────────────────────────────────────────────────────────────
export interface QrMatrix {
  /** Modules per side (without quiet zone). */
  size: number
  /** Version used (1–9). */
  version: number
  /** Row-major dark/light modules. */
  modules: boolean[][]
}

/** Encode text as a QR matrix (byte mode, EC level M), auto-selecting version. */
export function encodeQr(text: string): QrMatrix {
  const bytes = new TextEncoder().encode(text).length
  let version = 1
  for (; version <= VERSIONS.length; version++) {
    const cap = VERSIONS[version - 1].dataCodewords
    if (4 + 8 + bytes * 8 <= cap * 8) break
  }
  if (version > VERSIONS.length) throw new Error('Payload too long for QR versions 1–9 (level M)')

  const info = VERSIONS[version - 1]
  const size = version * 4 + 17
  const codewords = encodeDataBytes(text, version)

  let bestPenalty = Infinity
  let bestModules: boolean[][] = []
  for (let mask = 0; mask < 8; mask++) {
    const modules: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
    const isFunction: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
    drawFunctionPatterns(modules, isFunction, version, info.alignment)
    placeDataBits(modules, isFunction, codewords, info.remainderBits)
    applyMask(modules, isFunction, mask)
    drawFormatInfo(modules, mask)
    if (version >= 7) drawVersionInfo(modules, version)
    const penalty = maskPenalty(modules)
    if (penalty < bestPenalty) {
      bestPenalty = penalty
      bestModules = modules
    }
  }
  return { size, version, modules: bestModules }
}

/** Render a QR matrix as a standalone SVG string (includes quiet zone). */
export function qrToSvg(matrix: QrMatrix, pixelSize = 4, quietModules = 4): string {
  const total = matrix.size + quietModules * 2
  const dim = total * pixelSize
  let path = ''
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (matrix.modules[y][x]) {
        const px = (x + quietModules) * pixelSize
        const py = (y + quietModules) * pixelSize
        path += `M${px},${py}h${pixelSize}v${pixelSize}h-${pixelSize}z`
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" ` +
    `width="${dim}" height="${dim}" shape-rendering="crispEdges" role="img" aria-label="Tray card verification QR code">` +
    `<rect width="${dim}" height="${dim}" fill="#ffffff"/>` +
    `<path d="${path}" fill="#0f172a"/></svg>`
  )
}
