<script setup>
/**
 * 音高占比(Hz)：跟「音高占比」一樣依主旋律出現的時間計算，但不轉成音名，
 * 直接把赫茲數分成固定寬度的區間（utils/pitch.js 的 HZ_BIN，預設 10 Hz），依赫茲數由高到低排
 * - 上方：各音區（八度）的頻率範圍占多少，跟「音高占比」相同
 * - 下方：每個頻率區間一條，顏色跟所屬音區一致；區間很多時在卡片裡捲動
 */
import { computed } from 'vue'
import ShareBars from '@/components/common/ShareBars.vue'
import { hzShares, HZ_BIN, octaveColor as regColor } from '@/utils/pitch.js'

const props = defineProps({
  // utils/pitch.js normalizeContour() 的結果
  contour: { type: Object, required: true },
  // utils/pitch.js analyzePitch() 的結果（上方音區色條用）
  stats: { type: Object, required: true },
})

const groups = computed(() =>
  props.stats.octaves.map((o) => ({
    key: o.octave,
    label: o.name,
    sub: `${Math.round(o.fromHz)}–${Math.round(o.toHz)} Hz`,
    share: o.share,
    color: regColor(o.octave),
  })),
)

const rows = computed(() =>
  hzShares(props.contour).map((b) => ({
    key: b.from,
    name: `${b.from}–${b.to} Hz`,
    share: b.share,
    color: regColor(b.octave),
  })),
)
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">音高占比(Hz)</h3>
        <p class="card-desc">依主旋律出現時間計算・每 {{ HZ_BIN }} Hz 一個區間，不轉成音名，依赫茲數由高到低排</p>
      </div>
      <span class="count">共 {{ rows.length }} 個區間</span>
    </div>

    <div class="scroll">
      <ShareBars :groups="groups" :rows="rows" label="音區" />
    </div>
  </div>
</template>

<style scoped>
.count {
  font-size: 0.85rem;
  color: var(--muted);
  white-space: nowrap;
}

/* 區間可能有好幾十個，超過的在卡片裡捲動 */
.scroll {
  max-height: 520px;
  overflow-y: auto;
  padding-right: 4px;
}
</style>
