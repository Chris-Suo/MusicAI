<script setup>
/**
 * 共用播放器（固定在畫面上方）
 * - 色帶是整首歌的和弦功能，可點擊或拖曳跳轉
 * - 即時顯示：目前和弦（級數）、第幾小節第幾拍、旋律音高
 * - 快捷鍵：空白鍵播放／暫停、← → 前後 5 秒
 */
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'
import ChordStrip from '@/components/common/ChordStrip.vue'
import { usePlayback } from '@/composables/usePlayback.js'
import { segmentAt, fmtClock } from '@/utils/stats.js'
import { midiToName, midiToHz, fmtHz } from '@/utils/music.js'

const props = defineProps({
  total: { type: Number, required: true },
  timeline: { type: Array, default: () => [] },
  chordInfo: { type: Map, required: true },
  contour: { type: Object, default: null },
  keyInfo: { type: Object, default: null },
  hasBeats: { type: Boolean, default: false },
})

const pb = usePlayback()

const progress = computed(() => Math.min(100, (pb.current.value / props.total) * 100))

const nowChord = computed(() => {
  const i = segmentAt(props.timeline, pb.current.value)
  const label = i >= 0 ? props.timeline[i].chord : null
  if (!label) return null
  if (label === 'N' || label === 'X') return { name: '無和弦', fn: 'none', degree: null }
  const info = props.chordInfo.get(label)
  return { name: info?.name ?? label, fn: info?.fn ?? 'none', degree: info?.degree?.label ?? null }
})

const nowNote = computed(() => {
  const c = props.contour
  if (!c) return null
  const v = c.midi[Math.floor(pb.current.value / c.hop)]
  if (v === null || v === undefined) return { name: '—', hz: '' }
  return { name: midiToName(v, props.keyInfo), hz: fmtHz(midiToHz(v)) }
})

// ---------------------------------------------------------------------------
// 色帶拖曳跳轉
// ---------------------------------------------------------------------------
const seekEl = ref(null)
let dragging = false

function seekAtEvent(e) {
  const rect = seekEl.value.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
  pb.seek(ratio * props.total)
}

function onPointerDown(e) {
  dragging = true
  seekEl.value.setPointerCapture(e.pointerId)
  seekAtEvent(e)
}
function onPointerMove(e) {
  if (dragging) seekAtEvent(e)
}
function onPointerUp() {
  dragging = false
}

function onSliderKey(e) {
  const step = e.shiftKey ? 15 : 5
  if (e.key === 'ArrowRight') pb.seek(pb.current.value + step)
  else if (e.key === 'ArrowLeft') pb.seek(pb.current.value - step)
  else if (e.key === 'Home') pb.seek(0)
  else return
  e.preventDefault()
  e.stopPropagation()
}

