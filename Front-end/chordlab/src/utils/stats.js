/**
 * 數值與時間的共用小工具
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

/** 已排序的時間陣列中，最後一個 <= t 的索引；都比 t 大時回傳 -1 */
export function indexAt(sorted, t) {
  let lo = 0
  let hi = sorted.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] <= t + 1e-4) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans
}

/** 依 start 排序的區段（{ start, dur }）中，包含 t 的那一段索引 */
export function segmentAt(segments, t) {
  let lo = 0
  let hi = segments.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const s = segments[mid]
    if (t < s.start) hi = mid - 1
    else if (t >= s.start + s.dur) lo = mid + 1
    else return mid
  }
  return -1
}

export function pct(part, whole, digits = 0) {
  if (!whole) return '0%'
  return `${((part / whole) * 100).toFixed(digits)}%`
}

/** 秒 → '1:23.4' */
export function fmtClock(sec) {
  if (!Number.isFinite(sec)) return '0:00.0'
  const m = Math.floor(sec / 60)
  const s = (sec % 60).toFixed(1).padStart(4, '0')
  return `${m}:${s}`
}

/** 時間刻度標籤：'15s'、'1:30' */
export function fmtTick(sec) {
  if (sec < 60) return (Number.isInteger(sec) ? sec : sec.toFixed(1)) + 's'
  return Math.floor(sec / 60) + ':' + String(Math.round(sec % 60)).padStart(2, '0')
}

/** 時間軸刻度：挑一個讓標籤間距至少 minPx 的間隔 */
export function timeTicks(total, pxPerSec, minPx = 72) {
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]
  const step = steps.find((s) => s * pxPerSec >= minPx) ?? 600
  const ticks = []
  for (let t = 0; t <= total + 1e-6; t += step) ticks.push(+t.toFixed(3))
  return ticks
}
