<script setup>
/**
 * 節拍時間軸
 * - beats：Essentia RhythmExtractor2013 回傳的每一拍時間點（秒）
 * - 上：拍點與小節線（假設 4/4，從第一拍起算）；下：速度變化（每 5 拍取中位數，左邊有 BPM 刻度）
 * - 整首放進一個畫面；點一下從那裡播放
 */
import { computed, ref } from 'vue'
import TimeRuler from '@/components/common/TimeRuler.vue'
import PlayHead from '@/components/common/PlayHead.vue'
import { useTimeAxis } from '@/composables/useTimeAxis.js'
import { usePlayback } from '@/composables/usePlayback.js'
import { indexAt, median, percentile, fmtClock } from '@/utils/stats.js'

const props = defineProps({
  beats: { type: Array, default: () => [] },
  // ResultsPanel 算好的拍點統計（beatBpm、intervals、beatsPerBar…）
  rhythm: { type: Object, required: true },
  total: { type: Number, required: true },
})

// ---------------------------------------------------------------------------
// 版面
// ---------------------------------------------------------------------------
const AXIS_W = 56
const RULER_H = 22
const BEAT_H = 44
const TEMPO_H = 130
const TEMPO_PAD = 10
const SVG_H = BEAT_H + TEMPO_H

const pb = usePlayback()
const { plotEl, width, pxPerSec, x, ticks, eventTime, tipStyle } = useTimeAxis(computed(() => props.total))

const beatsPerBar = computed(() => props.rhythm.beatsPerBar)

// ---------------------------------------------------------------------------
// 拍點與小節線
// ---------------------------------------------------------------------------
const beatSpacing = computed(() => (props.rhythm.medianInterval ?? 0.5) * pxPerSec.value)

const barLines = computed(() => {
  // 小節號至少隔 48px；有標號的小節線畫粗一點
  const stride = [1, 2, 4, 8, 16].find((s) => s * beatSpacing.value * beatsPerBar.value >= 48) ?? 32
  const out = []
  for (let i = 0; i < props.beats.length; i += beatsPerBar.value) {
    const n = i / beatsPerBar.value + 1
    out.push({ x: x(props.beats[i]), n, label: (n - 1) % stride === 0 })
  }
  return out
})

// 拍點太密時只畫小節線
const beatTicks = computed(() =>
  beatSpacing.value < 4 ? [] : props.beats.filter((_, i) => i % beatsPerBar.value !== 0).map((t) => x(t)),
)

// ---------------------------------------------------------------------------
// 速度曲線：每個拍距換算 BPM，再取 5 拍中位數，去掉偵測的小抖動
// ---------------------------------------------------------------------------
const tempoPoints = computed(() => {
  const b = props.beats
  const raw = props.rhythm.intervals.map((d, i) => ({ t: (b[i] + b[i + 1]) / 2, bpm: 60 / d }))
  return raw.map((pt, i) => ({ t: pt.t, bpm: median(raw.slice(Math.max(0, i - 2), i + 3).map((q) => q.bpm)) }))
})

const tempoRange = computed(() => {
  const m = props.rhythm.beatBpm ?? 120
  const sorted = tempoPoints.value.map((p) => p.bpm).sort((a, b) => a - b)
  let spread = 0.08
  if (sorted.length) {
    spread = Math.max(spread, Math.abs(percentile(sorted, 0.02) / m - 1), Math.abs(percentile(sorted, 0.98) / m - 1))
  }
  spread = Math.min(0.25, spread * 1.1)
  return { mid: m, lo: m * (1 - spread), hi: m * (1 + spread) }
})

const tempoY = (bpm) => {
  const { lo, hi } = tempoRange.value
  const c = Math.min(hi, Math.max(lo, bpm))
  return BEAT_H + TEMPO_PAD + (1 - (c - lo) / (hi - lo)) * (TEMPO_H - TEMPO_PAD * 2)
}

const tempoTicks = computed(() => {
  const { mid, lo, hi } = tempoRange.value
  return [0, -0.05, 0.05, -0.1, 0.1, -0.2, 0.2]
    .map((r) => ({ r, bpm: mid * (1 + r) }))
    .filter((t) => t.bpm >= lo && t.bpm <= hi)
})

const tempoLine = computed(() => tempoPoints.value.map((p) => `${x(p.t).toFixed(1)},${tempoY(p.bpm).toFixed(1)}`).join(' '))

// ---------------------------------------------------------------------------
// 滑鼠互動
// ---------------------------------------------------------------------------
const hover = ref(null)

function onMove(e) {
  const { px, t } = eventTime(e)
  const b = props.beats
  let i = indexAt(b, t)
  if (i < b.length - 1 && (i < 0 || Math.abs(b[i + 1] - t) < Math.abs(b[i] - t))) i += 1
  i = Math.max(0, i)
  const bx = x(b[i])
  if (Math.abs(bx - px) > 8) {
    hover.value = { px, t, beat: null }
    return
  }
  const next = i < b.length - 1 ? b[i + 1] - b[i] : null
  hover.value = {
    px: bx,
    t: b[i],
    beat: i + 1,
    bar: Math.floor(i / beatsPerBar.value) + 1,
    pos: (i % beatsPerBar.value) + 1,
    next,
  }
}

