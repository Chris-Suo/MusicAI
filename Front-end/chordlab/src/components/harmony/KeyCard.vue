<script setup>
/**
 * 調性卡：調名、信心度、音階、順階和弦，以及調性情緒與常見情境
 */
import { computed } from 'vue'
import { lookupKeyMood } from '@/utils/keyMoodData.js'
import { scaleNotes, relativeKeyName, diatonicChords, keyNameZh } from '@/utils/music.js'

const props = defineProps({
  keyInfo: { type: Object, default: null },
  // Essentia KeyExtractor 的 strength（0～1）；推估的調沒有
  confidence: { type: Number, default: null },
})

const mood = computed(() => lookupKeyMood(props.keyInfo?.name))
const scale = computed(() => scaleNotes(props.keyInfo))
const chords = computed(() => diatonicChords(props.keyInfo))

const conf = computed(() => {
  const s = props.confidence
  if (s === null || !Number.isFinite(s)) return null
  const v = Math.min(1, Math.max(0, s))
  return { pct: Math.round(v * 100), level: v >= 0.7 ? '高' : v >= 0.45 ? '中' : '低' }
})
</script>

<template>
  <div class="card key-card">
    <div class="card-head">
      <div>
        <h3 class="card-title">調性</h3>
        <p class="card-desc">{{ keyInfo?.estimated ? 'Essentia 沒有給調性，依和弦出現時間推估' : '由 Essentia 分析整首歌的音高分布' }}</p>
      </div>
    </div>

    <div v-if="!keyInfo" class="note">無法判斷調性</div>
    <template v-else>
      <div class="key-main">
        <span class="key-name">{{ keyInfo.name }}</span>
        <span class="key-zh">{{ keyNameZh(keyInfo) }}</span>
      </div>

      <div v-if="conf" class="conf">
        <span class="conf-label">信心度</span>
        <span class="meter" role="meter" :aria-valuenow="conf.pct" aria-valuemin="0" aria-valuemax="100" :aria-label="`信心度 ${conf.pct}%`">
          <span class="meter-fill" :style="{ width: conf.pct + '%' }"></span>
        </span>
        <strong class="conf-val">{{ conf.pct }}%</strong>
        <span class="conf-level">{{ conf.level }}</span>
      </div>

      <dl class="facts">
        <div>
          <dt>關係{{ keyInfo.mode === 'major' ? '小調' : '大調' }}</dt>
          <dd>{{ relativeKeyName(keyInfo) }}</dd>
        </div>
        <div class="wide">
          <dt>音階</dt>
          <dd class="scale">
            <span v-for="(n, i) in scale" :key="i" class="note-pill" :class="{ tonic: i === 0 }">{{ n }}</span>
          </dd>
        </div>
      </dl>

      <div class="sub-title">順階和弦 <span class="note">{{ keyInfo.mode === 'minor' ? '級數以關係大調計算，跟流行歌的說法一致' : '這個調裡最常用的七個和弦' }}</span></div>
      <div class="diatonic">
        <div v-for="c in chords" :key="c.number" class="dia" :class="'fn-' + c.fn">
          <span class="dia-num">{{ c.number }}</span>
          <span class="dia-name">{{ c.name }}</span>
        </div>
      </div>

      <template v-if="mood">
        <div class="sub-title">調性情緒與情境</div>
        <p class="mood-zh">{{ mood.moodZh }}</p>
        <div class="tags">
          <span class="tag-label">常見情境</span>
          <span v-for="(s, i) in mood.scene.split('、')" :key="i" class="pill">{{ s.trim() }}</span>
        </div>
        <p class="source">
          {{ mood.mood }}・參考 C. F. D. Schubart《Ideen zu einer Ästhetik der Tonkunst》（1806），屬於歷史上的主觀描述
        </p>
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
  color: var(--text);
}

.key-zh {
  font-size: 1.15rem;
  color: var(--text2);
}

.conf {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 0.6rem;
  font-size: 0.9rem;
}

.conf-label {
  color: var(--muted);
}

.meter {
  flex: 1;
  max-width: 220px;
  height: 10px;
  border-radius: 5px;
  background: var(--accent-soft);
  overflow: hidden;
}

.meter-fill {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: 5px;
}

.conf-val {
  font-size: 1rem;
}

.conf-level {
  color: var(--text2);
}

.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 2rem;
  margin-top: 1rem;
}

.facts dt {
  font-size: 0.85rem;
  color: var(--muted);
}

.facts dd {
  font-size: 1.05rem;
  font-weight: 700;
}

.scale {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
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

.diatonic {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.dia {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 2px 4px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--fc) var(--tint), var(--surface));
  border-top: 4px solid var(--fc);
}

.dia-num {
  font-family: var(--font-mono);
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
}

.dia-name {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text2);
  white-space: nowrap;
}

.mood-zh {
  font-size: 1.05rem;
  font-weight: 500;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 0.5rem;
}

.tag-label {
  font-size: 0.85rem;
  color: var(--muted);
  margin-right: 4px;
}

.source {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  color: var(--muted);
}
</style>
