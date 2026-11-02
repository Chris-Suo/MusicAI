/**
 * 和弦進行分析
 * ============================================================================
 * 把 BTC 的和弦時間軸 + Essentia 的調性與拍點，轉成「每小節一個和弦」的級數序列，
 * 再找出常見的和弦進行（1-5-6-4、6-4-5-1…）與這首歌自己反覆出現的循環。
 *
 * 用法：
 *   import { analyzeProgression } from '@/utils/progression.js'
 *   const result = analyzeProgression({
 *     timeline: data.BTC.timeline,          // [{ chord: 'A:min', start, dur }]
 *     key:      data.Essentia.essentia.Key, // 'C major'（可省略，會用和弦推估）
 *     beats:    data.Essentia.essentia.Beats, // [0.41, 1.03, ...]（可省略，改用換和弦點切分）
 *   })
 *
 * 級數寫法：
 *   - number（簡譜式）：一律以「大調」為基準，小調歌曲換算到關係大調，
 *     所以 A 小調的 Am–F–C–G 會是 6-4-1-5，跟一般流行歌的說法一致。
 *     調外根音寫成 b2、b3、#4、b6、b7。
 *   - roman（羅馬數字）：以實際的調為基準，大寫＝大三和弦、小寫＝小三和弦，
 *     例如小調的 i–VI–III–VII。
 *
 * 限制：
 *   - 小節切分假設 beatsPerBar 拍一小節（預設 4/4），並從第一個拍點開始算；
 *     有弱起拍的歌曲小節會整個偏移。
 *   - 結果品質取決於 BTC 和弦辨識、Essentia 調性與拍點的準確度。
 */

