/**
 * 和弦：解析 BTC 和弦標籤、級數（簡譜／羅馬數字）、和聲功能、顯示名稱、占比，
 * 以及沒有調性資料時用和弦推估調性
 *
 * 級數寫法：
 *   - number（簡譜式）：一律以「大調」為基準，小調歌曲換算到關係大調，
 *     所以 A 小調的 Am–F–C–G 會是 6-4-1-5，跟一般流行歌的說法一致。
 *     調外根音寫成 b2、b3、#4、b6、b7。
 *   - roman（羅馬數字）：以實際的調為基準，大寫＝大三和弦、小寫＝小三和弦，
 *     例如小調的 i–VI–III–VII。
 */
import { PITCH_CLASS, SHARP_NAMES, mod12, noteName } from '@/utils/theory.js'

// BTC 的 14 種 quality → 三和弦家族
const FAMILY = {
  maj: 'maj', maj7: 'maj', maj6: 'maj', 7: 'maj', 9: 'maj', maj9: 'maj',
  min: 'min', min7: 'min', min6: 'min', minmaj7: 'min', min9: 'min',
  dim: 'dim', dim7: 'dim', hdim7: 'dim',
  aug: 'aug',
  sus2: 'sus', sus4: 'sus',
}

// 和弦名稱的寫法（'A:min' → 'Am'）
const QUALITY_SUFFIX = {
  maj: '', min: 'm', 7: '7', maj7: 'maj7', min7: 'm7', dim: '°', hdim7: 'ø7', dim7: '°7', aug: '+',
  min6: 'm6', maj6: '6', minmaj7: 'm(maj7)', sus2: 'sus2', sus4: 'sus4', 9: '9', maj9: 'maj9', min9: 'm9',
}

// 大調音階：半音距離 → 簡譜級數、該級的順階三和弦家族
const MAJOR_DEGREES = {
  0: { num: '1', family: 'maj' },
  2: { num: '2', family: 'min' },
  4: { num: '3', family: 'min' },
  5: { num: '4', family: 'maj' },
  7: { num: '5', family: 'maj' },
  9: { num: '6', family: 'min' },
  11: { num: '7', family: 'dim' },
}
const CHROMATIC_NUM = { 1: 'b2', 3: 'b3', 6: '#4', 8: 'b6', 10: 'b7' }

// 羅馬數字的級數名稱（大調／自然小調）
const ROMAN_STEPS = {
  major: { 0: 'I', 1: 'bII', 2: 'II', 3: 'bIII', 4: 'III', 5: 'IV', 6: '#IV', 7: 'V', 8: 'bVI', 9: 'VI', 10: 'bVII', 11: 'VII' },
  minor: { 0: 'I', 1: 'bII', 2: 'II', 3: 'III', 4: '#III', 5: 'IV', 6: '#IV', 7: 'V', 8: 'VI', 9: '#VI', 10: 'VII', 11: '#VII' },
}

// 調式互換（從同主音小調借來的和弦），以大調簡譜表示
const BORROWED = { '1': 'min', '4': 'min', '5': 'min', b3: 'maj', b6: 'maj', b7: 'maj', '2': 'dim', b2: 'maj' }

// 副屬和弦：大三（或屬七）和弦的根音 → 它解決到的級數
const SECONDARY_TARGET = { '2': '5', '3': '6', '6': '2', '7': '3', '1': '4' }

/** 和聲功能：主（T）、下屬（S）、屬（D），以簡譜級數查 */
export const FUNCTION_GROUP = { '1': 'T', '3': 'T', '6': 'T', '2': 'S', '4': 'S', '5': 'D', '7': 'D' }

export const FUNCTION_NAMES = {
  T: '主功能',
  S: '下屬功能',
  D: '屬功能',
  out: '調外和弦',
  none: '無和弦',
}

// ---------------------------------------------------------------------------
// 解析
// ---------------------------------------------------------------------------

/** 'N'（沒有和弦）或 'X'（BTC 認不出來） */
export const isNoChord = (label) => !label || label === 'N' || label === 'X'

/**
 * 解析 BTC 和弦標籤：'C'、'A:min'、'G:7'、'F:maj7'、'C:maj/3'、'N'
 * @returns {{ root: number, family: string, quality: string, label: string } | null}
 */
export function parseChord(label) {
  if (isNoChord(label)) return null
  const [rootStr, rest = ''] = String(label).split(':')
  const root = PITCH_CLASS[rootStr]
  if (root === undefined) return null
  const quality = (rest.split('/')[0] || 'maj').replace(/\(.*\)/, '') || 'maj'
  return { root, family: FAMILY[quality] ?? 'maj', quality, label }
}

