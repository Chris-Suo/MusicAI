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
const analysisResult = ref(null)
const failed = ref(false)
const progress = ref(0)
const progressLabel = ref('')
// 每次分析完換一個 key，讓結果區（含播放器）整個重建
const resultKey = ref(0)

// 後端不回報進度，等待時每 0.5 秒走一步，走到 90% 停住等結果
const PROGRESS_STEPS = ['正在解析音訊波形...', '提取頻率特徵...', '辨識和弦進行...', '計算統計數據...', '整理分析結果...']
const STEP_MS = 500
const STEP_PCT = 18

const isWav = (file) => file.name.toLowerCase().endsWith('.wav') || file.type === 'audio/wav'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function onFileSelected(file) {
  if (!isWav(file)) {
    alert('請上傳 .wav 格式的音訊檔案')
    return
  }
  selectedFile.value = file
  analyze()
}

async function analyze() {
  failed.value = false
  analysisResult.value = null
  progress.value = 0
  progressLabel.value = PROGRESS_STEPS[0]

  let step = 0
  const timer = setInterval(() => {
    step++
    progress.value = step * STEP_PCT
    progressLabel.value = PROGRESS_STEPS[Math.min(step, PROGRESS_STEPS.length - 1)]
    if (step >= PROGRESS_STEPS.length) clearInterval(timer)
  }, STEP_MS)

  let result
  try {
    result = await analyzeAudio(selectedFile.value)
  } catch (err) {
    console.error('[ChordLab] 分析失敗：', err)
    failed.value = true
    return
  } finally {
    clearInterval(timer)
  }

  progress.value = 100
  await sleep(300) // 讓使用者看到進度條走滿
  resultKey.value++
  analysisResult.value = result
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
