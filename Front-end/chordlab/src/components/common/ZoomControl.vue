<script setup>
import AppIcon from '@/components/common/AppIcon.vue'
import { ZOOMS } from '@/composables/useTimeAxis.js'

defineProps({
  zoomIdx: { type: Number, required: true },
})
defineEmits(['zoom'])
</script>

<template>
  <div class="zoom" role="group" aria-label="時間軸縮放">
    <button class="btn icon-btn" type="button" :disabled="zoomIdx === 0" title="縮小" @click="$emit('zoom', -1)">
      <AppIcon name="minus" :size="16" />
    </button>
    <span class="zoom-val" aria-live="polite">{{ zoomIdx === 0 ? '整首' : ZOOMS[zoomIdx] + '×' }}</span>
    <button class="btn icon-btn" type="button" :disabled="zoomIdx === ZOOMS.length - 1" title="放大" @click="$emit('zoom', 1)">
      <AppIcon name="plus" :size="16" />
    </button>
  </div>
</template>

<style scoped>
.zoom {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  padding: 0;
}

.zoom-val {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text2);
  min-width: 36px;
  text-align: center;
}
</style>
