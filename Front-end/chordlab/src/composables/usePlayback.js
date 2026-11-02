/**
 * 全頁共用的播放器
 * - ResultsPanel 建立一個（createPlayback）並 provide 下去，各圖表用 usePlayback() 取得
 * - 所有圖表共用同一個播放位置：音高曲線、節拍時間軸、響度曲線、級數格都會跟著走
 */
import { ref, computed, watch, inject } from 'vue'

export const PLAYBACK_KEY = Symbol('playback')

/**
 * @param {object} opts
 * @param {import('vue').Ref<File|null>} opts.file
 */
export function createPlayback({ file }) {
  const audio = new Audio()
  audio.preload = 'metadata'

  const url = ref(null)
  const current = ref(0)
  const duration = ref(0)
  const playing = ref(false)
  let raf = 0

  watch(
    file,
    (f) => {
      audio.pause()
      if (url.value) URL.revokeObjectURL(url.value)
      url.value = f ? URL.createObjectURL(f) : null
      if (url.value) audio.src = url.value
      else audio.removeAttribute('src')
      current.value = 0
      duration.value = 0
    },
    { immediate: true },
  )

  // 有開始播放過或跳轉過，圖表才畫播放頭
  const active = computed(() => playing.value || current.value > 0)

  function frame() {
    current.value = audio.currentTime
    if (playing.value) raf = requestAnimationFrame(frame)
  }

  audio.addEventListener('play', () => {
    playing.value = true
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(frame)
  })
  const stop = () => {
    playing.value = false
    cancelAnimationFrame(raf)
    current.value = audio.currentTime
  }
  audio.addEventListener('pause', stop)
  audio.addEventListener('ended', stop)
  audio.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(audio.duration)) duration.value = audio.duration
  })

  async function toggle() {
    if (!url.value) return
    if (audio.paused) {
      try {
        await audio.play()
      } catch (e) {
        console.warn('[ChordLab] 無法播放音檔：', e)
      }
    } else {
      audio.pause()
    }
  }

  function seek(t) {
    const max = duration.value || Infinity
    const clamped = Math.min(Math.max(0, t), max)
    current.value = clamped
    if (url.value) audio.currentTime = clamped
  }

  function dispose() {
    cancelAnimationFrame(raf)
    audio.pause()
    if (url.value) URL.revokeObjectURL(url.value)
  }

  return {
    hasAudio: computed(() => !!url.value),
    current,
    duration,
    playing,
    active,
    toggle,
    seek,
    dispose,
  }
}

export function usePlayback() {
  return inject(PLAYBACK_KEY, null)
}
