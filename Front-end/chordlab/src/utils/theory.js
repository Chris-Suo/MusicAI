/**
 * 基礎樂理：音名、調、音階、MIDI ↔ Hz
 * - pitch class（pc）：0 = C、1 = C#／Db … 11 = B
 * - 調（key）：parseKey() 的結果 { tonic: pc, mode: 'major' | 'minor', name: 'F# major', estimated? }
 */

/** 音名 → pitch class（含同音異名） */
export const PITCH_CLASS = {
  C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11,
}
export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const ACCIDENTAL = { 0: '', 1: '#', 2: '##', 11: 'b', 10: 'bb' }
const SCALE_STEPS = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] }

/** 任何整數 → 0～11 */
export const mod12 = (n) => ((n % 12) + 12) % 12

/** 用字母 + 升降記號拼出 pitch class，例如 (5, 'E') → 'E#'；拼不出來回傳 null */
function spell(pc, letter) {
  const acc = ACCIDENTAL[mod12(pc - NATURAL[letter])]
  return acc === undefined ? null : letter + acc
}

const tonicName = (key) => key.name.split(' ')[0]

// ---------------------------------------------------------------------------
// 調
// ---------------------------------------------------------------------------

/**
 * 解析調性字串：'C major'、'F# minor'、'Bb Minor'
 * @returns {{ tonic: number, mode: 'major'|'minor', name: string } | null}
 */
export function parseKey(keyStr) {
  if (!keyStr) return null
  const m = String(keyStr).trim().match(/^([A-Ga-g])([#b♯♭]?)\s*(major|minor|maj|min)?$/i)
  if (!m) return null
  const name = m[1].toUpperCase() + m[2].replace('♯', '#').replace('♭', 'b')
  const tonic = PITCH_CLASS[name]
  if (tonic === undefined) return null
  const mode = /^min/i.test(m[3] ?? 'major') ? 'minor' : 'major'
  return { tonic, mode, name: `${name} ${mode}` }
}

// 調名改成升降記號較少的常見寫法（Ab minor 有 7 個降記號 → G# minor 只有 5 個升記號）
const CONVENTIONAL_TONIC = {
  major: { 'C#': 'Db', 'D#': 'Eb', 'G#': 'Ab', 'A#': 'Bb', Cb: 'B', Fb: 'E', 'E#': 'F', 'B#': 'C' },
  minor: { Ab: 'G#', Db: 'C#', Gb: 'F#', 'A#': 'Bb', Cb: 'B', Fb: 'E', 'E#': 'F', 'B#': 'C' },
}

/** 調名換成常見寫法；音高相同，只改拼法 */
export function conventionalKey(key) {
  if (!key) return key
  const alt = CONVENTIONAL_TONIC[key.mode][tonicName(key)]
  return alt ? { ...key, name: `${alt} ${key.mode}` } : key
}

/** 小調的關係大調（D minor → F major） */
export function relativeMajor(key) {
  const tonic = mod12(key.tonic + 3)
  return conventionalKey({ tonic, mode: 'major', name: `${SHARP_NAMES[tonic]} major` })
}

/** 'F# major' → '升 F 大調'、'Bb minor' → '降 B 小調' */
export function keyNameZh(key) {
  if (!key) return ''
  const tonic = tonicName(key)
  const acc = { '#': '升 ', b: '降 ' }[tonic[1]] ?? ''
  return `${acc}${tonic[0]} ${key.mode === 'major' ? '大調' : '小調'}`
}

/** 調號用降記號的調（F、Bb… 大調；D、G、C… 小調） */
function prefersFlats(key) {
  if (!key) return false
  const tonic = tonicName(key)
  if (tonic.includes('b')) return true
  return key.mode === 'major' ? tonic === 'F' : ['D', 'G', 'C', 'F'].includes(tonic)
}

// ---------------------------------------------------------------------------
// 音階與音名
// ---------------------------------------------------------------------------

/** 調的音階，依字母順序拼寫（F# major → F# G# A# B C# D# E#） */
export function scaleNotes(key) {
  if (!key) return []
  const start = LETTERS.indexOf(tonicName(key)[0])
  return SCALE_STEPS[key.mode].map((s, i) => {
    const pc = mod12(key.tonic + s)
    return spell(pc, LETTERS[(start + i) % 7]) ?? SHARP_NAMES[pc]
  })
}

/** 調內音的 pitch class 集合 */
export function scalePitchClasses(key) {
  if (!key) return new Set()
  return new Set(SCALE_STEPS[key.mode].map((s) => mod12(key.tonic + s)))
}

/** pitch class 在這個調裡的寫法：調內音用音階拼寫，調外音依調號升降；沒有調時用升記號 */
export function noteName(pc, key = null) {
  pc = mod12(pc)
  if (key) {
    const i = SCALE_STEPS[key.mode].findIndex((s) => mod12(key.tonic + s) === pc)
    if (i >= 0) return scaleNotes(key)[i]
  }
  return (prefersFlats(key) ? FLAT_NAMES : SHARP_NAMES)[pc]
}

// ---------------------------------------------------------------------------
// MIDI 與頻率
// ---------------------------------------------------------------------------

export function midiToHz(m) {
  return 440 * 2 ** ((m - 69) / 12)
}

/** MIDI 音高所在的八度（科學音高記號：MIDI 60 = C4） */
export function octaveOf(m) {
  return Math.floor(Math.round(m) / 12) - 1
}

/** MIDI 60 → 'C4'（Cb、B# 的八度跟著字母走：B3 寫成 Cb4、C4 寫成 B#3） */
export function midiToName(m, key = null) {
  const name = noteName(Math.round(m), key)
  let octave = octaveOf(m)
  if (name.startsWith('Cb')) octave += 1
  else if (name.startsWith('B#')) octave -= 1
  return name + octave
}

/**
 * 調音偏差（音分）→ A4 實際頻率
 * BTC test.py 的 a4_hz 用 2 ** (offset / 1200)，但 offset 是半音的比例（不是音分），
 * 算出來幾乎都是 440，所以前端改用音分自己換算
 */
export function a4FromCents(cents) {
  return Number.isFinite(cents) ? 440 * 2 ** (cents / 1200) : null
}

export function fmtHz(hz) {
  return hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${hz < 100 ? hz.toFixed(1) : Math.round(hz)} Hz`
}
