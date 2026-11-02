<script setup>
/**
 * 旋律音域：最低音到最高音（排除最極端 1% 的偵測誤差）、最常出現的音，畫在鋼琴鍵盤上
 */
import { computed } from 'vue'
import { fmtHz } from '@/utils/music.js'

const props = defineProps({
  // utils/pitch.js analyzePitch() 的結果（後端沒有音高資料時 ResultsPanel 不顯示這張卡）
  stats: { type: Object, required: true },
})

const KEY_W = 22
const KEY_H = 78
const BLACK_H = 48
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11]
const BLACK_OFFSET = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 } // 黑鍵在第幾個白鍵右邊

const ready = computed(() => !!props.stats.low)

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
  return { whites, blacks, width: whites.length * KEY_W, topKey: all.find((k) => k.m === top.midi) }
})

const keyCenter = (k) => (k.black ? k.x + 7 : k.x + KEY_W / 2)
const octaves = (semis) => (semis / 12).toFixed(1)
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">旋律音域</h3>
      </div>
    </div>

    <div v-if="!ready" class="note">這首歌沒有偵測到明顯的主旋律</div>
    <template v-else>
      <p class="range">
        <strong>{{ stats.low.name }} – {{ stats.high.name }}</strong>
        <span class="range-hz">{{ fmtHz(stats.low.hz) }} – {{ fmtHz(stats.high.hz) }}・{{ stats.rangeSemis }} 個半音（約 {{ octaves(stats.rangeSemis) }} 個八度）</span>
      </p>
      <p class="top-note"><i class="dot-sw" aria-hidden="true"></i>最常出現 {{ stats.top.name }}（{{ fmtHz(stats.top.hz) }}，{{ Math.round(stats.top.share * 100) }}%）</p>

      <svg
        v-if="keyboard"
        class="piano"
        :viewBox="`-2 -2 ${keyboard.width + 4} ${KEY_H + 26}`"
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
    </template>
  </div>
</template>

<style scoped>
.range {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 14px;
}

.range strong {
  font-size: 2rem;
  line-height: 1.2;
}

.range-hz {
  font-size: 0.95rem;
  color: var(--text2);
}

.top-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 0.25rem;
  font-size: 0.9rem;
  color: var(--text2);
}

.piano {
  display: block;
  width: 100%;
  height: auto;
  max-height: 150px;
  margin-top: 1.25rem;
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

.top-dot {
  fill: #0f111a;
  stroke: #ffffff;
  stroke-width: 2;
}

.dot-sw {
  display: inline-block;
  width: 12px;
  height: 12px;
  background: #0f111a;
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 1px #9ea5b9;
  border-radius: 50%;
}
</style>
