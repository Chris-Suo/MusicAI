<script setup>
/**
 * 節拍時間軸
 * - beats：Essentia RhythmExtractor2013 回傳的每一拍時間點（秒）
 * - 由上而下：和弦（BTC）、拍點與小節線、速度變化（左邊有 BPM 刻度）
 * - 播放、節拍器由上方共用播放器控制；點時間軸跳轉
 */
import { computed, ref, watch } from 'vue'
import TimeRuler from '@/components/common/TimeRuler.vue'
import ZoomControl from '@/components/common/ZoomControl.vue'
import PlayHead from '@/components/common/PlayHead.vue'
import ChordStrip from '@/components/common/ChordStrip.vue'
import { useTimeAxis } from '@/composables/useTimeAxis.js'
import { usePlayback, useFollowPlayhead } from '@/composables/usePlayback.js'
import { indexAt, median, percentile, fmtClock } from '@/utils/stats.js'

const props = defineProps({
  beats: { type: Array, default: () => [] },
  // ResultsPanel 算好的拍點統計（beatBpm、intervals、beatsPerBar…）
  rhythm: { type: Object, required: true },
  chords: { type: Array, default: () => [] },
  chordInfo: { type: Map, required: true },
  total: { type: Number, required: true },
  // 要標示的時間段（例如和弦進行分析選到的進行）：[{ start, end }]
  highlights: { type: Array, default: () => [] },
})

// ---------------------------------------------------------------------------
// 版面
// ---------------------------------------------------------------------------
const AXIS_W = 64
const RULER_H = 22
const CHORD_H = 28
const BEAT_H = 56
const TEMPO_H = 150
const TEMPO_PAD = 10
const SVG_H = BEAT_H + TEMPO_H

const pb = usePlayback()
const { scroller, zoomIdx, pxPerSec, contentWidth, x, ticks, setZoom, eventTime, reveal, tipStyle } = useTimeAxis(computed(() => props.total))
useFollowPlayhead(scroller, x)

const beatsPerBar = computed(() => props.rhythm.beatsPerBar)

// ---------------------------------------------------------------------------
// 拍點與小節線
// ---------------------------------------------------------------------------
const beatSpacing = computed(() => (props.rhythm.medianInterval ?? 0.5) * pxPerSec.value)

