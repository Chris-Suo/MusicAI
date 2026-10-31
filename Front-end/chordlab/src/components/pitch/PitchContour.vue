<script setup>
/**
 * 旋律音高曲線（取代後端 matplotlib 畫的 PNG）
 * - 縱軸每一列一個半音，調內音的列加底色；左邊標音名、右邊標頻率（Hz）
 *   整首時只標 C 與主音，放大後圖表變高、標出所有調內音
 * - 可縮放（整首～8×），放大後左右捲動；滑鼠移上去看音名、音分偏差、Hz；點一下從那裡播放
 * - 後端還沒輸出 PitchContour 時，退回顯示 PNG
 */
import { computed, ref } from 'vue'
import TimeRuler from '@/components/common/TimeRuler.vue'
import ZoomControl from '@/components/common/ZoomControl.vue'
import PlayHead from '@/components/common/PlayHead.vue'
import { useTimeAxis } from '@/composables/useTimeAxis.js'
import { usePlayback } from '@/composables/usePlayback.js'
import { percentile, fmtClock } from '@/utils/stats.js'
import { midiToName, midiToHz, fmtHz, scalePitchClasses } from '@/utils/music.js'

const props = defineProps({
  contour: { type: Object, default: null },
  imageSrc: { type: String, default: null },
  keyInfo: { type: Object, default: null },
  total: { type: Number, required: true },
})

const AXIS_W = 56
const HZ_W = 52
const pb = usePlayback()
const { plotEl, width, pxPerSec, x, ticks, zoomIdx, setZoom, eventTime, tipStyle } = useTimeAxis(computed(() => props.total))

// ---------------------------------------------------------------------------
// 縱軸範圍：主要音域上下各留 2 個半音，太遠的偵測誤差不畫
// ---------------------------------------------------------------------------
const yRange = computed(() => {
  const voiced = (props.contour?.midi ?? []).filter((v) => v !== null).sort((a, b) => a - b)
  if (!voiced.length) return null
  const lo = Math.round(percentile(voiced, 0.01)) - 2
  const hi = Math.max(lo + 12, Math.round(percentile(voiced, 0.99)) + 2)
  const rows = hi - lo + 1
  const rowH = Math.min(24, Math.max(9, Math.round((zoomIdx.value > 0 ? 480 : 340) / rows)))
  return { lo, hi, rows, rowH, height: rows * rowH }
})

const y = (m) => (yRange.value.hi + 0.5 - m) * yRange.value.rowH

const inKey = computed(() => scalePitchClasses(props.keyInfo))

const rows = computed(() => {
  const r = yRange.value
  if (!r) return []
  const tonic = props.keyInfo?.tonic
  // 列夠高（放大後）就標所有調內音，否則只標 C 與主音
  const labelAll = r.rowH >= 16 && inKey.value.size > 0
  const out = []
  for (let m = r.hi; m >= r.lo; m--) {
    const pc = ((m % 12) + 12) % 12
    out.push({
      m,
      top: (r.hi - m) * r.rowH,
      inKey: inKey.value.has(pc),
      tonic: props.keyInfo && pc === props.keyInfo.tonic,
      isC: pc === 0,
      label: pc === 0 || pc === tonic || (labelAll && inKey.value.has(pc)) ? midiToName(m, props.keyInfo) : '',
      hz: Math.round(midiToHz(m)),
    })
  }
  return out
})

