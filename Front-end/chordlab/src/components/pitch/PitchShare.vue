<script setup>
/**
 * 音高占比（依主旋律出現的時間計算）
 * - 音名占比：12 個音名從主音開始排，調內音上色、調外音灰色
 * - 音區占比：每個八度的頻率範圍（Hz）占多少時間
 */
import { computed, ref } from 'vue'
import { fmtHz } from '@/utils/music.js'

const props = defineProps({
  stats: { type: Object, required: true },
  keyInfo: { type: Object, default: null },
})

const PLOT_H = 170

// 從主音開始排（調內音依 1 2 3 4 5 6 7 的順序出現）
const columns = computed(() => {
  const start = props.keyInfo?.tonic ?? 0
  const cols = Array.from({ length: 12 }, (_, i) => props.stats.pcShare[(start + i) % 12])
  const top3 = [...cols].sort((a, b) => b.share - a.share).slice(0, 3).map((c) => c.pc)
  return cols.map((c) => ({ ...c, tonic: props.keyInfo && c.pc === props.keyInfo.tonic, labeled: top3.includes(c.pc) && c.share > 0 }))
})

const yMax = computed(() => {
  const max = Math.max(...columns.value.map((c) => c.share), 0.05)
  const step = max <= 0.2 ? 0.05 : 0.1
  return Math.ceil(max / step) * step
})

const yTicks = computed(() => {
  const step = yMax.value <= 0.2 ? 0.05 : 0.1
  const out = []
  for (let v = 0; v <= yMax.value + 1e-9; v += step) out.push(+v.toFixed(2))
  return out
})

const inKeyShare = computed(() => columns.value.filter((c) => c.inKey).reduce((s, c) => s + c.share, 0))

const octaveRows = computed(() => {
  const rows = [...props.stats.octaves].reverse()
  const max = Math.max(...rows.map((r) => r.share), 0.01)
  return rows.map((r) => ({ ...r, bar: (r.share / max) * 100 }))
})

const hoverCol = ref(null)
const fmtPct = (v) => `${(v * 100).toFixed(v >= 0.1 ? 0 : 1)}%`
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">音高占比</h3>
        <p class="card-desc">依主旋律出現的時間計算</p>
      </div>
    </div>

    <div class="two">
      <!-- 音名占比 -->
      <section>
        <div class="sub-title first">音名占比</div>
        <p v-if="keyInfo" class="headline">調內音占 <strong>{{ fmtPct(inKeyShare) }}</strong></p>
        <div class="col-chart">
          <div class="y-ticks" :style="{ height: PLOT_H + 'px' }" aria-hidden="true">
            <span v-for="t in yTicks" :key="t" :style="{ bottom: (t / yMax) * 100 + '%' }">{{ Math.round(t * 100) }}%</span>
          </div>
          <div class="plot-area">
            <div class="plot" :style="{ height: PLOT_H + 'px' }">
              <span v-for="t in yTicks" :key="'g' + t" class="gridline" :style="{ bottom: (t / yMax) * 100 + '%' }"></span>
              <div
                v-for="c in columns"
                :key="c.pc"
                class="col"
                @mouseenter="hoverCol = c.pc"
                @mouseleave="hoverCol = null"
              >
                <span v-if="c.labeled || hoverCol === c.pc" class="cap" :style="{ bottom: (c.share / yMax) * 100 + '%' }">{{ fmtPct(c.share) }}</span>
                <span class="bar" :class="{ out: !c.inKey, hover: hoverCol === c.pc }" :style="{ height: (c.share / yMax) * 100 + '%' }"></span>
              </div>
            </div>
            <div class="x-labels">
              <span v-for="c in columns" :key="'x' + c.pc" class="x-label" :class="{ tonic: c.tonic }">{{ c.name }}</span>
            </div>
          </div>
        </div>
        <div class="legend foot">
          <span><i class="swatch in-sw"></i>調內音</span>
          <span><i class="swatch out-sw"></i>調外音</span>
        </div>
        <table class="visually-hidden">
          <caption>音名占比</caption>
          <tr v-for="c in columns" :key="'t' + c.pc"><th>{{ c.name }}</th><td>{{ fmtPct(c.share) }}</td></tr>
        </table>
      </section>

      <!-- 音區占比（頻率） -->
      <section>
        <div class="sub-title first">音區占比（頻率）</div>
        <div class="oct-rows" role="table" aria-label="音區占比">
          <div v-for="r in octaveRows" :key="r.octave" class="oct" role="row">
            <span class="o-name" role="cell">
              <strong>{{ r.name }}</strong>
              <span class="o-range">{{ r.range }}・{{ fmtHz(r.fromHz) }}–{{ fmtHz(r.toHz) }}</span>
            </span>
            <span class="o-track" role="cell" aria-hidden="true"><span class="o-bar" :style="{ width: r.bar + '%' }"></span></span>
            <strong class="o-pct" role="cell">{{ fmtPct(r.share) }}</strong>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.two {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
  gap: 1.5rem 2.5rem;
}

.sub-title.first {
  margin-top: 0;
}

.headline {
  font-size: 0.95rem;
  color: var(--text2);
  margin-bottom: 0.75rem;
}

.headline strong {
  font-size: 1.3rem;
  color: var(--text);
}

/* 直條圖 */
.col-chart {
  display: flex;
  gap: 8px;
}

.y-ticks {
  position: relative;
  width: 36px;
  flex-shrink: 0;
}

.y-ticks span {
  position: absolute;
  right: 0;
  transform: translateY(50%);
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.plot-area {
  flex: 1;
  min-width: 0;
}

.plot {
  position: relative;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  border-bottom: 1px solid var(--axis);
}

.gridline {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px solid var(--grid);
}

.col {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  height: 100%;
}

.bar {
  position: relative;
  width: min(24px, 70%);
  background: var(--c-pitch);
  border-radius: 4px 4px 0 0;
  transition: opacity 0.15s;
}

.bar.out {
  background: var(--c-muted-series);
}

.bar.hover {
  opacity: 0.8;
}

.cap {
  position: absolute;
  left: 50%;
  transform: translate(-50%, -4px);
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
}

.x-labels {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  margin-top: 4px;
}

.x-label {
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  color: var(--text2);
}

.x-label.tonic {
  color: var(--text);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.foot {
  margin-top: 0.75rem;
}

.in-sw {
  background: var(--c-pitch);
}

.out-sw {
  background: var(--c-muted-series);
}

/* 音區長條 */
.oct-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.oct {
  display: grid;
  grid-template-columns: minmax(150px, auto) minmax(0, 1fr) 52px;
  align-items: center;
  gap: 12px;
}

.o-name {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.o-range {
  font-size: 0.8rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.o-track {
  display: flex;
  align-items: center;
  height: 24px;
}

.o-bar {
  height: 20px;
  min-width: 3px;
  background: var(--c-pitch);
  border-radius: 0 4px 4px 0;
}

.o-pct {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
