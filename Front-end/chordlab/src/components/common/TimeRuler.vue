<script setup>
import { fmtTick } from '@/utils/stats.js'

defineProps({
  ticks: { type: Array, required: true },
  pxPerSec: { type: Number, required: true },
})
</script>

<template>
  <div class="ruler" aria-hidden="true">
    <span v-for="t in ticks" :key="t" class="tick" :style="{ left: t * pxPerSec + 'px' }">{{ fmtTick(t) }}</span>
  </div>
</template>

<style scoped>
.ruler {
  position: relative;
  height: 22px;
  border-bottom: 1px solid var(--axis);
}

.tick {
  position: absolute;
  bottom: 2px;
  padding-left: 4px;
  border-left: 1px solid var(--axis);
  font-size: 12px;
  line-height: 1;
  color: var(--muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
</style>