/** 'A:min' → 'Am'、'C#:7' → 'C#7'（依調性改寫升降，例如 Bb 大調裡的 A# 寫成 Bb） */
export function prettyChord(label, key = null) {
  const chord = parseChord(label)
  if (!chord) return label === 'X' ? '?' : 'N'
  const root = key ? noteName(chord.root, key) : SHARP_NAMES[chord.root]
  return root + (QUALITY_SUFFIX[chord.quality] ?? ':' + chord.quality)
}

// ---------------------------------------------------------------------------
// 推估調性
// ---------------------------------------------------------------------------

/** 沒有 Essentia 調性時，用和弦時長粗估調性（24 個調逐一評分） */
export function estimateKey(timeline) {
  const chords = timeline.map((t) => ({ c: parseChord(t.chord), dur: t.dur })).filter((x) => x.c)
  if (!chords.length) return null
  const total = chords.reduce((a, x) => a + x.dur, 0)
  const ends = [chords[0].c, chords[chords.length - 1].c]
  let best = null
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ['major', 'minor']) {
      const ref = mode === 'major' ? tonic : mod12(tonic + 3)
      const tonicFamily = mode === 'major' ? 'maj' : 'min'
      let score = 0
      for (const { c, dur } of chords) {
        const deg = MAJOR_DEGREES[mod12(c.root - ref)]
        if (deg && (deg.family === c.family || c.family === 'sus')) {
          score += dur * (c.root === tonic && c.family === tonicFamily ? 1.6 : 1)
        } else {
          score -= dur * 0.6
        }
      }
      // 開頭／結尾落在主和弦：用來分辨關係大小調（C major vs A minor）
      for (const c of ends) if (c.root === tonic && c.family === tonicFamily) score += total * 0.15
      if (!best || score > best.score) best = { tonic, mode, score }
    }
  }
  return { tonic: best.tonic, mode: best.mode, name: `${SHARP_NAMES[best.tonic]} ${best.mode}`, estimated: true }
}

// ---------------------------------------------------------------------------
// 級數
// ---------------------------------------------------------------------------

const numToSemitone = (num) => Number(Object.keys(MAJOR_DEGREES).find((k) => MAJOR_DEGREES[k].num === num))

/** 羅馬數字的級數名稱：小調的導音減和弦寫成 vii°（不是 #vii°） */
function romanStep(key, fromTonic, family) {
  if (key.mode === 'minor' && fromTonic === 11 && family === 'dim') return 'VII'
  return ROMAN_STEPS[key.mode][fromTonic]
}

