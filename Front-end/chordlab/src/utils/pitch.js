/**
 * 主旋律音高統計（資料來源：Essentia PitchContour，MIDI 音高，null = 沒有旋律）
 */
import { percentile } from '@/utils/stats.js'
import { midiToHz, midiToName, noteName, scalePitchClasses, scaleDegreeOf } from '@/utils/music.js'

const OCTAVE_NAMES = {
  1: '極低音區',
  2: '低音區',
  3: '中低音區',
  4: '中音區',
  5: '中高音區',
  6: '高音區',
  7: '極高音區',
}

/** 把後端的 PitchContour 整理成 { hop, midi[] }；格式不對回傳 null */
export function normalizeContour(raw) {
  if (!raw || !Array.isArray(raw.midi) || !(raw.hop > 0)) return null
  return { hop: raw.hop, midi: raw.midi.map((v) => (Number.isFinite(v) ? v : null)) }
}

/**
 * @param {{ hop: number, midi: (number|null)[] }} contour
 * @param {object|null} key  parseKey() 的結果
 */
export function analyzePitch(contour, key) {
  const voiced = contour.midi.filter((v) => v !== null)
  const empty = { voicedRatio: 0, voicedSec: 0, pcShare: [], octaves: [], low: null, high: null, top: null }
  if (!voiced.length) return empty

  const sorted = [...voiced].sort((a, b) => a - b)
  // 最低／最高音排除最極端的 1%（偵測誤差、雜音）
  const low = Math.round(percentile(sorted, 0.01))
  const high = Math.round(percentile(sorted, 0.99))

  const pcCounts = new Array(12).fill(0)
  const noteCounts = new Map()
  const octCounts = new Map()
  for (const v of voiced) {
    const r = Math.round(v)
    pcCounts[((r % 12) + 12) % 12]++
    noteCounts.set(r, (noteCounts.get(r) ?? 0) + 1)
    const oct = Math.floor(r / 12) - 1
    octCounts.set(oct, (octCounts.get(oct) ?? 0) + 1)
  }

  const inKey = scalePitchClasses(key)
  const pcShare = pcCounts.map((c, pc) => ({
    pc,
    name: noteName(pc, key),
    share: c / voiced.length,
    inKey: inKey.has(pc),
    degree: scaleDegreeOf(pc, key),
  }))

  const octaves = [...octCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([oct, c]) => {
      const from = (oct + 1) * 12
      return {
        octave: oct,
        name: OCTAVE_NAMES[Math.min(7, Math.max(1, oct))],
        range: `C${oct}–B${oct}`,
        fromHz: midiToHz(from),
        toHz: midiToHz(from + 11),
        share: c / voiced.length,
      }
    })
    .filter((o) => o.share >= 0.005)

  const [topMidi, topCount] = [...noteCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  const note = (m) => ({ midi: m, name: midiToName(m, key), hz: midiToHz(m) })

  return {
    voicedRatio: voiced.length / contour.midi.length,
    voicedSec: voiced.length * contour.hop,
    low: note(low),
    high: note(high),
    rangeSemis: high - low,
    top: { ...note(topMidi), share: topCount / voiced.length },
    median: note(Math.round(percentile(sorted, 0.5))),
    pcShare,
    octaves,
  }
}
