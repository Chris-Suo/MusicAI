<script setup>
import StatsGrid from '@/components/StatsGrid.vue'
import ChordTimeline from '@/components/ChordTimeline.vue'
import FrequencyChart from '@/components/FrequencyChart.vue'
import KeyAnalysis from '@/components/KeyAnalysis.vue'
import KeyMoodCard    from '@/components/KeyMoodCard.vue'
import { computed } from 'vue'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
})

const uniqueChords = computed(() => [...new Set(props.data.timeline.map((t) => t.chord))])

const totalDuration = computed(() => {
  const last = props.data.timeline[props.data.timeline.length - 1]
  return last ? last.start + last.dur : 0
})
</script>

<template>
  <div class="results">
    <StatsGrid
      :key-name="data.key"
      :chord-count="data.timeline.length"
      :unique-count="uniqueChords.length"
      :tuning="data.tuning" 
    />

    <KeyMoodCard :key-name="data.key" />
    <ChordTimeline :timeline="data.timeline" :total-duration="totalDuration" />

    <FrequencyChart :timeline="data.timeline" :total-duration="totalDuration" />

    <KeyAnalysis :timeline="data.timeline" :key-name="data.key" />
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
