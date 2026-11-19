/**
 * 總樂性元：把情緒座標、音高、速度合成一個最終值
 *
 *   最終值(x) = 60% × 情緒軌跡平均 x ＋ 20% × 平均音高(Hz) ＋ 20% × 平均速度(BPM)
 *   最終值(y) = 60% × 情緒軌跡平均 y ＋ 20% × 平均音高(Hz) ＋ 20% × 平均速度(BPM)
 *
 * - 情緒軌跡平均：utils/chordEmotion.js trajectoryMean()（軌跡版本跟和弦分頁一致）
 * - 平均音高：每 15 秒一個區間，算區間內主旋律的平均 Hz，再把各區間平均（沒有旋律的區間跳過）
 * - 平均速度：每 15 秒一個區間，用區間內的拍距算 BPM（60 ÷ 平均拍距），再把各區間平均（少於 2 拍的區間跳過）
 * - 三項直接用原始數值相加，不換算成同一個範圍（2026-11-19 決定）；所以結果主要由音高和速度決定
 */
import { buildTrajectory, trajectoryMean, WINDOW_SEC } from '@/utils/chordEmotion.js'
import { midiToHz } from '@/utils/theory.js'

export const WEIGHTS = { emotion: 0.6, pitch: 0.2, tempo: 0.2 }

const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null)

/**
 * @param {object} opts
 * @param {Array} opts.timeline                         BTC 和弦時間軸
 * @param {{ hop: number, midi: (number|null)[] }|null} opts.contour  主旋律音高
 * @param {number[]} opts.beats                         拍點（秒，已排序）
 * @param {number} opts.length                          整首歌長度（秒）
 * @param {number} [opts.windowSec]
 * @returns {{
 *   emotion: { x, y, count } | null,
 *   pitch: number | null,   // 各區間平均音高的平均（Hz）
 *   tempo: number | null,   // 各區間平均速度的平均（BPM）
 *   windows: { start, end, pitch: number|null, tempo: number|null }[],
 *   final: { x, y } | null, // 三項都有時才算
 *   windowSec: number,
 * }}
 */
export function overallScore({ timeline, contour, beats = [], length, windowSec = WINDOW_SEC }) {
  const emotion = trajectoryMean(buildTrajectory(timeline))

  const windows = []
  for (let ws = 0; ws < length; ws += windowSec) {
    const we = Math.min(ws + windowSec, length)

    // 區間內有旋律的點，換成 Hz 平均
    let pitch = null
    if (contour) {
      const from = Math.floor(ws / contour.hop)
      const to = Math.min(contour.midi.length, Math.ceil(we / contour.hop))
      const hz = contour.midi.slice(from, to).filter((v) => v !== null).map(midiToHz)
      pitch = mean(hz)
    }

    // 區間內的拍點：60 ÷ 平均拍距
    const b = beats.filter((t) => t >= ws && t < we)
    const tempo = b.length >= 2 ? 60 / ((b[b.length - 1] - b[0]) / (b.length - 1)) : null

    windows.push({ start: ws, end: we, pitch, tempo })
  }

  const pitch = mean(windows.map((w) => w.pitch).filter((v) => v !== null))
  const tempo = mean(windows.map((w) => w.tempo).filter((v) => v !== null))

  const rest = pitch !== null && tempo !== null ? WEIGHTS.pitch * pitch + WEIGHTS.tempo * tempo : null
  const final =
    emotion && rest !== null ? { x: WEIGHTS.emotion * emotion.x + rest, y: WEIGHTS.emotion * emotion.y + rest } : null

  return { emotion, pitch, tempo, windows, final, windowSec }
}
