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

// ---------------------------------------------------------------------------
// 上傳限制：跟後端 Back-end/backend/main.py 相同（原因寫在那裡）
// ---------------------------------------------------------------------------
export const MAX_UPLOAD_MB = 99
export const MAX_DURATION_MIN = 15

/** 後端拒絕這個檔案（格式、大小、長度）：不改用示範資料，直接顯示原因 */
export class UploadRejectedError extends Error {}

/**
 * 從 WAV 標頭算長度（秒）：只讀檔案開頭，不用整個載入；讀不懂時回傳 null
 * @param {File} file
 */
async function wavDuration(file) {
  const buf = await file.slice(0, 1024 * 1024).arrayBuffer()
  const v = new DataView(buf)
  const tag = (i) => String.fromCharCode(v.getUint8(i), v.getUint8(i + 1), v.getUint8(i + 2), v.getUint8(i + 3))
  if (buf.byteLength < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null
  let byteRate = null
  let i = 12
  while (i + 8 <= buf.byteLength) {
    const id = tag(i)
    const size = v.getUint32(i + 4, true)
    if (id === 'fmt ' && size >= 12 && i + 20 <= buf.byteLength) byteRate = v.getUint32(i + 16, true)
    else if (id === 'data') {
      // 串流錄音的 data 大小可能寫 0 或 0xFFFFFFFF，以實際剩下的長度為準
      const rest = file.size - i - 8
      const dataSize = size > 0 && size < rest ? size : rest
      return byteRate ? dataSize / byteRate : null
    }
    i += 8 + size + (size & 1)
  }
  return null
}

/**
 * 上傳前檢查大小與長度，省得傳了好幾十 MB 才被後端擋下
 * @returns {Promise<string|null>}  不符合時回傳原因
 */
export async function checkUpload(file) {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `檔案過大（${(file.size / 1024 / 1024).toFixed(1)} MB，上限 ${MAX_UPLOAD_MB} MB）`
  }
  try {
    const sec = await wavDuration(file)
    if (sec !== null && sec > MAX_DURATION_MIN * 60) {
      return `音檔太長（${(sec / 60).toFixed(1)} 分鐘，上限 ${MAX_DURATION_MIN} 分鐘）`
    }
  } catch {
    // 讀不到標頭就交給後端判斷
  }
  return null
}

/**
 * @param {File} file  WAV 音檔
 * @returns {Promise<object>}  後端回傳；改用示範資料時帶 _mock: true
 * @throws {UploadRejectedError}  後端拒絕這個檔案（400／413）
 */
export async function analyzeAudio(file) {
  const formData = new FormData()
  formData.append('audio', file)

  let response
  try {
    response = await fetch('/api/analyze', { method: 'POST', body: formData })
  } catch (err) {
    console.warn('[ChordLab] API unavailable, using mock data:', err.message)
    return getMockResponse()
  }

  // 檔案本身的問題：換成示範資料會讓人以為分析成功，所以直接顯示原因
  if (response.status === 400 || response.status === 413) {
    const body = await response.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail : null
    throw new UploadRejectedError(detail ?? (response.status === 413 ? `檔案過大（上限 ${MAX_UPLOAD_MB} MB）` : '檔案格式不符'))
  }

  try {
    if (!response.ok) throw new Error(`Server responded with ${response.status}`)
    return await response.json()
  } catch (err) {
    console.warn('[ChordLab] API unavailable, using mock data:', err.message)
    return getMockResponse()
  }
}
