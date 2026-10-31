<script setup>
/**
 * BPM 占比：每一拍換算成 BPM，依時間統計落在各速度區間的比例
 * ±3% 以內的區間上色，超出的灰色，一眼看出速度穩不穩
 */
import { computed, ref } from 'vue'

const props = defineProps({
  beats: { type: Array, default: () => [] },
  rhythm: { type: Object, required: true },
})

const PLOT_H = 170
const STABLE = 0.03
const SIDE_BINS = 5

const data = computed(() => {
  const m = props.rhythm.beatBpm
  const iv = props.rhythm.intervals
  if (!m || iv.length < 4) return null
  const w = Math.max(1, Math.round(m * 0.02))
  const c0 = Math.round(m)
  const lo = c0 - (SIDE_BINS + 0.5) * w
  const hi = c0 + (SIDE_BINS + 0.5) * w
  const bins = []
  bins.push({ key: 'under', label: `<${Math.round(lo)}`, sum: 0, stable: false, edge: true })
  for (let k = -SIDE_BINS; k <= SIDE_BINS; k++) {
    const c = c0 + k * w
    bins.push({ key: c, label: String(c), from: c - w / 2, to: c + w / 2, sum: 0, stable: Math.abs(c / m - 1) <= STABLE })
  }
  bins.push({ key: 'over', label: `>${Math.round(hi)}`, sum: 0, stable: false, edge: true })

  let total = 0
  let stableTime = 0
  for (const d of iv) {
    if (!(d > 0)) continue
    const bpm = 60 / d
    total += d
    if (Math.abs(bpm / m - 1) <= STABLE) stableTime += d
    if (bpm < lo) bins[0].sum += d
    else if (bpm >= hi) bins[bins.length - 1].sum += d
    else bins[1 + Math.floor((bpm - lo) / w)].sum += d
  }
  const out = bins.map((b) => ({ ...b, share: total ? b.sum / total : 0 }))
  // 兩端沒有資料時不顯示
  const shown = out.filter((b) => !b.edge || b.share > 0)
  const top3 = [...shown].sort((a, b) => b.share - a.share).slice(0, 3).map((b) => b.key)
  return {
    bins: shown.map((b) => ({ ...b, labeled: top3.includes(b.key) && b.share > 0 })),
    stableShare: total ? stableTime / total : 0,
    range: [Math.round(m * (1 - STABLE)), Math.round(m * (1 + STABLE))],
    edgeShare: out[0].share + out[out.length - 1].share,
  }
})

const yMax = computed(() => {
  const max = Math.max(...(data.value?.bins.map((b) => b.share) ?? [0]), 0.05)
  const step = max <= 0.2 ? 0.05 : max <= 0.5 ? 0.1 : 0.2
  return Math.ceil(max / step) * step
})

const yTicks = computed(() => {
  const step = yMax.value <= 0.2 ? 0.05 : yMax.value <= 0.5 ? 0.1 : 0.2
  const out = []
  for (let v = 0; v <= yMax.value + 1e-9; v += step) out.push(+v.toFixed(2))
  return out
})

const hoverBin = ref(null)
const fmtPct = (v) => `${(v * 100).toFixed(v >= 0.1 ? 0 : 1)}%`
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">BPM 占比</h3>
        <p class="card-desc">每一拍換算成 BPM，依時間計算</p>
      </div>
    </div>

    <div v-if="!data" class="note">拍點太少，無法統計</div>
    <template v-else>
      <p class="headline">
        <strong>{{ fmtPct(data.stableShare) }}</strong> 的時間速度在 {{ data.range[0] }}–{{ data.range[1] }} BPM（±3%）以內
      </p>

      <div class="col-chart">
        <div class="y-ticks" :style="{ height: PLOT_H + 'px' }" aria-hidden="true">
          <span v-for="t in yTicks" :key="t" :style="{ bottom: (t / yMax) * 100 + '%' }">{{ Math.round(t * 100) }}%</span>
        </div>
        <div class="plot-area">
          <div class="plot" :style="{ height: PLOT_H + 'px', gridTemplateColumns: `repeat(${data.bins.length}, 1fr)` }">
            <span v-for="t in yTicks" :key="'g' + t" class="gridline" :style="{ bottom: (t / yMax) * 100 + '%' }"></span>
            <div v-for="b in data.bins" :key="b.key" class="col" @mouseenter="hoverBin = b.key" @mouseleave="hoverBin = null">
              <span v-if="b.labeled || hoverBin === b.key" class="cap" :style="{ bottom: (b.share / yMax) * 100 + '%' }">{{ fmtPct(b.share) }}</span>
              <span class="bar" :class="{ out: !b.stable, hover: hoverBin === b.key }" :style="{ height: (b.share / yMax) * 100 + '%' }"></span>
            </div>
          </div>
          <div class="x-labels" :style="{ gridTemplateColumns: `repeat(${data.bins.length}, 1fr)` }">
            <span v-for="b in data.bins" :key="'x' + b.key" class="x-label">{{ b.label }}</span>
          </div>
          <div class="x-title">BPM</div>
        </div>
      </div>

      <div class="legend foot">
        <span><i class="swatch in-sw"></i>±3% 以內</span>
        <span><i class="swatch out-sw"></i>超出 ±3%</span>
      </div>
      <p v-if="data.edgeShare >= 0.05" class="note warn">
        有 {{ fmtPct(data.edgeShare) }} 的時間速度差很多，可能是速度轉換的段落，或拍點偵測跳到半拍／倍速。
      </p>
      <table class="visually-hidden">
        <caption>BPM 占比</caption>
        <tr v-for="b in data.bins" :key="'t' + b.key"><th>{{ b.label }} BPM</th><td>{{ fmtPct(b.share) }}</td></tr>
      </table>
    </template>
  </div>
</template>

<style scoped>
.headline {
  font-size: 0.95rem;
  color: var(--text2);
  margin-bottom: 0.75rem;
}

.headline strong {
  font-size: 1.3rem;
  color: var(--text);
}

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
  width: min(24px, 72%);
  background: var(--c-tempo);
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
  margin-top: 4px;
}

.x-label {
  text-align: center;
  font-size: 12px;
  color: var(--text2);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.x-title {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
}

.foot {
  margin-top: 0.75rem;
}

.in-sw {
  background: var(--c-tempo);
}

.out-sw {
  background: var(--c-muted-series);
}

.warn {
  margin-top: 0.5rem;
}
</style>
