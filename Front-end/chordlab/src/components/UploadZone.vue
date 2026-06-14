<script setup>
import { ref } from 'vue'

const props = defineProps({
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
  if (!file.name.endsWith('.wav') && file.type !== 'audio/wav') {
    alert('請上傳 .wav 格式的音訊檔案')
    return
  }
  emit('file-selected', file)
}

function onInputChange(e) {
  handleFile(e.target.files[0])
}

function onDrop(e) {
  isDragging.value = false
  handleFile(e.dataTransfer.files[0])
}

function onRemove() {
  emit('file-removed')
}
</script>

<template>
  <div>
    <!-- Drop Zone (shown when no file selected) -->
    <label
      v-if="!file"
      class="upload-zone"
      :class="{ 'drag-over': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave="isDragging = false"
      @drop.prevent="onDrop"
    >
      <input type="file" accept=".wav,audio/wav" class="hidden-input" @change="onInputChange" />
      <span class="upload-icon">♪</span>
      <div class="upload-title">上傳 WAV 音樂檔案</div>
      <div class="upload-sub">拖曳檔案至此，或點擊選擇 · 僅支援 .wav 格式</div>
    </label>

    <!-- File Info (shown when file is selected) -->
    <div v-else class="file-info">
      <div class="file-dot"></div>
      <div class="file-name">{{ file.name }}</div>
      <div class="file-size">{{ formatSize(file.size) }}</div>
      <button class="file-remove" type="button" @click="onRemove">×</button>
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
  display: block;
  position: relative;
  border: 1.5px dashed rgba(124, 106, 245, 0.35);
  border-radius: var(--radius-lg);
  background: var(--surface);
  padding: 3rem 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.upload-zone:hover,
.upload-zone.drag-over {
  border-color: var(--accent);
  background: rgba(124, 106, 245, 0.06);
}

.upload-icon {
  display: block;
  font-size: 36px;
  margin-bottom: 1rem;
}

.upload-title {
  font-size: 17px;
  font-weight: 500;
  margin-bottom: 0.4rem;
}

.upload-sub {
  font-size: 13px;
  color: var(--muted);
}

/* File info row */
.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-md);
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
}

.file-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent2);
  flex-shrink: 0;
}

.file-name {
  font-family: var(--font-mono);
  font-size: 13px;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}

.file-remove {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  padding: 0 4px;
  transition: color 0.15s;
}

.file-remove:hover {
  color: var(--text);
}
</style>
