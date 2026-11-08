<script setup>
/**
 * 軌跡座標說明：把「和弦情緒軌跡」用來畫軌跡的每個座標點依順序列出來，附上對應的描述
 * - 由 ChordEmotionMap.vue 放在軌跡卡片下方，path 也由它傳進來，所以兩種軌跡版本會跟著切換：
 *   A. 和弦順序：每一步是一種和弦性質，描述就是那種性質的描述
 *   B. 區間重心：每一步是一個區間的重心，列出區間內每種和弦性質的座標與描述
 * - 播放時目前那一步會亮起來，清單會自己捲到那裡；點一列從那一步開始播放
 */
import { ref, computed, watch, nextTick } from 'vue'
import { prettyChord } from '@/utils/chords.js'
import { usePlayback } from '@/composables/usePlayback.js'

const props = defineProps({
  // utils/chordEmotion.js buildEmotionPath() 或 buildWindowPath() 的結果
  path: { type: Object, required: true },
  keyInfo: { type: Object, default: null },
  // 目前播放到第幾步（-1：還沒播放）
  currentIndex: { type: Number, default: -1 },
})

const pb = usePlayback()

const isWindowMode = computed(() => props.path.mode === 'window')

const num = (v) => String(Math.round(v * 10) / 10)
const coord = (e) => `(${num(e.x)}, ${num(e.y)})`
const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
const chordNames = (labels) => labels.map((c) => prettyChord(c, props.keyInfo)).join('、')

const rows = computed(() =>
  props.path.steps.map((s, i) => ({
    i,
    start: s.start,
    time: `${clock(s.start)}–${clock(s.end)}`,
    coord: coord(s.emo),
    chords: chordNames(s.chords),
    // 區間版本：區間內每種和弦性質；和弦順序版本：就是這一步的那一種
    members: (s.emo.members ?? [s.emo]).map((e) => ({ key: e.key, name: e.name, coord: coord(e), desc: e.desc })),
  })),
)

// 播放時把目前那一步捲到清單上方附近（只捲清單本身，不動整個頁面）
const listEl = ref(null)
watch(
  () => props.currentIndex,
  async (i) => {
    if (i < 0 || !pb.playing.value) return
    await nextTick()
    const box = listEl.value
    const row = box?.querySelector(`[data-step="${i}"]`)
    if (!box || !row) return
    const top = row.offsetTop - box.offsetTop
    if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: Math.max(0, top - box.clientHeight / 4), behavior: 'smooth' })
    }
  },
)
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">軌跡座標說明</h3>
        <p v-if="isWindowMode" class="card-desc">
          每 {{ path.windowSec }} 秒一個區間，座標是區間內和弦性質的平均位置；下面列出區間內每種和弦性質的座標與描述
        </p>
        <p v-else class="card-desc">依和弦出現順序，每換一種和弦性質就是一步</p>
      </div>
      <span class="count">共 {{ rows.length }} 個座標點</span>
    </div>

    <ol ref="listEl" class="steps">
      <li v-for="r in rows" :key="r.i" :data-step="r.i">
        <button
          type="button"
          class="step"
          :class="{ now: r.i === currentIndex }"
          :aria-current="r.i === currentIndex ? 'step' : null"
          :title="`點一下從 ${r.time.split('–')[0]} 開始播放`"
          @click="pb.seek(r.start)"
        >
          <span class="no">{{ r.i + 1 }}</span>
          <span class="main">
            <span class="head">
              <span class="coord">{{ r.coord }}</span>
              <span class="time">{{ r.time }}</span>
              <span class="chords">{{ r.chords }}</span>
            </span>

            <!-- 和弦順序版本：一種性質，直接寫名稱與描述 -->
            <span v-if="!isWindowMode" class="desc">
              <strong>{{ r.members[0].name }}</strong>　{{ r.members[0].desc }}
            </span>

            <!-- 區間版本：區間內每種性質各一行 -->
            <span v-else class="members">
              <span v-for="m in r.members" :key="m.key" class="member">
                <span class="m-name">{{ m.name }}</span>
                <span class="m-coord">{{ m.coord }}</span>
                <span class="m-desc">{{ m.desc }}</span>
              </span>
            </span>
          </span>
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.count {
  font-size: 0.85rem;
  color: var(--muted);
  white-space: nowrap;
}

/* 步數多時（和弦順序版本可能上百步）在卡片裡捲動 */
.steps {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 560px;
  overflow-y: auto;
  padding-right: 4px;
}

.step {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  text-align: left;
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.6rem 0.85rem;
  color: var(--text);
  transition: border-color 0.15s, background 0.15s;
}

.step:hover {
  border-color: var(--border-strong);
  background: var(--surface2);
}

.step.now {
  border-color: var(--playhead);
  background: var(--surface2);
}

.no {
  flex-shrink: 0;
  min-width: 28px;
  height: 28px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: var(--surface3);
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.step.now .no {
  background: var(--playhead);
  color: #ffffff;
}

.main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 12px;
}

.coord {
  font-family: var(--font-mono);
  font-weight: 700;
}

.time {
  font-size: 0.85rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.chords {
  font-size: 0.9rem;
  color: var(--text2);
}

.desc {
  font-size: 0.95rem;
}

.members {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member {
  display: grid;
  grid-template-columns: 8.5em 6em 1fr;
  gap: 8px;
  font-size: 0.9rem;
}

.m-name {
  font-weight: 600;
}

.m-coord {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--muted);
}

@media (max-width: 640px) {
  .member {
    grid-template-columns: auto auto;
  }

  .m-desc {
    grid-column: 1 / -1;
  }
}
</style>
