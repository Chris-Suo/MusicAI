<script setup>
/**
 * 分析結果的版面
 * - 上方：共用播放器（固定在畫面上方，含換檔案）
 * - 下方四個分頁：和弦調性／音高頻率／速度節拍／總樂性元，分頁上顯示各自的重點數字
 *   調音基準放在「音高頻率」（它是頻率的基準），調性情緒與情境放在「和弦調性」，
 *   音量（響度）放在「速度節拍」（速度和力度都是樂曲的表情要素）
 * 資料整理在 utils/analysis.js，這裡只負責排版與播放器
 */
import { computed, ref, provide, toRef, watch, onBeforeUnmount } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'
import TabBar from '@/components/common/TabBar.vue'
import PlayerBar from '@/components/PlayerBar.vue'
import KeyCard from '@/components/harmony/KeyCard.vue'
import ChordShare from '@/components/harmony/ChordShare.vue'
import KeyAnalysis from '@/components/harmony/KeyAnalysis.vue'
import ChordEmotionMap from '@/components/harmony/ChordEmotionMap.vue'
import TuningCard from '@/components/pitch/TuningCard.vue'
import PitchRange from '@/components/pitch/PitchRange.vue'
import PitchShare from '@/components/pitch/PitchShare.vue'
import PitchHzShare from '@/components/pitch/PitchHzShare.vue'
import PitchEmotionMap from '@/components/pitch/PitchEmotionMap.vue'
import PitchContour from '@/components/pitch/PitchContour.vue'
import TempoCard from '@/components/rhythm/TempoCard.vue'
import TempoShare from '@/components/rhythm/TempoShare.vue'
import BeatTimeline from '@/components/rhythm/BeatTimeline.vue'
import LoudnessCard from '@/components/rhythm/LoudnessCard.vue'
import TempoEmotionMap from '@/components/rhythm/TempoEmotionMap.vue'
// 三維位置先隱藏（2026-11-20），要恢復時把這行和下面 <MusicSpace3D> 的註解拿掉
// import MusicSpace3D from '@/components/overall/MusicSpace3D.vue'
import OverallScore from '@/components/overall/OverallScore.vue'
import { createPlayback, PLAYBACK_KEY } from '@/composables/usePlayback.js'
import { buildAnalysis } from '@/utils/analysis.js'
import { overallPoint } from '@/utils/overall.js'
import { loadSetting, saveSetting } from '@/utils/storage.js'

const props = defineProps({
  // api.js analyzeAudio() 的結果
  data: { type: Object, required: true },
  // 使用者上傳的音檔，播放器用來播放對照
  audioFile: { type: Object, default: null },
  fileName: { type: String, default: '' },
  // 從分析結果檔載入時：檔案記錄的儲存時間（ISO；沒有記錄時是空字串）；不是載入的是 null
  loadedSavedAt: { type: String, default: null },
})

// 「從檔案載入」提示裡的儲存時間
const savedAtText = computed(() => {
  if (!props.loadedSavedAt) return ''
  const d = new Date(props.loadedSavedAt)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' })
})

// file-selected：換檔案；attach-audio：載入的結果補上音檔；download：下載分析結果
defineEmits(['file-selected', 'attach-audio', 'download'])

const analysis = computed(() => buildAnalysis(props.data))

// ---------------------------------------------------------------------------
// 播放器（全頁共用）
// ---------------------------------------------------------------------------
const playback = createPlayback({ file: toRef(props, 'audioFile') })
provide(PLAYBACK_KEY, playback)
onBeforeUnmount(() => playback.dispose())

// 整首歌長度：音檔和分析資料取長的
const total = computed(() => Math.max(playback.duration.value, analysis.value.length))

// ---------------------------------------------------------------------------
// 分頁（記住上次看的分頁）
// ---------------------------------------------------------------------------
const TAB_KEY = 'chordlab.tab'
const TAB_IDS = ['harmony', 'pitch', 'rhythm', 'overall']

const tab = ref(loadSetting(TAB_KEY, TAB_IDS) ?? 'harmony')
watch(tab, (t) => saveSetting(TAB_KEY, t))

// 總樂性元的最終座標（分頁上顯示；卡片裡的細節由 OverallScore 自己算）
const overallFinal = computed(() => {
  const { timeline, contour, beats, key } = analysis.value
  return overallPoint({ timeline, contour, beats, length: total.value, key }).final
})
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1)

const tabs = computed(() => {
  const { key, tuning, bpm } = analysis.value
  const fin = overallFinal.value
  return [
    { id: 'harmony', icon: 'harmony', title: '和弦調性', sub: key?.name ?? '' },
    { id: 'pitch', icon: 'pitch', title: '音高頻率', sub: tuning.a4 ? `A4 ${tuning.a4.toFixed(1)} Hz` : '' },
    { id: 'rhythm', icon: 'rhythm', title: '速度節拍', sub: bpm ? `${Math.round(bpm)} BPM` : '' },
    { id: 'overall', icon: 'cube', title: '總樂性元', sub: fin ? `(${f1(fin.x)}, ${f1(fin.y)})` : '' },
  ]
})
</script>

