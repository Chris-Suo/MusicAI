<script setup>
/**
 * 和弦占比：依出現時間計算
 * - 上方：和聲功能（主／下屬／屬／調外）占整首歌的比例，也是這個分頁的顏色圖例
 * - 下方：前幾名和弦的占比，其餘合併成「其他」
 */
import { computed } from 'vue'
import { FUNCTION_NAMES } from '@/utils/music.js'

const props = defineProps({
  timeline: { type: Array, required: true },
  chordInfo: { type: Map, required: true },
})

const TOP_N = 6

const totalTime = computed(() => props.timeline.reduce((s, c) => s + c.dur, 0))

const byFunction = computed(() => {
  const sums = { T: 0, S: 0, D: 0, out: 0, none: 0 }
  for (const c of props.timeline) sums[props.chordInfo.get(c.chord)?.fn ?? 'none'] += c.dur
  return ['T', 'S', 'D', 'out', 'none']
    .map((fn) => ({ fn, name: FUNCTION_NAMES[fn], share: totalTime.value ? sums[fn] / totalTime.value : 0 }))
    // 「無和弦」只有明顯時才列出
    .filter((f) => (f.fn === 'none' ? f.share >= 0.01 : f.share > 0))
})

const ranked = computed(() => {
  const sums = new Map()
  for (const c of props.timeline) {
    if (c.chord === 'N' || c.chord === 'X') continue
    sums.set(c.chord, (sums.get(c.chord) ?? 0) + c.dur)
  }
  return [...sums.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([chord, dur]) => {
      const info = props.chordInfo.get(chord)
      return { chord, share: totalTime.value ? dur / totalTime.value : 0, name: info?.name ?? chord, fn: info?.fn ?? 'none', fnName: info?.fnName ?? '', degree: info?.degree?.label ?? '' }
    })
})

const rows = computed(() => {
  // 只多一種時直接列出，不合併成「其他 1 種」
  const n = ranked.value.length <= TOP_N + 1 ? ranked.value.length : TOP_N
  const top = ranked.value.slice(0, n)
  const rest = ranked.value.slice(n)
  const out = rest.length
    ? [...top, { chord: 'other', name: `其他 ${rest.length} 種`, share: rest.reduce((s, r) => s + r.share, 0), fn: 'none', fnName: '', degree: '' }]
    : top
  const max = Math.max(...out.map((r) => r.share), 0.01)
  return out.map((r) => ({ ...r, bar: (r.share / max) * 100 }))
})

const fmtPct = (v) => `${(v * 100).toFixed(v >= 0.1 ? 0 : 1)}%`
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">和弦占比</h3>
        <p class="card-desc">依出現時間計算</p>
      </div>
    </div>

    <div v-if="!timeline.length" class="note">沒有和弦資料</div>
    <template v-else>
      <div class="stack" role="img" :aria-label="byFunction.map((f) => `${f.name} ${fmtPct(f.share)}`).join('，')">
        <span
          v-for="f in byFunction"
          :key="f.fn"
          class="block"
          :class="'fn-' + f.fn"
          :style="{ flexGrow: f.share }"
          :title="`${f.name} ${fmtPct(f.share)}`"
        ></span>
      </div>
      <div class="legend fn-legend">
        <span v-for="f in byFunction" :key="f.fn" :class="'fn-' + f.fn">
          <i class="swatch"></i>{{ f.name }}<strong>{{ fmtPct(f.share) }}</strong>
        </span>
      </div>

      <p v-if="!ranked.length" class="note empty">整首都沒有偵測到和弦（N）</p>
      <div v-else class="rows" role="table" aria-label="各和弦占比">
        <div v-for="r in rows" :key="r.chord" class="row" role="row" :class="'fn-' + r.fn" :title="r.fnName">
          <span class="name" role="cell">{{ r.name }}<span v-if="r.degree" class="deg">{{ r.degree }}</span></span>
          <span class="track" role="cell" aria-hidden="true"><span class="bar" :style="{ width: r.bar + '%' }"></span></span>
          <strong class="num" role="cell">{{ fmtPct(r.share) }}</strong>
        </div>
      </div>
    </template>
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
  background: var(--fc);
  border-radius: 4px;
}

.block.fn-none {
  background: var(--surface3);
}

.fn-legend {
  margin-top: 0.6rem;
  font-size: 0.9rem;
}

.fn-legend strong {
  color: var(--text);
  margin-left: 2px;
}

.fn-legend .fn-none .swatch {
  background: var(--surface3);
  border: 1px solid var(--border-strong);
}

/* 排行 */
.rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 1.5rem;
}

.empty {
  margin-top: 1.5rem;
}

.row {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr) 52px;
  align-items: center;
  gap: 12px;
  font-size: 0.95rem;
}

.name {
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.deg {
  font-family: var(--font-mono);
  font-size: 0.85rem;
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
  background: var(--fc);
  /* 4px 圓角在資料端，基線端是直角 */
  border-radius: 0 4px 4px 0;
}

.row.fn-none .bar {
  background: var(--c-muted-series);
}

.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
