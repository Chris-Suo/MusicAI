<script setup>
/**
 * 情緒輪座標圖的底圖：色輪、座標軸與刻度、象限、軸兩端的方向、圓外的情緒詞
 * 放在使用它的元件自己的 <svg> 裡（根元素是 <g>），點和軌跡畫在它上面
 * 位置的計算在 utils/emotionWheel.js
 */
import wheelUrl from '@/assets/emotion-color-wheel.webp'
import { UNIT, R, px, py, ringTicks, ringLabels, AXIS_LABELS, QUADRANTS, AXIS_TICKS } from '@/utils/emotionWheel.js'

defineProps({
  // 色輪裁成圓形用的 clipPath id；同一頁有好幾張圖時要不一樣
  clipId: { type: String, required: true },
})
</script>

<template>
  <g>
    <defs>
      <clipPath :id="clipId">
        <circle :cx="px(0)" :cy="py(0)" :r="R * UNIT" />
      </clipPath>
    </defs>

    <!-- 背景色輪：裁成圓形，±10 在圓周上 -->
    <image
      :href="wheelUrl"
      :x="px(-R)"
      :y="py(R)"
      :width="2 * R * UNIT"
      :height="2 * R * UNIT"
      :clip-path="`url(#${clipId})`"
      class="wheel"
    />

    <g class="axes" aria-hidden="true">
      <!-- 圓周、半徑 5 的虛線圓、十字軸 -->
      <circle :cx="px(0)" :cy="py(0)" :r="R * UNIT" class="rim" />
      <circle :cx="px(0)" :cy="py(0)" :r="5 * UNIT" class="half" />
      <line :x1="px(-R)" :y1="py(0)" :x2="px(R)" :y2="py(0)" />
      <line :x1="px(0)" :y1="py(-R)" :x2="px(0)" :y2="py(R)" />
      <!-- 刻度：x 軸在軸線下方，y 軸在軸線左邊 -->
      <template v-for="t in AXIS_TICKS" :key="t">
        <line :x1="px(t)" :y1="py(0) - 6" :x2="px(t)" :y2="py(0) + 6" />
        <text :x="px(t)" :y="py(0) + 28" text-anchor="middle" class="tick-text">{{ t }}</text>
        <template v-if="Math.abs(t) < R">
          <line :x1="px(0) - 6" :y1="py(t)" :x2="px(0) + 6" :y2="py(t)" />
          <text :x="px(0) - 12" :y="py(t) + 7" text-anchor="end" class="tick-text">{{ t }}</text>
        </template>
      </template>
      <!-- 四個象限、軸的兩端 -->
      <text v-for="q in QUADRANTS" :key="q.key" :x="px(q.x)" :y="py(q.y)" text-anchor="middle" class="quad-text">{{ q.text }}</text>
      <text v-for="a in AXIS_LABELS" :key="a.key" :x="px(a.x)" :y="py(a.y)" :text-anchor="a.anchor" class="axis-text">{{ a.text }}</text>
    </g>

    <!-- 圓周外的情緒詞 -->
    <g class="ring" aria-hidden="true">
      <line v-for="t in ringTicks" :key="t.key" :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2" class="ring-tick" />
      <circle v-for="t in ringTicks" :key="'d' + t.key" :cx="t.x1" :cy="t.y1" r="3.5" class="ring-dot" />
      <text v-for="g in ringLabels" :key="g.key" :text-anchor="g.anchor" class="ring-text">
        <tspan v-for="l in g.lines" :key="l.zh" :x="g.x" :y="l.y"><tspan class="ring-zh">{{ l.zh }}</tspan> {{ l.en }}</tspan>
      </text>
    </g>
  </g>
</template>

<style scoped>
.wheel {
  opacity: 0.85;
}

.axes line {
  stroke: #ffffff;
  stroke-width: 2;
  opacity: 0.55;
}

.axes .rim {
  fill: none;
  stroke: #8a8f9e;
  stroke-width: 2;
}

.axes .half {
  fill: none;
  stroke: #ffffff;
  stroke-width: 1.5;
  stroke-dasharray: 6 8;
  opacity: 0.45;
}

/* 圓內的字：白字＋深色外框，在色輪上也看得清楚 */
.tick-text,
.quad-text,
.axis-text {
  font-family: var(--font-sans);
  paint-order: stroke;
  stroke: #0b0d16;
  stroke-linejoin: round;
}

.tick-text {
  fill: #e6e8ef;
  font-size: 18px;
  stroke-width: 4px;
}

.quad-text {
  fill: #e6e8ef;
  font-size: 20px;
  stroke-width: 5px;
  opacity: 0.85;
}

.axis-text {
  fill: #ffffff;
  font-size: 22px;
  font-weight: 700;
  stroke-width: 6px;
}

/* 圓周外的情緒詞 */
.ring-tick {
  stroke: #8a8f9e;
  stroke-width: 2;
}

.ring-dot {
  fill: #8a8f9e;
}

.ring-text {
  fill: #a6acc0;
  font-size: 19px;
  font-family: var(--font-sans);
}

.ring-zh {
  fill: #e6e8ef;
  font-weight: 700;
}
</style>
