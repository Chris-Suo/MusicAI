/**
 * 分析結果檔：把後端回傳的分析結果存成 .json 下載，之後可以再載入，不用重新上傳音檔分析
 *
 * 檔案格式：
 * {
 *   app: 'musitonic-lab', kind: 'analysis-result', version: 1,
 *   fileName: '原本的音檔名稱.wav',
 *   savedAt: '2026-11-21T15:37:00.000Z',
 *   data: { BTC: {...}, Essentia: {...} }   // api.js analyzeAudio() 的結果，原封不動（格式見 api.js）
 * }
 * - 音檔本身不存（WAV 很大）；載入結果後可以另外選音檔來播放
 * - 載入時也接受直接存下來的後端回傳（最外層就是 { BTC, Essentia }）
 */

const APP = 'musitonic-lab'
const KIND = 'analysis-result'
const VERSION = 1

/** 選的檔案是不是分析結果檔（.json） */
export const isResultFile = (file) => /\.json$/i.test(file.name) || file.type === 'application/json'

/** 'song.wav' → 'song.musitonic.json' */
export function resultFileName(audioName) {
  const base = (audioName || 'analysis').replace(/\.[^.]+$/, '')
  return `${base}.musitonic.json`
}

/**
 * 下載分析結果
 * @param {object} data       api.js analyzeAudio() 的結果
 * @param {string} fileName   原本的音檔名稱
 */
export function downloadResult(data, fileName) {
  const payload = { app: APP, kind: KIND, version: VERSION, fileName, savedAt: new Date().toISOString(), data }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = resultFileName(fileName)
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 等瀏覽器開始下載再釋放
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 看起來像後端回傳的分析資料 */
const looksLikeAnalysis = (d) => !!d && typeof d === 'object' && (d.BTC || d.Essentia)

/**
 * 讀取分析結果檔
 * @param {File} file
 * @returns {Promise<{ data: object, fileName: string, savedAt: string|null }>}
 * @throws {Error}  檔案不是分析結果時，message 是給使用者看的說明
 */
export async function readResultFile(file) {
  let json
  try {
    json = JSON.parse(await file.text())
  } catch {
    throw new Error('這個檔案不是有效的 JSON，無法載入')
  }

  // 本程式下載的格式
  if (json?.app === APP && json?.kind === KIND) {
    if (json.version > VERSION) throw new Error('這個分析結果檔是較新版本產生的，請更新網頁後再試')
    if (!looksLikeAnalysis(json.data)) throw new Error('分析結果檔的內容不完整，無法載入')
    return { data: json.data, fileName: json.fileName || file.name, savedAt: json.savedAt ?? null }
  }

  // 直接存下來的後端回傳
  if (looksLikeAnalysis(json)) return { data: json, fileName: file.name, savedAt: null }

  throw new Error('這個檔案不是 Musitonic Lab 的分析結果，無法載入')
}
