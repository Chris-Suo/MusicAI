<script setup>
import { computed } from 'vue'

const props = defineProps({
  cents: { type: Number, default: 0 },   // -50 ~ +50 cents
})

// 把 cents 對應到指針角度（-50c = -45deg，+50c = +45deg）
const needleAngle = computed(() => {
  const clamped = Math.max(-50, Math.min(50, props.cents))
  return (clamped / 50) * 45   // 最大偏移 ±45 度
})

const statusColor = computed(() => {
  const abs = Math.abs(props.cents)
  if (abs < 5)  return 'var(--accent2)'   // 綠：標準
  if (abs < 20) return 'var(--accent3)'   // 橘：輕微偏移
  return '#ff6b6b'                         // 紅：明顯偏移
})
</script>

<template>
  <div class="meter-wrap">
    <!-- 刻度盤 -->
    <svg viewBox="0 0 120 70" class="meter-svg">
      <!-- 背景弧 -->
      <path d="M 10 65 A 50 50 0 0 1 110 65"
            fill="none" stroke="var(--surface2)" stroke-width="8"
            stroke-linecap="round" />

      <!-- 綠色安全區（中間 ±5 cents） -->
      <path d="M 50 20 A 50 50 0 0 1 70 20"
            fill="none" stroke="var(--accent2)" stroke-width="8"
            stroke-linecap="round" opacity="0.35" />

      <!-- 指針 -->
      <line
        x1="60" y1="65"
        :x2="60 + 42 * Math.sin(needleAngle * Math.PI / 180)"
        :y2="65 - 42 * Math.cos(needleAngle * Math.PI / 180)"
        :stroke="statusColor"
        stroke-width="2.5"
        stroke-linecap="round"
      />

      <!-- 中心點 -->
      <circle cx="60" cy="65" r="4" :fill="statusColor" />

      <!-- 刻度標籤 -->
      <text x="8"  y="68" class="tick-label">-50</text>
      <text x="52" y="16" class="tick-label">0</text>
      <text x="100" y="68" class="tick-label">+50</text>
    </svg>

    <!-- 數值 -->
    <div class="cents-val" :style="{ color: statusColor }">
      {{ cents >= 0 ? '+' : '' }}{{ cents.toFixed(1) }} cents
    </div>
  </div>
</template>

<style scoped>
.meter-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.meter-svg {
  width: 100px;
  height: 60px;
}

.tick-label {
  font-family: var(--font-mono);
  font-size: 9px;
  fill: var(--muted);
}

.cents-val {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
}
</style>