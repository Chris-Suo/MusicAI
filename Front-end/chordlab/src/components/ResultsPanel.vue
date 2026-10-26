<script setup>
import StatsGrid from '@/components/StatsGrid.vue'
import ChordTimeline from '@/components/ChordTimeline.vue'
import BeatTimeline from '@/components/BeatTimeline.vue'
import FrequencyChart from '@/components/FrequencyChart.vue'
import KeyAnalysis from '@/components/KeyAnalysis.vue'
import KeyMoodCard    from '@/components/KeyMoodCard.vue'
import { computed } from 'vue'
import PitchAnalysis from './PitchAnalysis.vue'
import LoudnessTempoBeatAnalysis from './LoudnessTempoBeatAnalysis.vue'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
  // 使用者上傳的音檔，節拍時間軸用來播放對照
  audioFile: {
    type: Object,
    default: null,
  },
})

const uniqueChords = computed(() => [...new Set(props.data.BTC.timeline.map((t) => t.chord))])

// 調性改由 Essentia 提供：data.Essentia.essentia.Key / KeyStrength
const essentia = computed(() => props.data.Essentia?.essentia ?? {})
const keyName = computed(() => essentia.value.Key || '')
const keyConfidence = computed(() => essentia.value.KeyStrength ?? null)

const totalDuration = computed(() => {
  const last = props.data.BTC.timeline[props.data.BTC.timeline.length - 1]
  return last ? last.start + last.dur : 0
})
</script>

<template>
  <div class="results">
    <StatsGrid
      :key-name="keyName"
      :key-confidence="keyConfidence"
      :chord-count="data.BTC.timeline.length"
      :unique-count="uniqueChords.length"
      :tuning="data.BTC.tuning" 
    />

    <KeyMoodCard :key-name="keyName" />
    <ChordTimeline :timeline="data.BTC.timeline" :total-duration="totalDuration" />

    <FrequencyChart :timeline="data.BTC.timeline" :total-duration="totalDuration" />

    <KeyAnalysis :timeline="data.BTC.timeline" :key-name="keyName" />
    <PitchAnalysis :essentiaResult="data.Essentia" />
    <BeatTimeline
      :beats="essentia.Beats ?? []"
      :bpm="essentia.BPM ?? null"
      :duration="totalDuration"
      :chords="data.BTC.timeline"
      :audio-file="audioFile"
    />

    <!-- <LoudnessTempoBeatAnalysis :edata="data.Essentia" /> -->
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
</style>
