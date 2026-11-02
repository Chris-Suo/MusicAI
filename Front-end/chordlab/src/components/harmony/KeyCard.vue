<script setup>
/**
 * 調性卡：調名、信心度、音階，以及調性情緒與常見情境
 */
import { computed } from 'vue'
import { lookupKeyMood } from '@/utils/keyMoodData.js'
import { scaleNotes, keyNameZh } from '@/utils/music.js'

const props = defineProps({
  keyInfo: { type: Object, default: null },
  // Essentia KeyExtractor 的 strength（0～1）；推估的調沒有
  confidence: { type: Number, default: null },
})

const mood = computed(() => lookupKeyMood(props.keyInfo?.name))
const scale = computed(() => scaleNotes(props.keyInfo))

const meta = computed(() => {
  if (props.keyInfo?.estimated) return 'Essentia 沒有給調性，依和弦推估'
  const s = props.confidence
  if (s === null || !Number.isFinite(s)) return ''
  const v = Math.min(1, Math.max(0, s))
  return `信心度 ${Math.round(v * 100)}%（${v >= 0.7 ? '高' : v >= 0.45 ? '中' : '低'}）`
})
</script>

<template>
  <div class="card">
    <div class="card-head">
      <h3 class="card-title">調性</h3>
    </div>

    <div v-if="!keyInfo" class="note">無法判斷調性</div>
    <template v-else>
      <div class="key-main">
        <span class="key-name">{{ keyInfo.name }}</span>
        <span class="key-zh">{{ keyNameZh(keyInfo) }}</span>
      </div>
      <p v-if="meta" class="meta">{{ meta }}</p>

      <div class="sub-title">音階</div>
      <div class="scale">
        <span v-for="(n, i) in scale" :key="i" class="note-pill" :class="{ tonic: i === 0 }">{{ n }}</span>
      </div>

      <template v-if="mood">
        <div class="sub-title">情緒與情境</div>
        <p class="mood" :title="`${mood.mood}（Schubart，1806）`">{{ mood.moodZh }}</p>
        <div class="tags">
          <span v-for="(s, i) in mood.scene.split('、')" :key="i" class="pill">{{ s.trim() }}</span>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.key-main {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 14px;
}

.key-name {
  font-size: 2.6rem;
  font-weight: 700;
  line-height: 1.15;
}

.key-zh {
  font-size: 1.15rem;
  color: var(--text2);
}

.meta {
  margin-top: 0.25rem;
  font-size: 0.9rem;
  color: var(--muted);
}

.scale {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.note-pill {
  min-width: 40px;
  text-align: center;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--surface2);
  border: 1px solid var(--border);
  font-weight: 700;
}

.note-pill.tonic {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}

.mood {
  font-size: 1.05rem;
  font-weight: 500;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 0.5rem;
}
</style>
