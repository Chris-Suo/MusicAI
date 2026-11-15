<script setup>
import ThemeToggle from '@/components/ThemeToggle.vue'
</script>

<template>
  <header class="header">
    <div class="logo">MusicTomic <span>Lab</span></div>
    <ThemeToggle />
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* 畫面窄到放不下時，主題切換換到下一列，logo 不斷行 */
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 1.25rem;
}

.logo {
  font-family: var(--font-mono);
  /* 一般是 26px；手機上依畫面寬度縮小，讓 logo 和主題切換排在同一列 */
  font-size: clamp(16px, 4.8vw, 26px);
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -1px;
  white-space: nowrap;
}

.logo span {
  color: var(--text);
}
</style>
