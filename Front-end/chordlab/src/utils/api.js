/**
 * 上傳 WAV 給後端分析（BTC 和弦辨識 + Essentia 音訊分析）。
 *
 * 開發時若後端連不到，會回傳 mock 資料，方便在沒有伺服器的情況下調整 UI。
 * （更完整的假後端：Back-end/mock/mock_server.py）
 *
 * 後端回傳格式：
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
 *
 * 連不到後端時回傳的 mock 資料會帶 _mock: true，畫面上會提示「示範資料」。
 *
 * @param {File} file - WAV audio file
 * @returns {Promise<{ BTC: object, Essentia: object }>}
 */
export async function analyzeAudio(file) {
  const formData = new FormData()
  formData.append('audio', file)

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`)
    }

    return await response.json()
  } catch (err) {
    console.warn('[ChordLab] API unavailable, using mock data:', err.message)
    return getMockResponse()
  }
}

/**
 * Mock response for development / testing（格式與後端相同）
 */
function getMockResponse() {
  // C 大調的簡單旋律（每 50ms 一點），和弦 C–Am–F–G 各兩拍一音
  const hop = 0.05
  const melody = [64, 67, 69, 67, 65, 64, 62, 60, 64, 67, 72, 71, 69, 67, 65, 67, 64, 62, 60, 60]
  const midi = Array.from({ length: Math.round(19.04 / hop) }, (_, i) => {
    const t = i * hop
    if (t < 0.74) return null
    const k = Math.floor((t - 0.74) / 0.95)
    const inNote = (t - 0.74) % 0.95
    if (k >= melody.length || inNote > 0.85) return null
    return +(melody[k] + 0.15 * Math.sin(t * 34)).toFixed(2)
  })
  const lufs = Array.from({ length: 39 }, (_, i) => +(-14.2 + 3 * Math.sin(i / 5) - (i < 3 ? (3 - i) * 5 : 0)).toFixed(1))

  return {
    _mock: true,
    BTC: {
      tuning: {
        a4_hz: 440.0,
        tuning_offset_cents: 4.8,
        status: 'standard',
        status_text: '標準 440 Hz',
      },
      timeline: [
        { chord: 'N', start: 0.0, dur: 0.743 },
        { chord: 'C', start: 0.743, dur: 2.137 },
        { chord: 'A:min', start: 2.88, dur: 1.951 },
        { chord: 'F', start: 4.831, dur: 2.229 },
        { chord: 'G', start: 7.06, dur: 2.043 },
        { chord: 'C', start: 9.103, dur: 1.858 },
        { chord: 'E:min', start: 10.961, dur: 1.858 },
        { chord: 'F:maj7', start: 12.819, dur: 2.136 },
        { chord: 'G:7', start: 14.955, dur: 2.044 },
        { chord: 'C', start: 16.999, dur: 2.043 },
      ],
    },
    Essentia: {
      essentia: {
        LUFS: -14.2,
        LoudnessRange: 6.4,
        BPM: 96.3,
        Beats: Array.from({ length: 30 }, (_, i) => +(0.42 + i * 0.623).toFixed(3)),
        Key: 'C major',
        KeyStrength: 0.82,
        KeyProfile: 'bgate',
        PitchContour: { hop, midi },
        LoudnessCurve: { hop: 0.5, lufs },
      },
      image_base64: null,
      image_mime: 'image/png',
    },
  }
}
