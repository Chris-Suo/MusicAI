<script setup>
/**
 * 分析結果
 * - 上方：歌曲總覽（四個重點數字）＋ 共用播放器（固定在畫面上方）
 * - 下方三個分頁：和弦調性／音高頻率／速度節拍
 *   調音基準放在「音高頻率」（它是頻率的基準），調性情緒與情境放在「和弦調性」，
 *   音量（響度）放在「速度節拍」（速度和力度都是樂曲的表情要素）
 */
import { computed, ref, provide, toRef, watch, onBeforeUnmount } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'
import SongOverview from '@/components/SongOverview.vue'
import PlayerBar from '@/components/PlayerBar.vue'
import KeyCard from '@/components/harmony/KeyCard.vue'
import ChordShare from '@/components/harmony/ChordShare.vue'
import ChordTimeline from '@/components/harmony/ChordTimeline.vue'
import KeyAnalysis from '@/components/harmony/KeyAnalysis.vue'
import TuningCard from '@/components/pitch/TuningCard.vue'
import PitchRange from '@/components/pitch/PitchRange.vue'
import PitchContour from '@/components/pitch/PitchContour.vue'
import PitchShare from '@/components/pitch/PitchShare.vue'
import TempoCard from '@/components/rhythm/TempoCard.vue'
import TempoShare from '@/components/rhythm/TempoShare.vue'
import BeatTimeline from '@/components/rhythm/BeatTimeline.vue'
import LoudnessCard from '@/components/rhythm/LoudnessCard.vue'
import { createPlayback, PLAYBACK_KEY } from '@/composables/usePlayback.js'
import { parseKey, estimateKey } from '@/utils/progression.js'
import { buildChordInfo, a4FromCents, conventionalKey } from '@/utils/music.js'
import { median } from '@/utils/stats.js'
import { normalizeContour, analyzePitch } from '@/utils/pitch.js'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
  // 使用者上傳的音檔，播放器用來播放對照
  audioFile: {
    type: Object,
    default: null,
  },
  fileName: {
    type: String,
    default: '',
  },
})

const BEATS_PER_BAR = 4

// ---------------------------------------------------------------------------
// 資料整理
// ---------------------------------------------------------------------------
const timeline = computed(() => props.data.BTC?.timeline ?? [])
const tuning = computed(() => props.data.BTC?.tuning ?? null)
const a4 = computed(() => a4FromCents(tuning.value?.tuning_offset_cents))
const essentia = computed(() => props.data.Essentia?.essentia ?? {})

// 調性由 Essentia 提供；沒有時用和弦推估。調名統一成常見寫法（例如 Ab minor → G# minor）
const keyInfo = computed(() => conventionalKey(parseKey(essentia.value.Key) ?? estimateKey(timeline.value)))
const keyConfidence = computed(() => (keyInfo.value?.estimated ? null : (essentia.value.KeyStrength ?? null)))

const chordInfo = computed(() => buildChordInfo(timeline.value, keyInfo.value))
const chordKinds = computed(() => [...chordInfo.value.keys()].filter((c) => c !== 'N' && c !== 'X').length)

const beats = computed(() =>
  Array.isArray(essentia.value.Beats) ? essentia.value.Beats.filter(Number.isFinite).sort((a, b) => a - b) : [],
)

const rhythm = computed(() => {
  const b = beats.value
  const intervals = b.slice(1).map((t, i) => t - b[i])
  const med = median(intervals)
  let jitterMs = null
  let cv = null
  if (intervals.length >= 2) {
    const mean = intervals.reduce((a, v) => a + v, 0) / intervals.length
    const sd = Math.sqrt(intervals.reduce((a, v) => a + (v - mean) ** 2, 0) / intervals.length)
    jitterMs = sd * 1000
    cv = sd / mean
  }
  return {
    count: b.length,
    intervals,
    medianInterval: med,
    beatBpm: med ? 60 / med : null,
    jitterMs,
    cv,
    barCount: Math.ceil(b.length / BEATS_PER_BAR),
    beatsPerBar: BEATS_PER_BAR,
  }
})

const bpm = computed(() => (Number.isFinite(essentia.value.BPM) ? essentia.value.BPM : rhythm.value.beatBpm))

