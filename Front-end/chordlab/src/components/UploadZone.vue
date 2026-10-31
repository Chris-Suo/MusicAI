<script setup>
import { ref } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'

defineProps({
  file: {
    type: File,
    default: null,
  },
})

const emit = defineEmits(['file-selected', 'file-removed'])

const isDragging = ref(false)

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

function handleFile(file) {
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.wav') && file.type !== 'audio/wav') {
    alert('請上傳 .wav 格式的音訊檔案')
    return
  }
  emit('file-selected', file)
}

function onInputChange(e) {
  handleFile(e.target.files[0])
  e.target.value = ''
}

function onDrop(e) {
  isDragging.value = false
  handleFile(e.dataTransfer.files[0])
}
</script>

<template>
  <div>
    <!-- 還沒選檔：拖放區 -->
    <label
      v-if="!file"
      class="upload-zone"
      :class="{ 'drag-over': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave="isDragging = false"
      @drop.prevent="onDrop"
    >
      <input type="file" accept=".wav,audio/wav" class="hidden-input" @change="onInputChange" />
      <span class="upload-icon"><AppIcon name="upload" :size="32" /></span>
      <span class="upload-title">上傳 WAV 音樂檔案</span>
      <span class="upload-sub">拖曳檔案到這裡，或點擊選擇・僅支援 .wav</span>
      <span class="features">
        <span class="pill"><AppIcon name="harmony" :size="16" />和弦調性</span>
        <span class="pill"><AppIcon name="pitch" :size="16" />音高頻率</span>
        <span class="pill"><AppIcon name="rhythm" :size="16" />速度節拍</span>
      </span>
    </label>

    <!-- 已選檔：檔名列＋動作（分析按鈕由父層放進 slot） -->
    <div v-else class="file-info">
      <span class="file-icon"><AppIcon name="file" :size="20" /></span>
      <div class="file-text">
        <div class="file-name">{{ file.name }}</div>
        <div class="file-size">{{ formatSize(file.size) }}</div>
      </div>
      <label class="btn change">
        <input type="file" accept=".wav,audio/wav" class="hidden-input" @change="onInputChange" />
        換檔案
      </label>
      <button class="btn remove" type="button" title="移除檔案" aria-label="移除檔案" @click="emit('file-removed')">
        <AppIcon name="close" :size="16" />
      </button>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.hidden-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}

.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
  border: 2px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--surface);
  padding: 2.75rem 2rem;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  margin-bottom: 1.25rem;
}

.upload-zone:hover,
.upload-zone.drag-over {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.upload-zone:focus-within {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

.upload-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  margin-bottom: 0.5rem;
}

.upload-title {
  font-size: 1.25rem;
  font-weight: 700;
}

.upload-sub {
  font-size: 0.95rem;
  color: var(--muted);
}

.features {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 0.75rem;
}

/* 檔名列 */
.file-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 0.75rem 1rem;
  margin-bottom: 1.25rem;
  box-shadow: var(--shadow-sm);
}

.file-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  color: var(--accent);
}

.file-text {
  flex: 1;
  min-width: 140px;
}

.file-name {
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  font-size: 0.85rem;
  color: var(--muted);
}

.change {
  position: relative;
  overflow: hidden;
}

.remove {
  width: 36px;
  padding: 5px 0;
}
</style>
