<script setup>
/**
 * 音量（響度）
 * - 整體響度（LUFS）放在參考尺上：廣播 −23、串流平台 −14、大聲的流行母帶約 −9
 * - 有 LoudnessCurve 時：響度隨時間變化的曲線
 */
import { computed, ref } from 'vue'
import PlayHead from '@/components/common/PlayHead.vue'
import TimeRuler from '@/components/common/TimeRuler.vue'
import { useTimeAxis } from '@/composables/useTimeAxis.js'
import { usePlayback } from '@/composables/usePlayback.js'
import { loudnessLevel, STREAMING_LUFS } from '@/utils/music.js'
import { fmtClock } from '@/utils/stats.js'

const props = defineProps({
  // 沒有響度資料時 ResultsPanel 不顯示這張卡
  lufs: { type: Number, required: true },
  curve: { type: Object, default: null },
  total: { type: Number, required: true },
})

// ---------------------------------------------------------------------------
// 參考尺
// ---------------------------------------------------------------------------
const S_MIN = -36
const S_MAX = -6
const W = 600
const REFS = [
  { v: -23, label: '廣播標準' },
  { v: STREAMING_LUFS, label: '串流平台' },
  { v: -9, label: '流行母帶' },
]
const S_TICKS = [-36, -30, -24, -18, -12, -6]
const sx = (v) => ((Math.min(S_MAX, Math.max(S_MIN, v)) - S_MIN) / (S_MAX - S_MIN)) * W

const level = computed(() => loudnessLevel(props.lufs))

// ---------------------------------------------------------------------------
// 響度曲線
// ---------------------------------------------------------------------------
const pb = usePlayback()
const { plotEl, width, pxPerSec, x, ticks, eventTime, tipStyle } = useTimeAxis(computed(() => props.total))

const PLOT_H = 150
const PAD = 8

const audible = computed(() => (props.curve?.lufs ?? []).filter((v) => v > -60))

const yRange = computed(() => {
  const vals = audible.value
  if (!vals.length) return null
  const max = Math.ceil((Math.max(...vals) + 1) / 3) * 3
  const min = Math.max(max - 30, Math.floor((Math.min(...vals) - 1) / 3) * 3)
  return { min, max }
})

const y = (v) => {
  const { min, max } = yRange.value
  const c = Math.min(max, Math.max(min, v))
  return PAD + (1 - (c - min) / (max - min)) * (PLOT_H - PAD * 2)
}

const yTicks = computed(() => {
  const r = yRange.value
  if (!r) return []
  const step = r.max - r.min > 18 ? 6 : 3
  const out = []
  for (let v = r.max; v >= r.min; v -= step) out.push(v)
  return out
})

const curvePath = computed(() => {
  const c = props.curve
  if (!c || !yRange.value) return { line: '', area: '' }
  const pts = c.lufs.map((v, i) => [x(i * c.hop), y(v)])
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join('')
  const area = `${line}L${pts[pts.length - 1][0].toFixed(1)} ${PLOT_H}L0 ${PLOT_H}Z`
  return { line, area }
})

const hover = ref(null)
function onMove(e) {
  const { px, t } = eventTime(e)
  const c = props.curve
  const v = c.lufs[Math.min(c.lufs.length - 1, Math.round(t / c.hop))]
  hover.value = { px, t, v }
}

