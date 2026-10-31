<script setup>
defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
  isAnalyzing: {
    type: Boolean,
    default: false,
  },
  // 已經有結果時改成「重新分析」
  done: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['click'])
</script>

<template>
  <button class="btn primary analyze-btn" type="button" :disabled="disabled" @click="$emit('click')">
    {{ isAnalyzing ? '分析中…' : done ? '重新分析' : '開始分析' }}
  </button>
</template>

<style scoped>
.analyze-btn {
  padding: 10px 24px;
  font-size: 1rem;
  font-weight: 700;
  border-radius: var(--radius-md);
}
</style>
