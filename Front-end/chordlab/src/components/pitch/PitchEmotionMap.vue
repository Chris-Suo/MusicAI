<script setup>
/**
 * 音高情緒軌跡：每 15 秒一個區間，用主旋律的平均赫茲數換算成情緒輪上的座標，依序連成軌跡
 * - 換算公式在 utils/pitchEmotion.js（照使用者提供的 pitch_emotion_compact.html）
 * - 圖跟和弦情緒軌跡同一張，x＝效價 Valence、y＝喚醒度 Arousal；軌跡與播放紅點在 EmotionTrajectoryMap.vue
 * - 播放時右邊顯示這一段的平均音高與所在象限；點右邊的清單從那一段開始播放
 */
import { ref, computed } from 'vue'
import EmotionTrajectoryMap from '@/components/common/EmotionTrajectoryMap.vue'
import { useTrajectoryPlayback, posKey } from '@/composables/useTrajectoryPlayback.js'
import { buildPitchEmotionPath, PITCH_QUADRANTS, PITCH_EMOTION_INPUT } from '@/utils/pitchEmotion.js'

const props = defineProps({
  // utils/pitch.js normalizeContour() 的結果
  contour: { type: Object, default: null },
  // 整首歌長度（秒）
  length: { type: Number, required: true },
  keyInfo: { type: Object, default: null },
})

const path = computed(() => buildPitchEmotionPath(props.contour, props.length, props.keyInfo))
const steps = computed(() => path.value.steps)

const playback = useTrajectoryPlayback(steps)
const { pb, currentIndex, currentStep } = playback

const hoverKey = ref(null)

const hzText = (hz) => `${Math.round(hz)} Hz`
const num = (v) => String(Math.round(v * 10) / 10)
const coord = (e) => `(${num(e.x)}, ${num(e.y)})`
const signed = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`
const quad = (e) => PITCH_QUADRANTS[e.quadrant]
const inputText = `頻譜質心 ${PITCH_EMOTION_INPUT.sc.toLocaleString()} Hz、${PITCH_EMOTION_INPUT.loudness === 'soft' ? '輕柔' : '強音'}音量、${PITCH_EMOTION_INPUT.tuning} Hz 調音`
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">音高情緒軌跡</h3>
        <p class="card-desc">每 {{ path.windowSec }} 秒一段，用主旋律的平均赫茲數換算成情緒座標（x 效價、y 喚醒度）</p>
      </div>
    </div>

    <div v-if="!steps.length" class="note">沒有主旋律音高資料，無法畫出音高情緒軌跡</div>

    <div v-else class="emo-layout">
      <EmotionTrajectoryMap
        v-model:hover="hoverKey"
        :steps="steps"
        :playback="playback"
        id-prefix="pitch"
        :label="`音高情緒軌跡，共 ${steps.length} 段`"
      >
        <template #tip="{ point }">
          <template v-for="s in point.steps" :key="s.emo.key">
            <strong>第 {{ s.emo.window }} 段・{{ s.emo.name }}</strong>
            <span>平均音高 {{ hzText(s.emo.hz) }}（{{ s.emo.note }}）</span>
            <span>座標 {{ coord(s.emo) }}・{{ quad(s.emo).title }}</span>
          </template>
        </template>
      </EmotionTrajectoryMap>

      <div class="side">
        <div class="now-box" :class="{ empty: !currentStep }" aria-live="polite">
          <template v-if="currentStep">
            <div class="now-head">
              <span class="now-main">{{ hzText(currentStep.emo.hz) }}</span>
              <span class="now-note">{{ currentStep.emo.note }}</span>
              <span class="now-coord">{{ coord(currentStep.emo) }}</span>
            </div>
            <p class="badge" :class="currentStep.emo.quadrant">{{ quad(currentStep.emo).badge }}</p>
            <p class="now-title">{{ quad(currentStep.emo).title }}</p>
            <dl class="facts">
              <div><dt>效價 V／喚醒 A</dt><dd>{{ signed(currentStep.emo.valence) }}／{{ signed(currentStep.emo.arousal) }}</dd></div>
              <div><dt>這個象限的基頻</dt><dd>{{ quad(currentStep.emo).f0Text }}</dd></div>
              <div><dt>主導頻段</dt><dd>{{ quad(currentStep.emo).bandText }}</dd></div>
            </dl>
            <p class="now-step">第 {{ currentStep.emo.window }} 段・{{ currentStep.emo.name }}</p>
          </template>
          <p v-else class="note">播放時這裡會顯示目前這一段的平均音高與情緒象限</p>
        </div>

        <div class="sub-title">各段平均音高</div>
        <ol class="emo-list">
          <li v-for="(s, i) in steps" :key="s.emo.key">
            <button
              type="button"
              class="list-row emo-row w-row"
              :class="{ now: i === currentIndex }"
              :title="`點一下從 ${s.emo.name.split('–')[0]} 開始播放`"
              @pointerenter="hoverKey = posKey(s.emo)"
              @pointerleave="hoverKey = null"
              @focus="hoverKey = posKey(s.emo)"
              @blur="hoverKey = null"
              @click="pb.seek(s.start + 0.01)"
            >
              <span class="emo-no">{{ s.emo.window }}</span>
              <span class="w-time">{{ s.emo.name }}</span>
              <span class="w-hz">{{ hzText(s.emo.hz) }}</span>
              <span class="w-quad" :class="s.emo.quadrant">{{ quad(s.emo).title.split('、')[0] }}</span>
            </button>
          </li>
        </ol>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* 版面、.now-box 那一塊與逐段清單的共用樣式在 assets/main.css（五張情緒軌跡卡一致） */
.now-note {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text2);
}

/* 象限色：照附件 HTML（q1 琥珀、q2 酒紅、q3 深藍、q4 墨綠），兩種主題都用白字 */
.q1 { --qc: #b45309; }
.q2 { --qc: #9e2a2b; }
.q3 { --qc: #1d3557; }
.q4 { --qc: #2e5a47; }

.badge {
  display: inline-block;
  margin-top: 0.4rem;
  padding: 1px 8px;
  border-radius: 4px;
  background: var(--qc);
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 700;
}

.now-title {
  margin-top: 0.25rem;
  font-size: 1.15rem;
  font-weight: 700;
}

.facts {
  margin-top: 0.35rem;
  font-size: 0.85rem;
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

.w-row {
  grid-template-columns: 1.8em auto 1fr auto;
}

.w-time {
  font-size: 0.85rem;
  color: var(--text2);
  font-variant-numeric: tabular-nums;
}

.w-hz {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.w-quad {
  font-size: 0.75rem;
  font-weight: 700;
  color: #ffffff;
  background: var(--qc);
  border-radius: 4px;
  padding: 1px 6px;
}

.assume {
  margin-top: 0.75rem;
}
</style>
