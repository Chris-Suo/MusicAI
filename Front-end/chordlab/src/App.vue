<script setup>
import { ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import UploadZone from '@/components/UploadZone.vue'
import AnalyzeButton from '@/components/AnalyzeButton.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import ResultsPanel from '@/components/ResultsPanel.vue'
import { analyzeAudio } from '@/utils/api.js'

const selectedFile = ref(null)
const isAnalyzing = ref(false)
const progress = ref(0)
const progressLabel = ref('')
const analysisResult = ref(null)
// 每次分析完換一個 key，讓結果區（含播放器）整個重建
const resultKey = ref(0)
const FAILED_LABEL = '分析失敗，請重試'

const PROGRESS_STEPS = [
  '正在解析音訊波形...',
  '提取頻率特徵...',
  '辨識和弦進行...',
  '計算統計數據...',
  '整理分析結果...',
]

function onFileSelected(file) {
  selectedFile.value = file
  analysisResult.value = null
  progressLabel.value = ''
}

function onFileRemoved() {
  selectedFile.value = null
  analysisResult.value = null
  progressLabel.value = ''
}

async function onAnalyze() {
  if (!selectedFile.value) return

  isAnalyzing.value = true
  progress.value = 0
  analysisResult.value = null

  // Simulate progress while waiting for API
  let step = 0
  const interval = setInterval(() => {
    step++
    progress.value = step * 18
    progressLabel.value = PROGRESS_STEPS[step - 1] ?? '完成'
    if (step >= 5) clearInterval(interval)
  }, 500)

  try {
    const result = await analyzeAudio(selectedFile.value)
    clearInterval(interval)
    progress.value = 100
    progressLabel.value = '分析完成！'
    await new Promise((r) => setTimeout(r, 300))
    resultKey.value++
    analysisResult.value = result
  } catch (err) {
    clearInterval(interval)
    console.error('Analysis failed:', err)
    progressLabel.value = FAILED_LABEL
  } finally {
    isAnalyzing.value = false
  }
}
</script>

<template>
  <div class="app-wrapper">
    <div class="app">
      <AppHeader />

      <UploadZone
        :file="selectedFile"
        @file-selected="onFileSelected"
        @file-removed="onFileRemoved"
      >
        <AnalyzeButton
          :disabled="!selectedFile || isAnalyzing"
          :is-analyzing="isAnalyzing"
          :done="!!analysisResult"
          @click="onAnalyze"
        />
      </UploadZone>

      <ProgressBar
        v-if="isAnalyzing || progressLabel === FAILED_LABEL"
        :progress="progress"
        :label="progressLabel"
      />

      <ResultsPanel
        v-if="analysisResult"
        :key="resultKey"
        :data="analysisResult"
        :audio-file="selectedFile"
        :file-name="selectedFile?.name ?? ''"
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
  max-width: 1440px;
  margin: 0 auto;
}
</style>
