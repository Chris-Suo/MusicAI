/**
 * 時間（秒）：在時間軸上找位置、時間刻度、時間格式
 */

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

/**
 * 依 start 排序、不重疊的區段中，包含 t 的那一段索引；沒有時回傳 -1
 * @param {{ start: number }[]} segments
 * @param {(s: object) => number} [endOf]  區段的結束時間，預設 start + dur
 */
export function segmentAt(segments, t, endOf = (s) => s.start + s.dur) {
  let lo = 0
  let hi = segments.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const s = segments[mid]
    if (t < s.start) hi = mid - 1
    else if (t >= endOf(s)) lo = mid + 1
    else return mid
  }
  return -1
}

/** 時間軸刻度：挑一個讓標籤間距至少 minPx 的間隔 */
export function timeTicks(total, pxPerSec, minPx = 72) {
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]
  const step = steps.find((s) => s * pxPerSec >= minPx) ?? 600
  const ticks = []
  for (let t = 0; t <= total + 1e-6; t += step) ticks.push(+t.toFixed(3))
  return ticks
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