<template>
  <div class="results">
    <div v-if="loadedSavedAt !== null" class="banner info" role="status">
      <AppIcon name="file" :size="20" />
      <span>
        這是從檔案載入的分析結果<template v-if="savedAtText">（{{ savedAtText }} 儲存）</template>，沒有重新分析。
        <template v-if="!audioFile">要播放請按播放器的「選擇音檔播放」，選同一首歌的 WAV 檔。</template>
      </span>
    </div>

    <div v-if="analysis.isMock" class="banner" role="status">
      <AppIcon name="alert" :size="20" />
      <span>無法連線到分析伺服器，下面顯示的是<strong>示範資料</strong>，不是這個檔案的分析結果。</span>
    </div>

    <PlayerBar
      :file-name="fileName"
      :total="total"
      :timeline="analysis.timeline"
      :chord-info="analysis.chordInfo"
      :needs-audio="!audioFile"
      @pick="$emit('file-selected', $event)"
      @attach="$emit('attach-audio', $event)"
      @download="$emit('download')"
    />

    <TabBar v-model="tab" :tabs="tabs" label="分析類別" />

    <!-- 每個分頁：上排兩張卡（占比在右上角），下面是時間軸類的大圖 -->
    <section v-show="tab === 'harmony'" id="panel-harmony" class="panel" role="tabpanel" aria-labelledby="tab-harmony">
      <div class="row">
        <KeyCard :key-info="analysis.key" :confidence="analysis.keyConfidence" />
        <ChordShare v-if="analysis.hasChords" :timeline="analysis.timeline" :chord-info="analysis.chordInfo" />
        <div v-else class="card empty-card"><p class="note">整首都沒有偵測到和弦</p></div>
      </div>
      <KeyAnalysis v-if="analysis.hasChords" :timeline="analysis.timeline" :key-info="analysis.key" :beats="analysis.beats" :beats-per-bar="analysis.rhythm.beatsPerBar" />
      <ChordEmotionMap v-if="analysis.hasChords" :timeline="analysis.timeline" :key-info="analysis.key" />
    </section>

    <section v-show="tab === 'pitch'" id="panel-pitch" class="panel" role="tabpanel" aria-labelledby="tab-pitch">
      <div class="row">
        <div class="col">
          <TuningCard :tuning="analysis.tuning" />
          <PitchRange v-if="analysis.pitchStats" :stats="analysis.pitchStats" />
        </div>
        <PitchShare v-if="analysis.pitchStats?.voicedRatio" :stats="analysis.pitchStats" />
      </div>
      <PitchHzShare v-if="analysis.pitchStats?.voicedRatio" :contour="analysis.contour" :stats="analysis.pitchStats" />
      <PitchContour :contour="analysis.contour" :image-src="analysis.pitchImage" :key-info="analysis.key" :total="total" />
      <PitchEmotionMap :contour="analysis.contour" :length="total" :key-info="analysis.key" />
    </section>

    <section v-show="tab === 'rhythm'" id="panel-rhythm" class="panel" role="tabpanel" aria-labelledby="tab-rhythm">
      <div v-if="!analysis.hasRhythm && analysis.lufs === null" class="card"><p class="note">沒有速度、節拍與響度資料（Essentia 沒有回傳）</p></div>
      <div v-if="analysis.hasRhythm" class="row">
        <TempoCard :bpm="analysis.bpm" :rhythm="analysis.rhythm" />
        <TempoShare :rhythm="analysis.rhythm" />
      </div>
      <BeatTimeline v-if="analysis.beats.length" :beats="analysis.beats" :rhythm="analysis.rhythm" :total="total" />
      <LoudnessCard v-if="analysis.lufs !== null" :lufs="analysis.lufs" :curve="analysis.loudnessCurve" :total="total" />
      <TempoEmotionMap v-if="analysis.beats.length" :beats="analysis.beats" :length="total" :key-info="analysis.key" />
    </section>

    <!-- 總樂性元：把和弦、速度等元素合在一起看 -->
    <section v-show="tab === 'overall'" id="panel-overall" class="panel" role="tabpanel" aria-labelledby="tab-overall">
      <!-- 三維位置先隱藏 -->
      <!-- <MusicSpace3D :timeline="analysis.timeline" :bpm="analysis.bpm" /> -->
      <OverallScore :timeline="analysis.timeline" :contour="analysis.contour" :beats="analysis.beats" :length="total" :key-info="analysis.key" />
    </section>
  </div>
</template>

<style scoped>
.results {
  animation: fadeIn 0.4s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface);
  border: 2px solid var(--warning);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  font-size: 0.95rem;
}

.banner :deep(.icon) {
  color: var(--warning);
}

/* 從檔案載入的提示：一般資訊，用主色 */
.banner.info {
  border-color: var(--accent);
}

.banner.info :deep(.icon) {
  color: var(--accent);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* 上排兩張卡，窄螢幕時上下疊 */
.row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
  gap: 1.25rem;
  align-items: stretch;
}

/* 一格裡疊兩張卡 */
.col {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.empty-card {
  align-self: start;
}
</style>
