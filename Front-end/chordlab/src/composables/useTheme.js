/**
 * 白天／黑夜主題（全頁共用一份狀態）
 * - 使用者切換過就記住；沒切換過就跟著系統設定
 * - 實際的色票在 assets/main.css 的 :root / :root[data-theme='dark']
 * - index.html 在畫面出現前就先套用一次，避免閃一下
 */
import { ref, watch } from 'vue'
import { loadSetting, saveSetting } from '@/utils/storage.js'

const STORAGE_KEY = 'chordlab.theme'
const THEMES = ['light', 'dark']

const darkQuery = window.matchMedia?.('(prefers-color-scheme: dark)')
const systemTheme = () => (darkQuery?.matches ? 'dark' : 'light')

const theme = ref(document.documentElement.dataset.theme || loadSetting(STORAGE_KEY, THEMES) || systemTheme())
let userChose = loadSetting(STORAGE_KEY, THEMES) !== null

watch(
  theme,
  (t) => {
    document.documentElement.dataset.theme = t
  },
  { immediate: true },
)

darkQuery?.addEventListener?.('change', (e) => {
  if (!userChose) theme.value = e.matches ? 'dark' : 'light'
})

export function useTheme() {
  function setTheme(t) {
    theme.value = t
    userChose = true
    saveSetting(STORAGE_KEY, t)
  }

  return { theme, setTheme }
}