const contour = computed(() => normalizeContour(essentia.value.PitchContour))
const pitchStats = computed(() => (contour.value ? analyzePitch(contour.value, keyInfo.value) : null))
const pitchImage = computed(() => {
  const e = props.data.Essentia
  return e?.image_base64 ? `data:${e.image_mime || 'image/png'};base64,${e.image_base64}` : null
})

const loudnessCurve = computed(() => {
  const c = essentia.value.LoudnessCurve
  return c && Array.isArray(c.lufs) && c.hop > 0 ? { hop: c.hop, lufs: c.lufs.map((v) => (Number.isFinite(v) ? v : -70)) } : null
})

// ---------------------------------------------------------------------------
// 播放器（全頁共用）
// ---------------------------------------------------------------------------
const playback = createPlayback({ file: toRef(props, 'audioFile'), beats, beatsPerBar: BEATS_PER_BAR })
provide(PLAYBACK_KEY, playback)
onBeforeUnmount(() => playback.dispose())

// 整首歌長度：取音檔、和弦、拍點、音高資料中最長的
const total = computed(() => {
  const tl = timeline.value
  const last = tl.length ? tl[tl.length - 1].start + tl[tl.length - 1].dur : 0
  const lastBeat = beats.value.length ? beats.value[beats.value.length - 1] + 0.5 : 0
  const pitchLen = contour.value ? contour.value.midi.length * contour.value.hop : 0
  return Math.max(playback.duration.value, last, lastBeat, pitchLen, 1)
})

// ---------------------------------------------------------------------------
// 分頁
// ---------------------------------------------------------------------------
const TAB_KEY = 'chordlab.tab'
function savedTab() {
  try {
    return localStorage.getItem(TAB_KEY)
  } catch {
    return null
  }
}

const tabs = computed(() => [
  {
    id: 'harmony',
    icon: 'harmony',
    title: '和弦調性',
    sub: [keyInfo.value?.name, chordKinds.value ? `${chordKinds.value} 種和弦` : null].filter(Boolean).join('・'),
  },
  {
    id: 'pitch',
    icon: 'pitch',
    title: '音高頻率',
    sub: [
      a4.value ? `A4 ${a4.value.toFixed(1)} Hz` : null,
      pitchStats.value?.low ? `${pitchStats.value.low.name}–${pitchStats.value.high.name}` : null,
    ].filter(Boolean).join('・'),
  },
  {
    id: 'rhythm',
    icon: 'rhythm',
    title: '速度節拍',
    sub: [bpm.value ? `${Math.round(bpm.value)} BPM` : null, Number.isFinite(essentia.value.LUFS) ? `${essentia.value.LUFS} LUFS` : null]
      .filter(Boolean)
      .join('・'),
  },
])

const tab = ref(['harmony', 'pitch', 'rhythm'].includes(savedTab()) ? savedTab() : 'harmony')
watch(tab, (t) => {
  try {
    localStorage.setItem(TAB_KEY, t)
  } catch {
    // 存不了就算了
  }
})

