<script setup>
import AppIcon from '@/components/common/AppIcon.vue'
import { useTheme } from '@/composables/useTheme.js'

const { theme, setTheme } = useTheme()
</script>

<template>
  <div class="seg theme-toggle" role="group" aria-label="畫面主題">
    <button type="button" :class="{ on: theme === 'light' }" :aria-pressed="theme === 'light'" @click="setTheme('light')">
      <AppIcon name="sun" :size="16" />白天
    </button>
    <button type="button" :class="{ on: theme === 'dark' }" :aria-pressed="theme === 'dark'" @click="setTheme('dark')">
      <AppIcon name="moon" :size="16" />黑夜
    </button>
  </div>
</template>

<style scoped>
.theme-toggle button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
}
</style>
