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
})

defineEmits(['click'])
</script>

<template>
  <button class="analyze-btn" :disabled="disabled" @click="$emit('click')">
    {{ isAnalyzing ? '分析中...' : '分析和弦' }}
  </button>
</template>

<style scoped>
.analyze-btn {
  width: 100%;
  padding: 14px;
  background: var(--accent);
  border: none;
  border-radius: var(--radius-md);
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  font-family: var(--font-sans);
  letter-spacing: 0.2px;
  transition:
    opacity 0.2s,
    transform 0.1s;
  margin-bottom: 1.5rem;
}

.analyze-btn:hover:not(:disabled) {
  opacity: 0.88;
}

.analyze-btn:active:not(:disabled) {
  transform: scale(0.99);
}

.analyze-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
