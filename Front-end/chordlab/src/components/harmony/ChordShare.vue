<script setup>
/**
 * 和弦占比：依出現時間計算
 * - 上方：和聲功能（主／下屬／屬／調外／無和弦）占整首歌的比例
 * - 下方：每種和弦的占比排行
 */
import { computed, ref } from 'vue'
import { FUNCTION_NAMES, FUNCTION_DEGREES } from '@/utils/music.js'

const props = defineProps({
  timeline: { type: Array, required: true },
  chordInfo: { type: Map, required: true },
})

const TOP_N = 8
const showAll = ref(false)

const totalTime = computed(() => props.timeline.reduce((s, c) => s + c.dur, 0))

const byFunction = computed(() => {
  const sums = { T: 0, S: 0, D: 0, out: 0, none: 0 }
  for (const c of props.timeline) sums[props.chordInfo.get(c.chord)?.fn ?? 'none'] += c.dur
  return ['T', 'S', 'D', 'out', 'none']
    .map((fn) => ({ fn, name: FUNCTION_NAMES[fn], degrees: FUNCTION_DEGREES[fn] ?? '', share: totalTime.value ? sums[fn] / totalTime.value : 0 }))
    .filter((f) => f.share > 0)
})

const ranked = computed(() => {
  const sums = new Map()
  for (const c of props.timeline) {
    if (c.chord === 'N' || c.chord === 'X') continue
    sums.set(c.chord, (sums.get(c.chord) ?? 0) + c.dur)
  }
  const rows = [...sums.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([chord, dur]) => {
      const info = props.chordInfo.get(chord)
      return { chord, dur, share: totalTime.value ? dur / totalTime.value : 0, name: info?.name ?? chord, fn: info?.fn ?? 'none', fnName: info?.fnName ?? '', degree: info?.degree?.label ?? '–' }
    })
  const max = rows[0]?.share ?? 1
  return rows.map((r) => ({ ...r, bar: (r.share / max) * 100 }))
})

const visible = computed(() => (showAll.value ? ranked.value : ranked.value.slice(0, TOP_N)))

const fmtPct = (v) => `${(v * 100).toFixed(v >= 0.1 ? 0 : 1)}%`
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">和弦占比</h3>
        <p class="card-desc">依每個和弦在整首歌裡出現的時間計算</p>
      </div>
    </div>

    <div v-if="!timeline.length" class="note">沒有和弦資料</div>
    <template v-else>
      <div class="sub-title first">和聲功能</div>
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
          <i class="swatch"></i>
          <span>{{ f.name }}<span v-if="f.degrees" class="deg-hint">（{{ f.degrees }}）</span></span>
          <strong>{{ fmtPct(f.share) }}</strong>
        </span>
      </div>

      <div class="sub-title">各和弦占比 <span v-if="ranked.length" class="note">共 {{ ranked.length }} 種</span></div>
      <p v-if="!ranked.length" class="note">整首都沒有偵測到和弦（N）</p>
      <div v-else class="rows" role="table" aria-label="各和弦占比">
        <div class="row head" role="row">
          <span role="columnheader">和弦</span>
          <span role="columnheader">級數</span>
          <span role="columnheader" class="visually-hidden">占比長條</span>
          <span role="columnheader" class="num">占比</span>
          <span role="columnheader" class="num">秒數</span>
        </div>
        <div v-for="r in visible" :key="r.chord" class="row" role="row" :class="'fn-' + r.fn" :title="r.fnName">
          <span class="name" role="cell">{{ r.name }}</span>
          <span class="deg" role="cell">{{ r.degree }}</span>
          <span class="track" role="cell" aria-hidden="true"><span class="bar" :style="{ width: r.bar + '%' }"></span></span>
          <strong class="num" role="cell">{{ fmtPct(r.share) }}</strong>
          <span class="num muted" role="cell">{{ r.dur.toFixed(1) }}</span>
        </div>
      </div>
      <button v-if="ranked.length > TOP_N" type="button" class="btn more" @click="showAll = !showAll">
        {{ showAll ? '只看前 ' + TOP_N + ' 名' : `顯示全部 ${ranked.length} 種` }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.sub-title.first {
  margin-top: 0;
}

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
}

.fn-legend .fn-none .swatch {
  background: var(--surface3);
  border: 1px solid var(--border-strong);
}

.deg-hint {
  color: var(--muted);
  font-size: 0.8rem;
}

/* 排行 */
.rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row {
  display: grid;
  grid-template-columns: 76px 44px minmax(0, 1fr) 56px 48px;
  align-items: center;
  gap: 10px;
  font-size: 0.95rem;
}

.row.head {
  font-size: 0.8rem;
  color: var(--muted);
}

.name {
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.deg {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--text2);
}

.track {
  height: 20px;
  display: flex;
  align-items: center;
}

.bar {
  height: 18px;
  min-width: 3px;
  background: var(--fc);
  /* 4px 圓角在資料端，基線端是直角 */
  border-radius: 0 4px 4px 0;
}

.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.muted {
  color: var(--muted);
  font-size: 0.85rem;
}

.more {
  margin-top: 0.75rem;
}
</style>
