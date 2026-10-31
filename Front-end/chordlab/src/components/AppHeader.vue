<script setup>
import ThemeToggle from '@/components/ThemeToggle.vue'
</script>

<template>
  <header class="header">
    <div class="brand">
      <div class="logo">Chord<span>Lab</span></div>
      <div class="subtitle">WAV 音樂分析：和弦調性・音高頻率・速度節拍</div>
    </div>
    <ThemeToggle />
  </header>
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
  margin-bottom: 1.5rem;
}

.brand {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 16px;
}

.logo {
  font-family: var(--font-mono);
  font-size: 28px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -1px;
}

.logo span {
  color: var(--text);
}

.subtitle {
  font-size: 0.95rem;
  color: var(--muted);
}
</style>
