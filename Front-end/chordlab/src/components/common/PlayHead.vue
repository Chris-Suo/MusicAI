<script setup>
/**
 * 播放頭：放在 position: relative 的圖表容器裡，自己讀播放位置，
 * 這樣播放時只有這條線在重畫，不會整張圖表跟著重畫
 */
import { computed } from 'vue'
import { usePlayback } from '@/composables/usePlayback.js'

const props = defineProps({
  pxPerSec: { type: Number, required: true },
  offset: { type: Number, default: 0 },
})

const pb = usePlayback()
const style = computed(() => ({ transform: `translateX(${props.offset + (pb?.current.value ?? 0) * props.pxPerSec}px)` }))
</script>

<template>
  <div v-if="pb?.active.value" class="playhead" :style="style" aria-hidden="true"></div>
</template>

<style scoped>
.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -1px;
  width: 2px;
  background: var(--playhead);
  pointer-events: none;
  z-index: 3;
  will-change: transform;
}

.playhead::before {
  content: '';
  position: absolute;
  top: 0;
  left: -5px;
  border: 6px solid transparent;
  border-top: 8px solid var(--playhead);
}
</style>