const fmtLufs = (v) => (v <= -60 ? '靜音' : `${v.toFixed(1)} LUFS`)
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">音量</h3>
        <p class="card-desc">LUFS 是依人耳感受計算的響度，越接近 0 越大聲</p>
      </div>
    </div>

    <div class="top">
      <div class="hero">
        <span class="val">{{ lufs.toFixed(1) }}<span class="unit">LUFS</span></span>
        <span class="level">{{ level }}</span>
      </div>

      <svg :viewBox="`0 -30 ${W} 92`" class="scale" role="img" :aria-label="`整體響度 ${lufs.toFixed(1)} LUFS`">
        <rect x="0" y="12" :width="W" height="14" rx="7" class="scale-track" />
        <rect x="0" y="12" :width="sx(lufs)" height="14" rx="7" class="scale-fill" />
        <g v-for="r in REFS" :key="r.v">
          <line :x1="sx(r.v)" :x2="sx(r.v)" y1="6" y2="32" class="ref-line" />
          <text :x="sx(r.v)" y="0" text-anchor="middle" class="ref-text">{{ r.label }} {{ r.v }}</text>
        </g>
        <text v-for="t in S_TICKS" :key="t" :x="sx(t)" y="52" text-anchor="middle" class="svg-axis-text">{{ t }}</text>
        <g :transform="`translate(${sx(lufs)}, 0)`">
          <circle cx="0" cy="19" r="9" class="knob" />
        </g>
        <text :x="0" y="-18" class="end-text">小聲</text>
        <text :x="W" y="-18" text-anchor="end" class="end-text">大聲</text>
      </svg>
    </div>

    <template v-if="curve && yRange">
      <div class="sub-title">響度變化</div>
      <div class="chart-wrap">
        <div class="layout">
          <div class="y-axis" aria-hidden="true">
            <div style="height: 22px"></div>
            <div class="y-ticks" :style="{ height: PLOT_H + 'px' }">
              <span v-for="t in yTicks" :key="t" :style="{ top: y(t) + 'px' }">{{ t }}</span>
            </div>
          </div>
          <div ref="plotEl" class="plot-wrap">
            <div class="inner">
              <TimeRuler :ticks="ticks" :px-per-sec="pxPerSec" />
              <svg
                :width="width"
                :height="PLOT_H"
                class="plot"
                role="img"
                aria-label="響度隨時間變化"
                @mousemove="onMove"
                @mouseleave="hover = null"
                @click="pb?.seek(eventTime($event).t)"
              >
                <line v-for="t in yTicks" :key="'g' + t" x1="0" :x2="width" :y1="y(t)" :y2="y(t)" class="svg-grid" />
                <path :d="curvePath.area" class="area" />
                <path :d="curvePath.line" class="line" />
                <line x1="0" :x2="width" :y1="y(lufs)" :y2="y(lufs)" class="overall" />
                <text :x="6" :y="y(lufs) - 6" class="overall-text">整體 {{ lufs.toFixed(1) }}</text>
                <line v-if="hover" :x1="hover.px" :x2="hover.px" y1="0" :y2="PLOT_H" class="cross" />
              </svg>
              <PlayHead :px-per-sec="pxPerSec" />
            </div>
          </div>
        </div>
        <div v-if="hover" class="chart-tip" :style="{ ...tipStyle(hover.px, 48), top: '30px' }">
          <strong>{{ fmtLufs(hover.v) }}</strong>
          <span class="muted">{{ fmtClock(hover.t) }}・點一下從這裡播放</span>
        </div>
      </div>
    </template>

  </div>
</template>

<style scoped>
.top {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 1rem 2rem;
  align-items: center;
}

.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 16px;
}

.val {
  font-size: 2.6rem;
  font-weight: 700;
  line-height: 1.15;
}

.unit {
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--text2);
  margin-left: 6px;
}

.level {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text2);
}

.scale {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.scale-track {
  fill: color-mix(in srgb, var(--c-loud) 18%, var(--surface));
}

.scale-fill {
  fill: var(--c-loud);
}

.ref-line {
  stroke: var(--text2);
  stroke-width: 2;
}

.ref-text {
  font-size: 12px;
  font-weight: 500;
  fill: var(--text2);
}

.knob {
  fill: var(--surface);
  stroke: var(--text);
  stroke-width: 3;
}

.end-text {
  font-size: 12px;
  fill: var(--muted);
}

/* 曲線 */
.chart-wrap {
  position: relative;
}

.layout {
  display: flex;
}

.y-axis {
  width: 48px;
  flex-shrink: 0;
  border-right: 1px solid var(--axis);
}

.y-ticks {
  position: relative;
}

.y-ticks span {
  position: absolute;
  right: 8px;
  transform: translateY(-50%);
  font-size: 12px;
  line-height: 1;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.plot-wrap {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.inner {
  position: relative;
}

.plot {
  display: block;
  cursor: pointer;
}

.area {
  fill: var(--c-loud);
  fill-opacity: 0.12;
}

.line {
  fill: none;
  stroke: var(--c-loud);
  stroke-width: 2;
  stroke-linejoin: round;
}

.overall {
  stroke: var(--text2);
  stroke-width: 1.5;
}

.overall-text {
  font-size: 12px;
  font-weight: 700;
  fill: var(--text2);
  paint-order: stroke;
  stroke: var(--surface);
  stroke-width: 3px;
}

.cross {
  stroke: var(--border-strong);
  pointer-events: none;
}

.muted {
  color: var(--muted);
}

</style>
