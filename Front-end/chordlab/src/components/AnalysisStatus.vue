<script setup>
/**
 * 分析中：檔名＋進度條；失敗時改成錯誤訊息＋重試／換檔案
 */
import AppIcon from '@/components/common/AppIcon.vue'
import FilePickButton from '@/components/common/FilePickButton.vue'

defineProps({
  fileName: { type: String, required: true },
  progress: { type: Number, default: 0 },
  label: { type: String, default: '' },
  failed: { type: Boolean, default: false },
})

defineEmits(['retry', 'file-selected'])
</script>

<template>
  <div class="analysis-status" :class="{ failed }">
    <span class="icon-box"><AppIcon :name="failed ? 'alert' : 'file'" :size="20" /></span>
    <div class="body">
      <div class="name">{{ fileName }}</div>
      <template v-if="failed">
        <div class="label">分析失敗，請重試</div>
      </template>
      <template v-else>
        <div class="track" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100" aria-label="分析進度">
          <div class="fill" :style="{ width: progress + '%' }"></div>
        </div>
        <div class="label">{{ label }}</div>
      </template>
    </div>
    <template v-if="failed">
      <button class="btn primary" type="button" @click="$emit('retry')">重試</button>
      <FilePickButton @pick="$emit('file-selected', $event)" />
    </template>
  </div>
</template>

<style scoped>
.analysis-status {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
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
