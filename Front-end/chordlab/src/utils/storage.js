/**
 * 記住使用者的選擇（localStorage）
 * 無痕模式等情況存取會失敗：讀不到就當作沒選過，存不了就算了，不影響操作
 */

/** 讀取設定；不在 allowed 裡的值當作沒有 */
export function loadSetting(key, allowed) {
  try {
    const v = localStorage.getItem(key)
    return allowed.includes(v) ? v : null
  } catch {
    return null
  }
}

export function saveSetting(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 存不了就算了
  }
}