function onSeek(e) {
  pb?.seek(eventTime(e).t)
}
</script>

<template>
  <div class="card">
    <div class="card-head">
      <h3 class="card-title">節拍時間軸</h3>
    </div>

    <div class="chart-wrap">
      <div class="layout">
        <!-- 固定的左側欄：分道名稱與 BPM 刻度 -->
        <div class="gutter" :style="{ width: AXIS_W + 'px' }" aria-hidden="true">
          <div :style="{ height: RULER_H + 'px' }"></div>
          <div class="lane-name" :style="{ height: BEAT_H + 'px' }">小節</div>
          <div class="tempo-axis" :style="{ height: TEMPO_H + 'px' }">
            <span class="lane-name tempo-name">BPM</span>
            <span
              v-for="tk in tempoTicks"
              :key="tk.r"
              class="tempo-tick"
              :class="{ mid: tk.r === 0 }"
              :style="{ top: tempoY(tk.bpm) - BEAT_H + 'px' }"
            >{{ Math.round(tk.bpm) }}</span>
          </div>
        </div>

        <div ref="plotEl" class="plot-wrap">
          <div class="inner">
            <TimeRuler :ticks="ticks" :px-per-sec="pxPerSec" />
            <svg
              :width="width"
              :height="SVG_H"
              class="track"
              role="img"
              :aria-label="`節拍時間軸，共 ${beats.length} 拍`"
              @mousemove="onMove"
              @mouseleave="hover = null"
              @click="onSeek"
            >
              <!-- 時間格線 -->
              <line v-for="t in ticks" :key="'g' + t" :x1="x(t)" :x2="x(t)" y1="0" :y2="SVG_H" class="svg-grid" />

              <!-- 拍點 -->
              <rect x="0" y="0" :width="width" :height="BEAT_H" class="lane" />
              <line v-for="(bx, i) in beatTicks" :key="'b' + i" :x1="bx" :x2="bx" :y1="BEAT_H - 16" :y2="BEAT_H - 2" class="beat" />
              <g v-for="b in barLines" :key="'bar' + b.n">
                <line :x1="b.x" :x2="b.x" :y1="b.label ? 2 : BEAT_H - 22" :y2="BEAT_H - 2" class="bar" :class="{ major: b.label }" />
                <text v-if="b.label" :x="b.x + 4" y="15" class="bar-text">{{ b.n }}</text>
              </g>

              <!-- 速度 -->
              <line
                v-for="tk in tempoTicks"
                :key="'tt' + tk.r"
                x1="0"
                :x2="width"
                :y1="tempoY(tk.bpm)"
                :y2="tempoY(tk.bpm)"
                :class="tk.r === 0 ? 'tempo-mid' : 'svg-grid'"
              />
              <polyline :points="tempoLine" class="tempo-line" />

              <!-- 滑鼠位置 -->
              <line v-if="hover" :x1="hover.px" :x2="hover.px" y1="0" :y2="SVG_H" class="hover-line" />
            </svg>
            <PlayHead :px-per-sec="pxPerSec" />
          </div>
        </div>
      </div>

      <div v-if="hover" class="chart-tip" :style="{ ...tipStyle(hover.px, AXIS_W), top: RULER_H + 'px' }">
        <template v-if="hover.beat">
          <strong>第 {{ hover.bar }} 小節・第 {{ hover.pos }} 拍</strong>
          <span v-if="hover.next">到下一拍 {{ Math.round(hover.next * 1000) }} 毫秒（{{ (60 / hover.next).toFixed(1) }} BPM）</span>
          <span class="muted">{{ fmtClock(hover.t) }}</span>
        </template>
        <template v-else>
          <span>{{ fmtClock(hover.t) }}</span>
          <span class="muted">點一下從這裡播放</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-wrap {
  position: relative;
}

.layout {
  display: flex;
}

.gutter {
  flex-shrink: 0;
  border-right: 1px solid var(--axis);
}

.lane-name {
  display: flex;
  align-items: center;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text2);
}

.tempo-axis {
  position: relative;
}

.tempo-name {
  position: absolute;
  top: 0;
  left: 0;
  height: auto;
}

.tempo-tick {
  position: absolute;
  right: 8px;
  transform: translateY(-50%);
  font-size: 12px;
  line-height: 1;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.tempo-tick.mid {
  color: var(--text);
  font-weight: 700;
}

.plot-wrap {
  flex: 1;
  min-width: 0;
  /* 最右邊的刻度文字超出時裁掉 */
  overflow: hidden;
}

.inner {
  position: relative;
}

.track {
  display: block;
  cursor: pointer;
  user-select: none;
}

.lane {
  fill: var(--surface2);
}

.beat {
  stroke: var(--border-strong);
  stroke-width: 1;
}

.bar {
  stroke: var(--border-strong);
  stroke-width: 1;
}

.bar.major {
  stroke: var(--text2);
  stroke-width: 2;
}

.bar-text {
  fill: var(--text);
  font-size: 12px;
  font-weight: 700;
  pointer-events: none;
}

.tempo-mid {
  stroke: var(--axis);
  stroke-width: 1;
}

.tempo-line {
  fill: none;
  stroke: var(--c-tempo);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.hover-line {
  stroke: var(--border-strong);
  stroke-width: 1;
  pointer-events: none;
}
</style>
