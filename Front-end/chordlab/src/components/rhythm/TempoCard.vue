<script setup>
/**
 * 速度：BPM、速度術語、在速度尺上的位置、拍數與小節數
 */
import { computed } from 'vue'
import { tempoTerm } from '@/utils/music.js'

const props = defineProps({
  // Essentia RhythmExtractor 的整體 BPM（沒有時用拍距中位數）
  bpm: { type: Number, default: null },
  // ResultsPanel 算好的拍點統計
  rhythm: { type: Object, required: true },
})

const MIN = 40
const MAX = 200
const W = 600
const ZONES = [
  { from: 40, to: 60, zh: '廣板' },
  { from: 60, to: 76, zh: '慢板' },
  { from: 76, to: 108, zh: '行板' },
  { from: 108, to: 120, zh: '中板' },
  { from: 120, to: 168, zh: '快板' },
  { from: 168, to: 200, zh: '急板' },
]
const TICKS = [40, 60, 76, 108, 120, 168, 200]

const xOf = (b) => ((Math.min(MAX, Math.max(MIN, b)) - MIN) / (MAX - MIN)) * W

const term = computed(() => tempoTerm(props.bpm))

</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">速度</h3>
        <p class="card-desc">BPM＝每分鐘幾拍</p>
      </div>
    </div>

    <div v-if="!bpm" class="note">沒有速度資料（Essentia 沒有回傳 BPM 與拍點）</div>
    <template v-else>
      <div class="hero">
        <span class="bpm">{{ bpm.toFixed(1) }}<span class="unit">BPM</span></span>
        <span v-if="term" class="term"><strong>{{ term.it }}</strong> {{ term.zh }}</span>
      </div>

      <svg :viewBox="`0 -8 ${W} 74`" class="scale" role="img" :aria-label="`速度 ${bpm.toFixed(0)} BPM，屬於${term?.zh ?? ''}`">
        <g v-for="z in ZONES" :key="z.from">
          <rect
            :x="xOf(z.from) + 1"
            y="10"
            :width="xOf(z.to) - xOf(z.from) - 2"
            height="26"
            rx="4"
            class="zone"
            :class="{ on: bpm >= z.from && bpm < z.to }"
          />
          <text :x="(xOf(z.from) + xOf(z.to)) / 2" y="28" text-anchor="middle" class="zone-text" :class="{ on: bpm >= z.from && bpm < z.to }">
            {{ xOf(z.to) - xOf(z.from) > 34 ? z.zh : '' }}
          </text>
        </g>
        <text v-for="t in TICKS" :key="t" :x="xOf(t)" y="56" text-anchor="middle" class="svg-axis-text">{{ t }}</text>
        <g :transform="`translate(${xOf(bpm)}, 0)`">
          <path d="M -8 -6 L 8 -6 L 0 6 Z" class="marker" />
          <line x1="0" x2="0" y1="6" y2="40" class="marker-line" />
        </g>
      </svg>

      <p v-if="rhythm.count" class="count">共 {{ rhythm.count }} 拍・約 {{ rhythm.barCount }} 小節</p>
    </template>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 16px;
}

.bpm {
  font-size: 2.6rem;
  font-weight: 700;
  line-height: 1.15;
}

.unit {
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--text2);
  margin-left: 6px;
}

.term {
  font-size: 1.15rem;
  color: var(--text2);
}

.term strong {
  color: var(--text);
}

.scale {
  display: block;
  width: 100%;
  max-width: 640px;
  height: auto;
  margin: 0.75rem 0 0.5rem;
  overflow: visible;
}

.zone {
  fill: var(--surface2);
  stroke: var(--border);
}

.zone.on {
  fill: var(--accent-soft);
  stroke: var(--accent);
  stroke-width: 2;
}

.zone-text {
  font-size: 13px;
  fill: var(--text2);
}

.zone-text.on {
  fill: var(--text);
  font-weight: 700;
}

.marker {
  fill: var(--text);
}

.marker-line {
  stroke: var(--text);
  stroke-width: 3;
  stroke-linecap: round;
}

.count {
  font-size: 0.95rem;
  color: var(--text2);
}
</style>
