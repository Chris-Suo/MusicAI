<script setup>
/**
 * 和弦情緒軌跡
 * 使用 utils/chordEmotion.js：依和弦性質把每個和弦放到情緒輪座標上，再連成軌跡。
 * 軌跡有兩個版本，在 utils/chordEmotion.js 的 buildTrajectory() 切換（註解掉一行、打開另一行）：
 *   A. 和弦順序：每換一種和弦性質就是一步
 *   B. 區間平均座標（目前使用）：每 15 秒一個區間，區間內和弦座標的 x、y 各自平均，得到平均座標，一個區間一步；
 *      播放時會用淡紅色畫出目前區間的圖形，數字點是各區間的平均座標
 * - 灰色曲線：整首歌出現過的移動（A → B），越粗代表出現越多次；曲線往行進方向的右邊彎，來回兩個方向不會疊在一起
 * - 播放時：紅點是目前的和弦，紅色箭頭是最近幾步的軌跡；
 *   換和弦時紅點依播放時間沿曲線慢慢移到新位置（不是一次跳過去），暫停時停在半路，跳轉時直接算出該在的位置
 * - 點右邊的清單：跳到下一次出現這種和弦的地方播放
 * - 下方另一張卡（ChordEmotionList.vue）依時間順序列出每一段用了哪些和弦與性質，用的是這裡的 path
 *
 * x、y 的數值出現在右邊的性質清單、「目前這一段」與滑過的提示。
 * 性質的座標是固定值（大三和弦永遠是 8, 5）；區間點是區間內所有和弦座標的平均，所以會有小數。
 * 每種性質的文字說明只在右邊清單出現一次，不在逐段明細重印。
 */
import { ref, computed } from 'vue'
import { CHORD_EMOTIONS, buildTrajectory, convexHull } from '@/utils/chordEmotion.js'
import { prettyChord } from '@/utils/chords.js'
import { indexAt } from '@/utils/time.js'
import { usePlayback } from '@/composables/usePlayback.js'
import ChordEmotionList from '@/components/harmony/ChordEmotionList.vue'
import EmotionWheelBackdrop from '@/components/common/EmotionWheelBackdrop.vue'
import { W, H, px, py, geom, pointOn, partialCurve, curve, easeInOut } from '@/utils/emotionWheel.js'

const props = defineProps({
  timeline: { type: Array, required: true },
  keyInfo: { type: Object, default: null },
})

const pb = usePlayback()

// 座標換算、曲線、底圖都在 utils/emotionWheel.js 與 EmotionWheelBackdrop.vue（音高情緒軌跡也用同一套）

// 播放時標出最近幾步
const TRAIL = 4
// 換和弦時移動的時間：這個和弦長度的 75%，最多 2.5 秒（和弦很短時移動得比較快）
const MOVE_SHARE = 0.75
const MOVE_MAX = 2.5

// 軌跡版本（A. 和弦順序／B. 每 15 秒區間平均）的切換在 utils/chordEmotion.js 的 buildTrajectory()，
// 總樂性元分頁也用同一個，切換一次兩邊一起換
const path = computed(() => buildTrajectory(props.timeline))

const isWindowMode = computed(() => path.value.mode === 'window')
const usageByKey = computed(() => new Map(path.value.usage.map((u) => [u.emo.key, u])))

const maxCount = computed(() => Math.max(1, ...path.value.edges.map((e) => e.count)))
const edges = computed(() =>
  path.value.edges.map((e) => ({
    key: e.from.key + '→' + e.to.key,
    d: curve(e.from, e.to),
    // 區間版本每條只出現一次，用細線就好
    width: maxCount.value > 1 ? 2 + 7 * Math.sqrt(e.count / maxCount.value) : 3.5,
    count: e.count,
  })),
)

