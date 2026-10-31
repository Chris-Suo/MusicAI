<script setup>
/**
 * 旋律音域：最低音、最高音、最常出現的音，畫在鋼琴鍵盤上
 */
import { computed } from 'vue'
import { fmtHz } from '@/utils/music.js'
import { fmtClock } from '@/utils/stats.js'

const props = defineProps({
  // utils/pitch.js analyzePitch() 的結果；後端沒有音高資料時是 null
  stats: { type: Object, default: null },
})

const KEY_W = 22
const KEY_H = 78
const BLACK_H = 48
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11]
const BLACK_OFFSET = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 } // 黑鍵在第幾個白鍵右邊

const ready = computed(() => props.stats && props.stats.low)

// 鍵盤範圍：涵蓋音域的完整八度，至少兩個八度
const keyboard = computed(() => {
  if (!ready.value) return null
  const { low, high, top } = props.stats
  let firstOct = Math.floor(low.midi / 12)
  let lastOct = Math.floor(high.midi / 12)
  if (lastOct - firstOct < 1) lastOct = firstOct + 1
  const whites = []
  const blacks = []
  for (let o = firstOct; o <= lastOct; o++) {
    const base = (o - firstOct) * 7
    WHITE_PCS.forEach((pc, i) => {
      const m = o * 12 + pc
      whites.push({ m, x: (base + i) * KEY_W, inRange: m >= low.midi && m <= high.midi, label: pc === 0 ? `C${o - 1}` : '' })
    })
    for (const [pc, after] of Object.entries(BLACK_OFFSET)) {
      const m = o * 12 + Number(pc)
      blacks.push({ m, x: (base + after + 1) * KEY_W - 7, inRange: m >= low.midi && m <= high.midi })
    }
  }
  const all = [...whites, ...blacks.map((b) => ({ ...b, black: true }))]
  const find = (m) => all.find((k) => k.m === m)
  const lowKey = find(low.midi)
  const highKey = find(high.midi)
  // 最低／最高音很近時，標籤分別往左右靠，避免重疊
  const close = lowKey && highKey && keyCenter(highKey) - keyCenter(lowKey) < 120
  return { whites, blacks, width: whites.length * KEY_W, lowKey, highKey, topKey: find(top.midi), close }
})

function markAttrs(k, i) {
  const c = keyCenter(k)
  if (!keyboard.value.close) return { x: c, anchor: 'middle' }
  return i === 0 ? { x: c + 6, anchor: 'end' } : { x: c - 6, anchor: 'start' }
}

