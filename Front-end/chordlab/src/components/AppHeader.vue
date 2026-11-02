<script setup>
import ThemeToggle from '@/components/ThemeToggle.vue'
</script>

<template>
  <header class="header">
    <div class="logo">Chord<span>Lab</span></div>
    <ThemeToggle />
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
  margin-bottom: 1.25rem;
}

.logo {
  font-family: var(--font-mono);
  font-size: 26px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -1px;
}

.logo span {
  color: var(--text);
}
</style>
