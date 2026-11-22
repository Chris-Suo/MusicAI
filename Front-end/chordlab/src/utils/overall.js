/**
 * 總樂性元：把和弦、音高、速度三條情緒軌跡合成一個最終座標（2026-11-20 起使用 overallPoint）
 *
 *   最終座標 = 60% × 和弦情緒軌跡的平均座標 ＋ 20% × 音高情緒軌跡的平均座標 ＋ 20% × 速度情緒軌跡的平均座標
 *   （x、y 各自加權加總；座標都是情緒輪的 ±10，x 效價 Valence、y 喚醒度 Arousal）
 *
 * - 和弦：utils/chordEmotion.js buildTrajectory()（軌跡版本跟和弦分頁一致）
 * - 音高：utils/pitchEmotion.js buildPitchEmotionPath()（每 15 秒平均赫茲數）
 * - 速度：utils/tempoEmotion.js buildTempoEmotionPath()（每 15 秒平均 BPM 所在區間，大小調依調性）
 * - 每條軌跡的平均：每一步依時間長短加權（速度軌跡會把連續同區間的段合成一步，依時間算才不會低估）
 *
 * 舊版（2026-11-19～20，overallScore）：60% 情緒座標 ＋ 20% 平均音高 Hz ＋ 20% 平均速度 BPM，三項直接用原始數值相加，
 * 結果幾乎只由音高和速度決定；保留在檔案下方，目前沒有使用。
 */
import { buildTrajectory, trajectoryMean, WINDOW_SEC } from '@/utils/chordEmotion.js'
import { buildPitchEmotionPath } from '@/utils/pitchEmotion.js'
import { buildTempoEmotionPath } from '@/utils/tempoEmotion.js'
import { midiToHz } from '@/utils/theory.js'
import { windowTempos } from '@/utils/rhythm.js'

// ---------------------------------------------------------------------------
// 目前使用：三條情緒軌跡的加權座標
// ---------------------------------------------------------------------------

/** 三條軌跡的權重 */
export const POINT_WEIGHTS = { chord: 0.6, pitch: 0.2, tempo: 0.2 }

/** 一條軌跡的平均座標：每一步依時間長短加權；沒有軌跡點時回傳 null */
function timeMean(steps) {
  let w = 0
  let x = 0
  let y = 0
  for (const s of steps) {
    const d = Math.max(0, s.end - s.start)
    w += d
    x += s.emo.x * d
    y += s.emo.y * d
  }
  return w > 0 ? { x: x / w, y: y / w, count: steps.length } : null
}

/**
 * @param {object} opts
 * @param {Array} opts.timeline       BTC 和弦時間軸
 * @param {object|null} opts.contour  主旋律音高（utils/pitch.js normalizeContour()）
 * @param {number[]} opts.beats       拍點（秒）
 * @param {number} opts.length        整首歌長度（秒）
 * @param {object|null} opts.key      調性（音名寫法、速度軌跡的大小調）
 * @returns {{
 *   parts: { key: 'chord'|'pitch'|'tempo', name: string, weight: number, mean: { x, y, count } | null }[],
 *   final: { x: number, y: number } | null,   // 三項都有時才算
 * }}
 */
export function overallPoint({ timeline, contour, beats = [], length, key = null }) {
  const mode = key?.mode === 'minor' ? 'minor' : 'major'
  const parts = [
    { key: 'chord', name: '和弦', weight: POINT_WEIGHTS.chord, mean: timeMean(buildTrajectory(timeline).steps) },
    { key: 'pitch', name: '音高', weight: POINT_WEIGHTS.pitch, mean: timeMean(buildPitchEmotionPath(contour, length, key).steps) },
    { key: 'tempo', name: '速度', weight: POINT_WEIGHTS.tempo, mean: timeMean(buildTempoEmotionPath(beats, length, mode).steps) },
  ]
  const final = parts.every((p) => p.mean)
    ? {
        x: parts.reduce((s, p) => s + p.weight * p.mean.x, 0),
        y: parts.reduce((s, p) => s + p.weight * p.mean.y, 0),
      }
    : null
  return { parts, final }
}

// ---------------------------------------------------------------------------
// 綜合軌跡：每 15 秒算一次綜合座標（權重跟最終座標相同）
// ---------------------------------------------------------------------------

/**
 * 一條軌跡在 [ws, we) 這段時間的座標：跟這段時間重疊的每一步，依重疊的時間長短加權平均
 * 三條軌跡切段的方式不同（速度會把連續同區間的段合成一步；和弦也可能切到「和弦順序」版本），用重疊時間算就都能對上
 * 這段時間完全沒有軌跡點時回傳 null
 */