const keyCenter = (k) => (k.black ? k.x + 7 : k.x + KEY_W / 2)
const octaves = (semis) => (semis / 12).toFixed(1)
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">旋律音域</h3>
        <p class="card-desc">主旋律從最低到最高的範圍（排除最極端 1% 的偵測誤差）</p>
      </div>
    </div>

    <div v-if="!stats" class="note">
      後端還沒有提供音高資料。更新 Back-end/Essentia/pitch.py（輸出 PitchContour）後，這裡會顯示音域與音高占比。
    </div>
    <div v-else-if="!ready" class="note">這首歌沒有偵測到明顯的主旋律</div>
    <template v-else>
      <div class="facts">
        <div class="fact">
          <span class="f-label">最低音</span>
          <strong class="f-val">{{ stats.low.name }}</strong>
          <span class="f-sub">{{ fmtHz(stats.low.hz) }}</span>
        </div>
        <div class="fact">
          <span class="f-label">最高音</span>
          <strong class="f-val">{{ stats.high.name }}</strong>
          <span class="f-sub">{{ fmtHz(stats.high.hz) }}</span>
        </div>
        <div class="fact">
          <span class="f-label">音域</span>
          <strong class="f-val">{{ stats.rangeSemis }}<span class="f-unit">個半音</span></strong>
          <span class="f-sub">約 {{ octaves(stats.rangeSemis) }} 個八度</span>
        </div>
        <div class="fact">
          <span class="f-label">最常出現</span>
          <strong class="f-val">{{ stats.top.name }}</strong>
          <span class="f-sub">{{ fmtHz(stats.top.hz) }}・{{ Math.round(stats.top.share * 100) }}%</span>
        </div>
      </div>

      <svg
        v-if="keyboard"
        class="piano"
        :viewBox="`-2 -26 ${keyboard.width + 4} ${KEY_H + 50}`"
        role="img"
        :aria-label="`音域 ${stats.low.name} 到 ${stats.high.name}`"
      >
        <rect
          v-for="k in keyboard.whites"
          :key="'w' + k.m"
          :x="k.x"
          y="0"
          :width="KEY_W"
          :height="KEY_H"
          rx="3"
          class="white"
          :class="{ in: k.inRange }"
        />
        <rect
          v-for="k in keyboard.blacks"
          :key="'b' + k.m"
          :x="k.x"
          y="0"
          width="14"
          :height="BLACK_H"
          rx="2"
          class="black"
          :class="{ in: k.inRange }"
        />
        <!-- 最低／最高音 -->
        <g v-for="(k, i) in [keyboard.lowKey, keyboard.highKey]" :key="'lh' + i">
          <template v-if="k">
            <line :x1="keyCenter(k)" :x2="keyCenter(k)" y1="-6" y2="0" class="mark-line" />
            <text :x="markAttrs(k, i).x" y="-11" :text-anchor="markAttrs(k, i).anchor" class="mark-text">{{ i === 0 ? '最低' : '最高' }} {{ i === 0 ? stats.low.name : stats.high.name }}</text>
          </template>
        </g>
        <!-- 最常出現的音 -->
        <circle
          v-if="keyboard.topKey"
          :cx="keyCenter(keyboard.topKey)"
          :cy="keyboard.topKey.black ? BLACK_H - 10 : KEY_H - 12"
          r="6"
          class="top-dot"
        />
        <!-- C 的音名 -->
        <text v-for="k in keyboard.whites.filter((w) => w.label)" :key="'l' + k.m" :x="k.x + KEY_W / 2" :y="KEY_H + 16" text-anchor="middle" class="svg-axis-text">
          {{ k.label }}{{ k.label === 'C4' ? ' 中央C' : '' }}
        </text>
      </svg>
      <div class="legend">
        <span><i class="swatch range-sw"></i>旋律音域</span>
        <span><i class="swatch dot-sw"></i>最常出現的音</span>
        <span class="muted">有旋律的時間 {{ Math.round(stats.voicedRatio * 100) }}%（{{ fmtClock(stats.voicedSec) }}）</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.fact {
  display: flex;
  flex-direction: column;
  background: var(--surface2);
  border-radius: var(--radius-md);
  padding: 0.6rem 0.75rem;
  min-width: 0;
}

.f-label {
  font-size: 0.85rem;
  color: var(--muted);
}

.f-val {
  font-size: 1.6rem;
  line-height: 1.25;
  white-space: nowrap;
}

.f-unit {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text2);
  margin-left: 4px;
}

.f-sub {
  font-size: 0.85rem;
  color: var(--text2);
}

.piano {
  display: block;
  width: 100%;
  height: auto;
  max-height: 170px;
  margin: 1rem 0 0.5rem;
}

/* 鍵盤保持真實鋼琴的黑白，兩種主題都一樣 */
.white {
  fill: #fbfbfd;
  stroke: #9ea5b9;
  stroke-width: 1;
}

.white.in {
  fill: color-mix(in srgb, var(--c-pitch) 35%, #ffffff);
}

.black {
  fill: #262a36;
}

.black.in {
  fill: var(--c-pitch);
}

.mark-line {
  stroke: var(--text);
  stroke-width: 2;
}

.mark-text {
  font-size: 12px;
  font-weight: 700;
  fill: var(--text);
}

.top-dot {
  fill: #0f111a;
  stroke: #ffffff;
  stroke-width: 2;
}

.range-sw {
  background: color-mix(in srgb, var(--c-pitch) 35%, #ffffff);
  border: 1px solid #9ea5b9;
}

.dot-sw {
  background: #0f111a;
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 1px #9ea5b9;
  border-radius: 50%;
}

.muted {
  color: var(--muted);
}

@media (max-width: 560px) {
  .facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
