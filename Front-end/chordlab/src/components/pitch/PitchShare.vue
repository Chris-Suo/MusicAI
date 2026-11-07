<script setup>
/**
 * 音高占比（依主旋律出現的時間計算），跟和弦占比同一種圖
 * - 上方：各音區（八度）的頻率範圍（Hz）占多少，低音區在左；每個音區一個顏色，相鄰音區顏色差很多
 * - 下方：最常出現的 10 個音（含八度與 Hz），顏色跟所屬音區一致
 */
import { computed } from 'vue'
import ShareBars from '@/components/common/ShareBars.vue'
import { fmtHz } from '@/utils/theory.js'
import { splitTop, fmtPct } from '@/utils/stats.js'

const props = defineProps({
  // utils/pitch.js analyzePitch() 的結果
  stats: { type: Object, required: true },
})

// 八度 2～6（低音區～高音區）→ --c-reg-1～5；極低／極高音區很少見，用灰色
const regColor = (octave) => (octave >= 2 && octave <= 6 ? `var(--c-reg-${octave - 1})` : 'var(--c-muted-series)')

const groups = computed(() =>
  props.stats.octaves.map((o) => ({
    key: o.octave,
    label: o.name,
    sub: `${Math.round(o.fromHz)}–${Math.round(o.toHz)} Hz`,
    share: o.share,
    color: regColor(o.octave),
  })),
)

const rows = computed(() => {
  const { top, rest } = splitTop(props.stats.notes, 10)
  const out = top.map((n) => ({
    key: n.midi,
    name: n.name,
    sub: fmtHz(n.hz) + (n.inKey ? '' : '・調外'),
    share: n.share,
    color: regColor(n.octave),
  }))
  if (rest.length) out.push({ key: 'other', name: `其他 ${rest.length} 個音`, share: rest.reduce((s, n) => s + n.share, 0), other: true })
  return out
})
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">音高占比</h3>
        <p class="card-desc">依主旋律出現時間計算・調內音占 {{ fmtPct(stats.inKeyShare) }}</p>
      </div>
    </div>

    <ShareBars :groups="groups" :rows="rows" label="音區" />
  </div>
</template>
