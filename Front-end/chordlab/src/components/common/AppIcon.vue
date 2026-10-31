<script setup>
/**
 * 線條圖示（24×24、跟著文字顏色）
 */
defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 20 },
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="icon"
  >
    <!-- 和弦調性：三個疊起來的音符頭 -->
    <template v-if="name === 'harmony'">
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </template>
    <!-- 音高頻率：波形 -->
    <template v-else-if="name === 'pitch'">
      <path d="M2 12h2l2-7 3 14 3-10 2 6 2-3h6" />
    </template>
    <!-- 速度節拍：節拍器 -->
    <template v-else-if="name === 'rhythm'">
      <path d="M8.5 3h7l3.5 18H5L8.5 3z" />
      <path d="M12 16l5-9" />
      <path d="M7 16h10" />
    </template>
    <template v-else-if="name === 'play'">
      <path d="M7 4.5v15l12-7.5-12-7.5z" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'pause'">
      <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'sun'">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </template>
    <template v-else-if="name === 'moon'">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </template>
    <template v-else-if="name === 'upload'">
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </template>
    <template v-else-if="name === 'file'">
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </template>
    <template v-else-if="name === 'plus'">
      <path d="M12 5v14M5 12h14" />
    </template>
    <template v-else-if="name === 'minus'">
      <path d="M5 12h14" />
    </template>
    <template v-else-if="name === 'check'">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </template>
    <template v-else-if="name === 'alert'">
      <path d="M12 3l9.5 17h-19L12 3z" />
      <path d="M12 10v4M12 17.5v.01" />
    </template>
  </svg>
</template>

<style scoped>
.icon {
  flex-shrink: 0;
  display: inline-block;
  vertical-align: middle;
}
</style>
