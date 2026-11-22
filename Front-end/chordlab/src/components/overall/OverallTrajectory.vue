<script setup>
/**
 * 總樂性元・綜合軌跡：每 15 秒算一次綜合座標，依時間連成軌跡
 *   綜合座標 = 60% 這段的和弦座標 ＋ 20% 音高座標 ＋ 20% 速度座標（權重跟「最終值」相同，計算見 utils/overall.js overallWindows）
 * - 圖跟其他情緒軌跡同一張（EmotionTrajectoryMap.vue）；淡淡的參考點是整首歌的最終座標
 * - 播放時紅點沿軌跡移動，右邊顯示這一段的綜合座標與三項各自的座標；點右邊的清單從那一段開始播放
 */
import { ref, computed } from 'vue'
import EmotionTrajectoryMap from '@/components/common/EmotionTrajectoryMap.vue'
import { useTrajectoryPlayback, posKey } from '@/composables/useTrajectoryPlayback.js'
import { overallWindows, overallPoint, POINT_WEIGHTS } from '@/utils/overall.js'
import { segmentAt } from '@/utils/time.js'

const props = defineProps({
  timeline: { type: Array, required: true },
  // utils/pitch.js normalizeContour() 的結果
  contour: { type: Object, default: null },
  beats: { type: Array, default: () => [] },
  // 整首歌長度（秒）
  length: { type: Number, required: true },
  // 調性：音名寫法、速度軌跡用大調或小調的位置
  keyInfo: { type: Object, default: null },
})

const input = computed(() => ({ timeline: props.timeline, contour: props.contour, beats: props.beats, length: props.length, key: props.keyInfo }))
const r = computed(() => overallWindows(input.value))
const steps = computed(() => r.value.steps)
const final = computed(() => overallPoint(input.value).final)

const playback = useTrajectoryPlayback(steps)
const { pb } = playback

// 目前播放到哪一段（含沒有綜合座標的段，才能說明缺什麼）
const currentWindow = computed(() => {
  if (!pb.active.value) return null
  return r.value.windows[segmentAt(r.value.windows, pb.current.value, (w) => w.end)] ?? null
})

const refPoints = computed(() => (final.value ? [{ key: 'final', ...final.value, label: '整首最終值' }] : []))

const hoverKey = ref(null)

const num = (v) => (Math.round(v * 10) / 10).toFixed(1)
const coord = (p) => `(${num(p.x)}, ${num(p.y)})`
const pct = (w) => `${Math.round(w * 100)}%`
const PARTS = [
  { key: 'chord', name: '和弦' },
  { key: 'pitch', name: '音高' },
  { key: 'tempo', name: '速度' },
]
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">綜合軌跡</h3>
        <p class="card-desc">
          每 {{ r.windowSec }} 秒一段：和弦 {{ pct(POINT_WEIGHTS.chord) }}、音高 {{ pct(POINT_WEIGHTS.pitch) }}、速度 {{ pct(POINT_WEIGHTS.tempo) }} 加權的綜合座標，依時間連成軌跡（x 效價、y 喚醒度）
        </p>
      </div>
    </div>

    <div v-if="!steps.length" class="note">每一段都缺少和弦、音高或速度其中一項，無法畫出綜合軌跡</div>

    <div v-else class="layout">
      <EmotionTrajectoryMap
        v-model:hover="hoverKey"
        :steps="steps"
        :playback="playback"
        :ref-points="refPoints"
        id-prefix="overall-traj"
        :label="`綜合軌跡，共 ${steps.length} 段`"
      >
        <template #tip="{ steps: at }">
          <template v-for="s in at" :key="s.emo.key">
            <strong>第 {{ s.emo.window }} 段・{{ s.emo.name }}</strong>
            <span>綜合座標 {{ coord(s.emo) }}</span>
            <span class="muted">和弦 {{ coord(s.win.parts.chord) }}・音高 {{ coord(s.win.parts.pitch) }}・速度 {{ coord(s.win.parts.tempo) }}</span>
          </template>
        </template>
      </EmotionTrajectoryMap>

      <div class="side">
        <div class="now-box" :class="{ empty: !currentWindow }" aria-live="polite">
          <template v-if="currentWindow">
            <p class="now-label">第 {{ currentWindow.no }} 段・{{ currentWindow.name }}</p>
            <p v-if="currentWindow.point" class="now-coord">{{ coord(currentWindow.point) }}</p>
            <p v-else class="now-missing">缺少{{ currentWindow.missing.join('、') }}，這一段沒有綜合座標</p>
            <table class="calc">
              <tbody>
                <tr v-for="part in PARTS" :key="part.key">
                  <td>{{ part.name }}</td>
                  <td class="num">{{ currentWindow.parts[part.key] ? coord(currentWindow.parts[part.key]) : '—' }}</td>
                  <td class="num muted">× {{ pct(POINT_WEIGHTS[part.key]) }}</td>
                </tr>
              </tbody>
            </table>
          </template>
          <p v-else class="note">播放時這裡會顯示目前這一段的綜合座標，以及和弦、音高、速度各自的座標</p>
        </div>

        <div class="sub-title">各段綜合座標</div>
        <ol class="windows">
          <li v-for="w in r.windows" :key="w.no">
            <button
              type="button"
              class="w-row"
              :class="{ now: currentWindow === w, none: !w.point }"
              :title="`點一下從第 ${w.no} 段開始播放`"
              @pointerenter="hoverKey = w.point ? posKey(w.point) : null"
              @pointerleave="hoverKey = null"
              @focus="hoverKey = w.point ? posKey(w.point) : null"
              @blur="hoverKey = null"
              @click="pb.seek(w.start + 0.01)"
            >
              <span class="w-no">{{ w.no }}</span>
              <span class="w-time">{{ w.name }}</span>
              <span class="w-val">{{ w.point ? coord(w.point) : `缺${w.missing.join('、')}` }}</span>
            </button>
          </li>
        </ol>
        <p class="note assume">
          每一項在這 {{ r.windowSec }} 秒的座標，是那條軌跡跟這段時間重疊的部分依時間長短加權平均；缺任何一項的段不畫進軌跡。淡淡的參考點是整首歌的最終座標
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

.now-label {
  font-size: 0.85rem;
  color: var(--muted);
}

.now-coord {
  font-size: 1.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.now-missing {
  font-weight: 600;
  color: var(--text2);
  margin: 0.25rem 0;
}

.calc {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  margin-top: 0.25rem;
}

.calc td {
  padding: 3px 4px;
  border-top: 1px solid var(--border);
  color: var(--text2);
}

.calc .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.calc .muted {
  color: var(--muted);
}

.windows {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
}

.w-row {
  width: 100%;
  display: grid;
  grid-template-columns: 1.8em auto 1fr;
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

.w-time {
  font-size: 0.85rem;
  color: var(--text2);
  font-variant-numeric: tabular-nums;
}

.w-val {
  text-align: right;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.w-row.none .w-val {
  font-weight: 500;
  font-size: 0.85rem;
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
