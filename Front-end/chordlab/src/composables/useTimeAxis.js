/**
 * 可縮放的時間軸（和弦時間軸、音高曲線、節拍時間軸共用）
 * - 1× 時整首歌剛好放進可見寬度，放大後可左右捲動
 * - 縮放時保持畫面中央（播放中則以播放位置）不動
 */
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { timeTicks } from '@/utils/stats.js'
import { usePlayback } from '@/composables/usePlayback.js'

export const ZOOMS = [1, 2, 4, 8, 16]

/**
 * @param {import('vue').Ref<number>} total  總秒數
 */
export function useTimeAxis(total) {
  const pb = usePlayback()
  const scroller = ref(null)
  const viewWidth = ref(800)
  const scrollLeft = ref(0)
  const zoomIdx = ref(0)
  let obs = null
  const onScroll = () => {
    scrollLeft.value = scroller.value?.scrollLeft ?? 0
  }

  const zoom = computed(() => ZOOMS[zoomIdx.value])
  const pxPerSec = computed(() => (viewWidth.value / Math.max(total.value, 1)) * zoom.value)
  const contentWidth = computed(() => Math.max(viewWidth.value, Math.ceil(total.value * pxPerSec.value)))
  const x = (t) => t * pxPerSec.value
  const ticks = computed(() => timeTicks(total.value, pxPerSec.value))

  async function setZoom(delta) {
    const el = scroller.value
    const centerT = el ? (el.scrollLeft + el.clientWidth / 2) / pxPerSec.value : 0
    zoomIdx.value = Math.min(ZOOMS.length - 1, Math.max(0, zoomIdx.value + delta))
    await nextTick()
    if (el) {
      const anchor = pb?.playing.value ? pb.current.value : centerT
      el.scrollLeft = Math.max(0, x(anchor) - el.clientWidth / 2)
    }
  }

  /** 滑鼠事件 → { px, t }（相對於事件目標的左緣） */
  function eventTime(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    return { px, t: Math.min(Math.max(0, px / pxPerSec.value), total.value) }
  }

  /** 把某個時間點捲進畫面 */
  async function reveal(t) {
    await nextTick()
    const el = scroller.value
    if (!el) return
    const px = x(t)
    if (px < el.scrollLeft || px > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = Math.max(0, px - 24)
  }

  /**
   * 浮動提示的位置：提示放在捲動區外面（才不會被裁掉），所以要扣掉捲動距離；
   * 靠右邊時翻到游標左側
   * @param {number} px  內容座標
   * @param {number} [offset=0]  捲動區左側到提示容器左緣的距離（例如左側有固定的軸標籤欄）
   */
  function tipStyle(px, offset = 0) {
    const left = px - scrollLeft.value + offset
    const flip = left > offset + viewWidth.value - 240
    return { left: left + 'px', transform: flip ? 'translateX(calc(-100% - 14px))' : 'translateX(14px)' }
  }

  onMounted(() => {
    if (!scroller.value) return
    viewWidth.value = scroller.value.clientWidth || viewWidth.value
    obs = new ResizeObserver(() => {
      // 分頁隱藏時寬度是 0，保留上次的值
      const w = scroller.value?.clientWidth
      if (w) viewWidth.value = w
    })
    obs.observe(scroller.value)
    scroller.value.addEventListener('scroll', onScroll, { passive: true })
  })
  onBeforeUnmount(() => {
    obs?.disconnect()
    scroller.value?.removeEventListener('scroll', onScroll)
  })

  return { scroller, viewWidth, scrollLeft, zoomIdx, zoom, pxPerSec, contentWidth, x, ticks, setZoom, eventTime, reveal, tipStyle }
}
