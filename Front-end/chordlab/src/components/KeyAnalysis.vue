<script setup>
import { computed } from 'vue'
import SectionLabel from '@/components/SectionLabel.vue'
import { CHORD_COLORS, ROMAN_NUMERALS } from '@/utils/chordData.js'

const props = defineProps({
  timeline: {
    type: Array,
    required: true,
  },
  keyName: {
    type: String,
    default: '—',
  },
})

const colorMap = computed(() => {
  const unique = [...new Set(props.timeline.map((t) => t.chord))]
  const map = {}
  unique.forEach((c, i) => (map[c] = CHORD_COLORS[i % CHORD_COLORS.length]))
  return map
})

const uniqueChords = computed(() => {
  const seen = new Set()
  return props.timeline
    .filter((t) => {
      if (seen.has(t.chord)) return false
      seen.add(t.chord)
      return true
    })
    .map((t) => t.chord)
    .filter((c) => ROMAN_NUMERALS[c])
})
</script>

<template>
  <div class="section">
    <SectionLabel>調性分析</SectionLabel>
    <div class="wrap">
      <div class="sub-text">以羅馬數字表示的和弦進行功能</div>
      <div class="chips">
        <div v-for="chord in uniqueChords" :key="chord" class="chip">
          <div class="roman" :style="{ color: colorMap[chord] }">
            {{ ROMAN_NUMERALS[chord] }}
          </div>
          <div class="chord-name">{{ chord }}</div>
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

.sub-text {
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 1rem;
}

.chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chip {
  background: var(--surface2);
  border: 0.5px solid var(--border);
  border-radius: 8px;
  padding: 8px 16px;
  text-align: center;
  min-width: 56px;
}

.roman {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 700;
}

.chord-name {
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
}
</style>
