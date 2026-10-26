<script setup>
/**
 * 節拍時間軸
 * - beats：Essentia RhythmExtractor2013 回傳的每一拍時間點（秒）
 * - 上方對照 BTC 和弦、中間是拍點、下方是即時速度曲線
 * - 有上傳的音檔時可以播放、點擊跳轉，並可開節拍器聽拍點準不準
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import SectionLabel from '@/components/SectionLabel.vue'
import { CHORD_COLORS } from '@/utils/chordData.js'

const props = defineProps({
  beats: { type: Array, default: () => [] },
  bpm: { type: Number, default: null },
  duration: { type: Number, default: 0 },
  chords: { type: Array, default: () => [] },
  audioFile: { type: Object, default: null },
  // Essentia 不提供小節線，這裡假設 4/4、從第一拍開始算小節
  beatsPerBar: { type: Number, default: 4 },
})

// ---------------------------------------------------------------------------
// 版面
// ---------------------------------------------------------------------------
const RULER_H = 20
const CHORD_Y = 24
const CHORD_H = 26
const BEAT_Y = 60
const BEAT_H = 46
const TEMPO_Y = 116
const TEMPO_H = 40
const SVG_H = TEMPO_Y + TEMPO_H + 6

const ZOOMS = [1, 2, 4, 8, 16]
const zoomIdx = ref(0)
const scroller = ref(null)
const viewWidth = ref(700)
let resizeObs = null

// ---------------------------------------------------------------------------
// 音訊播放
// ---------------------------------------------------------------------------
const audioEl = ref(null)
const audioUrl = ref(null)
const audioDuration = ref(0)
const playing = ref(false)
const current = ref(0)
const metronome = ref(false)
let raf = 0
let lastBeatIdx = -1
let actx = null

watch(
  () => props.audioFile,
  (file) => {
    if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
    audioUrl.value = file ? URL.createObjectURL(file) : null
    playing.value = false
    current.value = 0
  },
  { immediate: true },
)

// ---------------------------------------------------------------------------
// 資料計算
// ---------------------------------------------------------------------------
const beatList = computed(() =>
  Array.isArray(props.beats) ? props.beats.filter((t) => Number.isFinite(t)).sort((a, b) => a - b) : [],
)

const total = computed(() => {
  const last = beatList.value.length ? beatList.value[beatList.value.length - 1] : 0
  return Math.max(props.duration || 0, audioDuration.value || 0, last + 0.5, 1)
})

const pxPerSec = computed(() => (viewWidth.value / total.value) * ZOOMS[zoomIdx.value])
const svgWidth = computed(() => Math.max(viewWidth.value, Math.ceil(total.value * pxPerSec.value)))
const x = (t) => t * pxPerSec.value

const intervals = computed(() => beatList.value.slice(1).map((t, i) => t - beatList.value[i]))

function median(arr) {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const medianInterval = computed(() => median(intervals.value))
const beatBpm = computed(() => (medianInterval.value ? 60 / medianInterval.value : null))

const jitterMs = computed(() => {
  const iv = intervals.value
  if (iv.length < 2) return null
  const mean = iv.reduce((a, b) => a + b, 0) / iv.length
  const variance = iv.reduce((a, b) => a + (b - mean) ** 2, 0) / iv.length
  return Math.round(Math.sqrt(variance) * 1000)
})

// 時間刻度：挑一個讓標籤間距至少 70px 的間隔
const rulerTicks = computed(() => {
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120]
  const step = steps.find((s) => s * pxPerSec.value >= 70) ?? 300
  const ticks = []
  for (let t = 0; t <= total.value + 1e-6; t += step) ticks.push(+t.toFixed(3))
  return ticks
})

// 拍點：每小節第一拍畫長線並標小節號
const beatMarks = computed(() => {
  const barPx = (medianInterval.value ?? 0.5) * props.beatsPerBar * pxPerSec.value
  const labelStride = Math.max(1, Math.ceil(30 / Math.max(barPx, 1)))
  return beatList.value.map((t, i) => {
    const isBar = i % props.beatsPerBar === 0
    const barNum = Math.floor(i / props.beatsPerBar) + 1
    return {
      x: x(t),
      isBar,
      label: isBar && (barNum - 1) % labelStride === 0 ? barNum : null,
    }
  })
})

// 和弦色塊（顏色規則與 ChordTimeline 相同）
const chordBlocks = computed(() => {
  const unique = [...new Set(props.chords.map((c) => c.chord))]
  const colors = {}
  unique.forEach((c, i) => (colors[c] = CHORD_COLORS[i % CHORD_COLORS.length]))
  return props.chords.map((c) => {
    const w = Math.max(x(c.dur) - 1, 1)
    const color = c.chord === 'N' ? '#6b6f84' : colors[c.chord]
    return { x: x(c.start), w, color, label: w >= 30 ? c.chord : '' }
  })
})

// 即時速度：每個拍間距換算 BPM，畫在兩拍中點；顯示範圍為中位數 ±20%
const tempoRange = computed(() => {
  const ref0 = beatBpm.value ?? 120
  return { lo: ref0 * 0.8, hi: ref0 * 1.2, mid: ref0 }
})
const tempoY = (bpm) => {
  const { lo, hi } = tempoRange.value
  const c = Math.min(hi, Math.max(lo, bpm))
  return TEMPO_Y + TEMPO_H - ((c - lo) / (hi - lo)) * TEMPO_H
}
const tempoPoints = computed(() => {
  const b = beatList.value
  if (b.length < 3) return ''
  return intervals.value
    .map((d, i) => `${x((b[i] + b[i + 1]) / 2).toFixed(1)},${tempoY(60 / d).toFixed(1)}`)
    .join(' ')
})

// ---------------------------------------------------------------------------
// 播放狀態
// ---------------------------------------------------------------------------
function beatIndexAt(t) {
  const b = beatList.value
  let lo = 0
  let hi = b.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (b[mid] <= t + 1e-4) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans
}

const currentBeatIdx = computed(() => beatIndexAt(current.value))
const beatInBar = computed(() => (currentBeatIdx.value < 0 ? -1 : currentBeatIdx.value % props.beatsPerBar))
const currentBar = computed(() =>
  currentBeatIdx.value < 0 ? '—' : Math.floor(currentBeatIdx.value / props.beatsPerBar) + 1,
)

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

function followPlayhead() {
  const el = scroller.value
  if (!el) return
  const px = x(current.value)
  if (px < el.scrollLeft + 20 || px > el.scrollLeft + el.clientWidth - 60) {
    el.scrollLeft = Math.max(0, px - el.clientWidth * 0.25)
  }
}

function frame() {
  const a = audioEl.value
  if (!a) return
  current.value = a.currentTime
  const idx = currentBeatIdx.value
  // 只有「往前走到下一拍」才響，跳轉時不響
  if (idx === lastBeatIdx + 1 && idx >= 0 && metronome.value) click(idx % props.beatsPerBar === 0)
  lastBeatIdx = idx
  followPlayhead()
  if (playing.value) raf = requestAnimationFrame(frame)
}

async function togglePlay() {
  const a = audioEl.value
  if (!a) return
  if (!actx) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (Ctx) actx = new Ctx()
  }
  if (actx?.state === 'suspended') actx.resume()
  if (a.paused) {
    lastBeatIdx = beatIndexAt(a.currentTime)
    try {
      await a.play()
    } catch (e) {
      console.warn('[BeatTimeline] 無法播放音檔：', e)
    }
  } else {
    a.pause()
  }
}

function onPlay() {
  playing.value = true
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(frame)
}
function onPause() {
  playing.value = false
  cancelAnimationFrame(raf)
}
function onLoadedMeta() {
  if (Number.isFinite(audioEl.value?.duration)) audioDuration.value = audioEl.value.duration
}

// ---------------------------------------------------------------------------
// 滑鼠互動
// ---------------------------------------------------------------------------
const hover = ref(null)

function eventTime(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  return { px: e.clientX - rect.left, t: (e.clientX - rect.left) / pxPerSec.value }
}

function onMove(e) {
  const { px, t } = eventTime(e)
  const b = beatList.value
  if (!b.length) return
  let i = beatIndexAt(t)
  if (i < b.length - 1 && (i < 0 || Math.abs(b[i + 1] - t) < Math.abs(b[i] - t))) i += 1
  i = Math.max(0, i)
  const bx = x(b[i])
  if (Math.abs(bx - px) > 8) {
    hover.value = { x: px, t, beat: null }
    return
  }
  hover.value = {
    x: bx,
    t: b[i],
    beat: i + 1,
    bar: Math.floor(i / props.beatsPerBar) + 1,
    pos: (i % props.beatsPerBar) + 1,
    next: i < b.length - 1 ? b[i + 1] - b[i] : null,
  }
}

function onSeek(e) {
  const { t } = eventTime(e)
  const clamped = Math.min(Math.max(0, t), total.value)
  current.value = clamped
  lastBeatIdx = beatIndexAt(clamped)
  if (audioEl.value) audioEl.value.currentTime = clamped
}

async function setZoom(delta) {
  const el = scroller.value
  const centerT = el ? (el.scrollLeft + el.clientWidth / 2) / pxPerSec.value : 0
  zoomIdx.value = Math.min(ZOOMS.length - 1, Math.max(0, zoomIdx.value + delta))
  await nextTick()
  if (el) {
    const anchor = playing.value ? current.value : centerT
    el.scrollLeft = Math.max(0, x(anchor) - el.clientWidth / 2)
  }
}

// ---------------------------------------------------------------------------
// 格式化
// ---------------------------------------------------------------------------
function fmtTick(sec) {
  if (sec < 60) return (Number.isInteger(sec) ? sec : sec.toFixed(1)) + 's'
  return Math.floor(sec / 60) + ':' + String(Math.round(sec % 60)).padStart(2, '0')
}
function fmtClock(sec) {
  const m = Math.floor(sec / 60)
  const s = (sec % 60).toFixed(1).padStart(4, '0')
  return `${m}:${s}`
}

// ---------------------------------------------------------------------------
// 生命週期
// ---------------------------------------------------------------------------
onMounted(() => {
  if (!scroller.value) return
  viewWidth.value = scroller.value.clientWidth || 700
  resizeObs = new ResizeObserver(() => {
    if (scroller.value) viewWidth.value = scroller.value.clientWidth || viewWidth.value
  })
  resizeObs.observe(scroller.value)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  resizeObs?.disconnect()
  if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
  actx?.close?.()
})
</script>

<template>
  <div class="section">
    <SectionLabel>節拍時間軸</SectionLabel>
    <div class="wrap">
      <div v-if="!beatList.length" class="empty">沒有節拍資料（Essentia 未回傳 Beats）</div>

      <template v-else>
        <!-- 統計與控制 -->
        <div class="toolbar">
          <div class="stats">
            <div class="stat">
              <span class="v">{{ beatList.length }}</span>
              <span class="l">拍</span>
            </div>
            <div class="stat">
              <span class="v">{{ beatBpm ? beatBpm.toFixed(1) : '—' }}</span>
              <span class="l">BPM（拍距中位數）</span>
            </div>
            <div v-if="bpm" class="stat">
              <span class="v">{{ bpm.toFixed(1) }}</span>
              <span class="l">BPM（Essentia）</span>
            </div>
            <div class="stat">
              <span class="v">{{ jitterMs !== null ? '±' + jitterMs + 'ms' : '—' }}</span>
              <span class="l">拍距標準差</span>
            </div>
          </div>

          <div class="controls">
            <template v-if="audioUrl">
              <button class="btn play" type="button" @click="togglePlay">
                {{ playing ? '❚❚ 暫停' : '▶ 播放' }}
              </button>
              <label class="toggle">
                <input v-model="metronome" type="checkbox" />
                節拍器
              </label>
            </template>
            <div class="zoom">
              <button class="btn" type="button" :disabled="zoomIdx === 0" @click="setZoom(-1)">−</button>
              <span class="zoom-val">{{ ZOOMS[zoomIdx] }}×</span>
              <button class="btn" type="button" :disabled="zoomIdx === ZOOMS.length - 1" @click="setZoom(1)">+</button>
            </div>
          </div>
        </div>

        <!-- 播放位置：小節內第幾拍 -->
        <div class="pulse-row">
          <div class="pulse">
            <span
              v-for="n in beatsPerBar"
              :key="n"
              class="dot"
              :class="{ on: beatInBar === n - 1, down: n === 1 }"
            ></span>
          </div>
          <span class="pos">第 {{ currentBar }} 小節</span>
          <span class="clock">{{ fmtClock(current) }} / {{ fmtClock(total) }}</span>
        </div>

        <!-- 時間軸 -->
        <div ref="scroller" class="scroll">
          <div class="inner" :style="{ width: svgWidth + 'px' }">
            <svg
              :width="svgWidth"
              :height="SVG_H"
              class="track"
              @mousemove="onMove"
              @mouseleave="hover = null"
              @click="onSeek"
            >
              <!-- 時間刻度 -->
              <g>
                <g v-for="t in rulerTicks" :key="'r' + t">
                  <line :x1="x(t)" :x2="x(t)" :y1="RULER_H - 5" :y2="SVG_H" class="grid" />
                  <text :x="x(t) + 3" :y="RULER_H - 8" class="tick-text">{{ fmtTick(t) }}</text>
                </g>
              </g>

              <!-- 和弦（BTC） -->
              <g>
                <g v-for="(c, i) in chordBlocks" :key="'c' + i">
                  <rect
                    :x="c.x"
                    :y="CHORD_Y"
                    :width="c.w"
                    :height="CHORD_H"
                    rx="4"
                    :style="{ fill: c.color + '26', stroke: c.color + '88' }"
                  />
                  <text
                    v-if="c.label"
                    :x="c.x + 5"
                    :y="CHORD_Y + CHORD_H / 2 + 4"
                    class="chord-text"
                    :style="{ fill: c.color }"
                  >{{ c.label }}</text>
                </g>
              </g>

              <!-- 拍點 -->
              <rect :x="0" :y="BEAT_Y" :width="svgWidth" :height="BEAT_H" class="lane" />
              <g>
                <g v-for="(b, i) in beatMarks" :key="'b' + i">
                  <line
                    :x1="b.x"
                    :x2="b.x"
                    :y1="b.isBar ? BEAT_Y + 2 : BEAT_Y + 16"
                    :y2="BEAT_Y + BEAT_H - 2"
                    :class="b.isBar ? 'beat bar' : 'beat'"
                  />
                  <text v-if="b.label" :x="b.x + 3" :y="BEAT_Y + 12" class="bar-text">{{ b.label }}</text>
                </g>
              </g>

              <!-- 即時速度 -->
              <line :x1="0" :x2="svgWidth" :y1="tempoY(tempoRange.mid)" :y2="tempoY(tempoRange.mid)" class="tempo-ref" />
              <polyline v-if="tempoPoints" :points="tempoPoints" class="tempo-line" />

              <!-- 目前播放的拍 -->
              <line
                v-if="currentBeatIdx >= 0 && (playing || current > 0)"
                :x1="x(beatList[currentBeatIdx])"
                :x2="x(beatList[currentBeatIdx])"
                :y1="BEAT_Y"
                :y2="BEAT_Y + BEAT_H"
                class="beat-active"
              />

              <!-- 滑鼠位置 -->
              <line v-if="hover" :x1="hover.x" :x2="hover.x" :y1="RULER_H" :y2="SVG_H" class="hover-line" />

              <!-- 播放頭 -->
              <line
                v-if="playing || current > 0"
                :x1="x(current)"
                :x2="x(current)"
                :y1="0"
                :y2="SVG_H"
                class="playhead"
              />
            </svg>

            <div
              v-if="hover"
              class="tip"
              :class="{ flip: hover.x > svgWidth - 180 }"
              :style="{ left: hover.x + 'px' }"
            >
              <template v-if="hover.beat">
                <strong>第 {{ hover.beat }} 拍</strong>
                <span>第 {{ hover.bar }} 小節．第 {{ hover.pos }} 拍</span>
                <span>{{ hover.t.toFixed(3) }}s</span>
                <span v-if="hover.next">到下一拍 {{ (hover.next * 1000).toFixed(0) }}ms（{{ (60 / hover.next).toFixed(1) }} BPM）</span>
              </template>
              <template v-else>
                <span>{{ hover.t.toFixed(2) }}s</span>
                <span class="muted">點擊跳到這裡</span>
              </template>
            </div>
          </div>
        </div>

        <div class="legend">
          <span><i class="sw chord"></i>和弦（BTC）</span>
          <span><i class="sw bar"></i>小節第一拍（假設 {{ beatsPerBar }}/4，從第一拍起算）</span>
          <span><i class="sw beat"></i>拍點</span>
          <span><i class="sw tempo"></i>即時速度（中線＝{{ beatBpm ? beatBpm.toFixed(0) : '—' }} BPM，範圍 ±20%）</span>
        </div>

        <audio
          v-if="audioUrl"
          ref="audioEl"
          :src="audioUrl"
          preload="metadata"
          @play="onPlay"
          @pause="onPause"
          @ended="onPause"
          @loadedmetadata="onLoadedMeta"
          @seeked="frame"
        ></audio>
      </template>
    </div>
  </div>
</template>

<style scoped>
.section {
  margin-bottom: 2rem;
}

.wrap {
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  overflow: hidden;
}

.empty {
  font-size: 13px;
  color: var(--muted);
}

/* 工具列 */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 0.75rem;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stat {
  background: var(--surface2);
  border: 0.5px solid var(--border);
  border-radius: 8px;
  padding: 6px 12px;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.stat .v {
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}

.stat .l {
  font-size: 11px;
  color: var(--muted);
}

.controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn {
  background: var(--surface2);
  border: 0.5px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 4px 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.btn.play {
  background: rgba(124, 106, 245, 0.18);
  border-color: rgba(124, 106, 245, 0.45);
  color: var(--accent);
  min-width: 78px;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
}

.zoom {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.zoom-val {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
  min-width: 28px;
  text-align: center;
}

/* 小節內拍位 */
.pulse-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 0.6rem;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
}

.pulse {
  display: inline-flex;
  gap: 6px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--surface2);
  border: 1px solid var(--border);
  transition: background 0.06s, transform 0.06s;
}

.dot.down {
  border-color: rgba(124, 106, 245, 0.6);
}

.dot.on {
  background: var(--accent2);
  transform: scale(1.25);
}

.dot.on.down {
  background: var(--accent);
}

.clock {
  margin-left: auto;
}

/* 時間軸 */
.scroll {
  overflow-x: auto;
  padding-bottom: 6px;
}

.inner {
  position: relative;
}

.track {
  display: block;
  cursor: pointer;
  user-select: none;
}

.grid {
  stroke: rgba(255, 255, 255, 0.05);
  stroke-width: 1;
}

.tick-text {
  fill: var(--muted);
  font-family: var(--font-mono);
  font-size: 10px;
}

.chord-text {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  pointer-events: none;
}

.lane {
  fill: var(--surface2);
  opacity: 0.6;
}

.beat {
  stroke: var(--accent2);
  stroke-width: 1;
  opacity: 0.55;
}

.beat.bar {
  stroke: var(--accent);
  stroke-width: 2;
  opacity: 0.95;
}

.bar-text {
  fill: var(--accent);
  font-family: var(--font-mono);
  font-size: 9px;
  pointer-events: none;
}

.beat-active {
  stroke: #ffffff;
  stroke-width: 3;
}

.tempo-ref {
  stroke: rgba(255, 255, 255, 0.12);
  stroke-dasharray: 3 4;
}

.tempo-line {
  fill: none;
  stroke: var(--accent3);
  stroke-width: 1.5;
  stroke-linejoin: round;
}

.hover-line {
  stroke: rgba(255, 255, 255, 0.35);
  stroke-dasharray: 2 3;
  pointer-events: none;
}

.playhead {
  stroke: var(--danger);
  stroke-width: 2;
  pointer-events: none;
}

.tip {
  position: absolute;
  top: 4px;
  transform: translateX(10px);
  background: var(--bg);
  border: 0.5px solid var(--border);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 11px;
  color: var(--text);
  display: flex;
  flex-direction: column;
  gap: 1px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 2;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.tip.flip {
  transform: translateX(calc(-100% - 10px));
}

.tip strong {
  font-family: var(--font-mono);
  color: var(--accent2);
}

.tip .muted {
  color: var(--muted);
}

/* 圖例 */
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin-top: 0.6rem;
  font-size: 11px;
  color: var(--muted);
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.sw {
  display: inline-block;
  width: 14px;
  height: 3px;
  border-radius: 2px;
}

.sw.chord {
  height: 8px;
  background: rgba(124, 106, 245, 0.25);
  border: 1px solid rgba(124, 106, 245, 0.6);
}

.sw.bar {
  width: 2px;
  height: 12px;
  background: var(--accent);
}

.sw.beat {
  width: 1px;
  height: 8px;
  background: var(--accent2);
}

.sw.tempo {
  background: var(--accent3);
}
</style>
