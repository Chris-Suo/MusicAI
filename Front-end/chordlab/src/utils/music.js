/**
 * 樂理小工具：音名拼寫、和弦組成音、和聲功能、MIDI ↔ Hz、速度術語
 * 調性解析與級數計算沿用 progression.js（parseKey / parseChord / chordToDegree）
 */
import { parseChord, chordToDegree, FUNCTION_GROUP } from '@/utils/progression.js'

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const ACCIDENTAL = { 0: '', 1: '#', 2: '##', 11: 'b', 10: 'bb' }

export const FUNCTION_NAMES = {
  T: '主功能',
  S: '下屬功能',
  D: '屬功能',
  out: '調外和弦',
  none: '無和弦',
}

// ---------------------------------------------------------------------------
// 音名拼寫
// ---------------------------------------------------------------------------

/** 用字母 + 升降記號拼出 pitch class，例如 (pc 5, 'E') → 'E#' */
function spell(pc, letter) {
  const acc = ACCIDENTAL[(pc - NATURAL[letter] + 12) % 12]
  return acc === undefined ? null : letter + acc
}

// 調名改成升降記號較少的常見寫法（Ab minor 有 7 個降記號 → G# minor 只有 5 個升記號）
const CONVENTIONAL_TONIC = {
  major: { 'C#': 'Db', 'D#': 'Eb', 'G#': 'Ab', 'A#': 'Bb', Cb: 'B', Fb: 'E', 'E#': 'F', 'B#': 'C' },
  minor: { Ab: 'G#', Db: 'C#', Gb: 'F#', 'A#': 'Bb', Cb: 'B', Fb: 'E', 'E#': 'F', 'B#': 'C' },
}

/** parseKey() 的結果換成常見寫法；音高相同，只改拼法 */
export function conventionalKey(key) {
  if (!key) return key
  const alt = CONVENTIONAL_TONIC[key.mode][key.name.split(' ')[0]]
  return alt ? { ...key, name: `${alt} ${key.mode}` } : key
}

/** 'F# major' → '升 F 大調'、'Bb minor' → '降 B 小調' */
export function keyNameZh(key) {
  if (!key) return ''
  const tonic = key.name.split(' ')[0]
  const acc = { '#': '升 ', b: '降 ' }[tonic[1]] ?? ''
  return `${acc}${tonic[0]} ${key.mode === 'major' ? '大調' : '小調'}`
}

/** 調號用降記號的調（F、Bb… 大調；D、G、C… 小調） */
export function prefersFlats(key) {
  if (!key) return false
  const tonicName = key.name.split(' ')[0]
  if (tonicName.includes('b')) return true
  return key.mode === 'major' ? tonicName === 'F' : ['D', 'G', 'C', 'F'].includes(tonicName)
}

/**
 * 調的音階，依字母順序拼寫（F# major → F# G# A# B C# D# E#）
 * @returns {string[]} 7 個音名
 */
export function scaleNotes(key) {
  if (!key) return []
  const tonicName = key.name.split(' ')[0]
  const start = LETTERS.indexOf(tonicName[0])
  const steps = key.mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10]
  return steps.map((s, i) => spell((key.tonic + s) % 12, LETTERS[(start + i) % 7]) ?? SHARP_NAMES[(key.tonic + s) % 12])
}

/** pitch class 在這個調裡的寫法：調內音用音階拼寫，調外音依調號升降 */
export function noteName(pc, key) {
  pc = ((pc % 12) + 12) % 12
  if (key) {
    const steps = key.mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10]
    const i = steps.findIndex((s) => (key.tonic + s) % 12 === pc)
    if (i >= 0) return scaleNotes(key)[i]
  }
  return (prefersFlats(key) ? FLAT_NAMES : SHARP_NAMES)[pc]
}

/** 調內音的 pitch class 集合 */
export function scalePitchClasses(key) {
  if (!key) return new Set()
  const steps = key.mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10]
  return new Set(steps.map((s) => (key.tonic + s) % 12))
}

/** 簡譜級數（以大調為基準，小調換算到關係大調，與和弦級數一致）；調外音回傳 null */
export function scaleDegreeOf(pc, key) {
  if (!key) return null
  const majorRef = key.mode === 'major' ? key.tonic : (key.tonic + 3) % 12
  const map = { 0: '1', 2: '2', 4: '3', 5: '4', 7: '5', 9: '6', 11: '7' }
  return map[(pc - majorRef + 12) % 12] ?? null
}

// ---------------------------------------------------------------------------
// 和弦
// ---------------------------------------------------------------------------

// 和弦品質 → [半音, 字母距離]
const QUALITY_TONES = {
  maj: [[0, 0], [4, 2], [7, 4]],
  min: [[0, 0], [3, 2], [7, 4]],
  dim: [[0, 0], [3, 2], [6, 4]],
  aug: [[0, 0], [4, 2], [8, 4]],
  sus2: [[0, 0], [2, 1], [7, 4]],
  sus4: [[0, 0], [5, 3], [7, 4]],
}
const SEVENTHS = {
  7: ['maj', [10, 6]],
  maj7: ['maj', [11, 6]],
  min7: ['min', [10, 6]],
  minmaj7: ['min', [11, 6]],
  hdim7: ['dim', [10, 6]],
  dim7: ['dim', [9, 6]],
  maj6: ['maj', [9, 5]],
  min6: ['min', [9, 5]],
  9: ['maj', [10, 6], [2, 1]],
  maj9: ['maj', [11, 6], [2, 1]],
  min9: ['min', [10, 6], [2, 1]],
}

