<script setup>
/**
 * 和弦情緒軌跡
 * 使用 utils/chordEmotion.js：依和弦性質把每個和弦放到情緒輪座標上，依出現順序連成軌跡。
 * - 灰色曲線：整首歌出現過的移動（A → B），越粗代表出現越多次；曲線往行進方向的右邊彎，來回兩個方向不會疊在一起
 * - 播放時：紅點是目前的和弦，紅色箭頭是最近幾步的軌跡
 * - 點右邊的清單：跳到下一次出現這種和弦的地方播放
 */
import { ref, computed } from 'vue'
import wheelUrl from '@/assets/emotion-wheel.webp'
import { CHORD_EMOTIONS, buildEmotionPath } from '@/utils/chordEmotion.js'
import { prettyChord } from '@/utils/chords.js'
import { indexAt } from '@/utils/time.js'
import { usePlayback } from '@/composables/usePlayback.js'

const props = defineProps({
  timeline: { type: Array, required: true },
  keyInfo: { type: Object, default: null },
})

const pb = usePlayback()

// 座標 → SVG：背景圖是 960×960，中心是原點，每 1 單位 40px（±10 剛好在外圈上，整張圖是 ±12）
const SIZE = 960
const RANGE = 12
const UNIT = SIZE / 2 / RANGE
const px = (x) => SIZE / 2 + x * UNIT
const py = (y) => SIZE / 2 - y * UNIT
const TICKS = [-10, -5, 5, 10]
// 播放時標出最近幾步
const TRAIL = 4

const path = computed(() => buildEmotionPath(props.timeline))
const usageByKey = computed(() => new Map(path.value.usage.map((u) => [u.emo.key, u])))

/** 往行進方向右邊彎的曲線；同一點（不會發生，保險起見）回傳空字串 */
function curve(a, b, bend = 0.18) {
  const x1 = px(a.x), y1 = py(a.y), x2 = px(b.x), y2 = py(b.y)
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (!len) return ''
  const cx = (x1 + x2) / 2 - (dy / len) * len * bend
  const cy = (y1 + y2) / 2 + (dx / len) * len * bend
  // 終點往回縮一點，箭頭才不會蓋在點上
  const ex = x2 - ((x2 - cx) / Math.hypot(x2 - cx, y2 - cy)) * 18
  const ey = y2 - ((y2 - cy) / Math.hypot(x2 - cx, y2 - cy)) * 18
  return `M${x1},${y1} Q${cx},${cy} ${ex},${ey}`
}

const maxCount = computed(() => Math.max(1, ...path.value.edges.map((e) => e.count)))
const edges = computed(() =>
  path.value.edges.map((e) => ({
    key: e.from.key + '→' + e.to.key,
    d: curve(e.from, e.to),
    width: 2 + 7 * Math.sqrt(e.count / maxCount.value),
    count: e.count,
  })),
)

// 用到的點（大小依時間占比）與沒用到的點（淡淡的小點，滑過可看說明）
const usedPoints = computed(() =>
  path.value.usage.map((u) => ({ emo: u.emo, r: 11 + 16 * Math.sqrt(u.share) })),
)
const unusedPoints = computed(() => CHORD_EMOTIONS.filter((e) => !usageByKey.value.has(e.key)))

// ---------------------------------------------------------------------------
// 播放同步
// ---------------------------------------------------------------------------
const stepStarts = computed(() => path.value.steps.map((s) => s.start))
const currentIndex = computed(() => (pb.active.value ? indexAt(stepStarts.value, pb.current.value) : -1))
const currentStep = computed(() => path.value.steps[currentIndex.value] ?? null)

const trail = computed(() => {
  const i = currentIndex.value
  if (i < 1) return []
  const out = []
  for (let k = Math.max(1, i - TRAIL + 1); k <= i; k++) {
    const a = path.value.steps[k - 1].emo
    const b = path.value.steps[k].emo
    out.push({ key: k, d: curve(a, b), opacity: 1 - (i - k) * (0.7 / TRAIL) })
  }
  return out
})

const chordNames = (labels) => labels.map((c) => prettyChord(c, props.keyInfo)).join('、')

// ---------------------------------------------------------------------------
// 滑過提示、點清單跳播
// ---------------------------------------------------------------------------
const hoverKey = ref(null)
const hoverEmo = computed(() => CHORD_EMOTIONS.find((e) => e.key === hoverKey.value) ?? null)
const tipStyle = computed(() => {
  const e = hoverEmo.value
  if (!e) return {}
  const left = (px(e.x) / SIZE) * 100
  const top = (py(e.y) / SIZE) * 100
  // 點在右半邊時提示放左邊，避免超出卡片
  return { left: `${left}%`, top: `${top}%`, transform: `translate(${left > 55 ? 'calc(-100% - 16px)' : '16px'}, -50%)` }
})

function jumpTo(u) {
  const t = pb.current.value
  const next = u.starts.find((s) => s > t + 0.05) ?? u.starts[0]
  pb.seek(next)
}

