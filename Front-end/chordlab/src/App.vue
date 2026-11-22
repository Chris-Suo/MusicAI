<script setup>
/**
 * 流程：選檔（拖放或點選）→ 自動開始分析 → 顯示結果
 * 結果上方的播放器（和分析失敗時）有「返回」，回到上傳頁選新的音檔或分析結果
 *   結果頁按返回時先問要不要下載分析結果（從分析結果檔載入的不問，內容跟檔案一樣）
 *
 * 分析結果檔（.json，見 utils/resultFile.js）：
 * - 結果頁可以「下載結果」；上傳頁選 .json 就直接載入，不重新分析
 * - 載入的結果沒有音檔，播放器會出現「選擇音檔播放」，選了只拿來播放
 */
import { ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import UploadZone from '@/components/UploadZone.vue'
import AnalysisStatus from '@/components/AnalysisStatus.vue'
import ResultsPanel from '@/components/ResultsPanel.vue'
import ConfirmBackDialog from '@/components/ConfirmBackDialog.vue'
import FilePickButton from '@/components/common/FilePickButton.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import { analyzeAudio, checkUpload, UploadRejectedError } from '@/utils/api.js'
import { isResultFile, readResultFile, downloadResult } from '@/utils/resultFile.js'

// 音檔（載入分析結果時可能沒有）與顯示的檔名
const audioFile = ref(null)
const sourceName = ref('')
// 從分析結果檔載入時：檔案裡記錄的儲存時間（ISO 字串；沒有記錄時是空字串）；不是載入的是 null
const loadedSavedAt = ref(null)
const analysisResult = ref(null)
const failed = ref(false)
// 失敗原因（後端拒絕檔案時才有）
const errorText = ref('')
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

async function onFileSelected(file) {
  if (isResultFile(file)) {
    loadResult(file)
    return
  }
  if (!isWav(file)) {
    alert('請上傳 .wav 格式的音訊檔案，或之前下載的分析結果（.json）')
    return
  }
  const problem = await checkUpload(file)
  if (problem) {
    alert(problem)
    return
  }
  audioFile.value = file
  sourceName.value = file.name
  loadedSavedAt.value = null
  analyze()
}

/** 載入之前下載的分析結果：不分析，直接顯示 */
async function loadResult(file) {
  let saved
  try {
    saved = await readResultFile(file)
  } catch (err) {
    alert(err.message)
    return
  }
  audioFile.value = null
  sourceName.value = saved.fileName
  loadedSavedAt.value = saved.savedAt ?? ''
  failed.value = false
  resultKey.value++
  analysisResult.value = saved.data
}

/** 載入的分析結果補上音檔：只拿來播放，不重新分析 */
function onAttachAudio(file) {
  if (!isWav(file)) {
    alert('請選擇 .wav 格式的音訊檔案')
    return
  }
  audioFile.value = file
}

// 返回前的確認對話框
const confirmBack = ref(false)

/** 結果頁按返回：剛分析完的結果先問要不要下載；從檔案載入的直接返回 */
function requestBack() {
  if (loadedSavedAt.value !== null) goBack()
  else confirmBack.value = true
}

function downloadAndBack() {
  onDownload()
  confirmBack.value = false
  goBack()
}

function leaveWithoutDownload() {
  confirmBack.value = false
  goBack()
}

/** 返回上傳頁：清掉目前的檔案與結果（結果區卸載時播放器會一起停止） */
function goBack() {
  audioFile.value = null
  sourceName.value = ''
  loadedSavedAt.value = null
  analysisResult.value = null
  failed.value = false
  errorText.value = ''
}

function onDownload() {
  if (analysisResult.value) downloadResult(analysisResult.value, sourceName.value)
}

async function analyze() {
  failed.value = false
  errorText.value = ''
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
    result = await analyzeAudio(audioFile.value)
  } catch (err) {
    console.error('[ChordLab] 分析失敗：', err)
    failed.value = true
    if (err instanceof UploadRejectedError) errorText.value = err.message
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

      <template v-if="!sourceName">
        <UploadZone @file-selected="onFileSelected" />
        <div class="load-saved">
          <span class="load-text">已經分析過了？</span>
          <FilePickButton accept=".json,application/json" @pick="onFileSelected">
            <AppIcon name="upload" :size="16" />載入之前的分析結果
          </FilePickButton>
          <!-- <span class="load-hint">選擇結果頁「下載結果」存下來的 .json 檔，不用重新分析</span> -->
        </div>
      </template>

      <AnalysisStatus
        v-else-if="!analysisResult"
        :file-name="sourceName"
        :progress="progress"
        :label="progressLabel"
        :failed="failed"
        :error-text="errorText"
        @retry="analyze"
        @back="goBack"
      />

      <ResultsPanel
        v-else
        :key="resultKey"
        :data="analysisResult"
        :audio-file="audioFile"
        :file-name="sourceName"
        :loaded-saved-at="loadedSavedAt"
        @back="requestBack"
        @attach-audio="onAttachAudio"
        @download="onDownload"
      />

      <ConfirmBackDialog
        :open="confirmBack"
        :file-name="sourceName"
        @download="downloadAndBack"
        @leave="leaveWithoutDownload"
        @cancel="confirmBack = false"
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

/* 上傳區下方：載入之前的分析結果 */
.load-saved {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px 12px;
  margin-top: 1rem;
}

.load-text {
  font-weight: 600;
  color: var(--text2);
}

.load-hint {
  flex-basis: 100%;
  text-align: center;
  font-size: 0.85rem;
  color: var(--muted);
}
</style>
