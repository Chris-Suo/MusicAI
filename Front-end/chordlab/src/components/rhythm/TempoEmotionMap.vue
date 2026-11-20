<script setup>
/**
 * 速度情緒軌跡：每 15 秒一個區間算平均 BPM，找出所在的速度區間，取該區間在情緒輪上的位置，依序連成軌跡
 * - 區間、座標、說明與出處在 utils/tempoEmotion.js（照使用者提供的 bpm2.html）
 * - 大調用「大調／規律」的位置、小調用「小調／張力」的位置，依這首歌的調性決定
 * - 圖上淡淡的點是 6 個速度區間的位置；連續落在同一區的段合成一步
 * - 播放時右邊顯示這一段的平均速度與區間說明；點右邊的清單從那一段開始播放
 */
import { ref, computed } from 'vue'
import EmotionTrajectoryMap from '@/components/common/EmotionTrajectoryMap.vue'
import { useTrajectoryPlayback, posKey } from '@/composables/useTrajectoryPlayback.js'
import { buildTempoEmotionPath, TEMPO_ZONES, TEMPO_SOURCES, zonePoint, BPM_MIN, BPM_MAX } from '@/utils/tempoEmotion.js'
import { segmentAt } from '@/utils/time.js'

const props = defineProps({
  beats: { type: Array, default: () => [] },
  // 整首歌長度（秒）
  length: { type: Number, required: true },
  // 調性（theory.js parseKey() 的結果），決定用大調還是小調的位置
  keyInfo: { type: Object, default: null },
})

const mode = computed(() => (props.keyInfo?.mode === 'minor' ? 'minor' : 'major'))
const modeText = computed(() => (mode.value === 'minor' ? '小調／張力' : '大調／規律'))

const path = computed(() => buildTempoEmotionPath(props.beats, props.length, mode.value))
const steps = computed(() => path.value.steps)

const playback = useTrajectoryPlayback(steps)
const { pb, currentStep } = playback

// 目前播放到哪一段（15 秒那一段，不是合併後的一步）
const currentWindow = computed(() => {
  if (!pb.active.value) return null
  const i = segmentAt(path.value.windows, pb.current.value, (w) => w.end)
  return path.value.windows[i] ?? null
})
const zone = computed(() => currentWindow.value?.zone ?? currentStep.value?.emo.zone ?? null)

// 6 個速度區間的位置（淡淡的參考點）
const refPoints = computed(() =>
  TEMPO_ZONES.map((z) => ({ key: z.id, ...zonePoint(z, mode.value), label: z.range.replace(' BPM', '') + (z.empirical ? ' ★' : '') })),
)

const hoverKey = ref(null)

