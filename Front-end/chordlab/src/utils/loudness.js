/**
 * 響度（LUFS）
 */

export const STREAMING_LUFS = -14
const SILENCE_LUFS = -70

/** 後端的 LoudnessCurve → { hop, lufs[] }（缺值當作靜音）；格式不對回傳 null */
export function normalizeLoudnessCurve(raw) {
  if (!raw || !Array.isArray(raw.lufs) || !(raw.hop > 0)) return null
  return { hop: raw.hop, lufs: raw.lufs.map((v) => (Number.isFinite(v) ? v : SILENCE_LUFS)) }
}

/** 整體響度的白話描述 */
export function loudnessLevel(lufs) {
  if (!Number.isFinite(lufs)) return null
  if (lufs >= -10) return '很大聲'
  if (lufs >= -13) return '偏大聲'
  if (lufs >= -15) return '接近串流標準'
  if (lufs >= -20) return '適中'
  if (lufs >= -26) return '偏小聲'
  return '很小聲'
}