// 曲線：沒有旋律或超出範圍的地方斷開
const path = computed(() => {
  const c = props.contour
  const r = yRange.value
  if (!c || !r) return ''
  let d = ''
  let pen = false
  for (let i = 0; i < c.midi.length; i++) {
    const v = c.midi[i]
    if (v === null || v < r.lo - 0.5 || v > r.hi + 0.5) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${(i * c.hop * pxPerSec.value).toFixed(1)} ${y(v).toFixed(1)}`
    pen = true
  }
  return d
})

// ---------------------------------------------------------------------------
// 互動
// ---------------------------------------------------------------------------
const hover = ref(null)

function onMove(e) {
  const { px, t } = eventTime(e)
  const c = props.contour
  const v = c.midi[Math.floor(t / c.hop)]
  if (v === null || v === undefined) {
    hover.value = { px, t, v: null }
    return
  }
  const nearest = Math.round(v)
  hover.value = {
    px,
    t,
    v,
    name: midiToName(v, props.keyInfo),
    cents: Math.round((v - nearest) * 100),
    hz: fmtHz(midiToHz(v)),
    inRange: v >= yRange.value.lo - 0.5 && v <= yRange.value.hi + 0.5,
  }
}

function onClick(e) {
  pb?.seek(eventTime(e).t)
}
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">旋律音高曲線</h3>
      </div>
      <ZoomControl v-if="contour && yRange" :zoom-idx="zoomIdx" @zoom="setZoom" />
    </div>

    <template v-if="contour && yRange">
      <div class="chart-wrap">
        <div class="layout">
          <!-- 固定的縱軸 -->
          <div class="y-axis" :style="{ width: AXIS_W + 'px' }" aria-hidden="true">
            <div class="y-spacer"></div>
            <div class="y-labels" :style="{ height: yRange.height + 'px' }">
              <span
                v-for="r in rows.filter((r) => r.label)"
                :key="r.m"
                class="y-label"
                :class="{ c: r.isC, tonic: r.tonic }"
                :style="{ top: r.top + yRange.rowH / 2 + 'px' }"
              >{{ r.label }}</span>
            </div>
          </div>

          <div ref="plotEl" class="plot-wrap">
            <div class="inner" :style="{ width: width + 'px' }">
              <TimeRuler :ticks="ticks" :px-per-sec="pxPerSec" />
              <svg
                :width="width"
                :height="yRange.height"
                class="plot"
                role="img"
                aria-label="旋律音高曲線"
                @mousemove="onMove"
                @mouseleave="hover = null"
                @click="onClick"
              >
                <rect
                  v-for="r in rows.filter((r) => r.inKey)"
                  :key="'k' + r.m"
                  x="0"
                  :y="r.top"
                  :width="width"
                  :height="yRange.rowH"
                  :class="r.tonic ? 'row-tonic' : 'row-key'"
                />
                <line v-for="t in ticks" :key="'t' + t" :x1="x(t)" :x2="x(t)" y1="0" :y2="yRange.height" class="svg-grid" />
                <line
                  v-for="r in rows.filter((r) => r.isC)"
                  :key="'c' + r.m"
                  x1="0"
                  :x2="width"
                  :y1="r.top + yRange.rowH"
                  :y2="r.top + yRange.rowH"
                  class="c-line"
                />
                <path :d="path" class="contour" />
                <template v-if="hover">
                  <line :x1="hover.px" :x2="hover.px" y1="0" :y2="yRange.height" class="cross" />
                  <circle v-if="hover.v !== null && hover.inRange" :cx="hover.px" :cy="y(hover.v)" r="5" class="cross-dot" />
                </template>
              </svg>
              <PlayHead :px-per-sec="pxPerSec" />
            </div>
          </div>

          <!-- 右側頻率軸（跟左側音名同一列） -->
          <div class="y-axis hz-axis" :style="{ width: HZ_W + 'px' }" aria-hidden="true">
            <div class="y-spacer hz-unit">Hz</div>
            <div class="y-labels" :style="{ height: yRange.height + 'px' }">
              <span
                v-for="r in rows.filter((r) => r.label)"
                :key="r.m"
                class="y-label"
                :class="{ tonic: r.tonic }"
                :style="{ top: r.top + yRange.rowH / 2 + 'px' }"
              >{{ r.hz }}</span>
            </div>
          </div>
        </div>

        <div v-if="hover" class="chart-tip" :style="{ ...tipStyle(hover.px, AXIS_W), top: '30px' }">
          <template v-if="hover.v !== null">
            <strong>{{ hover.name }}<span class="cents">{{ hover.cents > 0 ? '+' : '' }}{{ hover.cents }} 音分</span></strong>
            <span>{{ hover.hz }}</span>
          </template>
          <span v-else class="muted">沒有旋律</span>
          <span class="muted">{{ fmtClock(hover.t) }}・點一下從這裡播放</span>
        </div>
      </div>

      <div v-if="keyInfo" class="legend foot">
        <span><i class="swatch key-sw"></i>調內音</span>
        <span><i class="swatch tonic-sw"></i>主音</span>
      </div>
    </template>

    <template v-else-if="imageSrc">
      <p class="note fallback-note">後端還沒有提供音高數據（需更新 pitch.py），先顯示靜態圖。</p>
      <div class="img-frame">
        <img :src="imageSrc" alt="音高曲線（靜態圖）" />
      </div>
    </template>
    <div v-else class="note">沒有音高分析結果</div>
  </div>
</template>

<style scoped>
.chart-wrap {
  position: relative;
}

.layout {
  display: flex;
}

.y-axis {
  flex-shrink: 0;
  border-right: 1px solid var(--axis);
}

/* 對齊時間刻度 */
.y-spacer {
  height: 22px;
}

.y-labels {
  position: relative;
}

.y-label {
  position: absolute;
  right: 8px;
  transform: translateY(-50%);
  font-size: 12px;
  line-height: 1;
  color: var(--muted);
  white-space: nowrap;
}

.y-label.c {
  color: var(--text2);
}

.y-label.tonic {
  color: var(--text);
  font-weight: 700;
}

.plot-wrap {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.inner {
  position: relative;
  /* 最右邊的刻度文字超出內容寬度時裁掉，避免整首時出現捲軸 */
  overflow-x: clip;
}

.hz-axis {
  border-right: none;
  border-left: 1px solid var(--axis);
}

.hz-axis .y-label {
  right: auto;
  left: 8px;
  font-variant-numeric: tabular-nums;
}

.hz-unit {
  display: flex;
  align-items: flex-end;
  padding: 0 0 4px 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}

.plot {
  display: block;
  cursor: crosshair;
}

.row-key {
  fill: var(--surface2);
}

.row-tonic {
  fill: var(--accent-soft);
}

.c-line {
  stroke: var(--axis);
  stroke-width: 1;
}

.contour {
  fill: none;
  stroke: var(--c-pitch);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.cross {
  stroke: var(--border-strong);
  stroke-width: 1;
  pointer-events: none;
}

.cross-dot {
  fill: var(--c-pitch);
  stroke: var(--surface);
  stroke-width: 2;
  pointer-events: none;
}

.cents {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--muted);
  margin-left: 8px;
}

.foot {
  margin-top: 0.75rem;
}

.key-sw {
  background: var(--surface2);
  border: 1px solid var(--border-strong);
}

.tonic-sw {
  background: var(--accent-soft);
  border: 1px solid var(--accent);
}

.fallback-note {
  margin-bottom: 0.75rem;
}

/* PNG 是白底，深色主題下也保留白色外框，避免刺眼的硬邊 */
.img-frame {
  background: #ffffff;
  border-radius: var(--radius-md);
  padding: 8px;
  border: 1px solid var(--border);
}

.img-frame img {
  display: block;
  width: 100%;
  height: auto;
}
</style>
