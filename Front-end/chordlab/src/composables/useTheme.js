/**
 * 白天／黑夜主題
 * - 使用者切換過就記在 localStorage；沒切換過就跟著系統設定
 * - 實際的色票在 assets/main.css 的 :root / :root[data-theme='dark']
 */
import { ref, watch } from 'vue'

const STORAGE_KEY = 'chordlab.theme'

function readSaved() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const theme = ref(document.documentElement.dataset.theme || readSaved() || systemTheme())
let userChose = readSaved() !== null

watch(
  theme,
  (t) => {
    document.documentElement.dataset.theme = t
  },
  { immediate: true },
)

window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', (e) => {
  if (!userChose) theme.value = e.matches ? 'dark' : 'light'
})

export function useTheme() {
  function setTheme(t) {
    theme.value = t
    userChose = true
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      // 無痕模式等情況存不了，不影響切換
    }
  }

  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  return { theme, setTheme, toggleTheme }
}
