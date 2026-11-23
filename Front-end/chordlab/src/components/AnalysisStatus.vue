<script setup>
/**
 * 分析中：檔名＋進度條；失敗時改成錯誤訊息＋重試／返回（回到上傳頁）
 */
import AppIcon from '@/components/common/AppIcon.vue'

defineProps({
  fileName: { type: String, required: true },
  progress: { type: Number, default: 0 },
  label: { type: String, default: '' },
  failed: { type: Boolean, default: false },
  // 失敗原因（例如「檔案過大」）；沒有時顯示「分析失敗，請重試」
  errorText: { type: String, default: '' },
})

defineEmits(['retry', 'back'])
</script>

<template>
  <div class="analysis-status" :class="{ failed }">
    <span class="icon-box"><AppIcon :name="failed ? 'alert' : 'file'" :size="20" /></span>
    <div class="body">
      <div class="name">{{ fileName }}</div>
      <template v-if="failed">
        <div class="label">{{ errorText || '分析失敗，請重試' }}</div>
      </template>
      <template v-else>
        <div class="track" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100" aria-label="分析進度">
          <div class="fill" :style="{ width: progress + '%' }"></div>
        </div>
        <div class="label">{{ label }}</div>
      </template>
    </div>
    <template v-if="failed">
      <!-- 檔案本身被拒絕時重試也沒用，只留返回 -->
      <button v-if="!errorText" class="btn primary" type="button" @click="$emit('retry')">重試</button>
      <button class="btn" type="button" @click="$emit('back')"><AppIcon name="back" :size="16" />返回</button>
    </template>
  </div>
</template>

<style scoped>
/* 分析中／失敗的那一條：跟卡片同一種材質，沒有邊框，靠柔影浮起
   （--lift 的說明在 assets/main.css 的色票區） */
.analysis-status {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--surface);
  border: none;
  border-radius: var(--radius-lg);
  box-shadow: var(--lift);
  padding: 1rem 1.25rem;
}

.icon-box {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  flex-shrink: 0;
}

.failed .icon-box {
  background: color-mix(in srgb, var(--warning) 22%, var(--surface));
  color: var(--text);
}

.body {
  flex: 1;
  min-width: 0;
}

.name {
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track {
  background: var(--surface3);
  border-radius: 4px;
  height: 6px;
  overflow: hidden;
  margin: 0.4rem 0 0.3rem;
}

.fill {
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
  transition: width 0.4s ease;
}

.label {
  font-size: 0.875rem;
  color: var(--text2);
}
</style>