// 用到的點（大小依時間占比）與沒用到的點（淡淡的小點，滑過可看說明）
const usedPoints = computed(() =>
  path.value.usage.map((u) => ({ emo: u.emo, r: 11 + 16 * Math.sqrt(u.share) })),
)
const unusedPoints = computed(() => CHORD_EMOTIONS.filter((e) => !usageByKey.value.has(e.key)))
// 軌跡上不是和弦性質本身的點（區間版本的平均座標），畫成有編號的小點
const stepPoints = computed(() => {
  const seen = new Set()
  return path.value.steps.map((s) => s.emo).filter((e) => !usageByKey.value.has(e.key) && !seen.has(e.key) && seen.add(e.key))
})

// ---------------------------------------------------------------------------
// 播放同步
// ---------------------------------------------------------------------------
const stepStarts = computed(() => path.value.steps.map((s) => s.start))
const currentIndex = computed(() => (pb.active.value ? indexAt(stepStarts.value, pb.current.value) : -1))
const currentStep = computed(() => path.value.steps[currentIndex.value] ?? null)

// 使用者設定「減少動態效果」時直接跳到定位
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** 從上一個和弦移到目前和弦走了多少（0～1，已套用緩動）；由播放時間算，暫停或跳轉都一致 */
const moveProgress = computed(() => {
  const i = currentIndex.value
  if (i < 1 || reduceMotion) return 1
  const step = path.value.steps[i]
  const next = path.value.steps[i + 1]
  const dur = (next ? next.start : step.end) - step.start
  const moveTime = Math.min(MOVE_MAX, Math.max(0.05, dur * MOVE_SHARE))
  const p = Math.min(1, Math.max(0, (pb.current.value - step.start) / moveTime))
  return easeInOut(p)
})

// 目前用到的和弦性質：和弦順序版本就是那一種，區間版本是區間內的全部
const currentMembers = computed(() => {
  const emo = currentStep.value?.emo
  return emo ? (emo.members ?? [emo]) : []
})

// 區間版本：目前區間的和弦座標圍成的圖形（2 個點時是一條線）
const currentShape = computed(() => {
  if (!isWindowMode.value || currentMembers.value.length < 2) return null
  return convexHull(currentMembers.value)
    .map((e) => `${px(e.x)},${py(e.y)}`)
    .join(' ')
})

/** 紅點目前的位置（SVG 座標） */
const markerPos = computed(() => {
  const step = currentStep.value
  if (!step) return null
  const p = moveProgress.value
  if (p >= 1) return { x: px(step.emo.x), y: py(step.emo.y) }
  return pointOn(geom(path.value.steps[currentIndex.value - 1].emo, step.emo), p)
})

const trail = computed(() => {
  const i = currentIndex.value
  if (i < 1) return []
  const out = []
  for (let k = Math.max(1, i - TRAIL + 1); k <= i; k++) {
    const a = path.value.steps[k - 1].emo
    const b = path.value.steps[k].emo
    // 正在移動的那一步只畫到紅點的位置，到了才加箭頭
    const moving = k === i && moveProgress.value < 1
    out.push({
      key: k,
      d: moving ? partialCurve(a, b, moveProgress.value) : curve(a, b),
      arrow: !moving,
      opacity: 1 - (i - k) * (0.7 / TRAIL),
    })
  }
  return out
})

const chordNames = (labels) => labels.map((c) => prettyChord(c, props.keyInfo)).join('、')

// ---------------------------------------------------------------------------
// 滑過提示、點清單跳播
// ---------------------------------------------------------------------------
const hoverKey = ref(null)
const hoverEmo = computed(
  () =>
    CHORD_EMOTIONS.find((e) => e.key === hoverKey.value) ??
    path.value.steps.find((s) => s.emo.key === hoverKey.value)?.emo ??
    null,
)
const tipStyle = computed(() => {
  const e = hoverEmo.value
  if (!e) return {}
  const left = (px(e.x) / W) * 100
  const top = (py(e.y) / H) * 100
  // 點在右半邊時提示放左邊，避免超出卡片
  return { left: `${left}%`, top: `${top}%`, transform: `translate(${left > 55 ? 'calc(-100% - 16px)' : '16px'}, -50%)` }
})

