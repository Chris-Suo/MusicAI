<script setup>
/**
 * 占比圖（和弦占比、音高占比、BPM 占比共用，三張卡長得一樣）
 * - 上方：100% 堆疊長條＋圖例（每一類占多少），也是這張卡的顏色圖例
 * - 下方：前幾名項目的橫條，顏色跟所屬的類別一致；「其他」是好幾項的加總，只寫數字不畫橫條
 */
import { computed } from 'vue'
import { fmtPct } from '@/utils/stats.js'

const props = defineProps({
  // [{ key, label, sub?, share, color, muted? }]；muted＝灰底（例如「無和弦」）
  groups: { type: Array, required: true },
  // [{ key, name, sub?, share, color, title?, other? }]；other＝「其他 N 種」加總列
  rows: { type: Array, default: () => [] },
  // 堆疊長條的無障礙說明開頭，例如「和聲功能」
  label: { type: String, default: '' },
})

// 橫條長度以最大的一項為滿格（「其他」不算）
const barRows = computed(() => {
  const max = Math.max(...props.rows.filter((r) => !r.other).map((r) => r.share), 0.01)
  return props.rows.map((r) => ({ ...r, bar: (r.share / max) * 100 }))
})

const stackLabel = computed(() => `${props.label} ` + props.groups.map((g) => `${g.label} ${fmtPct(g.share)}`).join('，'))
</script>

<template>
  <div class="stack" role="img" :aria-label="stackLabel">
    <span
      v-for="g in groups"
      :key="g.key"
      class="block"
      :class="{ muted: g.muted }"
      :style="{ flexGrow: g.share, background: g.muted ? null : g.color }"
      :title="`${g.label}${g.sub ? ' ' + g.sub : ''} ${fmtPct(g.share)}`"
    ></span>
  </div>
  <div class="legend share-legend">
    <span v-for="g in groups" :key="g.key">
      <i class="swatch" :class="{ muted: g.muted }" :style="{ background: g.muted ? null : g.color }"></i>
      {{ g.label }}<span v-if="g.sub" class="g-sub">{{ g.sub }}</span><strong>{{ fmtPct(g.share) }}</strong>
    </span>
  </div>

  <div v-if="barRows.length" class="rows" role="table" :aria-label="label">
    <div v-for="r in barRows" :key="r.key" class="row" :class="{ other: r.other }" role="row" :title="r.title">
      <span class="name" role="cell">{{ r.name }}<span v-if="r.sub" class="sub">{{ r.sub }}</span></span>
      <span class="track" role="cell" aria-hidden="true"><span v-if="!r.other" class="bar" :style="{ width: r.bar + '%', background: r.color }"></span></span>
      <strong class="num" role="cell">{{ fmtPct(r.share) }}</strong>
    </div>
  </div>
</template>

<style scoped>
/* 100% 堆疊長條（高 28px、區塊間 2px 表面色間隙） */
.stack {
  display: flex;
  gap: 2px;
  height: 28px;
}

.block {
  flex-basis: 0;
  min-width: 3px;
  border-radius: 4px;
}

.block.muted {
  background: var(--surface3);
}

.share-legend {
  margin-top: 0.6rem;
  font-size: 0.9rem;
}

.share-legend strong {
  color: var(--text);
  margin-left: 2px;
}

.share-legend .muted {
  background: var(--surface3);
  border: 1px solid var(--border-strong);
}

.g-sub {
  color: var(--muted);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

/* 排行：名稱欄依最長的名稱對齊 */
.rows {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr) 52px;
  align-items: center;
  gap: 8px 14px;
  margin-top: 1.5rem;
}

.row {
  display: contents;
  font-size: 0.95rem;
}

.name {
  min-width: 96px;
  font-weight: 700;
  white-space: nowrap;
}

.sub {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 400;
  color: var(--muted);
  margin-left: 8px;
}

.track {
  height: 20px;
  display: flex;
  align-items: center;
}

.bar {
  height: 16px;
  min-width: 3px;
  /* 4px 圓角在資料端，基線端是直角 */
  border-radius: 0 4px 4px 0;
}

.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.row.other .name,
.row.other .num {
  font-weight: 500;
  color: var(--muted);
}
</style>
