<script setup>
/**
 * 調音基準：整首歌的 A4 實際頻率，與標準 440 Hz 差幾音分
 * A4 頻率由音分換算（見 music.js a4FromCents）
 */
import { computed } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'
import { a4FromCents } from '@/utils/music.js'

const props = defineProps({
  tuning: { type: Object, default: null },
})

const RANGE = 50
const W = 600
const H = 74
const BAR_Y = 30
const BAR_H = 18

const cents = computed(() => {
  const c = props.tuning?.tuning_offset_cents
  return Number.isFinite(c) ? c : null
})

const hz = computed(() => a4FromCents(cents.value))

const status = computed(() => {
  const c = cents.value
  if (c === null) return null
  const a = Math.abs(c)
  const dir = c > 0 ? '偏高' : '偏低'
  if (a < 5) return { cls: 'good', icon: 'check', text: '標準', hint: '和標準音高幾乎一樣，一般人聽不出差別' }
  if (a < 20) return { cls: 'warning', icon: 'alert', text: `輕微${dir}`, hint: '耳朵敏銳的人可能察覺；跟著彈奏前建議先調音' }
  return { cls: 'serious', icon: 'alert', text: `明顯${dir}`, hint: '跟著彈奏的樂器需要先把音調' + (c > 0 ? '高' : '低') }
})

const xOf = (c) => ((Math.max(-RANGE, Math.min(RANGE, c)) + RANGE) / (2 * RANGE)) * W

const zones = [
  { from: -50, to: -20, cls: 'serious' },
  { from: -20, to: -5, cls: 'warning' },
  { from: -5, to: 5, cls: 'good' },
  { from: 5, to: 20, cls: 'warning' },
  { from: 20, to: 50, cls: 'serious' },
]
const TICKS = [-50, -20, 0, 20, 50]

const fmtCents = (c) => `${c > 0 ? '+' : c < 0 ? '−' : ''}${Math.abs(c).toFixed(1)}`
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">調音基準</h3>
        <p class="card-desc">這首歌的 A4（中央 C 上面的 La）實際是多少 Hz；標準是 440 Hz</p>
      </div>
    </div>

    <div v-if="cents === null" class="note">沒有調音資料（{{ tuning?.status_text ?? 'BTC 沒有回傳' }}）</div>
    <template v-else>
      <div class="hero">
        <span class="hz">A4 = {{ hz.toFixed(1) }}<span class="unit">Hz</span></span>
        <span class="status" :class="status.cls">
          <AppIcon :name="status.icon" :size="18" />{{ status.text }}
        </span>
      </div>
      <p class="hint">與 440 Hz 相差 <strong>{{ fmtCents(cents) }} 音分</strong>・{{ status.hint }}</p>

      <svg :viewBox="`0 0 ${W} ${H}`" class="gauge" role="img" :aria-label="`偏差 ${fmtCents(cents)} 音分，${status.text}`">
        <rect
          v-for="z in zones"
          :key="z.from"
          :x="xOf(z.from) + 1"
          :y="BAR_Y"
          :width="xOf(z.to) - xOf(z.from) - 2"
          :height="BAR_H"
          rx="4"
          :class="'zone ' + z.cls"
        />
        <g v-for="t in TICKS" :key="t">
          <text :x="xOf(t)" :y="H - 2" text-anchor="middle" class="svg-axis-text">{{ t > 0 ? '+' + t : t }}</text>
        </g>
        <!-- 指標 -->
        <g :transform="`translate(${xOf(cents)}, 0)`">
          <line x1="0" x2="0" :y1="BAR_Y - 6" :y2="BAR_Y + BAR_H + 4" class="needle" />
          <path :d="`M -8 ${BAR_Y - 16} L 8 ${BAR_Y - 16} L 0 ${BAR_Y - 5} Z`" class="needle-head" />
        </g>
      </svg>
      <div class="legend zone-legend">
        <span class="good"><i class="swatch zone-sw"></i>標準（±5 以內）</span>
        <span class="warning"><i class="swatch zone-sw"></i>輕微偏移（5～20）</span>
        <span class="serious"><i class="swatch zone-sw"></i>明顯偏移（20 以上）</span>
      </div>
      <p class="note unit-note">單位：音分（cent）。1 個半音 = 100 音分。</p>
    </template>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.hz {
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

.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 12px 3px 8px;
  border-radius: 999px;
  font-weight: 700;
  border: 2px solid var(--sc);
  color: var(--text);
  background: color-mix(in srgb, var(--sc) 18%, var(--surface));
}

.status :deep(.icon) {
  color: var(--sc);
}

.good {
  --sc: var(--good);
}
.warning {
  --sc: var(--warning);
}
.serious {
  --sc: var(--serious);
}

.hint {
  margin-top: 0.4rem;
  font-size: 0.95rem;
  color: var(--text2);
}

.gauge {
  display: block;
  width: 100%;
  max-width: 640px;
  height: auto;
  margin: 1rem 0 0.25rem;
  overflow: visible;
}

.zone {
  fill: color-mix(in srgb, var(--sc) 30%, var(--surface));
}

.zone-sw {
  background: color-mix(in srgb, var(--sc) 30%, var(--surface));
  border: 2px solid var(--sc);
}

.zone-legend {
  font-size: 0.85rem;
}

.unit-note {
  margin-top: 0.4rem;
}

.needle {
  stroke: var(--text);
  stroke-width: 3;
  stroke-linecap: round;
}

.needle-head {
  fill: var(--text);
}
</style>