// ---------------------------------------------------------------------------
// 全頁快捷鍵
// ---------------------------------------------------------------------------
function onKey(e) {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
  if (e.target.closest?.('button, input, textarea, select, label, a, [role="slider"], [contenteditable]')) return
  if (e.code === 'Space') {
    e.preventDefault()
    pb.toggle()
  } else if (e.key === 'ArrowRight') {
    pb.seek(pb.current.value + 5)
  } else if (e.key === 'ArrowLeft') {
    pb.seek(pb.current.value - 5)
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="player" role="region" aria-label="播放器">
    <button
      class="play"
      type="button"
      :disabled="!pb.hasAudio.value"
      :aria-label="pb.playing.value ? '暫停' : '播放'"
      :title="(pb.playing.value ? '暫停' : '播放') + '（空白鍵）'"
      @click="pb.toggle()"
    >
      <AppIcon :name="pb.playing.value ? 'pause' : 'play'" :size="24" />
    </button>

    <div class="main">
      <div class="seek-row">
        <div
          ref="seekEl"
          class="seek"
          role="slider"
          tabindex="0"
          aria-label="播放位置"
          :aria-valuemin="0"
          :aria-valuemax="Math.round(total)"
          :aria-valuenow="Math.round(pb.current.value)"
          :aria-valuetext="fmtClock(pb.current.value)"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @keydown="onSliderKey"
        >
          <ChordStrip :timeline="timeline" :chord-info="chordInfo" :total="total" :height="14" />
          <div class="knob" :style="{ left: progress + '%' }"></div>
        </div>
        <span class="clock">{{ fmtClock(pb.current.value) }} <span class="muted">/ {{ fmtClock(total) }}</span></span>
      </div>

      <div class="now">
        <span class="now-item">
          <span class="now-label">和弦</span>
          <template v-if="nowChord">
            <span class="swatch" :class="'fn-' + nowChord.fn"></span>
            <strong class="now-val">{{ nowChord.name }}</strong>
            <span v-if="nowChord.degree" class="deg">{{ nowChord.degree }}</span>
          </template>
          <strong v-else class="now-val">—</strong>
        </span>

        <span v-if="hasBeats" class="now-item">
          <span class="now-label">小節</span>
          <strong class="now-val">{{ pb.barIndex.value >= 0 ? pb.barIndex.value + 1 : '—' }}</strong>
          <span class="pulse" aria-hidden="true">
            <span
              v-for="n in pb.beatsPerBar"
              :key="n"
              class="dot"
              :class="{ on: pb.beatInBar.value === n - 1, down: n === 1 }"
            ></span>
          </span>
        </span>

        <span v-if="nowNote" class="now-item">
          <span class="now-label">旋律</span>
          <strong class="now-val">{{ nowNote.name }}</strong>
          <span class="muted">{{ nowNote.hz }}</span>
        </span>

        <label v-if="hasBeats && pb.hasAudio.value" class="switch">
          <input v-model="pb.metronome.value" type="checkbox" />
          <span class="track" aria-hidden="true"><span class="thumb"></span></span>
          節拍器
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  padding: 0.75rem 1.25rem;
  box-shadow: var(--shadow-md);
}

.play {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: var(--on-accent);
  flex-shrink: 0;
  transition: background 0.15s, transform 0.1s;
}

.play:hover:not(:disabled) {
  background: var(--accent-strong);
}

.play:active:not(:disabled) {
  transform: scale(0.96);
}

.play:disabled {
  opacity: 0.4;
  cursor: default;
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.seek-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.seek {
  position: relative;
  flex: 1;
  padding: 6px 0;
  cursor: pointer;
  touch-action: none;
}

.knob {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 4px;
  margin-left: -2px;
  background: var(--playhead);
  border-radius: 2px;
  box-shadow: 0 0 0 2px var(--surface);
  pointer-events: none;
}

.clock {
  font-size: 1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.muted {
  color: var(--muted);
  font-weight: 400;
}

.now {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 24px;
}

.now-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
}

.now-label {
  font-size: 0.85rem;
  color: var(--muted);
}

.now-val {
  font-size: 1.15rem;
  min-width: 2.5ch;
}

.deg {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 0.9rem;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0 8px;
}

.pulse {
  display: inline-flex;
  gap: 5px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--surface3);
  border: 2px solid var(--border-strong);
  transition: background 0.06s, transform 0.06s;
}

.dot.down {
  border-color: var(--accent);
}

.dot.on {
  background: var(--text);
  border-color: var(--text);
  transform: scale(1.2);
}

.dot.on.down {
  background: var(--accent);
  border-color: var(--accent);
}

/* 開關 */
.switch {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--text2);
  cursor: pointer;
  user-select: none;
}

.switch input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.track {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: var(--surface3);
  border: 1px solid var(--border-strong);
  position: relative;
  transition: background 0.15s;
}

.thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  transition: transform 0.15s;
}

.switch input:checked + .track {
  background: var(--accent);
  border-color: var(--accent);
}

.switch input:checked + .track .thumb {
  transform: translateX(18px);
}

.switch input:focus-visible + .track {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .player {
    padding: 0.6rem 0.75rem;
    gap: 10px;
  }

  .play {
    width: 44px;
    height: 44px;
  }

  .now {
    gap: 4px 14px;
  }

  .switch {
    margin-left: 0;
  }
}
</style>
