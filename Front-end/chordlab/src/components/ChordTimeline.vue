<script setup>
import { ref, computed } from 'vue'
import SectionLabel from '@/components/SectionLabel.vue'
import { CHORD_COLORS, CHORD_INFO } from '@/utils/chordData.js'

const props = defineProps({
  timeline: {
    type: Array,
    required: true,
  },
  totalDuration: {
    type: Number,
    required: true,
  },
})

const selectedChord = ref(null)
const PX_PER_SEC = 600

const colorMap = computed(() => {
  const unique = [...new Set(props.timeline.map((t) => t.chord))]
  const map = {}
  unique.forEach((c, i) => (map[c] = CHORD_COLORS[i % CHORD_COLORS.length]))
  return map
})

const timeTicks = computed(() => {
  const ticks = []
  const count = Math.ceil(props.totalDuration / 4)
  for (let i = 0; i <= count; i++) {
    const sec = i * 4
    const label =
      sec < 60 ? sec + 's' : Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')
    ticks.push(label)
  }
  return ticks
})

const beatCells = computed(() => {
  const total = Math.ceil(props.totalDuration * 2)
  return Array.from({ length: total }, (_, i) => ({ strong: i % 4 === 0 }))
})

function blockWidth(dur) {
  return Math.max(Math.round((dur / props.totalDuration) * PX_PER_SEC), 32)
}

function selectChord(item) {
  selectedChord.value = selectedChord.value?.chord === item.chord && selectedChord.value?.start === item.start ? null : item
}

function formatTime(sec) {
  return sec.toFixed(2) + 's'
}
</script>

<template>
  <div class="section">
    <SectionLabel>時間軸</SectionLabel>
    <div class="wrap">
      <div class="header">
        <span class="hint">點擊和弦方塊查看詳情</span>
        <div class="key-badge">
          <span class="key-dot"></span>
          <span>{{ timeline.length > 0 ? '已載入' : '—' }}</span>
        </div>
      </div>

      <div class="scroll">
        <!-- Time axis -->
        <div class="time-axis">
          <div v-for="(tick, i) in timeTicks" :key="i" class="time-tick">{{ tick }}</div>
        </div>

        <!-- Chord blocks -->
        <div class="chord-track">
          <div
            v-for="(item, i) in timeline"
            :key="i"
            class="chord-block"
            :style="{
              width: blockWidth(item.dur) + 'px',
              background: colorMap[item.chord] + '22',
              border: '1px solid ' + colorMap[item.chord] + '66',
              color: colorMap[item.chord],
            }"
            @click="selectChord(item)"
          >
            {{ item.chord }}
            <span class="time-sub">{{ item.start.toFixed(1) }}s</span>
          </div>
        </div>

        <!-- Beat grid -->
        <div class="beat-row">
          <div
            v-for="(cell, i) in beatCells"
            :key="i"
            class="beat-cell"
            :class="{ strong: cell.strong }"
          ></div>
        </div>
      </div>

      <!-- Detail panel -->
      <Transition name="slide">
        <div v-if="selectedChord" class="detail">
          <div class="detail-name" :style="{ color: colorMap[selectedChord.chord] }">
            {{ selectedChord.chord }} 和弦
          </div>
          <div class="detail-sub">構成音與功能</div>
          <div class="detail-grid">
            <div class="detail-item">
              出現時間：<strong>{{ formatTime(selectedChord.start) }}</strong>
            </div>
            <div class="detail-item">
              持續時長：<strong>{{ formatTime(selectedChord.dur) }}</strong>
            </div>
            <div class="detail-item">
              功能：<strong>{{ CHORD_INFO[selectedChord.chord]?.func ?? '—' }}</strong>
            </div>
            <div class="detail-item">
              構成音：<strong>{{ CHORD_INFO[selectedChord.chord]?.notes ?? '—' }}</strong>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.section {
  margin-bottom: 2rem;
}

.wrap {
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.hint {
  font-size: 13px;
  color: var(--muted);
}

.key-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(124, 106, 245, 0.12);
  border: 0.5px solid rgba(124, 106, 245, 0.3);
  border-radius: 8px;
  padding: 4px 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--accent);
}

.key-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}

.scroll {
  overflow-x: auto;
  padding-bottom: 8px;
}

.time-axis {
  display: flex;
  padding-bottom: 6px;
  min-width: 600px;
}

.time-tick {
  flex: 1;
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--muted);
  text-align: center;
}

.chord-track {
  display: flex;
  gap: 3px;
  min-width: 600px;
  align-items: stretch;
}

.chord-block {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  padding: 10px 4px;
  min-height: 42px;
  cursor: pointer;
  transition: opacity 0.15s;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

.chord-block:hover {
  opacity: 0.8;
}

.time-sub {
  position: absolute;
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  font-weight: 400;
  opacity: 0.7;
  white-space: nowrap;
}

.beat-row {
  display: flex;
  gap: 3px;
  min-width: 600px;
  margin-top: 8px;
}

.beat-cell {
  flex: 1;
  height: 6px;
  border-radius: 2px;
  background: var(--surface2);
}

.beat-cell.strong {
  background: rgba(124, 106, 245, 0.5);
}

/* Detail panel */
.detail {
  background: var(--surface2);
  border-radius: var(--radius-md);
  padding: 1rem 1.25rem;
  margin-top: 1rem;
}

.detail-name {
  font-family: var(--font-mono);
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 4px;
}

.detail-sub {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 8px;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  font-size: 13px;
}

.detail-item {
  color: var(--muted);
}

.detail-item strong {
  color: var(--text);
  font-weight: 500;
}

/* Transition */
.slide-enter-active,
.slide-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
