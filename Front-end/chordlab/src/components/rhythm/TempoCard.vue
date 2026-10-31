<script setup>
/**
 * 速度：BPM、速度術語、在速度尺上的位置、拍點穩定度
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

const stability = computed(() => {
  const cv = props.rhythm.cv
  if (cv === null) return null
  if (cv < 0.03) return { text: '非常穩定', hint: '拍子幾乎像節拍器一樣平均，常見於電子或錄音室製作' }
  if (cv < 0.06) return { text: '穩定', hint: '有真人演奏的自然起伏' }
  return { text: '起伏較大', hint: '可能有漸快漸慢、自由速度，或拍點偵測不穩定' }
})

const facts = computed(() => {
  const r = props.rhythm
  return [
    { label: '拍點換算', value: r.beatBpm ? r.beatBpm.toFixed(1) : '—', unit: 'BPM', sub: '拍距中位數' },
    { label: '一拍長度', value: r.medianInterval ? r.medianInterval.toFixed(2) : '—', unit: '秒', sub: r.medianInterval ? `${Math.round(r.medianInterval * 1000)} 毫秒` : '' },
    { label: '拍數', value: r.count || '—', unit: '拍', sub: r.barCount ? `約 ${r.barCount} 小節` : '' },
  ]
})
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">速度</h3>
        <p class="card-desc">BPM＝每分鐘幾拍；數字越大越快</p>
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

      <div class="facts">
        <div v-for="f in facts" :key="f.label" class="fact">
          <span class="f-label">{{ f.label }}</span>
          <strong class="f-val">{{ f.value }}<span class="f-unit">{{ f.unit }}</span></strong>
          <span class="f-sub">{{ f.sub }}</span>
        </div>
        <div v-if="stability" class="fact">
          <span class="f-label">拍子穩定度</span>
          <strong class="f-val">{{ stability.text }}</strong>
          <span class="f-sub">拍距誤差 ±{{ Math.round(rhythm.jitterMs) }} 毫秒</span>
        </div>
      </div>
      <p v-if="stability" class="note hint">{{ stability.hint }}。速度術語的 BPM 範圍各家說法略有不同，這裡是常見的參考值。</p>
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

.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
}

.fact {
  display: flex;
  flex-direction: column;
  background: var(--surface2);
  border-radius: var(--radius-md);
  padding: 0.6rem 0.75rem;
}

.f-label {
  font-size: 0.85rem;
  color: var(--muted);
}

.f-val {
  font-size: 1.45rem;
  line-height: 1.3;
}

.f-unit {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text2);
  margin-left: 4px;
}

.f-sub {
  font-size: 0.8rem;
  color: var(--text2);
}

.hint {
  margin-top: 0.75rem;
}
</style>