const barLines = computed(() => {
  const stride = [1, 2, 4, 8, 16].find((s) => s * beatSpacing.value * beatsPerBar.value >= 30) ?? 32
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

// 目前這一拍的範圍（亮底）
const currentBeat = computed(() => {
  const i = pb?.beatIndex.value ?? -1
  if (i < 0 || !pb.active.value) return null
  const start = props.beats[i]
  const end = props.beats[i + 1] ?? start + (props.rhythm.medianInterval ?? 0.5)
  return { x: x(start), w: Math.max(2, x(end) - x(start)) }
})

// ---------------------------------------------------------------------------
// 速度曲線：每個拍距換算 BPM（細線），再取 5 拍中位數當趨勢（粗線）
// ---------------------------------------------------------------------------
const tempoPoints = computed(() => {
  const b = props.beats
  return props.rhythm.intervals.map((d, i) => ({ t: (b[i] + b[i + 1]) / 2, bpm: 60 / d }))
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

function polyline(points) {
  return points.map((p) => `${x(p.t).toFixed(1)},${tempoY(p.bpm).toFixed(1)}`).join(' ')
}

const rawLine = computed(() => polyline(tempoPoints.value))
const trendLine = computed(() => {
  const p = tempoPoints.value
  const half = 2
  return polyline(p.map((pt, i) => ({ t: pt.t, bpm: median(p.slice(Math.max(0, i - half), i + half + 1).map((q) => q.bpm)) })))
})

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

watch(
  () => props.highlights,
  (hl) => {
    if (hl?.length && !pb?.playing.value) reveal(hl[0].start)
  },
)
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">節拍時間軸</h3>
        <p class="card-desc">每一條直線是一拍，粗線是小節第一拍；下方曲線是速度變化。點一下從那裡播放，可開上方的節拍器對照</p>
      </div>
      <ZoomControl v-if="beats.length" :zoom-idx="zoomIdx" @zoom="setZoom" />
    </div>

    <div v-if="!beats.length" class="note">沒有節拍資料（Essentia 未回傳 Beats）</div>

    <template v-else>
      <div class="chart-wrap">
        <div class="layout">
          <!-- 固定的左側欄：分道名稱與 BPM 刻度 -->
          <div class="gutter" :style="{ width: AXIS_W + 'px' }" aria-hidden="true">
            <div :style="{ height: RULER_H + 'px' }"></div>
            <div class="lane-name" :style="{ height: CHORD_H + 'px' }">和弦</div>
            <div class="lane-name" :style="{ height: BEAT_H + 'px' }">拍點</div>
            <div class="tempo-axis" :style="{ height: TEMPO_H + 'px' }">
              <span class="lane-name tempo-name">速度</span>
              <span
                v-for="tk in tempoTicks"
                :key="tk.r"
                class="tempo-tick"
                :class="{ mid: tk.r === 0 }"
                :style="{ top: tempoY(tk.bpm) - BEAT_H + 'px' }"
              >{{ Math.round(tk.bpm) }}</span>
            </div>
          </div>

          <div ref="scroller" class="scroll">
            <div class="inner" :style="{ width: contentWidth + 'px' }">
              <TimeRuler :ticks="ticks" :px-per-sec="pxPerSec" />
              <div class="chord-lane" :style="{ height: CHORD_H + 'px' }">
                <ChordStrip :timeline="chords" :chord-info="chordInfo" :total="total" :height="20" :px-per-sec="pxPerSec" />
              </div>
              <svg
                :width="contentWidth"
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

                <!-- 和弦進行分析選到的段落 -->
                <rect
                  v-for="(h, i) in highlights"
                  :key="'h' + i"
                  :x="x(h.start)"
                  y="0"
                  :width="Math.max(2, x(h.end) - x(h.start))"
                  :height="SVG_H"
                  class="hl-range"
                />

                <!-- 拍點 -->
                <rect x="0" y="0" :width="contentWidth" :height="BEAT_H" class="lane" />
                <rect v-if="currentBeat" :x="currentBeat.x" y="0" :width="currentBeat.w" :height="BEAT_H" class="beat-now" />
                <line v-for="(bx, i) in beatTicks" :key="'b' + i" :x1="bx" :x2="bx" :y1="BEAT_H - 22" :y2="BEAT_H - 2" class="beat" />
                <g v-for="b in barLines" :key="'bar' + b.n">
                  <line :x1="b.x" :x2="b.x" y1="2" :y2="BEAT_H - 2" class="bar" />
                  <text v-if="b.label" :x="b.x + 4" y="16" class="bar-text">{{ b.n }}</text>
                </g>

                <!-- 速度 -->
                <line
                  v-for="tk in tempoTicks"
                  :key="'tt' + tk.r"
                  x1="0"
                  :x2="contentWidth"
                  :y1="tempoY(tk.bpm)"
                  :y2="tempoY(tk.bpm)"
                  :class="tk.r === 0 ? 'tempo-mid' : 'svg-grid'"
                />
                <polyline :points="rawLine" class="tempo-raw" />
                <polyline :points="trendLine" class="tempo-trend" />

                <!-- 滑鼠位置 -->
                <line v-if="hover" :x1="hover.px" :x2="hover.px" y1="0" :y2="SVG_H" class="hover-line" />
              </svg>
              <PlayHead :px-per-sec="pxPerSec" />
            </div>
          </div>
        </div>

        <div v-if="hover" class="chart-tip" :style="{ ...tipStyle(hover.px, AXIS_W), top: RULER_H + CHORD_H + 'px' }">
          <template v-if="hover.beat">
            <strong>第 {{ hover.beat }} 拍</strong>
            <span>第 {{ hover.bar }} 小節・第 {{ hover.pos }} 拍</span>
            <span v-if="hover.next">到下一拍 {{ Math.round(hover.next * 1000) }} 毫秒（{{ (60 / hover.next).toFixed(1) }} BPM）</span>
            <span class="muted">{{ fmtClock(hover.t) }}</span>
          </template>
          <template v-else>
            <span>{{ fmtClock(hover.t) }}</span>
            <span class="muted">點一下從這裡播放</span>
          </template>
        </div>
      </div>

      <div class="legend foot">
        <span><i class="swatch bar-sw"></i>小節第一拍（假設 {{ beatsPerBar }}/4，從第一拍起算）</span>
        <span><i class="swatch beat-sw"></i>拍點</span>
        <span><i class="swatch raw-sw"></i>每一拍的速度</span>
        <span><i class="swatch trend-sw"></i>速度趨勢（5 拍中位數）</span>
        <span v-if="highlights.length"><i class="swatch hl-sw"></i>選取的和弦進行</span>
      </div>
    </template>
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

.scroll {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 6px;
}

.inner {
  position: relative;
  /* 最右邊的刻度、小節號超出內容寬度時裁掉，避免整首（1×）時出現捲軸 */
  overflow-x: clip;
}

.chord-lane {
  display: flex;
  align-items: center;
}

.track {
  display: block;
  cursor: pointer;
  user-select: none;
}

.lane {
  fill: var(--surface2);
}

.beat-now {
  fill: var(--accent-soft);
}

.beat {
  stroke: var(--border-strong);
  stroke-width: 1;
}

.bar {
  stroke: var(--text2);
  stroke-width: 2;
}

.bar-text {
  fill: var(--text);
  font-size: 12px;
  font-weight: 700;
  pointer-events: none;
}

.hl-range {
  fill: color-mix(in srgb, var(--accent) 14%, transparent);
  stroke: var(--accent);
  stroke-width: 2;
  pointer-events: none;
}

.tempo-mid {
  stroke: var(--axis);
  stroke-width: 1;
}

.tempo-raw {
  fill: none;
  stroke: var(--c-tempo);
  stroke-opacity: 0.35;
  stroke-width: 1;
  stroke-linejoin: round;
}

.tempo-trend {
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

.muted {
  color: var(--muted);
}

.foot {
  margin-top: 0.75rem;
}

.bar-sw {
  width: 3px;
  height: 16px;
  background: var(--text2);
  border-radius: 1px;
}

.beat-sw {
  width: 1px;
  height: 12px;
  background: var(--border-strong);
}

.raw-sw {
  height: 2px;
  background: color-mix(in srgb, var(--c-tempo) 40%, transparent);
}

.trend-sw {
  height: 3px;
  background: var(--c-tempo);
}

.hl-sw {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border: 2px solid var(--accent);
}
</style>
