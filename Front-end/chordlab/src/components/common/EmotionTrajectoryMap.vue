<script setup>
/**
 * 情緒輪上的軌跡圖（音高情緒軌跡、速度情緒軌跡共用）：底圖＋整首歌的軌跡＋播放中的紅點與最近幾步
 * - steps：[{ emo: { key, x, y, short }, start, end }]，依時間排序；座標 ±10（x 正負情緒、y 張力）
 * - 同一個座標的步畫成一個點，編號用「、」串起來（例如速度回到同一個區間）
 * - refPoints：淡淡的參考點（例如速度區間的位置），[{ key, x, y, label }]
 * - 滑過點時用 v-model:hover 回報點的 key（posKey），提示框的內容由使用的元件用 #tip 插槽決定
 */
import { computed } from 'vue'
import EmotionWheelBackdrop from '@/components/common/EmotionWheelBackdrop.vue'
import { W, H, px, py, curve } from '@/utils/emotionWheel.js'
import { posKey } from '@/composables/useTrajectoryPlayback.js'

const props = defineProps({
  steps: { type: Array, required: true },
  // useTrajectoryPlayback() 的結果
  playback: { type: Object, required: true },
  // SVG 裡 marker、clipPath 的 id 前綴；同一頁有好幾張圖時要不一樣
  idPrefix: { type: String, required: true },
  label: { type: String, default: '' },
  refPoints: { type: Array, default: () => [] },
})

const hover = defineModel('hover', { type: String, default: null })

const currentStep = computed(() => props.playback.currentStep.value)
const moveProgress = computed(() => props.playback.moveProgress.value)
const markerPos = computed(() => props.playback.markerPos.value)
const trail = computed(() => props.playback.trail.value)

// 同一個座標的步合成一個點
const positions = computed(() => {
  const map = new Map()
  for (const s of props.steps) {
    const k = posKey(s.emo)
    if (!map.has(k)) map.set(k, { key: k, x: s.emo.x, y: s.emo.y, steps: [] })
    map.get(k).steps.push(s)
  }
  return [...map.values()].map((p) => {
    const nums = p.steps.map((s) => s.emo.short)
    return { ...p, label: nums.length > 3 ? `${nums.slice(0, 3).join('、')}…` : nums.join('、') }
  })
})

const edges = computed(() =>
  props.steps
    .slice(1)
    .map((s, i) => ({ key: s.emo.key, d: curve(props.steps[i].emo, s.emo) }))
    .filter((e) => e.d),
)

const hoverPos = computed(() => positions.value.find((p) => p.key === hover.value) ?? null)
const tipStyle = computed(() => {
  const p = hoverPos.value
  if (!p) return {}
  const left = (px(p.x) / W) * 100
  const top = (py(p.y) / H) * 100
  return { left: `${left}%`, top: `${top}%`, transform: `translate(${left > 55 ? 'calc(-100% - 16px)' : '16px'}, -50%)` }
})
</script>

<template>
  <div class="map-wrap">
    <svg class="map" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="label">
      <defs>
        <marker :id="`${idPrefix}-arrow`" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="22" markerHeight="22" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" class="arrow-base" />
        </marker>
        <marker :id="`${idPrefix}-arrow-now`" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="30" markerHeight="30" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" class="arrow-now" />
        </marker>
      </defs>

      <!-- 背景色輪、座標軸、外圈情緒詞（跟和弦情緒軌跡共用） -->
      <EmotionWheelBackdrop :clip-id="`${idPrefix}-clip`" />

      <!-- 參考點 -->
      <g v-for="r in refPoints" :key="r.key" class="ref" aria-hidden="true">
        <circle :cx="px(r.x)" :cy="py(r.y)" r="6" class="ref-dot" />
        <!-- 標籤放在朝圓心的那一側，避免壓到圓外的情緒詞 -->
        <text :x="px(r.x) + (r.x > 0 ? -12 : 12)" :y="py(r.y) + 6" :text-anchor="r.x > 0 ? 'end' : 'start'" class="ref-label">{{ r.label }}</text>
      </g>

      <!-- 整首歌的軌跡 -->
      <path v-for="e in edges" :key="e.key" :d="e.d" class="edge" :class="{ faded: trail.length }" :marker-end="`url(#${idPrefix}-arrow)`" />

      <!-- 播放中：最近幾步 -->
      <path
        v-for="t in trail"
        :key="t.key"
        :d="t.d"
        class="trail"
        :style="{ opacity: t.opacity }"
        :marker-end="t.arrow ? `url(#${idPrefix}-arrow-now)` : null"
      />

      <!-- 每一步的位置 -->
      <g
        v-for="p in positions"
        :key="p.key"
        class="pt-step"
        :class="{ hover: hover === p.key, now: currentStep && p.steps.includes(currentStep) && moveProgress >= 1 }"
        @pointerenter="hover = p.key"
        @pointerleave="hover = null"
      >
        <circle :cx="px(p.x)" :cy="py(p.y)" r="9" class="pt-step-dot" />
        <text :x="px(p.x)" :y="py(p.y) - 16" text-anchor="middle" class="pt-step-label">{{ p.label }}</text>
      </g>

      <!-- 目前的位置 -->
      <g v-if="markerPos" class="now-marker" :transform="`translate(${markerPos.x}, ${markerPos.y})`">
        <circle r="22" class="pulse" />
        <circle r="13" class="now-dot" />
      </g>
    </svg>

    <div v-if="hoverPos" class="chart-tip" :style="tipStyle">
      <slot name="tip" :steps="hoverPos.steps" />
    </div>
  </div>
</template>

<style scoped>
/* 跟和弦情緒軌跡一樣放在深色底板上 */
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

.ref-dot {
  fill: #ffffff;
  opacity: 0.4;
}

.ref-label {
  fill: #e6e8ef;
  font-size: 17px;
  font-family: var(--font-sans);
  paint-order: stroke;
  stroke: #0b0d16;
  stroke-width: 4px;
  stroke-linejoin: round;
  opacity: 0.8;
}

.edge {
  fill: none;
  stroke: #ffffff;
  stroke-opacity: 0.6;
  stroke-width: 3.5;
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
  stroke-width: 7;
  stroke-linecap: round;
  filter: drop-shadow(0 0 3px #000000);
}

.arrow-now {
  fill: var(--playhead);
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

.chart-tip {
  white-space: normal;
  width: max-content;
  max-width: 300px;
}
</style>
