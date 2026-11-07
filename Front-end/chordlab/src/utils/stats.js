/**
 * 數值統計：中位數、百分位數、占比排行
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

/**
 * 依占比由大到小排好的項目，取前幾名、其餘合併成「其他」
 * - 只剩一項時直接列出，不合併成「其他 1 種」
 * - minShare：占比太小的不單獨列
 * @template {{ share: number }} T
 * @param {T[]} sorted
 * @returns {{ top: T[], rest: T[] }}
 */
export function splitTop(sorted, max = 6, minShare = 0) {
  let n = Math.min(sorted.length, max)
  while (n > 0 && sorted[n - 1].share < minShare) n--
  if (sorted.length === n + 1 && sorted[n].share >= minShare) n++
  return { top: sorted.slice(0, n), rest: sorted.slice(n) }
}

/** 占比 → '17%'、'9.0%'（10% 以下多一位小數） */
export function fmtPct(share) {
  return `${(share * 100).toFixed(share >= 0.1 ? 0 : 1)}%`
}
