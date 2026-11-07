/**
 * 節拍與速度：拍點統計、BPM 分布、速度術語
 */
import { median } from '@/utils/stats.js'

export const BEATS_PER_BAR = 4

/** 後端的 Beats → 排好序的秒數陣列 */
export function normalizeBeats(raw) {
  return Array.isArray(raw) ? raw.filter(Number.isFinite).sort((a, b) => a - b) : []
}

/**
 * 拍點統計
 * @param {number[]} beats  已排序的拍點（秒）
 * @returns {{ count, intervals: number[], medianInterval: number|null, beatBpm: number|null, barCount, beatsPerBar }}
 */
export function beatStats(beats, beatsPerBar = BEATS_PER_BAR) {
  const intervals = beats.slice(1).map((t, i) => t - beats[i])
  const med = median(intervals)
  return {
    count: beats.length,
    intervals,
    medianInterval: med,
    beatBpm: med ? 60 / med : null,
    barCount: Math.ceil(beats.length / beatsPerBar),
    beatsPerBar,
  }
}

/**
 * BPM 分布：每一拍換算成 BPM，依時間（拍距長度）統計
 * - 主速度 ±stable 以內算「穩定」，其餘是偏慢／偏快
 * - BPM 以主速度的 2% 為一格（至少 1 BPM）
 * @param {ReturnType<typeof beatStats>} stats
 * @returns {null | {
 *   lo: number, hi: number,  // 穩定範圍（BPM，四捨五入）
 *   binWidth: number,
 *   shares: { slow: number, stable: number, fast: number },
 *   bins: { bpm: number, share: number, group: 'slow'|'stable'|'fast' }[],  // 由多到少
 * }}
 */
export function tempoDistribution(stats, stable = 0.03) {
  const m = stats.beatBpm
  if (!m || stats.intervals.length < 4) return null

  const groupOf = (bpm) => (bpm / m - 1 < -stable ? 'slow' : bpm / m - 1 > stable ? 'fast' : 'stable')
  const binWidth = Math.max(1, Math.round(m * 0.02))
  const center = Math.round(m)
  const sums = { slow: 0, stable: 0, fast: 0 }
  const bins = new Map()
  let total = 0
  for (const d of stats.intervals) {
    if (!(d > 0)) continue
    const bpm = 60 / d
    total += d
    sums[groupOf(bpm)] += d
    const bin = center + binWidth * Math.round((bpm - center) / binWidth)
    bins.set(bin, (bins.get(bin) ?? 0) + d)
  }
  if (!total) return null

  return {
    lo: Math.round(m * (1 - stable)),
    hi: Math.round(m * (1 + stable)),
    binWidth,
    shares: { slow: sums.slow / total, stable: sums.stable / total, fast: sums.fast / total },
    bins: [...bins]
      .map(([bpm, s]) => ({ bpm, share: s / total, group: groupOf(bpm) }))
      .sort((a, b) => b.share - a.share),
  }
}

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
