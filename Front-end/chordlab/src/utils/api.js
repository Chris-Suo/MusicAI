/**
 * 上傳 WAV 給後端分析（BTC 和弦辨識 + Essentia 音訊分析）
 * 後端連不到（或回傳錯誤）時改用示範資料，方便在沒有伺服器的情況下調整畫面。
 *
 * 後端回傳格式（畫面怎麼使用見 analysis.js）：
 * {
 *   BTC: {
 *     tuning: { a4_hz, tuning_offset_cents, status, status_text },
 *     timeline: Array<{ chord: string, start: number, dur: number }>  // chord 例如 "A:min"
 *   },
 *   Essentia: {
 *     essentia: {
 *       LUFS: number, BPM: number,
 *       LoudnessRange: number, // 動態範圍（LU）
 *       Beats: number[],      // 每一拍的時間點（秒），例如 [0.42, 1.04, 1.66, ...]
 *       Key: string,          // 例如 "C major"（由 Essentia KeyExtractor 計算）
 *       KeyStrength: number,  // 調性強度，前端當作信心度
 *       KeyProfile: string,
 *       PitchContour: { hop: number, midi: (number|null)[] },  // 主旋律音高，約每 50ms 一點（MIDI，A4 = 69）
 *       LoudnessCurve: { hop: number, lufs: number[] }        // 短時響度，每 0.5 秒一點
 *     },
 *     image_base64: string | null,   // 舊版音高圖（沒有 PitchContour 時前端才顯示）
 *     image_mime: string
 *   }
 * }
 */
import { getMockResponse } from '@/utils/mockResponse.js'

/**
 * @param {File} file  WAV 音檔
 * @returns {Promise<object>}  後端回傳；改用示範資料時帶 _mock: true
 */
export async function analyzeAudio(file) {
  const formData = new FormData()
  formData.append('audio', file)

  try {
    const response = await fetch('/api/analyze', { method: 'POST', body: formData })
    if (!response.ok) throw new Error(`Server responded with ${response.status}`)
    return await response.json()
  } catch (err) {
    console.warn('[ChordLab] API unavailable, using mock data:', err.message)
    return getMockResponse()
  }
}