function overlapMean(steps, ws, we) {
  let w = 0
  let x = 0
  let y = 0
  for (const s of steps) {
    const d = Math.min(we, s.end) - Math.max(ws, s.start)
    if (d <= 0) continue
    w += d
    x += s.emo.x * d
    y += s.emo.y * d
  }
  return w > 0 ? { x: x / w, y: y / w } : null
}

const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

/**
 * 每 windowSec 秒一段的綜合座標：60% 這段的和弦座標 ＋ 20% 音高座標 ＋ 20% 速度座標
 * 三項缺任何一項的段（例如前奏沒有旋律、沒有拍點）不算綜合座標，不畫進軌跡
 * @param {object} opts  同 overallPoint()
 * @returns {{
 *   windows: { no, start, end, name, parts: { chord, pitch, tempo }, point: { x, y } | null, missing: string[] }[],
 *   steps: { emo: { key, x, y, short, name, window }, start, end, win }[],   // 有綜合座標的段，依時間排序
 *   windowSec: number,
 * }}
 */
export function overallWindows({ timeline, contour, beats = [], length, key = null, windowSec = WINDOW_SEC }) {
  const mode = key?.mode === 'minor' ? 'minor' : 'major'
  const tracks = {
    chord: buildTrajectory(timeline).steps,
    pitch: buildPitchEmotionPath(contour, length, key).steps,
    tempo: buildTempoEmotionPath(beats, length, mode).steps,
  }
  const NAMES = { chord: '和弦', pitch: '音高', tempo: '速度' }
  const windows = []
  const steps = []
  for (let ws = 0, no = 1; ws < length; ws += windowSec, no++) {
    const we = Math.min(ws + windowSec, length)
    const parts = {}
    for (const k of Object.keys(tracks)) parts[k] = overlapMean(tracks[k], ws, we)
    const missing = Object.keys(parts).filter((k) => !parts[k]).map((k) => NAMES[k])
    const point = missing.length
      ? null
      : {
          x: Math.round((POINT_WEIGHTS.chord * parts.chord.x + POINT_WEIGHTS.pitch * parts.pitch.x + POINT_WEIGHTS.tempo * parts.tempo.x) * 100) / 100,
          y: Math.round((POINT_WEIGHTS.chord * parts.chord.y + POINT_WEIGHTS.pitch * parts.pitch.y + POINT_WEIGHTS.tempo * parts.tempo.y) * 100) / 100,
        }
    const win = { no, start: ws, end: we, name: `${clock(ws)}–${clock(we)}`, parts, point, missing }
    windows.push(win)
    if (point) steps.push({ emo: { key: `ow-${no}`, ...point, short: String(no), name: win.name, window: no }, start: ws, end: we, win })
  }
  return { windows, steps, windowSec }
}

// ---------------------------------------------------------------------------
// 舊版（目前沒有使用）：60% 情緒座標 ＋ 20% 平均音高 Hz ＋ 20% 平均速度 BPM，原始數值直接相加
// ---------------------------------------------------------------------------

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

  const tempos = windowTempos(beats, length, windowSec)
  const windows = []
  for (let ws = 0, w = 0; ws < length; ws += windowSec, w++) {
    const we = Math.min(ws + windowSec, length)

    // 區間內有旋律的點，換成 Hz 平均
    let pitch = null
    if (contour) {
      const from = Math.floor(ws / contour.hop)
      const to = Math.min(contour.midi.length, Math.ceil(we / contour.hop))
      const hz = contour.midi.slice(from, to).filter((v) => v !== null).map(midiToHz)
      pitch = mean(hz)
    }

    // 區間內的拍點：60 ÷ 平均拍距（utils/rhythm.js windowTempos）
    const tempo = tempos[w].bpm

    windows.push({ start: ws, end: we, pitch, tempo })
  }

  const pitch = mean(windows.map((w) => w.pitch).filter((v) => v !== null))
  const tempo = mean(windows.map((w) => w.tempo).filter((v) => v !== null))

  const rest = pitch !== null && tempo !== null ? WEIGHTS.pitch * pitch + WEIGHTS.tempo * tempo : null
  const final =
    emotion && rest !== null ? { x: WEIGHTS.emotion * emotion.x + rest, y: WEIGHTS.emotion * emotion.y + rest } : null

  return { emotion, pitch, tempo, windows, final, windowSec }
}
