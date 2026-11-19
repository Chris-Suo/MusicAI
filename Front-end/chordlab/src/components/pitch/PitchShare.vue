<script setup>
/**
 * 音高占比（依主旋律出現的時間計算），跟和弦占比同一種圖
 * - 上方：各音區（八度）的頻率範圍（Hz）占多少，低音區在左；每個音區一個顏色，相鄰音區顏色差很多
 * - 下方：出現過的每個音（含八度與 Hz），依 Hz 由低到高排，調外音放在最後（也是依 Hz 由低到高），顏色跟所屬音區一致
 */
import { computed } from 'vue'
import ShareBars from '@/components/common/ShareBars.vue'
import { fmtHz } from '@/utils/theory.js'
import { fmtPct } from '@/utils/stats.js'

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

// 每個音一條：調內音在前、調外音在後，各自依 Hz 由低到高排
const rows = computed(() =>
  [...props.stats.notes]
    .sort((a, b) => Number(b.inKey) - Number(a.inKey) || a.hz - b.hz)
    .map((n) => ({
      key: n.midi,
      name: n.name,
      sub: fmtHz(n.hz) + (n.inKey ? '' : '・調外'),
      share: n.share,
      color: regColor(n.octave),
    })),
)
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