/**
 * 沒有定義情緒座標的和弦性質（BTC 會輸出的 14 種裡只有 sus4 沒有定義，見 chordEmotion.js 的 CHORD_EMOTIONS）
 * 這些和弦畫不進軌跡，也不算進上面的占比，所以要說一句，否則上面的百分比加起來不到 100%
 */
const unmappedText = computed(() => {
  const list = path.value.unmapped
  if (!list.length) return ''
  const total = list.reduce((s, u) => s + u.share, 0)
  const names = list.map((u) => u.quality).join('、')
  return `這首歌有 ${pct(total)} 的時間是 ${names} 和弦，情緒輪上還沒有${list.length > 1 ? '它們' : '它'}的位置，所以沒有算進上面的比例`
})

function jumpTo(u) {
  const t = pb.current.value
  const next = u.starts.find((s) => s > t + 0.05) ?? u.starts[0]
  pb.seek(next)
}

const pct = (v) => (v >= 0.995 ? '100%' : v < 0.01 ? '<1%' : `${Math.round(v * 100)}%`)
// 座標取到小數一位；區間點是區間內所有和弦座標的平均，所以會有小數
const num = (v) => String(Math.round(v * 10) / 10)
const coord = (e) => `(${num(e.x)}, ${num(e.y)})`
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">和弦情緒軌跡</h3>
        <p class="card-desc">
          依和弦性質定位，不看根音<template v-if="isWindowMode">・每 {{ path.windowSec }} 秒一段</template>
        </p>
      </div>
    </div>

    <div v-if="!path.steps.length" class="note">這首歌的和弦性質都沒有對應的情緒座標</div>

    <div v-else class="layout">
      <div class="map-wrap">
        <svg
          class="map"
          :viewBox="`0 0 ${W} ${H}`"
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

          <!-- 背景色輪、座標軸、外圈情緒詞（跟音高情緒軌跡共用） -->
          <EmotionWheelBackdrop clip-id="chord-wheel-clip" />

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

          <!-- 區間版本：目前區間的圖形 -->
          <polygon v-if="currentShape" :points="currentShape" class="shape" />

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
          <path
            v-for="t in trail"
            :key="t.key"
            :d="t.d"
            class="trail"
            :style="{ opacity: t.opacity }"
            :marker-end="t.arrow ? 'url(#emo-arrow-now)' : null"
          />

          <!-- 用到的點 -->
          <g
            v-for="p in usedPoints"
            :key="p.emo.key"
            class="pt"
            :class="{ hover: hoverKey === p.emo.key, now: currentMembers.includes(p.emo) && moveProgress >= 1 }"
            @pointerenter="hoverKey = p.emo.key"
            @pointerleave="hoverKey = null"
          >
            <circle :cx="px(p.emo.x)" :cy="py(p.emo.y)" :r="p.r" class="pt-dot" />
            <text :x="px(p.emo.x) + p.r + 8" :y="py(p.emo.y) + 9" class="pt-label">{{ p.emo.short }}</text>
          </g>

          <!-- 區間平均座標 -->
          <g
            v-for="e in stepPoints"
            :key="e.key"
            class="pt-step"
            :class="{ hover: hoverKey === e.key, now: currentStep?.emo === e && moveProgress >= 1 }"
            @pointerenter="hoverKey = e.key"
            @pointerleave="hoverKey = null"
          >
            <circle :cx="px(e.x)" :cy="py(e.y)" r="8" class="pt-step-dot" />
            <text :x="px(e.x)" :y="py(e.y) - 15" text-anchor="middle" class="pt-step-label">{{ e.short }}</text>
          </g>

          <!-- 目前的和弦 -->
          <g v-if="markerPos" class="now-marker" :transform="`translate(${markerPos.x}, ${markerPos.y})`">
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
          <span v-else-if="hoverEmo.window" class="muted">第 {{ hoverEmo.window }} 段</span>
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
            <p class="now-step">第 {{ currentIndex + 1 }} / {{ path.steps.length }} 段</p>
          </template>
          <p v-else class="note">播放時這裡會顯示目前的和弦</p>
        </div>

        <!-- 用到的和弦性質：每種性質的說明只在這裡出現一次 -->
        <div class="sub-title">用到的和弦性質</div>
        <ul class="usage">
          <li v-for="u in path.usage" :key="u.emo.key">
            <button
              type="button"
              class="usage-row"
              :class="{ now: currentMembers.includes(u.emo) }"
              title="點一下跳到下一次出現的地方"
              @pointerenter="hoverKey = u.emo.key"
              @pointerleave="hoverKey = null"
              @focus="hoverKey = u.emo.key"
              @blur="hoverKey = null"
              @click="jumpTo(u)"
            >
              <span class="u-top">
                <span class="u-name">{{ u.emo.name }}</span>
                <span class="u-coord">{{ coord(u.emo) }}</span>
                <span class="u-bar"><span :style="{ width: `${Math.max(2, u.share * 100)}%` }" /></span>
                <span class="u-share">{{ pct(u.share) }}</span>
              </span>
              <span class="u-desc">{{ u.emo.desc }}</span>
            </button>
          </li>
        </ul>
        <p v-if="unmappedText" class="note unmapped">{{ unmappedText }}</p>
      </div>
    </div>
  </div>

  <!-- 軌跡逐段明細（另一張卡，放在軌跡下方） -->
  <ChordEmotionList v-if="path.steps.length" :path="path" :key-info="keyInfo" :current-index="currentIndex" />
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(0, 700px) minmax(240px, 1fr);
  gap: 1.5rem;
  align-items: start;
}

