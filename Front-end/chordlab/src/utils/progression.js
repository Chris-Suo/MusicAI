/**
 * 和弦進行分析
 * ============================================================================
 * 把 BTC 的和弦時間軸 + 調性 + Essentia 拍點，轉成「每小節一個和弦」的級數序列，
 * 再找出常見的和弦進行（1-5-6-4、6-4-5-1…）與這首歌自己反覆出現的循環。
 * 級數的算法見 chords.js。
 *
 * 限制：
 *   - 小節切分假設 beatsPerBar 拍一小節（預設 4/4），並從第一個拍點開始算；
 *     有弱起拍的歌曲小節會整個偏移。
 *   - 結果品質取決於 BTC 和弦辨識、Essentia 調性與拍點的準確度。
 */
import { parseChord, chordToDegree } from '@/utils/chords.js'
import { median } from '@/utils/stats.js'

/**
 * 常見和弦進行字典（以大調簡譜表示）
 * token 可以只寫級數（'6'，不管大小三），或加上和弦家族（'3:maj' 表示必須是大三／屬七）
 */
const KNOWN_PROGRESSIONS = [
  { id: 'canon', name: '卡農進行', degrees: ['1', '5', '6', '3', '4', '1', '4', '5'] },
  { id: 'axis', name: '四和弦循環', degrees: ['1', '5', '6', '4'] },
  { id: 'axis-minor', name: '四和弦循環（小調起）', degrees: ['6', '4', '1', '5'] },
  { id: 'fifties', name: '50 年代進行', degrees: ['1', '6', '4', '5'] },
  { id: 'komuro', name: '小室進行', degrees: ['6', '4', '5', '1'] },
  { id: 'royal-road', name: '王道進行', degrees: ['4', '5', '3', '6'] },
  { id: 'marusa', name: '丸サ進行', degrees: ['4', '3:maj', '6'] },
  { id: 'circle', name: '六二五一', degrees: ['6', '2', '5', '1'] },
  { id: 'doo-wop-2', name: '一六二五', degrees: ['1', '6', '2', '5'] },
  { id: 'blues-cadence', name: '一四五一', degrees: ['1', '4', '5', '1'] },
  { id: 'two-five-one', name: '二五一', degrees: ['2', '5', '1'] },
]

const LOOP_LENGTHS = [4, 3, 8]

// 字典的級數去掉和弦家族：'3:maj' → '3'
const plainDegrees = (p) => p.degrees.map((d) => d.split(':')[0])

// ---------------------------------------------------------------------------
// 前處理與小節切分
// ---------------------------------------------------------------------------

/** 合併連續相同和弦，太短的片段併進前一段（BTC 換和弦時常會抖一下） */
function cleanTimeline(timeline, minDur) {
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
    if (last && (seg.dur < minDur || last.chord === seg.chord)) {
      last.dur = +(seg.start + seg.dur - last.start).toFixed(3)
    } else {
      out.push({ ...seg })
    }
  }
  return out
}

/** 依拍點切出小節（或半小節）邊界；拍點不夠時回傳 null */
function barBoundaries(beats, beatsPerUnit) {
  const b = beats
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

/** 每個單位（小節）取重疊時間最長的和弦；第二長的超過 35% 時記在 alt */
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
    const chord = ranked[0]?.[0] ?? 'N'
    const alt = ranked[1] && ranked[1][1] / len >= 0.35 ? ranked[1][0] : null
    units.push({ index: i, start: +start.toFixed(3), end: +end.toFixed(3), chord, alt })
  }
  return units
}

// ---------------------------------------------------------------------------
// 進行比對
// ---------------------------------------------------------------------------

function tokenMatches(token, deg) {
  if (!deg) return false
  const [num, fam] = token.split(':')
  if (deg.number !== num) return false
  return !fam || deg.family === fam
}

/** 一次出現涵蓋的小節範圍 */
const occurrence = (runs, from, to) => ({ startBar: runs[from].startBar, endBar: runs[to].endBar })

/**
 * 這一段（run）有沒有落在樂句開頭：從所在段落（section）的開頭算起，涵蓋的小節裡有 phrase 的倍數
 * （段落的第 1、5、9… 小節）。段落以無和弦（N）分開，所以間奏、停頓之後會重新起算。
 * 同一個循環的不同起點（6-4-5-1 / 1-6-4-5）在連續重複時都比對得到，用這個判斷哪個起點才是樂句的開頭
 * phrase 為 null（沒有拍點、無法切小節）時一律不算
 */
function onPhraseStart(run, phrase) {
  if (!phrase) return false
  const from = run.startBar - run.sectionStart
  const to = run.endBar - run.sectionStart
  return Math.floor(to / phrase) * phrase >= from
}

/** runs[i]～runs[i+n-1] 都在同一個段落（中間沒有無和弦） */
const sameSection = (runs, i, n) => runs[i].section === runs[i + n - 1].section

