<script setup>
/**
 * 播放器（固定在畫面上方）
 * - 檔名、播放／暫停、進度條（可點擊或拖曳跳轉）、正在播放的和弦、換檔案
 * - 快捷鍵：空白鍵播放／暫停、← → 前後 5 秒
 */
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'
import FilePickButton from '@/components/common/FilePickButton.vue'
import { usePlayback } from '@/composables/usePlayback.js'
import { segmentAt, fmtClock } from '@/utils/stats.js'

const props = defineProps({
  fileName: { type: String, default: '' },
  total: { type: Number, required: true },
  timeline: { type: Array, default: () => [] },
  chordInfo: { type: Map, required: true },
})

const emit = defineEmits(['pick'])

const pb = usePlayback()

const progress = computed(() => Math.min(100, (pb.current.value / props.total) * 100))

// 開始播放（或跳轉）後才顯示目前的和弦
const nowChord = computed(() => {
  if (!pb.active.value) return null
  const i = segmentAt(props.timeline, pb.current.value)
  const label = i >= 0 ? props.timeline[i].chord : null
  if (!label) return null
  if (label === 'N' || label === 'X') return { name: '無和弦', fn: 'none', degree: null }
  const info = props.chordInfo.get(label)
  return { name: info?.name ?? label, fn: info?.fn ?? 'none', degree: info?.degree?.label ?? null }
})

// ---------------------------------------------------------------------------
// 進度條拖曳跳轉
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
      <AppIcon :name="pb.playing.value ? 'pause' : 'play'" :size="22" />
    </button>

    <div class="main">
      <div class="info">
        <span class="file-name" :title="fileName">{{ fileName }}</span>
        <span v-if="nowChord" class="chord" aria-live="off">
          <i class="swatch" :class="'fn-' + nowChord.fn"></i>
          <strong>{{ nowChord.name }}</strong>
          <span v-if="nowChord.degree" class="deg">{{ nowChord.degree }}</span>
        </span>
        <span class="clock">{{ fmtClock(pb.current.value) }} <span class="muted">/ {{ fmtClock(total) }}</span></span>
      </div>

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
        <div class="track"><div class="fill" :style="{ width: progress + '%' }"></div></div>
        <div class="knob" :style="{ left: progress + '%' }"></div>
      </div>
    </div>

    <FilePickButton class="change" @pick="emit('pick', $event)" />
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
  border-radius: var(--radius-lg);
  padding: 0.75rem 1.25rem;
  box-shadow: var(--shadow-sm);
}

.play {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
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
  gap: 4px;
}

.info {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 28px;
}

.file-name {
  flex: 1;
  min-width: 0;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chord {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 1.05rem;
  white-space: nowrap;
}

.deg {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 0.85rem;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0 7px;
}

.clock {
  margin-left: auto;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.muted {
  color: var(--muted);
  font-weight: 400;
}

.seek {
  position: relative;
  padding: 8px 0;
  cursor: pointer;
  touch-action: none;
}

.track {
  height: 6px;
  border-radius: 3px;
  background: var(--surface3);
  overflow: hidden;
}

.fill {
  height: 100%;
  background: var(--accent);
}

.knob {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--surface);
  pointer-events: none;
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

  /* 手機寬度放不下檔名，留和弦和時間 */
  .file-name {
    display: none;
  }

  .info {
    gap: 10px;
  }

  .chord {
    font-size: 0.95rem;
  }

  .clock {
    font-size: 0.875rem;
  }
}
</style>
