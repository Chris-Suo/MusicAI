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

    <div v-else class="emo-layout">
      <EmotionTrajectoryMap
        v-model:hover="hoverKey"
        :steps="steps"
        :playback="playback"
        :ref-points="refPoints"
        id-prefix="overall-traj"
        :label="`綜合軌跡，共 ${steps.length} 段`"
      >
        <!-- EmotionTrajectoryMap 的 #tip 給的是滑到的那個點（point），
             參考點跟軌跡點都會進來，所以要分開寫：軌跡點才有 point.steps -->
        <template #tip="{ point }">
          <!-- 淡淡的參考點：整首歌的最終座標 -->
          <template v-if="!point.steps">
            <strong>整首最終值 {{ coord(point) }}</strong>
            <span class="muted">三條軌跡各自的平均再加權，不是某一段</span>
          </template>
          <!-- 軌跡上的點；同一個座標可能有好幾段 -->
          <template v-else>
            <template v-for="s in point.steps" :key="s.emo.key">
              <strong>第 {{ s.emo.window }} 段・{{ s.emo.name }}</strong>
              <span>綜合座標 {{ coord(s.emo) }}</span>
              <span class="muted">和弦 {{ coord(s.win.parts.chord) }}・音高 {{ coord(s.win.parts.pitch) }}・速度 {{ coord(s.win.parts.tempo) }}</span>
            </template>
          </template>
        </template>
      </EmotionTrajectoryMap>

      <div class="side">
        <div class="now-box" :class="{ empty: !currentWindow }" aria-live="polite">
          <template v-if="currentWindow">
            <div class="now-head">
              <span class="now-main">{{ currentWindow.point ? coord(currentWindow.point) : '—' }}</span>
              <span v-if="!currentWindow.point" class="now-coord">缺少{{ currentWindow.missing.join('、') }}，這一段沒有綜合座標</span>
            </div>
            <dl class="facts">
              <div v-for="part in PARTS" :key="part.key">
                <dt>{{ part.name }} × {{ pct(POINT_WEIGHTS[part.key]) }}</dt>
                <dd>{{ currentWindow.parts[part.key] ? coord(currentWindow.parts[part.key]) : '—' }}</dd>
              </div>
            </dl>
            <p class="now-step">第 {{ currentWindow.no }} 段・{{ currentWindow.name }}</p>
          </template>
          <p v-else class="note">播放時這裡會顯示目前這一段的綜合座標，以及和弦、音高、速度各自的座標</p>
        </div>

        <div class="sub-title">各段綜合座標</div>
        <ol class="emo-list">
          <li v-for="w in r.windows" :key="w.no">
            <button
              type="button"
              class="list-row emo-row w-row"
              :class="{ now: currentWindow === w, none: !w.point }"
              :title="`點一下從第 ${w.no} 段開始播放`"
              @pointerenter="hoverKey = w.point ? posKey(w.point) : null"
              @pointerleave="hoverKey = null"
              @focus="hoverKey = w.point ? posKey(w.point) : null"
              @blur="hoverKey = null"
              @click="pb.seek(w.start + 0.01)"
            >
              <span class="emo-no">{{ w.no }}</span>
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
/* 版面（.emo-layout）、上面那一塊（.now-box、.now-head、.now-main、.now-step）
   與逐段清單（.emo-list、.list-row、.emo-row、.emo-no）的樣式都在 assets/main.css，
   五張情緒軌跡卡共用；這裡只寫這張卡自己的部分 */

/* 這一段的三個分項：跟音高、速度兩張卡的 .facts 同一個寫法（左邊名稱、右邊數值）。
   權重寫進左邊的名稱裡，就不用為了它多一欄 */
.facts {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.facts div {
  display: grid;
  grid-template-columns: 7.5em 1fr;
  gap: 8px;
  padding: 2px 0;
}

.facts dt {
  color: var(--muted);
}

.facts dd {
  font-variant-numeric: tabular-nums;
}

/* 清單一列的欄位：段號、時間、座標 */
.w-row {
  grid-template-columns: 1.8em auto 1fr;
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

/* 三項缺一項的段：沒有綜合座標，整列壓淡 */
.w-row.none {
  color: var(--muted);
}

.w-row.none .w-val {
  font-weight: 500;
  font-size: 0.85rem;
}

.assume {
  margin-top: 0.75rem;
}
</style>
