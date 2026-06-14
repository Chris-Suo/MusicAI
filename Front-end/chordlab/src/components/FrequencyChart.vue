<script setup>
import { computed, onMounted, ref } from 'vue'
import SectionLabel from '@/components/SectionLabel.vue'
import { CHORD_COLORS } from '@/utils/chordData.js'

const props = defineProps({
  timeline: {
    type: Array,
    required: true,
  },
  totalDuration: {
    type: Number,
    required: true,
  },
})

const animated = ref(false)

onMounted(() => {
  setTimeout(() => (animated.value = true), 50)
})

const colorMap = computed(() => {
  const unique = [...new Set(props.timeline.map((t) => t.chord))]
  const map = {}
  unique.forEach((c, i) => (map[c] = CHORD_COLORS[i % CHORD_COLORS.length]))
  return map
})

const sortedChords = computed(() => {
  const counts = {}
  props.timeline.forEach((t) => {
    counts[t.chord] = (counts[t.chord] ?? 0) + t.dur
  })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([chord, dur]) => ({
      chord,
      dur,
      pct: ((dur / props.totalDuration) * 100).toFixed(1),
      barPct: (dur / Math.max(...Object.values(counts))) * 100,
    }))
})
</script>

<template>
  <div class="section">
    <SectionLabel>使用頻率統計</SectionLabel>
    <div class="wrap">
      <div class="chart">
        <div v-for="item in sortedChords" :key="item.chord" class="bar-row">
          <div class="bar-label" :style="{ color: colorMap[item.chord] }">{{ item.chord }}</div>
          <div class="bar-track">
            <div
              class="bar-fill"
              :style="{
                width: animated ? item.barPct + '%' : '0%',
                background: colorMap[item.chord] + '33',
                borderRight: '2px solid ' + colorMap[item.chord],
                color: colorMap[item.chord],
              }"
            >
              {{ item.dur.toFixed(1) }}s
            </div>
          </div>
          <div class="bar-pct">{{ item.pct }}%</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section {
  margin-bottom: 2rem;
}

.wrap {
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
}

.chart {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bar-label {
  font-family: var(--font-mono);
  font-size: 12px;
  width: 52px;
  text-align: right;
  flex-shrink: 0;
}

.bar-track {
  flex: 1;
  height: 24px;
  background: var(--surface2);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
  display: flex;
  align-items: center;
  padding-left: 8px;
  font-size: 11px;
  font-family: var(--font-mono);
  font-weight: 700;
  transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}

.bar-pct {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--muted);
  width: 42px;
  flex-shrink: 0;
}
</style>