const bpmText = (b) => `${b.toFixed(1)} BPM`
const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
const num = (v) => String(Math.round(v * 10) / 10)
const coord = (e) => `(${num(e.x)}, ${num(e.y)})`
const sources = (z) => z.sources.map((k) => TEMPO_SOURCES[k])
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">速度情緒軌跡</h3>
        <p class="card-desc">每 {{ path.windowSec }} 秒一段，用平均 BPM 所在的速度區間定位（x 正負情緒、y 張力）</p>
      </div>
      <span class="mode-tag" :class="mode">依調性：{{ modeText }}</span>
    </div>

    <div v-if="!steps.length" class="note">沒有拍點資料（Essentia 沒有回傳），無法畫出速度情緒軌跡</div>

    <div v-else class="layout">
      <EmotionTrajectoryMap
        v-model:hover="hoverKey"
        :steps="steps"
        :playback="playback"
        :ref-points="refPoints"
        id-prefix="tempo"
        :label="`速度情緒軌跡，共 ${steps.length} 步`"
      >
        <template #tip="{ steps: at }">
          <strong>{{ at[0].emo.zone.range }}・{{ at[0].emo.zone.term }}</strong>
          <span>座標 {{ coord(at[0].emo) }}</span>
          <span v-for="s in at" :key="s.emo.key" class="muted">
            第 {{ s.emo.short }} 段（{{ s.emo.name }}）：{{ s.windows.map((w) => bpmText(w.bpm)).join('、') }}
          </span>
        </template>
      </EmotionTrajectoryMap>

      <div class="side">
        <div class="now-box" :class="{ empty: !zone }" aria-live="polite">
          <template v-if="zone">
            <div class="now-head">
              <span v-if="currentWindow?.bpm" class="now-bpm">{{ bpmText(currentWindow.bpm) }}</span>
              <span v-else class="now-bpm muted">這一段拍點不足</span>
              <span class="now-coord">{{ coord(zonePoint(zone, mode)) }}</span>
            </div>
            <p class="zone-line">
              <strong>{{ zone.range }}</strong>
              <span class="term">{{ zone.term }}</span>
              <span class="kind" :class="{ empirical: zone.empirical }">{{ zone.empirical ? '★ Yang (2025) 實測點' : '跨文獻內插' }}</span>
            </p>
            <dl class="facts">
              <div><dt>喚醒度</dt><dd>{{ zone.arousal }}</dd></div>
              <div :class="{ on: mode === 'major' }"><dt>正向（大調／規律）</dt><dd>{{ zone.pos }}</dd></div>
              <div :class="{ on: mode === 'minor' }"><dt>負向（小調／張力）</dt><dd>{{ zone.neg }}</dd></div>
              <div><dt>神經生理實證</dt><dd>{{ zone.neuro }}</dd></div>
            </dl>
            <p class="srcs">
              <a v-for="s in sources(zone)" :key="s.url" :href="s.url" target="_blank" rel="noopener noreferrer">{{ s.label }} ↗</a>
            </p>
            <p v-if="currentWindow" class="now-step">第 {{ currentWindow.no }} 段・{{ clock(currentWindow.start) }}–{{ clock(currentWindow.end) }}</p>
          </template>
          <p v-else class="note">播放時這裡會顯示目前這一段的平均速度與速度區間的說明</p>
        </div>

        <div class="sub-title">各段平均速度</div>
        <ol class="windows">
          <li v-for="w in path.windows" :key="w.no">
            <button
              type="button"
              class="w-row"
              :class="{ now: currentWindow === w, none: !w.zone }"
              :title="`點一下從第 ${w.no} 段開始播放`"
              @pointerenter="hoverKey = w.zone ? posKey(zonePoint(w.zone, mode)) : null"
              @pointerleave="hoverKey = null"
              @focus="hoverKey = w.zone ? posKey(zonePoint(w.zone, mode)) : null"
              @blur="hoverKey = null"
              @click="pb.seek(w.start + 0.01)"
            >
              <span class="w-no">{{ w.no }}</span>
              <span class="w-bpm">{{ w.bpm ? bpmText(w.bpm) : '拍點不足' }}</span>
              <span class="w-zone">{{ w.zone ? w.zone.range.replace(' BPM', '') : '—' }}</span>
            </button>
          </li>
        </ol>
        <p class="note assume">
          平均 BPM 先限制在 {{ BPM_MIN }}～{{ BPM_MAX }}（原圖的範圍），再依區間上限分區；原圖座標（效價 ±5.5、喚醒度 1～7 分）換算成 ±10。★ 是 Yang (2025) 實測的區間，其他是跨文獻內插
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(0, 700px) minmax(240px, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.mode-tag {
  font-size: 0.8rem;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  color: var(--text2);
  white-space: nowrap;
}

.now-box {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-left: 5px solid var(--playhead);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  min-height: 120px;
}

.now-box.empty {
  border-left-color: var(--border-strong);
  display: flex;
  align-items: center;
}

.now-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
}

.now-bpm {
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.now-bpm.muted {
  font-size: 1.05rem;
  color: var(--muted);
}

.now-coord {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--muted);
}

.zone-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  margin-top: 0.3rem;
}

.term {
  color: var(--text2);
}

.kind {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--surface3);
  color: var(--text2);
}

.kind.empirical {
  background: var(--accent-soft);
  color: var(--text);
}

.facts {
  margin-top: 0.4rem;
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.facts div {
  display: grid;
  grid-template-columns: 8.5em 1fr;
  gap: 8px;
  padding: 2px 4px;
  border-radius: 4px;
}

.facts div.on {
  background: var(--accent-soft);
}

.facts dt {
  color: var(--muted);
}

.srcs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 0.4rem;
  font-size: 0.8rem;
}

.srcs a {
  color: var(--accent);
}

.now-step {
  margin-top: 0.35rem;
  font-size: 0.8rem;
  color: var(--muted);
}

.windows {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 4px;
}

.w-row {
  width: 100%;
  display: grid;
  grid-template-columns: 1.8em 1fr auto;
  align-items: center;
  gap: 10px;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  text-align: left;
  color: var(--text);
}

.w-row:hover {
  background: var(--surface2);
  border-color: var(--border);
}

.w-row.now {
  border-color: var(--playhead);
}

.w-row.none {
  color: var(--muted);
}

.w-no {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.w-bpm {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.w-zone {
  font-size: 0.8rem;
  color: var(--text2);
  font-variant-numeric: tabular-nums;
}

.assume {
  margin-top: 0.75rem;
}

@media (max-width: 860px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
