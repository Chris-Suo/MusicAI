<script setup>
/**
 * 情緒輪座標圖的底圖：色輪、座標軸與刻度、象限、軸兩端的方向、圓外的情緒詞
 * 放在 EmotionTrajectoryMap.vue 的 <svg> 裡（根元素是 <g>），點和軌跡畫在它上面
 *
 * 色輪是向量畫的（扇形與顏色在 utils/emotionWheel.js 的 WHEEL_WEDGES，色相、明度、彩度都照角度走），
 * 主題的差別交給 main.css 的 --wheel-* 色票，所以淺色、深色各有一套，字也能用一般的文字色票。
 * 這裡文字的位置與字級有在 utils/emotionWheel.js 的 WHEEL_TEXTS 複製一份，給標籤避讓用，改這裡要一起改
 * 位置的計算在 utils/emotionWheel.js
 */
import { UNIT, R, px, py, ringTicks, ringLabels, AXIS_LABELS, QUADRANTS, AXIS_TICKS, SPOKES, WHEEL_WEDGES } from '@/utils/emotionWheel.js'

defineProps({
  // 漸層的 id 前綴；同一頁有好幾張圖時要不一樣
  uid: { type: String, required: true },
})
</script>

<template>
  <g aria-hidden="true">
    <defs>
      <!-- 圓心是「情緒中性」，所以中央淡出成底板色，顏色往外才浮出來。
           只蓋住中央一小塊（到半徑三分之一就完全放開），蓋太大整個色輪會變粉 -->
      <radialGradient :id="`${uid}-core`" :cx="px(0)" :cy="py(0)" :r="R * UNIT" gradientUnits="userSpaceOnUse">
        <stop offset="0" class="core-0" />
        <stop offset="0.07" class="core-1" />
        <stop offset="0.18" class="core-2" />
        <stop offset="0.33" class="core-3" />
      </radialGradient>
    </defs>

    <!-- 色輪：96 片扇形，每片的色相、明度、彩度都由 WHEEL_WEDGES 照角度給 -->
    <g class="wheel" :style="{ transformOrigin: `${px(0)}px ${py(0)}px` }">
      <path v-for="w in WHEEL_WEDGES" :key="w.key" :d="w.d" :style="{ '--h': w.h, '--l': w.l, '--c': w.c }" />
    </g>
    <circle :cx="px(0)" :cy="py(0)" :r="R * UNIT" :fill="`url(#${uid}-core)`" />

    <g class="axes">
      <!-- 圓心到圓周的分隔線：每 15 度一條。先畫，後面的軸線與虛線圓才蓋得過去 -->
      <line v-for="s in SPOKES" :key="s.key" :x1="px(0)" :y1="py(0)" :x2="s.x" :y2="s.y" class="spoke" />
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
      <text v-for="a in AXIS_LABELS" :key="a.key" :x="px(a.x)" :y="py(a.y)" :text-anchor="a.anchor" :class="a.sub ? 'axis-sub' : 'axis-text'">{{ a.text }}</text>
    </g>

    <!-- 圓周外的情緒詞 -->
    <g class="ring">
      <line v-for="t in ringTicks" :key="t.key" :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2" class="ring-tick" />
      <circle v-for="t in ringTicks" :key="'d' + t.key" :cx="t.x1" :cy="t.y1" r="3" class="ring-dot" />
      <text v-for="g in ringLabels" :key="g.key" :text-anchor="g.anchor" class="ring-text">
        <tspan v-for="l in g.lines" :key="l.zh" :x="g.x" :y="l.y"><tspan class="ring-zh">{{ l.zh }}</tspan> {{ l.en }}</tspan>
      </text>
    </g>
  </g>
</template>

<style scoped>
/* --- 色輪 --- */
/* 每片扇形的顏色來自 WHEEL_WEDGES（量自原本的點陣色輪），主題只調整整體的提亮與彩度倍率 */
.wheel path {
  fill: oklch(calc(var(--l) + var(--wheel-dl)) calc(var(--c) * var(--wheel-sat)) var(--h));
}

/* 呼吸：濃度與尺寸都只動一點點，慢到不會搶走注意力 */
.wheel {
  opacity: var(--wheel-ink);
  animation: wheel-breathe 11s ease-in-out infinite alternate;
}

@keyframes wheel-breathe {
  from {
    opacity: calc(var(--wheel-ink) - 0.1);
    transform: scale(0.992);
  }
  to {
    opacity: var(--wheel-ink);
    transform: scale(1.008);
  }
}

/* 中央淡出成底板色 */
.core-0 {
  stop-color: var(--wheel-plate);
  stop-opacity: 1;
}

.core-1 {
  stop-color: var(--wheel-plate);
  stop-opacity: 0.52;
}

.core-2 {
  stop-color: var(--wheel-plate);
  stop-opacity: 0.17;
}

.core-3 {
  stop-color: var(--wheel-plate);
  stop-opacity: 0;
}

/* --- 座標軸 --- */
.axes line {
  stroke: var(--axis);
  stroke-width: 1.5;
}

/* 圓心到圓周的分隔線：比座標軸細、比圓周淡，是底圖的格線而不是另一組軸，
   所以從色輪上看得到、但不會跟軸線搶。位置算在 utils/emotionWheel.js 的 SPOKES */
.axes .spoke {
  stroke: var(--muted);
  stroke-width: 1;
  opacity: 0.28;
}

.axes .rim {
  fill: none;
  stroke: var(--border-strong);
  stroke-width: 1.5;
  opacity: 0.7;
}

.axes .half {
  fill: none;
  stroke: var(--axis);
  stroke-width: 1.5;
  stroke-dasharray: 5 9;
}

/* 圓內的字：用一般文字色票，底板色的外框當柔光。
   底下的色輪是飽和色，外框太細字會被吃掉，所以留 4.5px */
.tick-text,
.quad-text,
.axis-text,
.axis-sub {
  font-family: var(--font-sans);
  paint-order: stroke;
  stroke: var(--wheel-plate);
  stroke-width: 4.5px;
  stroke-linejoin: round;
}

.tick-text {
  fill: var(--muted);
  font-size: 18px;
}

.quad-text {
  fill: var(--text2);
  font-size: 20px;
  opacity: 0.8;
  letter-spacing: 0.08em;
}

.axis-text {
  fill: var(--text2);
  font-size: 22px;
  font-weight: 700;
}

/* 軸名、英文：比軸兩端的字小一號 */
.axis-sub {
  fill: var(--muted);
  font-size: 17px;
  font-weight: 500;
}

/* --- 圓周外的情緒詞：純粹是參考用的語境，所以最淡，也跟著呼吸 --- */
.ring {
  animation: ring-breathe 13s ease-in-out infinite alternate;
}

@keyframes ring-breathe {
  from {
    opacity: 0.72;
  }
  to {
    opacity: 1;
  }
}

.ring-tick {
  stroke: var(--border-strong);
  stroke-width: 1.5;
  opacity: 0.6;
}

.ring-dot {
  fill: var(--border-strong);
  opacity: 0.6;
}

.ring-text {
  fill: var(--muted);
  font-size: 19px;
  font-family: var(--font-sans);
}

.ring-zh {
  fill: var(--text2);
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .wheel,
  .ring {
    animation: none;
  }
}
</style>