const QUALITY_SUFFIX = {
  maj: '', min: 'm', 7: '7', maj7: 'maj7', min7: 'm7', dim: '°', hdim7: 'ø7', dim7: '°7', aug: '+',
  min6: 'm6', maj6: '6', minmaj7: 'm(maj7)', sus2: 'sus2', sus4: 'sus4', 9: '9', maj9: 'maj9', min9: 'm9',
}

function rootName(chord, key) {
  return key ? noteName(chord.root, key) : SHARP_NAMES[chord.root]
}

/** 'A:min' → 'Am'、'C#:7' → 'C#7'（依調性改寫升降，例如 Bb 大調裡的 A# 寫成 Bb） */
export function prettyChord(label, key = null) {
  const chord = parseChord(label)
  if (!chord) return label === 'X' ? '?' : 'N'
  const suffix = QUALITY_SUFFIX[chord.quality] ?? ':' + chord.quality
  return rootName(chord, key) + suffix
}

/** 和弦組成音，依字母順序拼寫（C#7 → C# E# G# B） */
export function chordTones(label, key = null) {
  const chord = parseChord(label)
  if (!chord) return []
  const root = rootName(chord, key)
  const letter = LETTERS.indexOf(root[0])
  let tones = QUALITY_TONES[chord.quality]
  if (!tones && SEVENTHS[chord.quality]) {
    const [base, ...extra] = SEVENTHS[chord.quality]
    tones = [...QUALITY_TONES[base], ...extra]
  }
  tones = tones ?? QUALITY_TONES[chord.family] ?? QUALITY_TONES.maj
  return tones.map(([semi, steps]) => {
    const pc = (chord.root + semi) % 12
    return spell(pc, LETTERS[(letter + steps) % 7]) ?? SHARP_NAMES[pc]
  })
}

/**
 * 和弦在調裡的功能與級數
 * @returns {{ fn: 'T'|'S'|'D'|'out'|'none', degree: object|null }}
 */
export function chordFunction(label, key) {
  const chord = parseChord(label)
  if (!chord || !key) return { fn: 'none', degree: null }
  const degree = chordToDegree(chord, key)
  if (!degree) return { fn: 'none', degree: null }
  const fn = degree.kind === 'diatonic' ? (FUNCTION_GROUP[degree.number] ?? 'out') : 'out'
  return { fn, degree }
}

/**
 * 一次算好時間軸上每種和弦的資訊（顯示名稱、功能、級數、組成音）
 * @returns {Map<string, { label, name, fn, fnName, degree, tones }>}
 */
export function buildChordInfo(timeline, key) {
  const map = new Map()
  for (const { chord } of timeline) {
    if (map.has(chord)) continue
    const { fn, degree } = chordFunction(chord, key)
    map.set(chord, {
      label: chord,
      name: prettyChord(chord, key),
      fn,
      fnName: FUNCTION_NAMES[fn],
      degree,
      tones: chordTones(chord, key),
    })
  }
  return map
}

// ---------------------------------------------------------------------------
// 音高
// ---------------------------------------------------------------------------

export function midiToHz(m) {
  return 440 * 2 ** ((m - 69) / 12)
}

/**
 * 調音偏差（音分）→ A4 實際頻率
 * BTC test.py 的 a4_hz 用 2 ** (offset / 1200)，但 offset 是半音的比例（不是音分），
 * 算出來幾乎都是 440，所以前端改用音分自己換算
 */
export function a4FromCents(cents) {
  return Number.isFinite(cents) ? 440 * 2 ** (cents / 1200) : null
}

/** MIDI 60 → 'C4'（Cb、B# 的八度跟著字母走：B3 寫成 Cb4、C4 寫成 B#3） */
export function midiToName(m, key = null) {
  const r = Math.round(m)
  const name = noteName(r, key)
  let octave = Math.floor(r / 12) - 1
  if (name.startsWith('Cb')) octave += 1
  else if (name.startsWith('B#')) octave -= 1
  return name + octave
}

export function fmtHz(hz) {
  return hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${hz < 100 ? hz.toFixed(1) : Math.round(hz)} Hz`
}

// ---------------------------------------------------------------------------
// 速度
// ---------------------------------------------------------------------------

const TEMPO_TERMS = [
  [40, 'Grave', '極緩板'],
  [60, 'Largo', '廣板'],
  [66, 'Larghetto', '小廣板'],
  [76, 'Adagio', '慢板'],
  [108, 'Andante', '行板'],
  [120, 'Moderato', '中板'],
  [168, 'Allegro', '快板'],
  [200, 'Presto', '急板'],
  [Infinity, 'Prestissimo', '最急板'],
]

/** 90 BPM → { it: 'Andante', zh: '行板' } */
export function tempoTerm(bpm) {
  if (!bpm) return null
  const [, it, zh] = TEMPO_TERMS.find(([max]) => bpm < max)
  return { it, zh }
}

// ---------------------------------------------------------------------------
// 響度
// ---------------------------------------------------------------------------

export const STREAMING_LUFS = -14

/** 整體響度（LUFS）的白話描述 */
export function loudnessLevel(lufs) {
  if (!Number.isFinite(lufs)) return null
  if (lufs >= -10) return '很大聲'
  if (lufs >= -13) return '偏大聲'
  if (lufs >= -15) return '接近串流標準'
  if (lufs >= -20) return '適中'
  if (lufs >= -26) return '偏小聲'
  return '很小聲'
}