const pct = (v) => (v >= 0.995 ? '100%' : v < 0.01 ? '<1%' : `${Math.round(v * 100)}%`)
const coord = (e) => `(${e.x}, ${e.y})`
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">和弦情緒軌跡</h3>
        <p class="card-desc">依和弦性質（大三、小七、屬七…）定位，不看根音；連續同性質的和弦算同一步</p>
      </div>
    </div>

    <div v-if="!path.steps.length" class="note">這首歌的和弦性質都沒有對應的情緒座標</div>

    <div v-else class="layout">
      <div class="map-wrap">
        <svg
          class="map"
          :viewBox="`0 0 ${SIZE} ${SIZE}`"
          role="img"
          :aria-label="`和弦情緒軌跡，共 ${path.steps.length} 步，用到 ${path.usage.length} 種和弦性質`"
        >
          <defs>
            <marker id="emo-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="22" markerHeight="22" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" class="arrow-base" />
            </marker>
            <marker id="emo-arrow-now" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="30" markerHeight="30" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" class="arrow-now" />
            </marker>
          </defs>

          <image :href="wheelUrl" x="0" y="0" :width="SIZE" :height="SIZE" class="wheel" />

          <!-- 座標軸 -->
          <g class="axes" aria-hidden="true">
            <line :x1="px(-RANGE + 0.5)" :y1="py(0)" :x2="px(RANGE - 0.5)" :y2="py(0)" />
            <line :x1="px(0)" :y1="py(-RANGE + 0.5)" :x2="px(0)" :y2="py(RANGE - 0.5)" />
            <template v-for="t in TICKS" :key="t">
              <line :x1="px(t)" :y1="py(0) - 7" :x2="px(t)" :y2="py(0) + 7" />
              <line :x1="px(0) - 7" :y1="py(t)" :x2="px(0) + 7" :y2="py(t)" />
              <text :x="px(t)" :y="py(0) + 30" text-anchor="middle">{{ t }}</text>
              <text :x="px(0) - 14" :y="py(t) + 8" text-anchor="end">{{ t }}</text>
            </template>
          </g>

          <!-- 沒用到的定義點 -->
          <circle
            v-for="e in unusedPoints"
            :key="e.key"
            :cx="px(e.x)"
            :cy="py(e.y)"
            r="6"
            class="pt-unused"
            :class="{ hover: hoverKey === e.key }"
            @pointerenter="hoverKey = e.key"
            @pointerleave="hoverKey = null"
          />

          <!-- 整首歌的移動 -->
          <path
            v-for="e in edges"
            :key="e.key"
            :d="e.d"
            class="edge"
            :class="{ faded: trail.length }"
            :stroke-width="e.width"
            marker-end="url(#emo-arrow)"
          />

          <!-- 播放中：最近幾步 -->
          <path v-for="t in trail" :key="t.key" :d="t.d" class="trail" :style="{ opacity: t.opacity }" marker-end="url(#emo-arrow-now)" />

          <!-- 用到的點 -->
          <g
            v-for="p in usedPoints"
            :key="p.emo.key"
            class="pt"
            :class="{ hover: hoverKey === p.emo.key, now: currentStep?.emo === p.emo }"
            @pointerenter="hoverKey = p.emo.key"
            @pointerleave="hoverKey = null"
          >
            <circle :cx="px(p.emo.x)" :cy="py(p.emo.y)" :r="p.r" class="pt-dot" />
            <text :x="px(p.emo.x) + p.r + 8" :y="py(p.emo.y) + 9" class="pt-label">{{ p.emo.short }}</text>
          </g>

          <!-- 目前的和弦 -->
          <g v-if="currentStep" class="now-marker" :transform="`translate(${px(currentStep.emo.x)}, ${py(currentStep.emo.y)})`">
            <circle r="22" class="pulse" />
            <circle r="13" class="now-dot" />
          </g>
        </svg>

        <div v-if="hoverEmo" class="chart-tip" :style="tipStyle">
          <strong>{{ hoverEmo.name }} {{ coord(hoverEmo) }}</strong>
          <span>{{ hoverEmo.desc }}</span>
          <span v-if="usageByKey.get(hoverEmo.key)" class="muted">
            占和弦時間 {{ pct(usageByKey.get(hoverEmo.key).share) }}，出現 {{ usageByKey.get(hoverEmo.key).count }} 次
          </span>
          <span v-else class="muted">這首歌沒有用到</span>
        </div>
      </div>

      <div class="side">
        <div class="now-box" :class="{ empty: !currentStep }" aria-live="polite">
          <template v-if="currentStep">
            <div class="now-head">
              <span class="now-chords">{{ chordNames(currentStep.chords) }}</span>
              <span class="now-type">{{ currentStep.emo.name }} {{ coord(currentStep.emo) }}</span>
            </div>
            <p class="now-desc">{{ currentStep.emo.desc }}</p>
            <p class="now-step">第 {{ currentIndex + 1 }} / {{ path.steps.length }} 步</p>
          </template>
          <p v-else class="note">播放時會標出目前的和弦與最近 {{ TRAIL }} 步的軌跡</p>
        </div>

        <div class="sub-title">用到的和弦性質</div>
        <ul class="usage">
          <li v-for="u in path.usage" :key="u.emo.key">
            <button
              type="button"
              class="usage-row"
              :class="{ now: currentStep?.emo === u.emo }"
              :title="`${u.emo.desc}　點一下跳到下一次出現的地方`"
              @pointerenter="hoverKey = u.emo.key"
              @pointerleave="hoverKey = null"
              @focus="hoverKey = u.emo.key"
              @blur="hoverKey = null"
              @click="jumpTo(u)"
            >
              <span class="u-name">{{ u.emo.name }}</span>
              <span class="u-coord">{{ coord(u.emo) }}</span>
              <span class="u-bar"><span :style="{ width: `${Math.max(2, u.share * 100)}%` }" /></span>
              <span class="u-share">{{ pct(u.share) }}</span>
            </button>
          </li>
        </ul>
        <p v-if="path.unmapped.length" class="note unmapped">
          沒有座標、未畫入：{{ path.unmapped.map((u) => `${u.quality}（${pct(u.share)}）`).join('、') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(0, 560px) minmax(240px, 1fr);
  gap: 1.5rem;
  align-items: start;
}

/* 背景圖是白底，兩種主題都放在淺色底板上，圖上的線與字用固定的深色 */
.map-wrap {
  position: relative;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.map {
  display: block;
  width: 100%;
  height: auto;
}

.wheel {
  opacity: 0.5;
}

.axes line {
  stroke: #4a4f63;
  stroke-width: 2;
}

.axes text {
  fill: #4a4f63;
  font-size: 22px;
  font-family: var(--font-sans);
}

.pt-unused {
  fill: #1b1d29;
  opacity: 0.22;
  cursor: help;
}

.pt-unused.hover {
  opacity: 0.6;
}

.edge {
  fill: none;
  stroke: #2b2f45;
  stroke-opacity: 0.45;
  stroke-linecap: round;
  transition: stroke-opacity 0.2s;
}

.edge.faded {
  stroke-opacity: 0.18;
}

.arrow-base {
  fill: #2b2f45;
  fill-opacity: 0.55;
}

.trail {
  fill: none;
  stroke: var(--playhead);
  stroke-width: 7;
  stroke-linecap: round;
}

.arrow-now {
  fill: var(--playhead);
}

.pt {
  cursor: help;
}

.pt-dot {
  fill: #1b1d29;
  stroke: #ffffff;
  stroke-width: 4;
  transition: fill 0.15s;
}

.pt.hover .pt-dot {
  fill: #4b36d6;
}

.pt-label {
  fill: #1b1d29;
  font-size: 28px;
  font-weight: 700;
  font-family: var(--font-sans);
  paint-order: stroke;
  stroke: #ffffff;
  stroke-width: 7px;
  stroke-linejoin: round;
}

.now-dot {
  fill: var(--playhead);
  stroke: #ffffff;
  stroke-width: 4;
}

.pulse {
  fill: none;
  stroke: var(--playhead);
  stroke-width: 4;
  transform-box: fill-box;
  transform-origin: center;
  animation: pulse 1.2s ease-out infinite;
}

@keyframes pulse {
  from {
    transform: scale(0.7);
    opacity: 0.9;
  }
  to {
    transform: scale(1.8);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pulse {
    animation: none;
    opacity: 0.5;
  }
}

/* 右側：目前的和弦＋用到的性質 */
.now-box {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-left: 5px solid var(--playhead);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  min-height: 120px;
}

.now-box.empty {
  border-left-color: var(--border-strong);
  display: flex;
  align-items: center;
}

.now-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
}

.now-chords {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.25;
}

.now-type {
  color: var(--text2);
  font-size: 0.95rem;
}

.now-desc {
  margin-top: 0.35rem;
  font-size: 1rem;
}

.now-step {
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: var(--muted);
}

.usage {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.usage-row {
  width: 100%;
  display: grid;
  grid-template-columns: auto auto 1fr 3.2em;
  align-items: center;
  gap: 10px;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  text-align: left;
  color: var(--text);
}

.usage-row:hover {
  background: var(--surface2);
  border-color: var(--border);
}

.usage-row.now {
  border-color: var(--playhead);
}

.u-name {
  font-weight: 600;
  white-space: nowrap;
}

.u-coord {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--muted);
  white-space: nowrap;
}

.u-bar {
  height: 8px;
  background: var(--surface3);
  border-radius: 4px;
  overflow: hidden;
}

.u-bar > span {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
}

.u-share {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 0.9rem;
  color: var(--text2);
}

.unmapped {
  margin-top: 0.75rem;
}

.chart-tip {
  white-space: normal;
  width: max-content;
  max-width: 260px;
}

@media (max-width: 860px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
