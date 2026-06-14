<script setup>
defineProps({
  progress: {
    type: Number,
    default: 0,
  },
  label: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div class="progress-wrap">
    <div class="track">
      <div class="fill" :style="{ width: progress + '%' }"></div>
    </div>
    <div class="label">{{ label }}</div>
  </div>
</template>

<style scoped>
.progress-wrap {
  margin-bottom: 1.5rem;
}

.track {
  background: var(--surface);
  border-radius: 4px;
  height: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent2));
  border-radius: 4px;
  transition: width 0.4s ease;
}

.label {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
}
</style>
