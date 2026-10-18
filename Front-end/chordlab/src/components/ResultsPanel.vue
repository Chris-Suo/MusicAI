<script setup>
import StatsGrid from '@/components/StatsGrid.vue'
import ChordTimeline from '@/components/ChordTimeline.vue'
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
})

const uniqueChords = computed(() => [...new Set(props.data.BTC.timeline.map((t) => t.chord))])

const totalDuration = computed(() => {
  const last = props.data.BTC.timeline[props.data.BTC.timeline.length - 1]
  return last ? last.start + last.dur : 0
})
</script>

<template>
  <div class="results">
    <StatsGrid
      :key-name="data.BTC.key"
      :chord-count="data.BTC.timeline.length"
      :unique-count="uniqueChords.length"
      :tuning="data.BTC.tuning" 
    />

    <KeyMoodCard :key-name="data.BTC.key" />
    <ChordTimeline :timeline="data.BTC.timeline" :total-duration="totalDuration" />

    <FrequencyChart :timeline="data.BTC.timeline" :total-duration="totalDuration" />

    <KeyAnalysis :timeline="data.BTC.timeline" :key-name="data.BTC.key" />
    <PitchAnalysis :essentiaResult="data.Essentia" />
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
