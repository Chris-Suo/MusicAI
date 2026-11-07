/**
 * 主旋律音高統計（資料來源：Essentia PitchContour，MIDI 音高，null = 沒有旋律）
 */
import { percentile } from '@/utils/stats.js'
import { midiToHz, midiToName, octaveOf, scalePitchClasses, mod12 } from '@/utils/theory.js'

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

/** 一個數值出現幾次 */
function countBy(values, keyOf) {
  const counts = new Map()
  for (const v of values) {
    const k = keyOf(v)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return counts
}

/**
 * @param {{ hop: number, midi: (number|null)[] }} contour
 * @param {object|null} key  theory.js parseKey() 的結果
 * @returns {{
 *   voicedRatio: number,   // 有旋律的時間比例
 *   low, high,             // 最低／最高音 { midi, name, hz }（排除最極端的 1%）
 *   rangeSemis: number,    // 音域幾個半音
 *   inKeyShare: number,    // 調內音占的時間比例
 *   notes: { midi, name, hz, octave, inKey, share }[],  // 每個音（含八度）的占比，由多到少
 *   octaves: { octave, name, fromHz, toHz, share }[],    // 每個音區的占比，由低到高
 * }}
 */
export function analyzePitch(contour, key) {
  const voiced = contour.midi.filter((v) => v !== null)
  if (!voiced.length) return { voicedRatio: 0, low: null, high: null, rangeSemis: 0, inKeyShare: 0, notes: [], octaves: [] }

  // 最低／最高音排除最極端的 1%（偵測誤差、雜音）
  const sorted = [...voiced].sort((a, b) => a - b)
  const low = Math.round(percentile(sorted, 0.01))
  const high = Math.round(percentile(sorted, 0.99))
  const note = (m) => ({ midi: m, name: midiToName(m, key), hz: midiToHz(m) })

  const inKey = scalePitchClasses(key)
  const notes = [...countBy(voiced, Math.round)]
    .map(([m, c]) => ({ ...note(m), octave: octaveOf(m), inKey: inKey.has(mod12(m)), share: c / voiced.length }))
    .sort((a, b) => b.share - a.share)

  const octaves = [...countBy(voiced, octaveOf)]
    .sort((a, b) => a[0] - b[0])
    .map(([oct, c]) => ({
      octave: oct,
      name: OCTAVE_NAMES[Math.min(7, Math.max(1, oct))],
      fromHz: midiToHz((oct + 1) * 12),
      toHz: midiToHz((oct + 1) * 12 + 11),
      share: c / voiced.length,
    }))
    .filter((o) => o.share >= 0.005)

  return {
    voicedRatio: voiced.length / contour.midi.length,
    low: note(low),
    high: note(high),
    rangeSemis: high - low,
    inKeyShare: notes.filter((n) => n.inKey).reduce((s, n) => s + n.share, 0),
    notes,
    octaves,
  }
}
