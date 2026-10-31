<script setup>
/**
 * 歌曲總覽：一眼看到調性、速度、調音、響度，點一下跳到對應分頁
 */
import { computed } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'
import { tempoTerm, loudnessLevel, a4FromCents, keyNameZh } from '@/utils/music.js'
import { fmtClock } from '@/utils/stats.js'

const props = defineProps({
  fileName: { type: String, default: '' },
  total: { type: Number, default: 0 },
  keyInfo: { type: Object, default: null },
  keyConfidence: { type: Number, default: null },
  bpm: { type: Number, default: null },
  barCount: { type: Number, default: 0 },
  tuning: { type: Object, default: null },
  lufs: { type: Number, default: null },
})

defineEmits(['open'])

const tiles = computed(() => {
  const k = props.keyInfo
  const term = tempoTerm(props.bpm)
  const cents = props.tuning?.tuning_offset_cents
  const a4 = a4FromCents(cents)
  return [
    {
      id: 'key',
      tab: 'harmony',
      icon: 'harmony',
      label: '調性',
      value: k?.name ?? '—',
      sub: [
        keyNameZh(k),
        k?.estimated ? '依和弦推估' : props.keyConfidence !== null ? `信心度 ${Math.round(props.keyConfidence * 100)}%` : null,
      ].filter(Boolean).join('・'),
      link: '和弦調性',
    },
    {
      id: 'tempo',
      tab: 'rhythm',
      icon: 'rhythm',
      label: '速度',
      value: props.bpm ? Math.round(props.bpm) : '—',
      unit: props.bpm ? 'BPM' : '',
      sub: [term ? `${term.it} ${term.zh}` : null, props.barCount ? `約 ${props.barCount} 小節` : null].filter(Boolean).join('・'),
      link: '速度節拍',
    },
    {
      id: 'tuning',
      tab: 'pitch',
      icon: 'tuning',
      label: '調音基準',
      value: a4 ? a4.toFixed(1) : '—',
      unit: a4 ? 'Hz' : '',
      sub: Number.isFinite(cents)
        ? `A4・${Math.abs(cents) < 5 ? '標準' : cents > 0 ? '偏高' : '偏低'}（${cents > 0 ? '+' : ''}${cents.toFixed(1)} 音分）`
        : '無調音資料',
      link: '音高頻率',
    },
    {
      id: 'loud',
      tab: 'rhythm',
      icon: 'loud',
      label: '整體響度',
      value: Number.isFinite(props.lufs) ? props.lufs.toFixed(1) : '—',
      unit: Number.isFinite(props.lufs) ? 'LUFS' : '',
      sub: loudnessLevel(props.lufs) ?? '無響度資料',
      link: '速度節拍',
    },
  ]
})
</script>

<template>
  <section class="overview" aria-label="歌曲總覽">
    <div class="ov-head">
      <h2 class="ov-title">歌曲總覽</h2>
      <span class="ov-meta">{{ fileName }}<template v-if="total > 1">・長度 {{ fmtClock(total) }}</template></span>
    </div>
    <div class="tiles">
      <button v-for="t in tiles" :key="t.id" type="button" class="tile" @click="$emit('open', t.tab)">
        <span class="t-label"><AppIcon :name="t.icon" :size="18" />{{ t.label }}</span>
        <span class="t-value">
          {{ t.value }}<span v-if="t.unit" class="t-unit">{{ t.unit }}</span>
        </span>
        <span class="t-sub">{{ t.sub || '—' }}</span>
        <span class="t-link">{{ t.link }} <AppIcon name="arrow" :size="14" /></span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.overview {
  margin-bottom: 1rem;
}

.ov-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 16px;
  margin-bottom: 0.75rem;
}

.ov-title {
  font-size: 1.35rem;
  font-weight: 700;
}

.ov-meta {
  font-size: 0.95rem;
  color: var(--muted);
}

.tiles {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  text-align: left;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1rem 1.15rem 0.85rem;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.15s, transform 0.15s;
  min-width: 0;
}

.tile:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}

.t-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text2);
}

.t-value {
  font-size: 2.1rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text);
  margin-top: 4px;
  white-space: nowrap;
}

.t-unit {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text2);
  margin-left: 6px;
}

.t-sub {
  font-size: 0.9rem;
  color: var(--text2);
}

.t-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--accent);
}

@media (max-width: 900px) {
  .tiles {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 420px) {
  .t-value {
    font-size: 1.6rem;
  }
}
</style>