// ---------------------------------------------------------------------------
// 基本表
// ---------------------------------------------------------------------------
const PITCH = {
  C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11,
}
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// BTC 的 14 種 quality → 三和弦家族
const FAMILY = {
  maj: 'maj', maj7: 'maj', maj6: 'maj', 7: 'maj', 9: 'maj', maj9: 'maj',
  min: 'min', min7: 'min', min6: 'min', minmaj7: 'min', min9: 'min',
  dim: 'dim', dim7: 'dim', hdim7: 'dim',
  aug: 'aug',
  sus2: 'sus', sus4: 'sus',
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

/**
 * 常見和弦進行字典（以大調簡譜表示）
 * token 可以只寫級數（'6'，不管大小三），或加上和弦家族（'3:maj' 表示必須是大三／屬七）
 */
export const KNOWN_PROGRESSIONS = [
  { id: 'canon', name: '卡農進行', nameEn: 'Canon progression', degrees: ['1', '5', '6', '3', '4', '1', '4', '5'] },
  { id: 'axis', name: '四和弦循環', nameEn: 'I–V–vi–IV (Axis)', degrees: ['1', '5', '6', '4'] },
  { id: 'axis-minor', name: '四和弦循環（小調起）', nameEn: 'vi–IV–I–V', degrees: ['6', '4', '1', '5'] },
  { id: 'fifties', name: '50 年代進行', nameEn: "'50s progression", degrees: ['1', '6', '4', '5'] },
  { id: 'komuro', name: '小室進行', nameEn: 'Komuro progression', degrees: ['6', '4', '5', '1'] },
  { id: 'royal-road', name: '王道進行', nameEn: 'Royal road progression', degrees: ['4', '5', '3', '6'] },
  { id: 'marusa', name: '丸サ進行', nameEn: 'Just the Two of Us progression', degrees: ['4', '3:maj', '6'] },
  { id: 'circle', name: '六二五一', nameEn: 'vi–ii–V–I', degrees: ['6', '2', '5', '1'] },
  { id: 'doo-wop-2', name: '一六二五', nameEn: 'I–vi–ii–V', degrees: ['1', '6', '2', '5'] },
  { id: 'blues-cadence', name: '一四五一', nameEn: 'I–IV–V–I', degrees: ['1', '4', '5', '1'] },
  { id: 'two-five-one', name: '二五一', nameEn: 'ii–V–I', degrees: ['2', '5', '1'] },
]

// ---------------------------------------------------------------------------
// 解析
// ---------------------------------------------------------------------------

/**
 * 解析 BTC 和弦標籤：'C'、'A:min'、'G:7'、'F:maj7'、'C:maj/3'、'N'
 * @returns {{ root: number, family: string, quality: string, label: string } | null}
 */
export function parseChord(label) {
  if (!label || label === 'N' || label === 'X') return null
  const [rootStr, rest = ''] = String(label).split(':')
  const root = PITCH[rootStr]
  if (root === undefined) return null
  const quality = (rest.split('/')[0] || 'maj').replace(/\(.*\)/, '') || 'maj'
  return { root, family: FAMILY[quality] ?? 'maj', quality, label }
}

/**
 * 解析調性字串：'C major'、'F# minor'、'Bb Minor'
 * @returns {{ tonic: number, mode: 'major'|'minor', name: string } | null}
 */
export function parseKey(keyStr) {
  if (!keyStr) return null
  const m = String(keyStr).trim().match(/^([A-Ga-g])([#b♯♭]?)\s*(major|minor|maj|min)?$/i)
  if (!m) return null
  const name = m[1].toUpperCase() + m[2].replace('♯', '#').replace('♭', 'b')
  const tonic = PITCH[name]
  if (tonic === undefined) return null
  const mode = /^min/i.test(m[3] ?? 'major') ? 'minor' : 'major'
  return { tonic, mode, name: `${name} ${mode}` }
}

/**
 * 沒有 Essentia 調性時，用和弦時長粗估調性（24 個調逐一評分）
 */
export function estimateKey(timeline) {
  const chords = timeline.map((t) => ({ c: parseChord(t.chord), dur: t.dur })).filter((x) => x.c)
  if (!chords.length) return null
  const total = chords.reduce((a, x) => a + x.dur, 0)
  const ends = [chords[0].c, chords[chords.length - 1].c]
  let best = null
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ['major', 'minor']) {
      const ref = mode === 'major' ? tonic : (tonic + 3) % 12
      const tonicFamily = mode === 'major' ? 'maj' : 'min'
      let score = 0
      for (const { c, dur } of chords) {
        const deg = MAJOR_DEGREES[(c.root - ref + 12) % 12]
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

/**
 * 把一個和弦換成級數資訊
 * @param {{root:number,family:string,quality:string}} chord
 * @param {{tonic:number,mode:string}} key
 */
export function chordToDegree(chord, key) {
  if (!chord || !key) return null
  // 簡譜一律以大調為基準：小調換算到關係大調（主音 +3 半音）
  const majorRef = key.mode === 'major' ? key.tonic : (key.tonic + 3) % 12
  const fromMajor = (chord.root - majorRef + 12) % 12
  const diatonic = MAJOR_DEGREES[fromMajor]
  const number = diatonic ? diatonic.num : CHROMATIC_NUM[fromMajor]

  // 羅馬數字以實際調為基準
  const fromTonic = (chord.root - key.tonic + 12) % 12
  let step = ROMAN_STEPS[key.mode][fromTonic]
  if (key.mode === 'minor' && fromTonic === 11 && chord.family === 'dim') step = 'VII' // 導音減和弦 vii°
  const roman = formatRoman(step, chord)

  // 是否為順階和弦、調外和弦的類型
  let kind = 'diatonic'
  let target = null
  const familyOk = diatonic && (diatonic.family === chord.family || chord.family === 'sus')
  if (!familyOk) {
    if (chord.family === 'maj' && SECONDARY_TARGET[number] &&
        (number !== '1' || chord.quality === '7')) {
      kind = 'secondaryDominant'
      target = SECONDARY_TARGET[number]
    } else if (BORROWED[number] === chord.family) {
      kind = 'borrowed'
    } else {
      kind = 'chromatic'
    }
  }

  return {
    number,                                      // '6'、'b7'
    label: number + suffixFor(chord, diatonic),  // '6m' 只在跟順階不同時才加註，例如 '3M'、'4m'
    roman,                                       // 'vi'、'V7'、'bVII'
    family: chord.family,
    kind,                                        // 'diatonic' | 'secondaryDominant' | 'borrowed' | 'chromatic'
    target,                                      // 副屬和弦解決到的級數，例如 '6'（V/vi）
    secondaryLabel: target ? `V/${formatRoman(romanStepOfNumber(target), { family: MAJOR_DEGREES[numToSemitone(target)].family, quality: '' })}` : null,
  }
}

function suffixFor(chord, diatonic) {
  if (diatonic && (diatonic.family === chord.family || chord.family === 'sus')) return ''
  return { maj: 'M', min: 'm', dim: '°', aug: '+', sus: 'sus' }[chord.family] ?? ''
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
  let step = ROMAN_STEPS[key.mode][fromTonic]
  if (key.mode === 'minor' && fromTonic === 11 && family === 'dim') step = 'VII'
  return formatRoman(step, { family, quality: '' })
}

function numToSemitone(num) {
  return Number(Object.keys(MAJOR_DEGREES).find((k) => MAJOR_DEGREES[k].num === num))
}
function romanStepOfNumber(num) {
  return ROMAN_STEPS.major[numToSemitone(num)]
}

// ---------------------------------------------------------------------------
// 前處理與小節切分
// ---------------------------------------------------------------------------

function median(arr) {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * 合併連續相同和弦，太短的片段併進前一段（BTC 換和弦時常會抖一下）
 */
export function cleanTimeline(timeline, minDur = 0.25) {
  const merged = []
  for (const t of timeline) {
    const last = merged[merged.length - 1]
    if (last && last.chord === t.chord) {
      last.dur = +(t.start + t.dur - last.start).toFixed(3)
    } else {
      merged.push({ chord: t.chord, start: t.start, dur: t.dur })
    }
  }
  const out = []
  for (const seg of merged) {
    const last = out[out.length - 1]
    if (seg.dur < minDur && last) {
      last.dur = +(seg.start + seg.dur - last.start).toFixed(3)
    } else if (last && last.chord === seg.chord) {
      last.dur = +(seg.start + seg.dur - last.start).toFixed(3)
    } else {
      out.push({ ...seg })
    }
  }
  return out
}

/**
 * 依拍點切出小節（或半小節）邊界；沒有拍點時回傳 null
 */
function barBoundaries(beats, beatsPerUnit) {
  const b = (Array.isArray(beats) ? beats : []).filter(Number.isFinite).sort((x, y) => x - y)
  if (b.length < beatsPerUnit + 1) return null
  const beatLen = median(b.slice(1).map((t, i) => t - b[i]))
  const bounds = []
  for (let i = 0; i < b.length; i += beatsPerUnit) bounds.push(b[i])
  const last = bounds[bounds.length - 1]
  const lastIdx = (bounds.length - 1) * beatsPerUnit
  const remaining = b.length - 1 - lastIdx
  bounds.push(remaining > 0 ? b[b.length - 1] + beatLen : last + beatLen * beatsPerUnit)
  return { bounds, beatLen }
}

/**
 * 每個單位（小節）取重疊時間最長的和弦
 */
function assignChords(segments, bounds) {
  const units = []
  let si = 0
  for (let i = 0; i < bounds.length - 1; i++) {
    const start = bounds[i]
    const end = bounds[i + 1]
    const overlap = {}
    while (si < segments.length && segments[si].start + segments[si].dur <= start) si++
    for (let j = si; j < segments.length && segments[j].start < end; j++) {
      const s = segments[j]
      const o = Math.min(end, s.start + s.dur) - Math.max(start, s.start)
      if (o > 0) overlap[s.chord] = (overlap[s.chord] ?? 0) + o
    }
    const ranked = Object.entries(overlap).sort((a, b) => b[1] - a[1])
    const len = end - start
    const [chord, dur] = ranked[0] ?? ['N', len]
    const second = ranked[1] && ranked[1][1] / len >= 0.35 ? ranked[1][0] : null
    units.push({ index: i, start: +start.toFixed(3), end: +end.toFixed(3), chord, ratio: +(dur / len).toFixed(2), alt: second })
  }
  return units
}

// ---------------------------------------------------------------------------
// 進行比對
// ---------------------------------------------------------------------------

// 和聲功能：主（T）、下屬（S）、屬（D）
export const FUNCTION_GROUP = { '1': 'T', '3': 'T', '6': 'T', '2': 'S', '4': 'S', '5': 'D', '7': 'D' }

// 模糊比對時，不同的那個和弦必須跟原本的和弦屬於同一個功能（例如 6 被辨識成 3）
function similarFunction(token, deg) {
  if (!deg) return false
  const want = FUNCTION_GROUP[token.split(':')[0]]
  return !!want && FUNCTION_GROUP[deg.number] === want
}

function tokenMatches(token, deg) {
  if (!deg) return false
  const [num, fam] = token.split(':')
  if (deg.number !== num) return false
  return !fam || deg.family === fam
}

/**
 * 在和弦變換序列（runs）上比對字典
 * 4 個和弦以上的進行允許 1 個和弦不同（標示為 exact: false），
 * 但不同的和弦必須是同功能的代理和弦（例如 vi ↔ iii），且不能是第一個或最後一個
 */
function findKnown(runs, dictionary) {
  const candidates = []
  for (const p of dictionary) {
    const n = p.degrees.length
    const allowMiss = n >= 4 ? 1 : 0
    for (let i = 0; i + n <= runs.length; i++) {
      let miss = 0
      let missAt = -1
      for (let k = 0; k < n && miss <= allowMiss; k++) {
        if (!tokenMatches(p.degrees[k], runs[i + k].degree)) {
          miss++
          missAt = k
          if (!similarFunction(p.degrees[k], runs[i + k].degree)) miss = Infinity
        }
      }
      // 第一個與最後一個和弦必須對上，避免太寬鬆
      if (miss > allowMiss || (miss && (missAt === 0 || missAt === n - 1))) continue
      candidates.push({ pattern: p, from: i, to: i + n - 1, exact: miss === 0 })
    }
  }
  // 精確優先、長的優先、位置先的優先；挑不重疊的
  candidates.sort((a, b) => (b.exact - a.exact) || (b.to - b.from) - (a.to - a.from) || a.from - b.from)
  const used = new Array(runs.length).fill(false)
  const picked = []
  for (const c of candidates) {
    let free = true
    for (let k = c.from; k <= c.to; k++) if (used[k]) { free = false; break }
    if (!free) continue
    for (let k = c.from; k <= c.to; k++) used[k] = true
    picked.push(c)
  }
  picked.sort((a, b) => a.from - b.from)

  const byId = new Map()
  for (const c of picked) {
    const p = c.pattern
    if (!byId.has(p.id)) {
      byId.set(p.id, { id: p.id, name: p.name, nameEn: p.nameEn, degrees: p.degrees.map((d) => d.split(':')[0]), count: 0, exactCount: 0, occurrences: [] })
    }
    const entry = byId.get(p.id)
    entry.count++
    if (c.exact) entry.exactCount++
    entry.occurrences.push(occurrence(runs, c.from, c.to, c.exact))
  }
  return [...byId.values()].sort((a, b) => b.count - a.count || b.degrees.length - a.degrees.length)
}

function occurrence(runs, from, to, exact = true) {
  return {
    start: runs[from].start,
    end: runs[to].end,
    startBar: runs[from].startBar,
    endBar: runs[to].endBar,
    chords: runs.slice(from, to + 1).map((r) => r.chord),
    exact,
  }
}

function canonicalRotation(arr) {
  let best = null
  for (let i = 0; i < arr.length; i++) {
    const rot = [...arr.slice(i), ...arr.slice(0, i)].join('-')
    if (best === null || rot < best) best = rot
  }
  return best
}

function isRepetition(arr) {
  // 例如 1-5-6-4-1-5-6-4 是 1-5-6-4 重複兩次
  for (let p = 1; p < arr.length; p++) {
    if (arr.length % p) continue
    if (arr.every((v, i) => v === arr[i % p])) return true
  }
  return false
}

/**
 * 從資料本身找反覆出現的循環（不需要字典）
 * 同一個循環的不同起點（1564 / 5641 / 6415 / 4156）視為同一組
 */
function findLoops(runs, lengths = [4, 3, 8], dictionary = KNOWN_PROGRESSIONS) {
  const loops = []
  for (const n of lengths) {
    const groups = new Map()
    for (let i = 0; i + n <= runs.length; i++) {
      const seq = runs.slice(i, i + n).map((r) => r.degree?.number)
      if (seq.some((d) => !d)) continue
      if (n > 1 && seq.every((d) => d === seq[0])) continue
      if (n >= 6 && isRepetition(seq)) continue
      const key = canonicalRotation(seq)
      if (!groups.has(key)) groups.set(key, { variants: new Map(), starts: [] })
      const g = groups.get(key)
      const v = seq.join('-')
      g.variants.set(v, (g.variants.get(v) ?? 0) + 1)
      g.starts.push(i)
    }
    for (const [key, g] of groups) {
      // 不重疊計數
      const occ = []
      let lastEnd = -1
      for (const s of g.starts) {
        if (s > lastEnd) {
          occ.push(occurrence(runs, s, s + n - 1))
          lastEnd = s + n - 1
        }
      }
      if (occ.length < 2) continue
      const degrees = [...g.variants.entries()].sort((a, b) => b[1] - a[1])[0][0].split('-')
      // 先找起點寫法完全相同的（6-4-5-1 → 小室進行），找不到再找同一個循環的（→ 50 年代進行）
      const plainOf = (p) => p.degrees.map((d) => d.split(':')[0])
      const named =
        dictionary.find((p) => plainOf(p).join('-') === degrees.join('-')) ??
        dictionary.find((p) => plainOf(p).length === n && canonicalRotation(plainOf(p)) === key)
      loops.push({
        degrees,                    // 最常出現的起點寫法，例如 ['6','4','1','5']
        length: n,
        count: occ.length,
        occurrences: occ,
        family: named ? { id: named.id, name: named.name } : null, // 跟哪個已知進行是同一個循環
      })
    }
  }
  // 次數多、長度 4 的優先
  return loops
    .sort((a, b) => b.count * b.length - a.count * a.length || (a.length === 4 ? -1 : 1))
    .filter((l, i, arr) => !arr.slice(0, i).some((o) => o.length > l.length && containsCyclic(o.degrees, l.degrees) && o.count >= l.count))
}

function containsCyclic(big, small) {
  const doubled = [...big, ...big]
  for (let i = 0; i < big.length; i++) {
    if (small.every((v, k) => doubled[i + k] === v)) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 主函式
// ---------------------------------------------------------------------------

/**
 * @param {object}   opts
 * @param {Array}    opts.timeline      BTC timeline：[{ chord, start, dur }]
 * @param {string}   [opts.key]         Essentia Key，例如 'C major'；省略時用和弦推估
 * @param {number[]} [opts.beats]       Essentia Beats；省略時改用「換和弦點」當單位
 * @param {number}   [opts.beatsPerBar=4]
 * @param {'bar'|'half'} [opts.unit='bar']  以小節或半小節為單位
 * @param {Array}    [opts.dictionary]  自訂進行字典
 */
export function analyzeProgression({
  timeline = [],
  key = null,
  beats = null,
  beatsPerBar = 4,
  unit = 'bar',
  dictionary = KNOWN_PROGRESSIONS,
} = {}) {
  const keyInfo = parseKey(key) ?? estimateKey(timeline)
  const empty = { key: keyInfo, unit: null, bars: [], runs: [], sequence: [], known: [], loops: [], nonDiatonic: [], summary: { mainLoop: null, knownCoverage: 0, diatonicRatio: 0 } }
  if (!timeline.length || !keyInfo) return empty

  const beatsPerUnit = unit === 'half' ? Math.max(1, Math.round(beatsPerBar / 2)) : beatsPerBar
  const grid = barBoundaries(beats, beatsPerUnit)
  const minDur = grid ? grid.beatLen * 0.75 : 0.3
  const segments = cleanTimeline(timeline, minDur)

  // 1. 切成小節；沒有拍點就用和弦片段本身
  let bars
  let unitName
  if (grid) {
    bars = assignChords(segments, grid.bounds)
    unitName = unit === 'half' ? 'half-bar' : 'bar'
  } else {
    bars = segments.map((s, i) => ({ index: i, start: s.start, end: +(s.start + s.dur).toFixed(3), chord: s.chord, ratio: 1, alt: null }))
    unitName = 'chord'
  }

  // 2. 換成級數
  for (const b of bars) {
    b.degree = chordToDegree(parseChord(b.chord), keyInfo)
  }

  // 3. 壓縮成「和弦變換序列」：連續相同級數＋和弦的小節合成一段（和聲節奏不影響比對）
  const runs = []
  for (const b of bars) {
    const last = runs[runs.length - 1]
    if (last && last.chord === b.chord) {
      last.end = b.end
      last.endBar = b.index
      last.bars++
    } else {
      runs.push({ chord: b.chord, degree: b.degree, start: b.start, end: b.end, startBar: b.index, endBar: b.index, bars: 1 })
    }
  }
  // N（無和弦）會打斷進行
  const runsNoN = runs.filter((r) => r.degree)

  // 4. 比對
  const known = findKnown(runsNoN, dictionary)
  const loops = findLoops(runsNoN, [4, 3, 8], dictionary)

  const nonDiatonic = runsNoN
    .filter((r) => r.degree.kind !== 'diatonic')
    .map((r) => ({ chord: r.chord, start: r.start, end: r.end, startBar: r.startBar, ...r.degree }))

  const covered = known.reduce((sum, k) => sum + k.occurrences.reduce((s, o) => s + (o.end - o.start), 0), 0)
  const voiced = runsNoN.reduce((s, r) => s + (r.end - r.start), 0)

  return {
    key: keyInfo,                                   // { tonic, mode, name, estimated? }
    unit: unitName,                                 // 'bar' | 'half-bar' | 'chord'
    bars,                                           // 每小節：{ index, start, end, chord, ratio, alt, degree }
    runs: runsNoN,                                  // 和弦變換序列
    sequence: bars.map((b) => b.degree?.number ?? null), // ['1','1','5','6',...]
    known,                                          // 命中的已知進行
    loops,                                          // 這首歌反覆出現的循環
    nonDiatonic,                                    // 調外和弦（副屬、借用…）
    summary: {
      mainLoop: loops[0] ?? null,
      knownCoverage: voiced ? +(covered / voiced).toFixed(2) : 0, // 已知進行涵蓋的時間比例
      diatonicRatio: runsNoN.length ? +(1 - nonDiatonic.length / runsNoN.length).toFixed(2) : 0,
    },
  }
}

/**
 * 把級數陣列格式化成 '1-5-6-4'
 */
export function formatDegrees(degrees, sep = '-') {
  return degrees.join(sep)
}
