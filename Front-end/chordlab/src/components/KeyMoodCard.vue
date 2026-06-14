<script setup>
import { computed } from 'vue'
import SectionLabel from '@/components/SectionLabel.vue'
import { lookupKeyMood } from '@/utils/keyMoodData.js'

const props = defineProps({
  keyName: {
    type: String,
    default: '',
  },
})

const mood = computed(() => lookupKeyMood(props.keyName))

// 根據調性顏色計算文字對比色（深色背景用白字，淺色用深字）
function textColor(hexColor) {
  if (!hexColor) return '#ffffff'
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.45 ? '#1a1a2e' : '#ffffff'
}
</script>

<template>
  <div v-if="mood" class="section">
    <SectionLabel>調性情緒分析</SectionLabel>

    <div class="mood-card" :style="{ '--key-color': mood.color }">

      <!-- 左側：調性名稱與情緒標籤 -->
      <div class="mood-main">
        <div class="key-names">
          <span class="key-en">{{ mood.nameEn }}</span>
          <span class="key-zh">{{ mood.nameZh }}</span>
        </div>

        <div class="mood-label">
          <span
            v-for="(tag, i) in mood.mood.split(',')"
            :key="i"
            class="mood-tag"
          >
            {{ tag.trim() }}
          </span>
        </div>

        <div class="mood-zh">{{ mood.moodZh }}</div>
      </div>

      <!-- 右側裝飾色塊 -->
      <div class="mood-deco" aria-hidden="true">
        <div class="deco-circle large"></div>
        <div class="deco-circle small"></div>
      </div>

    </div>

    <!-- 情境描述列 -->
    <div class="scene-row">
      <div class="scene-icon">🎬</div>
      <div class="scene-content">
        <div class="scene-label">常見音樂情境</div>
        <div class="scene-tags">
          <span
            v-for="(scene, i) in mood.scene.split('、')"
            :key="i"
            class="scene-tag"
          >
            {{ scene.trim() }}
          </span>
        </div>
      </div>
    </div>

    <!-- 來源說明 -->
    <div class="source-note">
      情緒描述參考自 Christian Friedrich Schubart《Ideen zu einer Ästhetik der Tonkunst》（1806）
    </div>
  </div>

  <!-- keyName 存在但查不到對照資料時 -->
  <div v-else-if="keyName" class="section">
    <SectionLabel>調性情緒分析</SectionLabel>
    <div class="no-data">
      查無「{{ keyName }}」的情緒對照資料
    </div>
  </div>
</template>

<style scoped>
.section {
  margin-bottom: 2rem;
}

/* 主卡片 */
.mood-card {
  position: relative;
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.5rem 1.25rem;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 10px;

  /* 左側彩色邊條 */
  border-left: 4px solid var(--key-color);
}

/* 裝飾圓 */
.mood-deco {
  position: absolute;
  right: -20px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

.deco-circle {
  border-radius: 50%;
  background: var(--key-color);
  opacity: 0.08;
  position: absolute;
}

.deco-circle.large {
  width: 140px;
  height: 140px;
  right: 0;
  top: -70px;
}

.deco-circle.small {
  width: 80px;
  height: 80px;
  right: 40px;
  top: -20px;
  opacity: 0.05;
}

/* 主內容 */
.mood-main {
  flex: 1;
  position: relative;
  z-index: 1;
}

.key-names {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
}

.key-en {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 700;
  color: var(--key-color);
}

.key-zh {
  font-size: 13px;
  color: var(--muted);
}

/* 情緒標籤群 */
.mood-label {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.mood-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-family: var(--font-mono);
  font-weight: 700;
  background: color-mix(in srgb, var(--key-color) 15%, transparent);
  border: 0.5px solid color-mix(in srgb, var(--key-color) 40%, transparent);
  color: var(--key-color);
}

.mood-zh {
  font-size: 14px;
  color: var(--text);
  line-height: 1.6;
}

/* 情境列 */
.scene-row {
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-md);
  padding: 0.875rem 1.25rem;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
}

.scene-icon {
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 1px;
}

.scene-label {
  font-size: 11px;
  color: var(--muted);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 6px;
}

.scene-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.scene-tag {
  display: inline-block;
  background: var(--surface2);
  border: 0.5px solid var(--border);
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 13px;
  color: var(--text);
}

/* 來源說明 */
.source-note {
  font-size: 11px;
  color: var(--muted);
  font-family: var(--font-mono);
  padding-left: 4px;
}

/* 無資料 */
.no-data {
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-md);
  padding: 1rem 1.25rem;
  font-size: 13px;
  color: var(--muted);
}
</style>
