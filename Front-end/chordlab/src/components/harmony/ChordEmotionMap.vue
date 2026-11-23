<script setup>
/**
 * 和弦情緒軌跡
 * 使用 utils/chordEmotion.js：依和弦性質把每個和弦放到情緒輪座標上，再連成軌跡。
 * 軌跡有兩個版本，在 utils/chordEmotion.js 的 buildTrajectory() 切換（註解掉一行、打開另一行）：
 *   A. 和弦順序：每換一種和弦性質就是一步
 *   B. 區間平均座標（目前使用）：每 15 秒一個區間，區間內和弦座標的 x、y 各自平均，得到平均座標，一個區間一步；
 *      播放時會用淡紅色畫出目前區間的圖形，編號點是各區間的平均座標
 * - 圖、點的樣式、播放時紅點沿曲線移動都跟音高／速度情緒軌跡與最終值共用
 *   （components/common/EmotionTrajectoryMap.vue、composables/useTrajectoryPlayback.js）
 * - 白色錨點是這首歌用到的和弦性質（固定位置），淡點是沒用到的性質
 * - 點右邊的清單：跳到下一次出現這種和弦的地方播放
 * - 下方另一張卡（ChordEmotionList.vue）依時間順序列出每一段用了哪些和弦與性質，用的是這裡的 path
 *
 * 圖上只標「這是誰」，x、y 的數值放在右邊的性質清單、「目前這一段」與滑過的提示。
 * 性質的座標是固定值（大三和弦永遠是 8, 5）；區間點是區間內所有和弦座標的平均，所以會有小數。
 * 每種性質的文字說明只在右邊清單出現一次，不在逐段明細重印。
 */
import { ref, computed } from 'vue'
import { CHORD_EMOTIONS, buildTrajectory, convexHull } from '@/utils/chordEmotion.js'
import { prettyChord } from '@/utils/chords.js'
import ChordEmotionList from '@/components/harmony/ChordEmotionList.vue'
import EmotionTrajectoryMap from '@/components/common/EmotionTrajectoryMap.vue'
import { useTrajectoryPlayback } from '@/composables/useTrajectoryPlayback.js'
import { px, py, curve } from '@/utils/emotionWheel.js'

const props = defineProps({
  timeline: { type: Array, required: true },
  keyInfo: { type: Object, default: null },
})

// 軌跡版本（A. 和弦順序／B. 每 15 秒區間平均）的切換在 utils/chordEmotion.js 的 buildTrajectory()，
// 總樂性元分頁也用同一個，切換一次兩邊一起換
const path = computed(() => buildTrajectory(props.timeline))
const steps = computed(() => path.value.steps)

const playback = useTrajectoryPlayback(steps)
const { pb, currentIndex, currentStep, moveProgress } = playback

const isWindowMode = computed(() => path.value.mode === 'window')
const usageByKey = computed(() => new Map(path.value.usage.map((u) => [u.emo.key, u])))

// 目前用到的和弦性質：和弦順序版本就是那一種，區間版本是區間內的全部
const currentMembers = computed(() => {
  const emo = currentStep.value?.emo
  return emo ? (emo.members ?? [emo]) : []
})

// 整首歌出現過的移動（A → B）；越粗代表出現越多次（區間版本每條只出現一次，就都一樣細）
const maxCount = computed(() => Math.max(1, ...path.value.edges.map((e) => e.count)))
const edges = computed(() =>
  path.value.edges
    .map((e) => ({
      key: e.from.key + '→' + e.to.key,
      d: curve(e.from, e.to),
      width: maxCount.value > 1 ? 2 + 7 * Math.sqrt(e.count / maxCount.value) : 3.5,
    }))
    .filter((e) => e.d),
)

// 用到的和弦性質＝錨點（固定位置）；沒用到的＝淡淡的參考點
const anchors = computed(() =>
  path.value.usage.map((u) => ({
    key: u.emo.key,
    x: u.emo.x,
    y: u.emo.y,
    label: u.emo.short,
    now: currentMembers.value.includes(u.emo) && moveProgress.value >= 1,
    emo: u.emo,
    usage: u,
  })),
)
const refPoints = computed(() =>
  CHORD_EMOTIONS.filter((e) => !usageByKey.value.has(e.key)).map((e) => ({ key: e.key, x: e.x, y: e.y, emo: e })),
)

// 區間版本：目前區間的和弦座標圍成的圖形（2 個點時是一條線）
const currentShape = computed(() => {
  if (!isWindowMode.value || currentMembers.value.length < 2) return null
  return convexHull(currentMembers.value)
    .map((e) => `${px(e.x)},${py(e.y)}`)
    .join(' ')
})

const hoverKey = ref(null)

/**
 * 點右邊的性質清單：跳到這個性質「下一次」出現的地方，到最後一次就繞回第一次
 * （清單是整首歌的統計，不是依時間排的，所以不能像逐段清單那樣直接跳到某一段）
 * +0.05 是避開現在正在播的那一次，不然點下去會原地不動
 */
function jumpTo(u) {
  const t = pb.current.value
  const next = u.starts.find((s) => s > t + 0.05) ?? u.starts[0]
  pb.seek(next)
}

/**
 * 沒有定義情緒座標的和弦性質（BTC 會輸出的 14 種裡只有 sus4 沒有定義，見 chordEmotion.js 的 CHORD_EMOTIONS）
 * 這些和弦畫不進軌跡，也不算進上面的占比，所以要說一句，否則上面的百分比加起來不到 100%
 */
