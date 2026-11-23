/**
 * 情緒軌跡的播放同步（和弦、音高、速度、綜合軌跡四張卡共用；最終值沒有時間軸，用不到）
 * - 目前播放到第幾步
 * - 換步時紅點沿曲線慢慢移過去：位置由播放時間算，暫停時停在半路，跳轉時直接算出該在的位置
 * - 最近幾步的紅色軌跡（正在移動的那一步只畫到紅點的位置）
 */
import { computed } from 'vue'
import { usePlayback } from '@/composables/usePlayback.js'
import { px, py, geom, pointOn, partialCurve, curve, easeInOut } from '@/utils/emotionWheel.js'
import { indexAt } from '@/utils/time.js'

/** 同一個座標的點畫成一個（例如速度回到同一個區間），用這個當 key */
export const posKey = (emo) => `${emo.x},${emo.y}`

/**
 * @param {import('vue').Ref<{ emo: { x: number, y: number }, start: number, end: number }[]>} steps  依時間排序
 * @param {object} [opts]
 * @param {number} [opts.trail=4]        標出最近幾步
 * @param {number} [opts.moveShare=0.75] 移動時間占這一步長度的比例
 * @param {number} [opts.moveMax=2.5]    移動時間最多幾秒
 */
export function useTrajectoryPlayback(steps, { trail: trailLen = 4, moveShare = 0.75, moveMax = 2.5 } = {}) {
  const pb = usePlayback()
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  const starts = computed(() => steps.value.map((s) => s.start))
  const currentIndex = computed(() => (pb.active.value ? indexAt(starts.value, pb.current.value) : -1))
  const currentStep = computed(() => steps.value[currentIndex.value] ?? null)

  const moveProgress = computed(() => {
    const i = currentIndex.value
    if (i < 1 || reduceMotion) return 1
    const step = steps.value[i]
    const next = steps.value[i + 1]
    const dur = (next ? next.start : step.end) - step.start
    const moveTime = Math.min(moveMax, Math.max(0.05, dur * moveShare))
    return easeInOut(Math.min(1, Math.max(0, (pb.current.value - step.start) / moveTime)))
  })

  const markerPos = computed(() => {
    const step = currentStep.value
    if (!step) return null
    const p = moveProgress.value
    if (p >= 1) return { x: px(step.emo.x), y: py(step.emo.y) }
    return pointOn(geom(steps.value[currentIndex.value - 1].emo, step.emo), p)
  })

  const trail = computed(() => {
    const i = currentIndex.value
    if (i < 1) return []
    const out = []
    for (let k = Math.max(1, i - trailLen + 1); k <= i; k++) {
      const a = steps.value[k - 1].emo
      const b = steps.value[k].emo
      const moving = k === i && moveProgress.value < 1
      out.push({ key: k, d: moving ? partialCurve(a, b, moveProgress.value) : curve(a, b), arrow: !moving, opacity: 1 - (i - k) * (0.7 / trailLen) })
    }
    return out
  })

  return { pb, currentIndex, currentStep, moveProgress, markerPos, trail }
}
