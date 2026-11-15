/**
 * 數值統計：中位數、百分位數、占比的寫法
 */

export function median(arr) {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** 已排序陣列的百分位數（p：0～1） */
export function percentile(sorted, p) {
  if (!sorted.length) return null
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))
  return sorted[i]
}

/** 占比 → '17%'、'9.0%'（10% 以下多一位小數）；有出現但會被四捨五入成 0.0% 的寫成 '<0.1%' */
export function fmtPct(share) {
  if (share > 0 && share < 0.0005) return '<0.1%'
  return `${(share * 100).toFixed(share >= 0.1 ? 0 : 1)}%`
}