const unmappedText = computed(() => {
  const list = path.value.unmapped
  if (!list.length) return ''
  const total = list.reduce((s, u) => s + u.share, 0)
  const names = list.map((u) => u.quality).join('、')
  return `這首歌有 ${pct(total)} 的時間是 ${names} 和弦，情緒輪上還沒有${list.length > 1 ? '它們' : '它'}的位置，所以沒有算進上面的比例`
})

const chordNames = (labels) => labels.map((c) => prettyChord(c, props.keyInfo)).join('、')
const pct = (v) => (v >= 0.995 ? '100%' : v < 0.01 ? '<1%' : `${Math.round(v * 100)}%`)
// 座標取到小數一位；區間點是區間內所有和弦座標的平均，所以會有小數
const num = (v) => String(Math.round(v * 10) / 10)
const coord = (e) => `(${num(e.x)}, ${num(e.y)})`
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">和弦情緒軌跡</h3>
        <p class="card-desc">
          依和弦性質定位，不看根音<template v-if="isWindowMode">・每 {{ path.windowSec }} 秒一段</template>
        </p>
      </div>
    </div>

    <div v-if="!steps.length" class="note">這首歌的和弦性質都沒有對應的情緒座標</div>

    <div v-else class="emo-layout">
      <EmotionTrajectoryMap
        v-model:hover="hoverKey"
        :steps="steps"
        :playback="playback"
        :anchors="anchors"
        :ref-points="refPoints"
        :edges="edges"
        :shape="currentShape"
        id-prefix="chord"
        :label="`和弦情緒軌跡，共 ${steps.length} 步，用到 ${path.usage.length} 種和弦性質`"
      >
        <template #tip="{ point }">
          <!-- 和弦性質（用到的錨點、沒用到的參考點） -->
          <template v-if="point.emo">
            <strong>{{ point.emo.name }} {{ coord(point.emo) }}</strong>
            <span>{{ point.emo.desc }}</span>
            <span v-if="point.usage" class="muted">占和弦時間 {{ pct(point.usage.share) }}，出現 {{ point.usage.count }} 次</span>
            <span v-else class="muted">這首歌沒有用到</span>
          </template>
          <!-- 區間平均座標 -->
          <template v-else>
            <strong>{{ point.steps[0].emo.name }} {{ coord(point.steps[0].emo) }}</strong>
            <span>{{ point.steps[0].emo.desc }}</span>
          </template>
        </template>
      </EmotionTrajectoryMap>

      <div class="side">
        <div class="now-box" :class="{ empty: !currentStep }" aria-live="polite">
          <template v-if="currentStep">
            <div class="now-head">
              <span class="now-main">{{ chordNames(currentStep.chords) }}</span>
              <span class="now-type">{{ currentStep.emo.name }}</span>
              <span class="now-coord">{{ coord(currentStep.emo) }}</span>
            </div>
            <p class="now-desc">{{ currentStep.emo.desc }}</p>
            <p class="now-step">第 {{ currentIndex + 1 }} / {{ steps.length }} 段</p>
          </template>
          <p v-else class="note">播放時這裡會顯示目前的和弦</p>
        </div>

        <!-- 用到的和弦性質：每種性質的說明只在這裡出現一次 -->
        <div class="sub-title">用到的和弦性質</div>
        <ul class="usage">
          <li v-for="u in path.usage" :key="u.emo.key">
            <button
              type="button"
              class="list-row usage-row"
              :class="{ now: currentMembers.includes(u.emo) }"
              title="點一下跳到下一次出現的地方"
              @pointerenter="hoverKey = u.emo.key"
              @pointerleave="hoverKey = null"
              @focus="hoverKey = u.emo.key"
              @blur="hoverKey = null"
              @click="jumpTo(u)"
            >
              <span class="u-top">
                <span class="u-name">{{ u.emo.name }}</span>
                <span class="u-coord">{{ coord(u.emo) }}</span>
                <span class="u-bar"><span :style="{ width: `${Math.max(2, u.share * 100)}%` }" /></span>
                <span class="u-share">{{ pct(u.share) }}</span>
              </span>
              <span class="u-desc">{{ u.emo.desc }}</span>
            </button>
          </li>
        </ul>
        <p v-if="unmappedText" class="note unmapped">{{ unmappedText }}</p>
      </div>
    </div>
  </div>

  <!-- 軌跡逐段明細（另一張卡，放在軌跡下方） -->
  <ChordEmotionList v-if="steps.length" :path="path" :key-info="keyInfo" :current-index="currentIndex" />
</template>

<style scoped>
/* 版面、.now-box 那一塊與 .now-coord 的共用樣式在 assets/main.css（五張情緒軌跡卡一致） */
.now-type {
  color: var(--text2);
  font-size: 0.95rem;
}

.now-desc {
  margin-top: 0.35rem;
  font-size: 1rem;
}

.usage {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 滑過、播放中的樣式在 assets/main.css 的 .list-row（跟各段清單共用），這裡只管內部排版 */
.usage-row {
  display: flex;
  flex-direction: column;
  gap: 1px;
  /* 左邊的內距是紅點的位置（assets/main.css 的 .list-row.now::before） */
  padding: 5px 8px 5px 20px;
}

.u-top {
  display: grid;
  grid-template-columns: auto auto 1fr 3.2em;
  align-items: center;
  gap: 10px;
}

.u-name {
  font-weight: 600;
  white-space: nowrap;
}

.u-coord {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--muted);
  white-space: nowrap;
}

.u-desc {
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.45;
}

.u-bar {
  height: 8px;
  background: var(--surface3);
  border-radius: 4px;
  overflow: hidden;
}

.u-bar > span {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
}

.u-share {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 0.9rem;
  color: var(--text2);
}

.unmapped {
  margin-top: 0.75rem;
}
</style>
