<script setup>
/**
 * BPM 占比：每一拍換算成 BPM，依時間統計，跟和弦占比同一種圖
 * - 上方：偏慢／穩定（主速度 ±3% 以內）／偏快 的比例
 * - 下方：最常出現的 BPM（區間寬約主速度的 2%），1% 以下的不列
 */
import { computed } from 'vue'
import ShareBars from '@/components/common/ShareBars.vue'
import { tempoDistribution } from '@/utils/rhythm.js'
import { splitTop, fmtPct } from '@/utils/stats.js'

const props = defineProps({
  // utils/rhythm.js beatStats() 的結果
  rhythm: { type: Object, required: true },
})

// 穩定＝速度的顏色，偏慢／偏快＝深淺兩種灰
const COLORS = { slow: 'var(--c-muted-series)', stable: 'var(--c-tempo)', fast: 'var(--c-muted-series-2)' }

const dist = computed(() => tempoDistribution(props.rhythm))

const groups = computed(() => {
  const { lo, hi, shares } = dist.value
  return [
    { key: 'slow', label: '偏慢', sub: `< ${lo}` },
    { key: 'stable', label: '穩定', sub: `${lo}–${hi} BPM` },
    { key: 'fast', label: '偏快', sub: `> ${hi}` },
  ]
    .map((g) => ({ ...g, share: shares[g.key], color: COLORS[g.key] }))
    .filter((g) => g.share > 0)
})

const rows = computed(() => {
  const w = dist.value.binWidth
  return splitTop(dist.value.bins, 6, 0.01).top.map((b) => ({
    key: b.bpm,
    name: String(b.bpm),
    sub: 'BPM',
    share: b.share,
    color: COLORS[b.group],
    title: w > 1 ? `${b.bpm - w / 2}–${b.bpm + w / 2} BPM` : '',
  }))
})

// 偏慢＋偏快的時間比例
const edgeShare = computed(() => dist.value.shares.slow + dist.value.shares.fast)
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">BPM 占比</h3>
        <p class="card-desc">每一拍換算成 BPM，依時間計算</p>
      </div>
    </div>

    <div v-if="!dist" class="note">拍點太少，無法統計</div>
    <template v-else>
      <ShareBars :groups="groups" :rows="rows" label="速度" />
      <p v-if="edgeShare >= 0.05" class="note warn">
        有 {{ fmtPct(edgeShare) }} 的時間速度差很多，可能是速度轉換的段落，或拍點偵測跳到半拍／倍速。
      </p>
    </template>
  </div>
</template>

<style scoped>
.warn {
  margin-top: 0.75rem;
}
</style>