const tabsEl = ref(null)
function openTab(id) {
  tab.value = id
  tabsEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function onTabKey(e) {
  const ids = tabs.value.map((t) => t.id)
  const i = ids.indexOf(tab.value)
  let next = null
  if (e.key === 'ArrowRight') next = ids[(i + 1) % ids.length]
  else if (e.key === 'ArrowLeft') next = ids[(i - 1 + ids.length) % ids.length]
  else if (e.key === 'Home') next = ids[0]
  else if (e.key === 'End') next = ids[ids.length - 1]
  if (!next) return
  e.preventDefault()
  tab.value = next
  document.getElementById('tab-' + next)?.focus()
}

// 和弦進行分析中選到的段落，同步標示在和弦時間軸與節拍時間軸上
const progressionHighlights = ref([])
</script>

<template>
  <div class="results">
    <div v-if="data._mock" class="banner" role="status">
      <AppIcon name="alert" :size="20" />
      <span>無法連線到分析伺服器，下面顯示的是<strong>示範資料</strong>，不是這個檔案的分析結果。</span>
    </div>

    <SongOverview
      :file-name="fileName"
      :total="total"
      :key-info="keyInfo"
      :key-confidence="keyConfidence"
      :bpm="bpm"
      :bar-count="rhythm.barCount"
      :tuning="tuning"
      :lufs="essentia.LUFS ?? null"
      @open="openTab"
    />

    <PlayerBar
      :total="total"
      :timeline="timeline"
      :chord-info="chordInfo"
      :contour="contour"
      :key-info="keyInfo"
      :has-beats="beats.length > 0"
    />

    <div ref="tabsEl" class="tabs" role="tablist" aria-label="分析類別">
      <button
        v-for="t in tabs"
        :id="'tab-' + t.id"
        :key="t.id"
        type="button"
        role="tab"
        class="tab"
        :class="{ on: tab === t.id }"
        :aria-selected="tab === t.id"
        :aria-controls="'panel-' + t.id"
        :tabindex="tab === t.id ? 0 : -1"
        @click="tab = t.id"
        @keydown="onTabKey"
      >
        <span class="tab-icon"><AppIcon :name="t.icon" :size="24" /></span>
        <span class="tab-text">
          <span class="tab-title">{{ t.title }}</span>
          <span class="tab-sub">{{ t.sub || '—' }}</span>
        </span>
      </button>
    </div>

    <!-- 和弦調性 -->
    <section v-show="tab === 'harmony'" id="panel-harmony" class="panel" role="tabpanel" aria-labelledby="tab-harmony">
      <div class="row">
        <KeyCard :key-info="keyInfo" :confidence="keyConfidence" />
        <ChordShare :timeline="timeline" :chord-info="chordInfo" />
      </div>
      <ChordTimeline
        :timeline="timeline"
        :chord-info="chordInfo"
        :beats="beats"
        :beats-per-bar="rhythm.beatsPerBar"
        :total="total"
        :highlights="progressionHighlights"
      />
      <KeyAnalysis
        :timeline="timeline"
        :key-name="keyInfo?.name ?? ''"
        :key-estimated="!!keyInfo?.estimated"
        :beats="beats"
        :beats-per-bar="rhythm.beatsPerBar"
        @highlight="progressionHighlights = $event"
      />
    </section>

    <!-- 音高頻率 -->
    <section v-show="tab === 'pitch'" id="panel-pitch" class="panel" role="tabpanel" aria-labelledby="tab-pitch">
      <div class="row">
        <TuningCard :tuning="tuning" />
        <PitchRange :stats="pitchStats" />
      </div>
      <PitchContour
        :contour="contour"
        :image-src="pitchImage"
        :timeline="timeline"
        :chord-info="chordInfo"
        :key-info="keyInfo"
        :total="total"
      />
      <PitchShare v-if="pitchStats && pitchStats.voicedRatio > 0" :stats="pitchStats" :key-info="keyInfo" />
    </section>

    <!-- 速度節拍 -->
    <section v-show="tab === 'rhythm'" id="panel-rhythm" class="panel" role="tabpanel" aria-labelledby="tab-rhythm">
      <div class="row">
        <TempoCard :bpm="bpm" :rhythm="rhythm" />
        <TempoShare :beats="beats" :rhythm="rhythm" />
      </div>
      <BeatTimeline
        :beats="beats"
        :rhythm="rhythm"
        :chords="timeline"
        :chord-info="chordInfo"
        :total="total"
        :highlights="progressionHighlights"
      />
      <LoudnessCard
        :lufs="essentia.LUFS ?? null"
        :loudness-range="essentia.LoudnessRange ?? null"
        :curve="loudnessCurve"
        :total="total"
      />
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

/* 分頁 */
.tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 1.5rem 0 1.25rem;
  scroll-margin-top: 96px;
}

.tab {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 0.85rem 1rem;
  color: var(--text);
  transition: border-color 0.15s, background 0.15s;
  min-width: 0;
}

.tab:hover {
  border-color: var(--border-strong);
}

.tab.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: inset 0 -4px 0 var(--accent);
}

.tab-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--surface2);
  color: var(--text2);
  flex-shrink: 0;
}

.tab.on .tab-icon {
  background: var(--accent);
  color: var(--on-accent);
}

.tab-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tab-title {
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.3;
}

.tab-sub {
  font-size: 0.85rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
  gap: 1.25rem;
  align-items: stretch;
}

@media (max-width: 640px) {
  .tabs {
    gap: 6px;
  }

  .tab {
    flex-direction: column;
    text-align: center;
    padding: 0.6rem 0.4rem;
    gap: 4px;
  }

  .tab-icon {
    width: 36px;
    height: 36px;
  }

  .tab-title {
    font-size: 0.95rem;
  }

  .tab-sub {
    display: none;
  }
}
</style>
