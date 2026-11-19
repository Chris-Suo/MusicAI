<script setup>
/**
 * 總樂性元・最終值（計算方式見 utils/overall.js）
 * - 上方：x、y 兩個最終值
 * - 中間：每一項的平均值、權重、乘出來的數字，可以對照算式
 * - 下方：每 15 秒區間的平均音高與平均速度（可展開）
 */
import { computed } from 'vue'
import { overallScore, WEIGHTS } from '@/utils/overall.js'

const props = defineProps({
  timeline: { type: Array, required: true },
  // utils/pitch.js normalizeContour() 的結果
  contour: { type: Object, default: null },
  beats: { type: Array, default: () => [] },
  // 整首歌長度（秒）
  length: { type: Number, required: true },
})

const r = computed(() => overallScore(props))

const f1 = (v) => (v === null || v === undefined ? '—' : (Math.round(v * 10) / 10).toFixed(1))
const f2 = (v) => (v === null || v === undefined ? '—' : (Math.round(v * 100) / 100).toFixed(2))
const pct = (w) => `${Math.round(w * 100)}%`
const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

// 缺哪些資料（最終值算不出來時說明原因）
const missing = computed(() =>
  [!r.value.emotion && '情緒軌跡', r.value.pitch === null && '主旋律音高', r.value.tempo === null && '拍點'].filter(Boolean),
)

const rows = computed(() => {
  const { emotion, pitch, tempo } = r.value
  return [
    { key: 'ex', name: '情緒軌跡平均 x', value: emotion?.x, unit: '', w: WEIGHTS.emotion, only: 'x' },
    { key: 'ey', name: '情緒軌跡平均 y', value: emotion?.y, unit: '', w: WEIGHTS.emotion, only: 'y' },
    { key: 'p', name: '平均音高', value: pitch, unit: 'Hz', w: WEIGHTS.pitch },
    { key: 't', name: '平均速度', value: tempo, unit: 'BPM', w: WEIGHTS.tempo },
  ]
})
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">最終值</h3>
        <p class="card-desc">
          {{ pct(WEIGHTS.emotion) }} 情緒座標 ＋ {{ pct(WEIGHTS.pitch) }} 平均音高(Hz) ＋ {{ pct(WEIGHTS.tempo) }} 平均速度(BPM)・音高與速度每
          {{ r.windowSec }} 秒一個區間再平均
        </p>
      </div>
    </div>

    <div v-if="!r.final" class="note">缺少{{ missing.join('、') }}資料，無法算出最終值</div>
    <div v-else class="finals">
      <div class="final">
        <span class="f-label">最終值 x</span>
        <span class="hero-value">{{ f2(r.final.x) }}</span>
      </div>
      <div class="final">
        <span class="f-label">最終值 y</span>
        <span class="hero-value">{{ f2(r.final.y) }}</span>
      </div>
    </div>

    <div class="sub-title">算式</div>
    <table class="calc">
      <thead>
        <tr>
          <th scope="col">項目</th>
          <th scope="col" class="num">平均值</th>
          <th scope="col" class="num">權重</th>
          <th scope="col" class="num">乘積</th>
          <th scope="col">用在</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <td>{{ row.name }}</td>
          <td class="num">{{ f1(row.value) }}<span v-if="row.unit" class="unit">{{ row.unit }}</span></td>
          <td class="num">× {{ pct(row.w) }}</td>
          <td class="num strong">{{ row.value === null || row.value === undefined ? '—' : f2(row.value * row.w) }}</td>
          <td class="muted">{{ row.only ? `最終值 ${row.only}` : 'x、y 都加' }}</td>
        </tr>
      </tbody>
    </table>
    <p class="note hint">三項直接用原始數值相加，沒有換算成同一個範圍，所以結果主要由音高（Hz）和速度（BPM）決定</p>

    <details class="windows">
      <summary>每 {{ r.windowSec }} 秒區間的平均音高與速度（{{ r.windows.length }} 個區間）</summary>
      <table class="calc">
        <thead>
          <tr>
            <th scope="col">區間</th>
            <th scope="col" class="num">平均音高</th>
            <th scope="col" class="num">平均速度</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in r.windows" :key="w.start">
            <td>{{ clock(w.start) }}–{{ clock(w.end) }}</td>
            <td class="num">{{ w.pitch === null ? '沒有旋律' : `${f1(w.pitch)} Hz` }}</td>
            <td class="num">{{ w.tempo === null ? '拍點不足' : `${f1(w.tempo)} BPM` }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </div>
</template>

<style scoped>
.finals {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 3rem;
}

.final {
  display: flex;
  flex-direction: column;
}

.f-label {
  font-size: 0.9rem;
  color: var(--muted);
}

.calc {
  width: 100%;
  max-width: 640px;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.calc th {
  text-align: left;
  font-weight: 600;
  color: var(--muted);
  padding: 4px 10px;
  border-bottom: 1px solid var(--border-strong);
}

.calc td {
  padding: 4px 10px;
  border-bottom: 1px solid var(--border);
  color: var(--text2);
}

.calc .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.calc .strong {
  color: var(--text);
  font-weight: 700;
}

.calc .muted {
  color: var(--muted);
}

.unit {
  margin-left: 4px;
  font-size: 0.8rem;
  color: var(--muted);
}

.hint {
  margin-top: 0.5rem;
}

.windows {
  margin-top: 1rem;
}

.windows summary {
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text2);
  margin-bottom: 0.5rem;
}
</style>
