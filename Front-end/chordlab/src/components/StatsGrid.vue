<script setup>
import { computed } from 'vue'
import SectionLabel from '@/components/SectionLabel.vue'
import TuningMeter from '@/components/TuningMeter.vue'

const props = defineProps({
  keyName: {
    type: String,
    default: '—',
  },
  // Essentia KeyExtractor 的 strength，作為調性信心度
  keyConfidence: {
    type: Number,
    default: null,
  },
  chordCount: {
    type: Number,
    default: 0,
  },
  uniqueCount: {
    type: Number,
    default: 0,
  },
  tuning: {                          // ← 新增
    type: Object,
    default: () => ({
      a4_hz: 440,
      tuning_offset_cents: 0,
      status: 'standard',
      status_text: '—',
    }),
  }
})

const confidenceText = computed(() => {
  const s = props.keyConfidence
  if (s === null || s === undefined || Number.isNaN(s)) return '信心度 —'
  const pct = Math.round(Math.min(1, Math.max(0, s)) * 100)
  return `信心度 ${pct}%`
})

function tuningColor(status) {
  if (status === 'standard') return 'var(--accent2)'    // 綠色
  if (status === 'sharp')    return 'var(--accent3)'    // 橘色
  if (status === 'flat')     return '#5cb8ff'           // 藍色
  return 'var(--muted)'
}
</script>

<template>
  <div class="section">
    <SectionLabel>整體統計</SectionLabel>
    <div class="grid">
      <div class="card">
        <div class="label">偵測到的調性</div>
        <div class="value accent">{{ keyName || '—' }}</div>
        <div class="sub">{{ confidenceText }}</div>
      </div>
      <div class="card">
        <div class="label">和弦總數</div>
        <div class="value">{{ chordCount }}</div>
        <div class="sub">含重複</div>
      </div>
      <div class="card">
        <div class="label">不重複和弦</div>
        <div class="value green">{{ uniqueCount }}</div>
        <div class="sub">種類</div>
      </div>
    </div>
    <div class="card tuning-card">
        <div class="tuning-left">
          <div class="label">調音基準</div>
          <div class="tuning-hz" :style="{ color: tuningColor(tuning.status) }">
            A4 = {{ tuning.a4_hz }} Hz
          </div>
          <div class="sub">{{ tuning.status_text }}</div>
        </div>
        <div class="tuning-right">
          <TuningMeter :cents="tuning.tuning_offset_cents" />
        </div>
      </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 2rem;
}

.card {
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-md);
  padding: 1rem;
}

.label {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 6px;
}

.value {
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 700;
}

.value.accent {
  color: var(--accent);
}

.value.green {
  color: var(--accent2);
}

.sub {
  font-size: 11px;
  color: var(--muted);
  margin-top: 4px;
}
</style>
