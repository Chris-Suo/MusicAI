/**
 * 全頁共用的播放器
 * - ResultsPanel 建立一個（createPlayback）並 provide 下去，各圖表用 usePlayback() 取得
 * - 所有圖表共用同一個播放位置：和弦時間軸、音高曲線、節拍時間軸、級數格都會跟著走
 * - 節拍器：播放時每走到下一拍響一聲，小節第一拍音比較高
 */
import { ref, computed, watch, inject } from 'vue'
import { indexAt } from '@/utils/stats.js'

export const PLAYBACK_KEY = Symbol('playback')

/**
 * @param {object} opts
 * @param {import('vue').Ref<File|null>} opts.file
 * @param {import('vue').Ref<number[]>} opts.beats  已排序的拍點（秒）
 * @param {number} [opts.beatsPerBar=4]
 */
export function createPlayback({ file, beats, beatsPerBar = 4 }) {
  const audio = new Audio()
  audio.preload = 'metadata'

  const url = ref(null)
  const current = ref(0)
  const duration = ref(0)
  const playing = ref(false)
  const metronome = ref(false)
  let raf = 0
  let lastBeat = -1
  let actx = null

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

  const beatIndex = computed(() => indexAt(beats.value, current.value))
  const barIndex = computed(() => (beatIndex.value < 0 ? -1 : Math.floor(beatIndex.value / beatsPerBar)))
  const beatInBar = computed(() => (beatIndex.value < 0 ? -1 : beatIndex.value % beatsPerBar))
  // 有開始播放過或跳轉過，圖表才畫播放頭
  const active = computed(() => playing.value || current.value > 0)

  function click(accent) {
    if (!actx) return
    const now = actx.currentTime
    const osc = actx.createOscillator()
    const gain = actx.createGain()
    osc.frequency.value = accent ? 1600 : 1000
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)
    osc.connect(gain).connect(actx.destination)
    osc.start(now)
    osc.stop(now + 0.06)
  }

  function frame() {
    current.value = audio.currentTime
    const i = beatIndex.value
    // 只有「往前走到下一拍」才響，跳轉時不響
    if (metronome.value && i >= 0 && i === lastBeat + 1) click(i % beatsPerBar === 0)
    lastBeat = i
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
    if (!actx) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (Ctx) actx = new Ctx()
    }
    if (actx?.state === 'suspended') actx.resume()
    if (audio.paused) {
      lastBeat = indexAt(beats.value, audio.currentTime)
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
    lastBeat = indexAt(beats.value, clamped)
    if (url.value) audio.currentTime = clamped
  }

  function dispose() {
    cancelAnimationFrame(raf)
    audio.pause()
    if (url.value) URL.revokeObjectURL(url.value)
    actx?.close?.()
  }

  return {
    hasAudio: computed(() => !!url.value),
    current,
    duration,
    playing,
    metronome,
    active,
    beatIndex,
    barIndex,
    beatInBar,
    beatsPerBar,
    toggle,
    seek,
    dispose,
  }
}

export function usePlayback() {
  return inject(PLAYBACK_KEY, null)
}

/**
 * 播放時讓可捲動的時間軸跟著播放頭走
 * @param {import('vue').Ref<HTMLElement|null>} scroller
 * @param {(t:number)=>number} toPx
 */
export function useFollowPlayhead(scroller, toPx) {
  const pb = usePlayback()
  if (!pb) return
  watch(pb.current, (t) => {
    const el = scroller.value
    if (!el || !pb.playing.value || el.scrollWidth <= el.clientWidth) return
    const px = toPx(t)
    if (px < el.scrollLeft + 20 || px > el.scrollLeft + el.clientWidth - 60) {
      el.scrollLeft = Math.max(0, px - el.clientWidth * 0.25)
    }
  })
}
