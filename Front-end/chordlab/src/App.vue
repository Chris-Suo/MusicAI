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
// const analysisResult = ref({"BTC":{"key":"C major","tuning":{"a4_hz":439.97,"tuning_offset_cents":-12.0,"status":"flat","status_text":"偏低 12.0 cents"},"timeline":[{"chord":"N","start":0.0,"dur":0.741},{"chord":"C","start":0.741,"dur":2.129},{"chord":"F","start":2.87,"dur":2.778},{"chord":"G","start":5.648,"dur":2.871},{"chord":"C","start":8.519,"dur":3.981}]},"Essentia":"{\"LUFS\": -24.84,\"BPM\": 79.57,\"Beats\": 16}"})

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
}

function onFileRemoved() {
  selectedFile.value = null
  analysisResult.value = null
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
    analysisResult.value = result
    console.log(result)
  } catch (err) {
    clearInterval(interval)
    console.error('Analysis failed:', err)
    progressLabel.value = '分析失敗，請重試'
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
      />

      <AnalyzeButton
        :disabled="!selectedFile || isAnalyzing"
        :is-analyzing="isAnalyzing"
        @click="onAnalyze"
      />

      <ProgressBar
        v-if="isAnalyzing"
        :progress="progress"
        :label="progressLabel"
      />

      <ResultsPanel v-if="analysisResult" :data="analysisResult" :audio-file="selectedFile" />
      <!-- <ResultsPanel :data="analysisResult" /> -->
    </div>
  </div>
</template>

<style scoped>
.app-wrapper {
  min-height: 100vh;
  padding: 1.5rem 1rem 4rem;
}

.app {
  max-width: 780px;
  margin: 0 auto;
}
</style>