function formatRoman(step, chord) {
  const m = step.match(/^([b#]?)([IV]+)$/)
  const acc = m ? m[1] : ''
  let base = m ? m[2] : step
  if (chord.family === 'min' || chord.family === 'dim') base = base.toLowerCase()
  let suffix = ''
  if (chord.family === 'dim') suffix = chord.quality === 'hdim7' ? 'ø7' : chord.quality === 'dim7' ? '°7' : '°'
  else if (chord.family === 'aug') suffix = '+'
  else if (chord.quality === '7') suffix = '7'
  else if (chord.quality === 'maj7') suffix = 'maj7'
  else if (chord.quality === 'min7') suffix = '7'
  else if (chord.family === 'sus') suffix = chord.quality
  return acc + base + suffix
}

/** 簡譜級數後面的大小三註記，只在跟順階不同時才加（例如 '3M'、'4m'） */
function degreeSuffix(chord, diatonic) {
  if (diatonic && (diatonic.family === chord.family || chord.family === 'sus')) return ''
  return { maj: 'M', min: 'm', dim: '°', aug: '+', sus: 'sus' }[chord.family] ?? ''
}

/**
 * 把一個和弦換成級數資訊
 * @param {{ root: number, family: string, quality: string }} chord  parseChord() 的結果
 * @param {{ tonic: number, mode: string }} key
 */
export function chordToDegree(chord, key) {
  if (!chord || !key) return null
  // 簡譜一律以大調為基準：小調換算到關係大調（主音 +3 半音）
  const majorRef = key.mode === 'major' ? key.tonic : mod12(key.tonic + 3)
  const fromMajor = mod12(chord.root - majorRef)
  const diatonic = MAJOR_DEGREES[fromMajor]
  const number = diatonic ? diatonic.num : CHROMATIC_NUM[fromMajor]

  // 羅馬數字以實際調為基準
  const fromTonic = mod12(chord.root - key.tonic)
  const roman = formatRoman(romanStep(key, fromTonic, chord.family), chord)

  // 是否為順階和弦、調外和弦的類型
  let kind = 'diatonic'
  let target = null
  const familyOk = diatonic && (diatonic.family === chord.family || chord.family === 'sus')
  if (!familyOk) {
    if (chord.family === 'maj' && SECONDARY_TARGET[number] && (number !== '1' || chord.quality === '7')) {
      kind = 'secondaryDominant'
      target = SECONDARY_TARGET[number]
    } else if (BORROWED[number] === chord.family) {
      kind = 'borrowed'
    } else {
      kind = 'chromatic'
    }
  }

  return {
    number, // '6'、'b7'
    label: number + degreeSuffix(chord, diatonic), // '6'、'3M'、'4m'
    roman, // 'vi'、'V7'、'bVII'
    family: chord.family,
    kind, // 'diatonic' | 'secondaryDominant' | 'borrowed' | 'chromatic'
    // 副屬和弦解決到的級數，例如 V/vi
    secondaryLabel: target
      ? `V/${formatRoman(ROMAN_STEPS.major[numToSemitone(target)], { family: MAJOR_DEGREES[numToSemitone(target)].family, quality: '' })}`
      : null,
  }
}

/**
 * 簡譜級數（以大調為基準，例如 '6'、'b7'、'3M'、'3:maj'）→ 這個調的羅馬數字
 * 小調以實際主音計算：D minor 的 '6'（Dm）→ 'i'、'4'（Bb）→ 'VI'
 * 沒註明大小三的級數用順階的和弦家族；變化音級數預設大三
 */
export function numberToRoman(token, key) {
  const m = String(token).match(/^([b#]?)([1-7]):?(maj|min|dim|aug|M|m|°|\+)?/)
  if (!m || !key) return String(token)
  const base = numToSemitone(m[2])
  const semi = (base + (m[1] === 'b' ? 11 : m[1] === '#' ? 1 : 0)) % 12
  const family = { M: 'maj', m: 'min', '°': 'dim', '+': 'aug' }[m[3]] ?? m[3] ?? (m[1] ? 'maj' : MAJOR_DEGREES[base].family)
  // 簡譜的 1 在小調是主音上方小三度
  const fromTonic = (semi + (key.mode === 'minor' ? 3 : 0)) % 12
  return formatRoman(romanStep(key, fromTonic, family), { family, quality: '' })
}

/** 級數 → 和聲功能：'T' | 'S' | 'D' | 'out'（調外）| 'none'（無和弦） */
export function functionOf(degree) {
  if (!degree) return 'none'
  if (degree.kind !== 'diatonic') return 'out'
  return FUNCTION_GROUP[degree.number] ?? 'out'
}

// ---------------------------------------------------------------------------
// 整首歌
// ---------------------------------------------------------------------------

/**
 * 一次算好時間軸上每種和弦的資訊（顯示名稱、級數、和聲功能）
 * @returns {Map<string, { name: string, degree: object|null, fn: string, fnName: string }>}
 */
export function buildChordInfo(timeline, key) {
  const map = new Map()
  for (const { chord } of timeline) {
    if (map.has(chord)) continue
    const degree = chordToDegree(parseChord(chord), key)
    const fn = functionOf(degree)
    map.set(chord, { name: prettyChord(chord, key), degree, fn, fnName: FUNCTION_NAMES[fn] })
  }
  return map
}

/**
 * 依出現時間算占比
 * @returns {{ byFunction: Record<'T'|'S'|'D'|'out'|'none', number>, byChord: { chord: string, share: number }[] }}
 *   byChord 由多到少、不含無和弦
 */
export function chordShares(timeline, chordInfo) {
  const total = timeline.reduce((s, c) => s + c.dur, 0)
  const share = (dur) => (total ? dur / total : 0)
  const byFunction = { T: 0, S: 0, D: 0, out: 0, none: 0 }
  const byChord = new Map()
  for (const c of timeline) {
    byFunction[chordInfo.get(c.chord)?.fn ?? 'none'] += c.dur
    if (!isNoChord(c.chord)) byChord.set(c.chord, (byChord.get(c.chord) ?? 0) + c.dur)
  }
  for (const fn in byFunction) byFunction[fn] = share(byFunction[fn])
  return {
    byFunction,
    byChord: [...byChord].map(([chord, dur]) => ({ chord, share: share(dur) })).sort((a, b) => b.share - a.share),
  }
}
