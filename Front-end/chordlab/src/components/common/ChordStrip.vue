<script setup>
/**
 * 和弦色帶：依和聲功能上色，用百分比定位，可放在任何寬度的容器裡
 * 傳入 pxPerSec 時，寬度夠的色塊會印出和弦名稱
 */
import { computed } from 'vue'

const props = defineProps({
  timeline: { type: Array, required: true },
  chordInfo: { type: Map, required: true },
  total: { type: Number, required: true },
  height: { type: Number, default: 10 },
  pxPerSec: { type: Number, default: 0 },
})

const segments = computed(() =>
  props.timeline.map((c) => {
    const info = props.chordInfo.get(c.chord)
    const name = info?.name ?? c.chord
    const widthPx = c.dur * props.pxPerSec
    return {
      left: (c.start / props.total) * 100,
      width: (c.dur / props.total) * 100,
      fn: info?.fn ?? 'none',
      label: props.pxPerSec && widthPx >= name.length * 8 + 10 ? name : '',
    }
  }),
)
</script>

<template>
  <div class="strip" :style="{ height: height + 'px' }" aria-hidden="true">
    <span
      v-for="(s, i) in segments"
      :key="i"
      class="cs-seg"
      :class="'fn-' + s.fn"
      :style="{ left: s.left + '%', width: s.width + '%' }"
    >{{ s.label }}</span>
  </div>
</template>

<style scoped>
.strip {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 4px;
}

.cs-seg {
  position: absolute;
  top: 0;
  bottom: 0;
  background: var(--fc);
  /* 1px 表面色間隙分開相鄰色塊 */
  border-right: 1px solid var(--surface);
  color: var(--on-fc);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  display: flex;
  align-items: center;
  padding-left: 5px;
  white-space: nowrap;
}

.cs-seg.fn-none {
  background: var(--surface3);
}
</style>
