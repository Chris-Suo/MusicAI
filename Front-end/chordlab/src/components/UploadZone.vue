<script setup>
/**
 * 拖放區：拖檔案進來或點一下選檔，選好就 emit('file-selected', file)（格式由 App 檢查）
 */
import { ref } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'

const emit = defineEmits(['file-selected'])

const isDragging = ref(false)

function onInputChange(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (file) emit('file-selected', file)
}

function onDrop(e) {
  isDragging.value = false
  const file = e.dataTransfer.files[0]
  if (file) emit('file-selected', file)
}
</script>

<template>
  <label
    class="upload-zone"
    :class="{ 'drag-over': isDragging }"
    @dragover.prevent="isDragging = true"
    @dragleave="isDragging = false"
    @drop.prevent="onDrop"
  >
    <input type="file" accept=".wav,audio/wav" class="hidden-input" @change="onInputChange" />
    <span class="upload-icon"><AppIcon name="upload" :size="32" /></span>
    <span class="upload-title">上傳 WAV 音樂檔案</span>
    <span class="upload-sub">拖曳到這裡，或點一下選擇檔案</span>
  </label>
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
  padding: 3.5rem 2rem;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
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
</style>
