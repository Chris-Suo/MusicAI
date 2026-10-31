<script setup>
/**
 * 流程：選檔（拖放或點選）→ 自動開始分析 → 顯示結果
 * 結果上方的播放器有「換檔案」，選了新檔就重新分析
 */
import { ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import UploadZone from '@/components/UploadZone.vue'
import AnalysisStatus from '@/components/AnalysisStatus.vue'
import ResultsPanel from '@/components/ResultsPanel.vue'
import { analyzeAudio } from '@/utils/api.js'

const selectedFile = ref(null)
const isAnalyzing = ref(false)
const failed = ref(false)
const progress = ref(0)
const progressLabel = ref('')
const analysisResult = ref(null)
// 每次分析完換一個 key，讓結果區（含播放器）整個重建
const resultKey = ref(0)

const PROGRESS_STEPS = [
  '正在解析音訊波形...',
  '提取頻率特徵...',
  '辨識和弦進行...',
  '計算統計數據...',
  '整理分析結果...',
]

function isWav(file) {
  return file.name.toLowerCase().endsWith('.wav') || file.type === 'audio/wav'
}

function onFileSelected(file) {
  if (!isWav(file)) {
    alert('請上傳 .wav 格式的音訊檔案')
    return
  }
  selectedFile.value = file
  analyze()
}

async function analyze() {
  if (!selectedFile.value) return

  isAnalyzing.value = true
  failed.value = false
  progress.value = 0
  progressLabel.value = PROGRESS_STEPS[0]
  analysisResult.value = null

  // Simulate progress while waiting for API
  let step = 0
  const interval = setInterval(() => {
    step++
    progress.value = step * 18
    progressLabel.value = PROGRESS_STEPS[step] ?? PROGRESS_STEPS[PROGRESS_STEPS.length - 1]
    if (step >= 5) clearInterval(interval)
  }, 500)

  try {
    const result = await analyzeAudio(selectedFile.value)
    clearInterval(interval)
    progress.value = 100
    await new Promise((r) => setTimeout(r, 300))
    resultKey.value++
    analysisResult.value = result
  } catch (err) {
    clearInterval(interval)
    console.error('Analysis failed:', err)
    failed.value = true
  } finally {
    isAnalyzing.value = false
  }
}
</script>

<template>
  <div class="app-wrapper">
    <div class="app">
      <AppHeader />

      <UploadZone v-if="!selectedFile" @file-selected="onFileSelected" />

      <AnalysisStatus
        v-else-if="!analysisResult"
        :file-name="selectedFile.name"
        :progress="progress"
        :label="progressLabel"
        :failed="failed"
        @retry="analyze"
        @file-selected="onFileSelected"
      />

      <ResultsPanel
        v-else
        :key="resultKey"
        :data="analysisResult"
        :audio-file="selectedFile"
        :file-name="selectedFile.name"
        @file-selected="onFileSelected"
      />
    </div>
  </div>
</template>

<style scoped>
.app-wrapper {
  min-height: 100vh;
  padding: 1.5rem 1.25rem 4rem;
}

.app {
  max-width: 1280px;
  margin: 0 auto;
}
</style>
