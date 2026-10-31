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
  <div class="progress-wrap" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100">
    <div class="track">
      <div class="fill" :style="{ width: progress + '%' }"></div>
    </div>
    <div class="label">{{ label }}</div>
  </div>
</template>

<style scoped>
.progress-wrap {
  margin-bottom: 1.25rem;
}

.track {
  background: var(--surface3);
  border-radius: 4px;
  height: 8px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.fill {
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
  transition: width 0.4s ease;
}

.label {
  font-size: 0.9rem;
  color: var(--text2);
}
</style>
