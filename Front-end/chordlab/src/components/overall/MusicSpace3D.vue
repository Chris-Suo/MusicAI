<script setup>
/**
 * 總樂性元・三維位置：把整首歌放進一個三維空間
 * - x、y：和弦分頁「和弦情緒軌跡」所有軌跡點的平均（x 效價 Valence、y 喚醒度 Arousal），軌跡版本跟和弦分頁一致
 *   （切換在 utils/chordEmotion.js 的 buildTrajectory()）
 * - z：速度 BPM
 * 用 SVG 自己做正投影，不另外裝 3D 套件：拖曳（滑鼠或觸控）旋轉，聚焦後也可以用方向鍵，按鈕回到預設視角
 */
import { ref, computed } from 'vue'
import { buildTrajectory, trajectoryMean } from '@/utils/chordEmotion.js'
import { tempoTerm } from '@/utils/rhythm.js'

const props = defineProps({
  timeline: { type: Array, required: true },
  bpm: { type: Number, default: null },
})

// 座標範圍：x、y 跟情緒軌跡圖一樣是 ±10；z 是 0～240 BPM（超出的貼在邊上）
const XY = 10
const Z_MIN = 0
const Z_MAX = 240
const XY_TICKS = [-10, -5, 0, 5, 10]
// z 的 0 就是地板，不另外標（會跟 x、y 的刻度擠在角落）
const Z_TICKS = [60, 120, 180, 240]

// 畫面
const W = 640
const H = 520
const CX = W / 2
const CY = H / 2 + 20
const S = 150 // 正規化座標 1 對應幾 px

const mean = computed(() => trajectoryMean(buildTrajectory(props.timeline)))
const term = computed(() => tempoTerm(props.bpm))

// ---------------------------------------------------------------------------
// 視角與投影
// ---------------------------------------------------------------------------
const DEFAULT_VIEW = { yaw: -0.6, pitch: 0.42 }
const yaw = ref(DEFAULT_VIEW.yaw) // 繞垂直軸轉（弧度）
const pitch = ref(DEFAULT_VIEW.pitch) // 往下看的角度（弧度），限制在 5°～80°
const clampPitch = (p) => Math.min(1.4, Math.max(0.09, p))

const clamp1 = (v) => Math.min(1, Math.max(-1, v))
// 資料座標 → 正規化座標（-1～1）
const nx = (x) => clamp1(x / XY)
const ny = (y) => clamp1(y / XY)
const nz = (bpm) => clamp1(((bpm - Z_MIN) / (Z_MAX - Z_MIN)) * 2 - 1)

/** 正規化座標 (X, Y, Z) → 畫面座標；Y 是前後（往畫面裡面為正），Z 是上下 */
function project(X, Y, Z) {
  const c = Math.cos(yaw.value)
  const s = Math.sin(yaw.value)
  const sx = X * c - Y * s
  const depth = X * s + Y * c
  const up = Z * Math.cos(pitch.value) + depth * Math.sin(pitch.value)
  return { x: CX + sx * S, y: CY - up * S }
}
const P = (X, Y, Z) => {
  const p = project(X, Y, Z)
  return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
}
const line = (a, b) => `M${P(...a)} L${P(...b)}`

// 地板格線（z 最低處）、立方體的 12 條邊、地板中央的十字
const floorGrid = computed(() => {
  void yaw.value, pitch.value
  const out = []
  for (const t of XY_TICKS) {
    const v = t / XY
    out.push({ key: `x${t}`, d: line([v, -1, -1], [v, 1, -1]), center: t === 0 })
    out.push({ key: `y${t}`, d: line([-1, v, -1], [1, v, -1]), center: t === 0 })
  }
  return out
})

const cubeEdges = computed(() => {
  void yaw.value, pitch.value
  const out = []
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      out.push(line([-1, a, b], [1, a, b]))
      out.push(line([a, -1, b], [a, 1, b]))
      out.push(line([a, b, -1], [a, b, 1]))
    }
  }
  return out
})

// 刻度文字：x 沿前緣、y 沿右緣、z 沿左前的直立邊；y 的 -10 跟 x 的 10 在同一個角落，省略
const ticks = computed(() => {
  void yaw.value, pitch.value
  return [
    ...XY_TICKS.map((t) => ({ key: `tx${t}`, ...project(t / XY, -1.16, -1), text: t })),
    ...XY_TICKS.filter((t) => t !== -XY).map((t) => ({ key: `ty${t}`, ...project(1.16, t / XY, -1), text: t })),
    ...Z_TICKS.map((t) => ({ key: `tz${t}`, ...project(-1.1, -1.1, nz(t)), text: t })),
  ]
})

const axisTitles = computed(() => {
  void yaw.value, pitch.value
  return [
    // 軸名比刻度再往外一點，避免壓到刻度數字
    { key: 'x', ...project(0, -1.5, -1), text: 'x 效價 Valence', anchor: 'middle' },
    { key: 'y', ...project(1.42, -0.1, -1), text: 'y 喚醒度 Arousal', anchor: 'start' },
    { key: 'z', ...project(-1.1, -1.1, 1.22), text: 'z 速度 BPM', anchor: 'middle' },
  ]
})

// 這首歌的位置、往地板的垂直線、地板上的投影
const point = computed(() => {
  void yaw.value, pitch.value
  if (!mean.value || !props.bpm) return null
  const X = nx(mean.value.x)
  const Y = ny(mean.value.y)
  const Z = nz(props.bpm)
  return {
    at: project(X, Y, Z),
    floor: project(X, Y, -1),
    drop: line([X, Y, Z], [X, Y, -1]),
    // 地板上往兩個軸的參考線，方便讀出 x、y
    toX: line([X, Y, -1], [X, -1, -1]),
    toY: line([X, Y, -1], [1, Y, -1]),
    // 往 z 軸那條直立邊的水平線，方便讀出高度
    toZ: line([X, Y, Z], [-1, -1, Z]),
  }
})

