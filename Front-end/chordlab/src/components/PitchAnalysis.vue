<script setup>
import { computed } from 'vue'
import SectionLabel from '@/components/SectionLabel.vue'
// import image from '../assets/fig.png'
// import { CHORD_COLORS, ROMAN_NUMERALS } from '@/utils/chordData.js'

const props = defineProps({
  essentiaResult: {
    type: Object,
    default: null,
  },
})

const imageSrc = computed(() => {
  if (!props.essentiaResult?.image_base64) return null
  const mime = props.essentiaResult.image_mime || 'image/png'
  return `data:${mime};base64,${props.essentiaResult.image_base64}`
})

const essentia = computed(() => props.essentiaResult?.essentia ?? null)

</script>

<template>
  <div class="section">
    <SectionLabel>音高分析</SectionLabel>
    <div class="wrap">
      <!-- <img :src="image" width="100%"> -->
      <img v-if="imageSrc" :src="imageSrc" width="100%" alt="Pitch Contour" />
      <p v-else class="sub-text">尚無音高分析結果</p>

      <div v-if="essentia" class="chips">
        <div class="chip">
          <div class="roman">{{ essentia.BPM ?? '—' }}</div>
          <div class="chord-name">BPM</div>
        </div>
        <div class="chip">
          <div class="roman">{{ essentia.LUFS ?? '—' }}</div>
          <div class="chord-name">LUFS</div>
        </div>
        <div class="chip">
          <div class="roman">{{ essentia.Beats ?? '—' }}</div>
          <div class="chord-name">Beats</div>
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
