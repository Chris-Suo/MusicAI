/**
 * 後端回傳 → 畫面用的資料
 *
 * 這是前端唯一直接讀後端欄位（BTC.timeline、Essentia.essentia.Key…）的地方，
 * 後端格式改了只要改這裡（格式說明見 api.js）。元件只吃這裡整理好的資料。
 */
import { parseKey, conventionalKey, a4FromCents } from '@/utils/theory.js'
import { estimateKey, buildChordInfo, isNoChord } from '@/utils/chords.js'
import { normalizeBeats, beatStats } from '@/utils/rhythm.js'
import { normalizeContour, analyzePitch } from '@/utils/pitch.js'
import { normalizeLoudnessCurve } from '@/utils/loudness.js'

const finiteOrNull = (v) => (Number.isFinite(v) ? v : null)

/**
 * @param {object} data  api.js analyzeAudio() 的結果
 */
export function buildAnalysis(data) {
  const btc = data.BTC ?? {}
  const essentia = data.Essentia?.essentia ?? {}

  // 和弦與調性：調性由 Essentia 提供，沒有時用和弦推估；調名統一成常見寫法（Ab minor → G# minor）
  const timeline = btc.timeline ?? []
  const key = conventionalKey(parseKey(essentia.Key) ?? estimateKey(timeline))

  // 調音：A4 頻率由音分換算（不用 a4_hz，原因見 theory.js a4FromCents）
  const cents = finiteOrNull(btc.tuning?.tuning_offset_cents)

  // 節拍與速度：沒有整體 BPM 時用拍距中位數
  const beats = normalizeBeats(essentia.Beats)
  const rhythm = beatStats(beats)
  const bpm = finiteOrNull(essentia.BPM) ?? rhythm.beatBpm

  // 主旋律音高；後端還是舊版（沒有 PitchContour）時改顯示 PNG
  const contour = normalizeContour(essentia.PitchContour)
  const image = data.Essentia?.image_base64

  const lufs = finiteOrNull(essentia.LUFS)

  return {
    isMock: !!data._mock,

    timeline,
    hasChords: timeline.some((c) => !isNoChord(c.chord)),
    key,
    keyConfidence: key?.estimated ? null : finiteOrNull(essentia.KeyStrength),
    chordInfo: buildChordInfo(timeline, key),

    tuning: { cents, a4: a4FromCents(cents), statusText: btc.tuning?.status_text ?? null },
    contour,
    pitchStats: contour ? analyzePitch(contour, key) : null,
    pitchImage: image ? `data:${data.Essentia.image_mime || 'image/png'};base64,${image}` : null,

    beats,
    rhythm,
    bpm,
    hasRhythm: !!bpm || beats.length > 0,
    lufs,
    loudnessCurve: normalizeLoudnessCurve(essentia.LoudnessCurve),

    // 資料涵蓋的長度：取和弦、拍點、音高資料中最長的（播放器再跟音檔長度比）
    length: Math.max(
      timeline.length ? timeline[timeline.length - 1].start + timeline[timeline.length - 1].dur : 0,
      beats.length ? beats[beats.length - 1] + 0.5 : 0,
      contour ? contour.midi.length * contour.hop : 0,
      1,
    ),
  }
}