/** 依序挑不重疊的位置（每個位置涵蓋 n 段） */
function nonOverlapping(starts, n) {
  const out = []
  let lastEnd = -1
  for (const s of starts) {
    if (s > lastEnd) {
      out.push(s)
      lastEnd = s + n - 1
    }
  }
  return out
}

/**
 * 在和弦變換序列（runs）上比對字典
 * 每個級數都要完全對上才算（不接受代理和弦，例如 1-3-4-5 不算 50 年代進行 1-6-4-5）
 *
 * 重疊時的取捨：同一個循環的不同起點（小室進行 6-4-5-1、50 年代進行 1-6-4-5）在連續重複時
 * 兩個都比對得到，不能只看誰的位置先，否則前奏多一個和弦就會整首都判成另一個。
 * 依序比：長的優先 → 這首歌裡「從樂句開頭開始」次數多的優先 → 總次數多的優先 → 位置先的優先
 */
function findKnown(runs, phrase) {
  const candidates = []
  const stats = new Map() // pattern id → { aligned, total }
  for (const p of KNOWN_PROGRESSIONS) {
    const n = p.degrees.length
    const st = { aligned: 0, total: 0 }
    for (let i = 0; i + n <= runs.length; i++) {
      if (sameSection(runs, i, n) && p.degrees.every((token, k) => tokenMatches(token, runs[i + k].degree))) {
        candidates.push({ pattern: p, from: i, to: i + n - 1 })
        st.total++
        if (onPhraseStart(runs[i], phrase)) st.aligned++
      }
    }
    stats.set(p.id, st)
  }
  const st = (c) => stats.get(c.pattern.id)
  candidates.sort(
    (a, b) =>
      b.to - b.from - (a.to - a.from) ||
      st(b).aligned - st(a).aligned ||
      st(b).total - st(a).total ||
      a.from - b.from,
  )
  const used = new Array(runs.length).fill(false)
  const picked = []
  for (const c of candidates) {
    if (used.slice(c.from, c.to + 1).some(Boolean)) continue
    used.fill(true, c.from, c.to + 1)
    picked.push(c)
  }
  picked.sort((a, b) => a.from - b.from)

  const byId = new Map()
  for (const c of picked) {
    const p = c.pattern
    if (!byId.has(p.id)) byId.set(p.id, { id: p.id, name: p.name, degrees: plainDegrees(p), count: 0, occurrences: [] })
    const entry = byId.get(p.id)
    entry.count++
    entry.occurrences.push(occurrence(runs, c.from, c.to))
  }
  return [...byId.values()].sort((a, b) => b.count - a.count || b.degrees.length - a.degrees.length)
}

/** 同一個循環的不同起點（1564 / 5641 / 6415 / 4156）用字典順序最小的那個當代表 */
function canonicalRotation(arr) {
  let best = null
  for (let i = 0; i < arr.length; i++) {
    const rot = [...arr.slice(i), ...arr.slice(0, i)].join('-')
    if (best === null || rot < best) best = rot
  }
  return best
}

/** 例如 1-5-6-4-1-5-6-4 是 1-5-6-4 重複兩次 */
function isRepetition(arr) {
  for (let p = 1; p < arr.length; p++) {
    if (arr.length % p) continue
    if (arr.every((v, i) => v === arr[i % p])) return true
  }
  return false
}

function containsCyclic(big, small) {
  const doubled = [...big, ...big]
  for (let i = 0; i < big.length; i++) {
    if (small.every((v, k) => doubled[i + k] === v)) return true
  }
  return false
}

/**
 * 從資料本身找反覆出現的循環（不需要字典）
 * 同一個循環的不同起點（6-4-5-1 / 4-5-1-6 / 5-1-6-4 / 1-6-4-5）視為同一組，但只挑一個起點當代表，
 * 次數與標出的位置都只算「完全照這個起點」的出現，不會把其他起點也圈進來。
 * 代表的起點：從樂句開頭開始的次數多的優先 → 次數多的優先 → 第一次出現早的優先
 */