/* 色輪很鮮豔，兩種主題都放在深色底板上，圖上的點、線、字用固定的淺色＋深色外框 */
.map-wrap {
  position: relative;
  background: #0d0f16;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.map {
  display: block;
  width: 100%;
  height: auto;
}

.pt-unused {
  fill: #ffffff;
  opacity: 0.35;
  cursor: help;
}

.pt-unused.hover {
  opacity: 0.85;
}

.edge {
  fill: none;
  stroke: #ffffff;
  stroke-opacity: 0.6;
  stroke-linecap: round;
  transition: stroke-opacity 0.2s;
}

.edge.faded {
  stroke-opacity: 0.25;
}

.arrow-base {
  fill: #ffffff;
  fill-opacity: 0.7;
}

.trail {
  fill: none;
  stroke: var(--playhead);
  filter: drop-shadow(0 0 3px #000000);
  stroke-width: 7;
  stroke-linecap: round;
}

.arrow-now {
  fill: var(--playhead);
}

.pt {
  cursor: help;
}

/* 區間版本：目前區間的圖形 */
.shape {
  fill: var(--playhead);
  fill-opacity: 0.12;
  stroke: var(--playhead);
  stroke-opacity: 0.6;
  stroke-width: 3;
  stroke-dasharray: 10 8;
  stroke-linejoin: round;
}

.pt-step {
  cursor: help;
}

.pt-step-dot {
  fill: #11131c;
  stroke: #ffffff;
  stroke-width: 3;
}

.pt-step.hover .pt-step-dot,
.pt-step.now .pt-step-dot {
  fill: #9d8cff;
  stroke: #ffffff;
}

.pt-step-label {
  fill: #ffffff;
  font-size: 20px;
  font-weight: 700;
  font-family: var(--font-sans);
  paint-order: stroke;
  stroke: #0b0d16;
  stroke-width: 6px;
  stroke-linejoin: round;
}

.pt-dot {
  fill: #ffffff;
  stroke: #11131c;
  stroke-width: 4;
  transition: fill 0.15s;
}

.pt.hover .pt-dot {
  fill: #9d8cff;
}

.pt-label {
  fill: #ffffff;
  font-size: 28px;
  font-weight: 700;
  font-family: var(--font-sans);
  paint-order: stroke;
  stroke: #0b0d16;
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
  min-height: 104px;
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
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 5px 8px;
  text-align: left;
  color: var(--text);
}

.u-top {
  display: grid;
  grid-template-columns: auto auto 1fr 3.2em;
  align-items: center;
  gap: 10px;
}

.u-coord {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--muted);
  white-space: nowrap;
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

.u-desc {
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.45;
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