const num = (v) => (Math.round(v * 10) / 10).toFixed(1)

// ---------------------------------------------------------------------------
// 旋轉：拖曳、方向鍵、重設
// ---------------------------------------------------------------------------
let drag = null
function onDown(e) {
  drag = { x: e.clientX, y: e.clientY, yaw: yaw.value, pitch: pitch.value }
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function onMove(e) {
  if (!drag) return
  yaw.value = drag.yaw + (e.clientX - drag.x) * 0.01
  pitch.value = clampPitch(drag.pitch + (e.clientY - drag.y) * 0.01)
}
function onUp() {
  drag = null
}
function onKey(e) {
  const step = 0.12
  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
  if (!d) return
  e.preventDefault()
  yaw.value += d[0]
  pitch.value = clampPitch(pitch.value + d[1])
}
function resetView() {
  yaw.value = DEFAULT_VIEW.yaw
  pitch.value = DEFAULT_VIEW.pitch
}
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">三維位置</h3>
        <p class="card-desc">x、y＝和弦情緒軌跡所有點的平均，z＝速度 BPM・拖曳可旋轉</p>
      </div>
      <button type="button" class="btn" @click="resetView">重設視角</button>
    </div>

    <div v-if="!mean || !bpm" class="note">
      {{ !mean ? '沒有情緒軌跡資料（和弦都沒有對應的座標）' : '沒有速度資料（Essentia 沒有回傳 BPM）' }}，無法畫出三維位置
    </div>

    <template v-else>
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        class="space"
        role="img"
        tabindex="0"
        :aria-label="`三維位置：x ${num(mean.x)}、y ${num(mean.y)}、速度 ${bpm.toFixed(0)} BPM。按方向鍵旋轉`"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @keydown="onKey"
      >
        <path v-for="g in floorGrid" :key="g.key" :d="g.d" class="grid" :class="{ center: g.center }" />
        <path v-for="(d, i) in cubeEdges" :key="i" :d="d" class="edge" />

        <text v-for="t in ticks" :key="t.key" :x="t.x" :y="t.y + 4" text-anchor="middle" class="tick">{{ t.text }}</text>
        <text v-for="t in axisTitles" :key="t.key" :x="t.x" :y="t.y + 5" :text-anchor="t.anchor" class="axis-title">{{ t.text }}</text>

        <template v-if="point">
          <path :d="point.toX" class="guide" />
          <path :d="point.toY" class="guide" />
          <path :d="point.toZ" class="guide" />
          <path :d="point.drop" class="drop" />
          <ellipse :cx="point.floor.x" :cy="point.floor.y" rx="9" ry="4" class="shadow" />
          <circle :cx="point.at.x" :cy="point.at.y" r="12" class="dot" />
          <text :x="point.at.x" :y="point.at.y - 22" text-anchor="middle" class="dot-label">
            ({{ num(mean.x) }}, {{ num(mean.y) }}, {{ bpm.toFixed(0) }})
          </text>
        </template>
      </svg>

      <dl class="stats">
        <div>
          <dt>x 效價 Valence</dt>
          <dd>{{ num(mean.x) }}</dd>
        </div>
        <div>
          <dt>y 喚醒度 Arousal</dt>
          <dd>{{ num(mean.y) }}</dd>
        </div>
        <div>
          <dt>z 速度</dt>
          <dd>{{ bpm.toFixed(1) }} <span class="unit">BPM</span><span v-if="term" class="term">{{ term.zh }}</span></dd>
        </div>
      </dl>
      <p class="note">x、y 由 {{ mean.count }} 個情緒軌跡點平均而來（每個點同樣份量）</p>
    </template>
  </div>
</template>

<style scoped>
.space {
  display: block;
  width: 100%;
  max-width: 680px;
  height: auto;
  margin: 0 auto;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.space:active {
  cursor: grabbing;
}

/* 用滑鼠拖曳時不顯示聚焦框；用鍵盤時框在圖內側 */
.space:focus:not(:focus-visible) {
  outline: none;
}

.space:focus-visible {
  outline-offset: -3px;
  border-radius: var(--radius-md);
}

.grid {
  stroke: var(--grid);
  stroke-width: 1;
}

.grid.center {
  stroke: var(--axis);
  stroke-width: 1.5;
}

.edge {
  stroke: var(--axis);
  stroke-width: 1;
  fill: none;
}

.tick {
  fill: var(--muted);
  font-size: 12px;
  font-family: var(--font-sans);
  font-variant-numeric: tabular-nums;
}

.axis-title {
  fill: var(--text2);
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font-sans);
}

.guide {
  stroke: var(--accent);
  stroke-width: 1.5;
  stroke-dasharray: 3 5;
  opacity: 0.6;
}

.drop {
  stroke: var(--accent);
  stroke-width: 2;
  stroke-dasharray: 6 5;
}

.shadow {
  fill: var(--accent);
  opacity: 0.35;
}

.dot {
  fill: var(--accent);
  stroke: var(--surface);
  stroke-width: 3;
}

.dot-label {
  fill: var(--text);
  font-size: 15px;
  font-weight: 700;
  font-family: var(--font-mono);
  paint-order: stroke;
  stroke: var(--surface);
  stroke-width: 5px;
  stroke-linejoin: round;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 2.5rem;
  margin-top: 0.75rem;
}

.stats dt {
  font-size: 0.85rem;
  color: var(--muted);
}

.stats dd {
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.unit {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text2);
  margin-left: 2px;
}

.term {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text2);
  margin-left: 8px;
}
</style>