function findLoops(runs, phrase) {
  const loops = []
  for (const n of LOOP_LENGTHS) {
    const groups = new Map()
    for (let i = 0; i + n <= runs.length; i++) {
      if (!sameSection(runs, i, n)) continue
      const seq = runs.slice(i, i + n).map((r) => r.degree?.number)
      if (seq.some((d) => !d)) continue
      if (n > 1 && seq.every((d) => d === seq[0])) continue
      if (n >= 6 && isRepetition(seq)) continue
      const key = canonicalRotation(seq)
      if (!groups.has(key)) groups.set(key, new Map())
      const variants = groups.get(key) // 起點寫法 → 出現的位置
      const v = seq.join('-')
      if (!variants.has(v)) variants.set(v, [])
      variants.get(v).push(i)
    }
    for (const [key, variants] of groups) {
      // 每種起點各自算不重疊的次數，挑一個當代表
      const best = [...variants.entries()]
        .map(([v, starts]) => {
          const picked = nonOverlapping(starts, n)
          return { v, picked, aligned: picked.filter((s) => onPhraseStart(runs[s], phrase)).length }
        })
        .sort((a, b) => b.aligned - a.aligned || b.picked.length - a.picked.length || a.picked[0] - b.picked[0])[0]
      if (best.picked.length < 2) continue
      const occ = best.picked.map((s) => occurrence(runs, s, s + n - 1))
      const degrees = best.v.split('-')
      // 先找起點寫法完全相同的（6-4-5-1 → 小室進行），找不到再找同一個循環的（→ 50 年代進行）
      const named =
        KNOWN_PROGRESSIONS.find((p) => plainDegrees(p).join('-') === degrees.join('-')) ??
        KNOWN_PROGRESSIONS.find((p) => p.degrees.length === n && canonicalRotation(plainDegrees(p)) === key)
      loops.push({
        degrees, // 代表的起點寫法，例如 ['6','4','5','1']
        length: n,
        count: occ.length,
        occurrences: occ,
        family: named ? { id: named.id, name: named.name } : null, // 跟哪個已知進行是同一個循環
      })
    }
  }
  // 次數多、長度 4 的優先；被更長、次數不少於它的循環包含的不列
  return loops
    .sort((a, b) => b.count * b.length - a.count * a.length || (a.length === 4 ? -1 : 1))
    .filter((l, i, arr) => !arr.slice(0, i).some((o) => o.length > l.length && containsCyclic(o.degrees, l.degrees) && o.count >= l.count))
}

// ---------------------------------------------------------------------------
// 主函式
// ---------------------------------------------------------------------------

/**
 * @param {object}   opts
 * @param {Array}    opts.timeline      BTC timeline：[{ chord, start, dur }]
 * @param {object}   opts.key           theory.js parseKey() 的結果
 * @param {number[]} [opts.beats]       已排序的拍點（秒）；沒有時改用「換和弦點」當單位
 * @param {number}   [opts.beatsPerBar=4]
 * @param {'bar'|'half'} [opts.unit='bar']  以小節或半小節為單位
 * @returns {{
 *   unit: 'bar'|'half-bar'|'chord'|null,
 *   bars: { index, start, end, chord, alt, degree }[],  // 每格一個和弦
 *   known: { id, name, degrees, count, occurrences }[],  // 命中的已知進行
 *   loops: { degrees, length, count, occurrences, family }[],  // 這首歌反覆出現的循環，第一個是主要循環
 * }}
 */
export function analyzeProgression({ timeline = [], key = null, beats = [], beatsPerBar = 4, unit = 'bar' } = {}) {
  if (!timeline.length || !key) return { unit: null, bars: [], known: [], loops: [] }

  const beatsPerUnit = unit === 'half' ? Math.max(1, Math.round(beatsPerBar / 2)) : beatsPerBar
  const grid = barBoundaries(beats, beatsPerUnit)
  const segments = cleanTimeline(timeline, grid ? grid.beatLen * 0.75 : 0.3)

  // 1. 切成小節；沒有拍點就用和弦片段本身
  const bars = grid
    ? assignChords(segments, grid.bounds)
    : segments.map((s, i) => ({ index: i, start: s.start, end: +(s.start + s.dur).toFixed(3), chord: s.chord, alt: null }))

  // 2. 換成級數
  for (const b of bars) b.degree = chordToDegree(parseChord(b.chord), key)

  // 3. 壓縮成「和弦變換序列」：連續相同和弦的小節合成一段（和聲節奏不影響比對）；N（無和弦）會打斷進行
  const runs = []
  for (const b of bars) {
    const last = runs[runs.length - 1]
    if (last && last.chord === b.chord) last.endBar = b.index
    else runs.push({ chord: b.chord, degree: b.degree, startBar: b.index, endBar: b.index })
  }
  // 無和弦（N）把歌切成好幾個段落：進行不跨段比對，樂句開頭也從每段的開頭重新算
  let section = 0
  let sectionStart = 0
  let prevVoiced = false
  for (const r of runs) {
    if (r.degree && !prevVoiced) {
      section++
      sectionStart = r.startBar
    }
    r.section = section
    r.sectionStart = sectionStart
    prevVoiced = !!r.degree
  }
  const voicedRuns = runs.filter((r) => r.degree)

  // 樂句長度（幾格）：4 小節一句；半小節模式是 8 格；沒有拍點時無法判斷
  const phrase = grid ? (unit === 'half' ? 8 : 4) : null

  return {
    unit: grid ? (unit === 'half' ? 'half-bar' : 'bar') : 'chord',
    bars,
    known: findKnown(voicedRuns, phrase),
    loops: findLoops(voicedRuns, phrase),
  }
}
