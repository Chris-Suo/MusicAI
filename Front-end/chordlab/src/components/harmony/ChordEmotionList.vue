<script setup>
/**
 * 軌跡逐段明細：把「和弦情緒軌跡」的每一步依時間順序列出來
 * - 由 ChordEmotionMap.vue 放在軌跡卡片下方，path 由它傳進來，兩種軌跡版本都適用：
 *   A. 和弦順序：一步是一種和弦性質
 *   B. 區間平均座標：一步是一個區間，可能同時有好幾種性質
 * - 左邊的編號對應軌跡圖上的數字點
 * - 播放時目前那一段會亮起來，清單會自己捲到那裡；點一列從那一段開始播放
 *
 * 這裡只回答「什麼時候、彈了什麼、算哪種性質」。
 * 每種性質的文字說明在軌跡卡右邊的清單，不在這裡重複（原本每一段都重印一次，
 * 同樣一句「純粹的陽光，極度穩定」會出現十幾次）。座標數值同樣不顯示。
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

const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

const rows = computed(() =>
  props.path.steps.map((s, i) => ({
    i,
    start: s.start,
    from: clock(s.start),
    time: `${clock(s.start)}–${clock(s.end)}`,
    chords: s.chords.map((c) => prettyChord(c, props.keyInfo)).join('、'),
    // 區間版本：區間內用到的每種性質；和弦順序版本：就是這一步的那一種
    types: (s.emo.members ?? [s.emo]).map((e) => e.name).join('・'),
  })),
)

// 播放時把目前那一段捲到清單上方附近（只捲清單本身，不動整個頁面）
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
        <h3 class="card-title">軌跡逐段明細</h3>
        <p class="card-desc">編號對應上面軌跡圖的數字點・點一段從那裡開始播放</p>
      </div>
      <span class="count">共 {{ rows.length }} 段</span>
    </div>

    <ol ref="listEl" class="steps">
      <li v-for="r in rows" :key="r.i" :data-step="r.i">
        <button
          type="button"
          class="step"
          :class="{ now: r.i === currentIndex }"
          :aria-current="r.i === currentIndex ? 'step' : null"
          :aria-label="`第 ${r.i + 1} 段，${r.time}，${r.chords}，${r.types}，點一下從 ${r.from} 開始播放`"
          @click="pb.seek(r.start)"
        >
          <span class="no">{{ r.i + 1 }}</span>
          <span class="main">
            <span class="chords">{{ r.chords }}</span>
            <span class="types">{{ r.types }}</span>
          </span>
          <span class="time">{{ r.time }}</span>
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
  gap: 4px;
  max-height: 420px;
  overflow-y: auto;
  padding-right: 4px;
}

.step {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.85rem;
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
  min-width: 26px;
  height: 26px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  background: var(--surface3);
  font-size: 0.8rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.step.now .no {
  background: var(--playhead);
  color: #ffffff;
}

/* 和弦在上、性質在下；時間靠右對齊 */
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.chords {
  font-weight: 600;
  line-height: 1.4;
}

.types {
  font-size: 0.85rem;
  color: var(--muted);
}

.time {
  flex-shrink: 0;
  font-size: 0.85rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

/* 窄螢幕：和弦名稱會被右邊的時間擠到換行，改成時間自己一行（跟編號同一列、靠右） */
@media (max-width: 560px) {
  .step {
    flex-wrap: wrap;
    row-gap: 2px;
  }

  .time {
    order: 2;
    margin-left: auto;
  }

  .main {
    order: 3;
    flex-basis: 100%;
  }
}
</style>
