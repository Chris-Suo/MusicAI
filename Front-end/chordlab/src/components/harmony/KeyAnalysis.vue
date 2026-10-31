<script setup>
/**
 * 和弦進行
 * 使用 utils/progression.js：把 BTC 和弦 + Essentia 調性／拍點轉成每小節的級數，
 * 並找出這首歌的主要循環與已知和弦進行（1-5-6-4、6-4-5-1…）。
 * 點循環或進行會在級數格上標出位置；播放時目前的小節會亮起來；點格子從那個小節開始播放。
 * 右上角可切換級數寫法（簡譜／羅馬數字）與每格長度（1 小節／半小節）。
 */
import { ref, computed, watch } from 'vue'
import { analyzeProgression, numberToRoman, FUNCTION_GROUP } from '@/utils/progression.js'
import { prettyChord as prettyChordIn } from '@/utils/music.js'
import { usePlayback } from '@/composables/usePlayback.js'

const props = defineProps({
  timeline: { type: Array, required: true },
  keyName: { type: String, default: '' },
  beats: { type: Array, default: () => [] },
  beatsPerBar: { type: Number, default: 4 },
})

const pb = usePlayback()

const notation = ref('number') // 'number'（簡譜）| 'roman'
const unit = ref('bar') // 'bar' | 'half'
const selected = ref(null) // { type: 'known' | 'loop', key }

const result = computed(() =>
  analyzeProgression({
    timeline: props.timeline,
    key: props.keyName,
    beats: props.beats,
    beatsPerBar: props.beatsPerBar,
    unit: unit.value,
  }),
)

// ---------------------------------------------------------------------------
// 顯示用資料
// ---------------------------------------------------------------------------
const PITCH_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

const desc = computed(() => {
  const cell = { bar: '每格一小節', 'half-bar': '每格半小節', chord: '沒有拍點資料，每格是一個和弦' }[result.value.unit] ?? ''
  const k = result.value.key
  // 簡譜在小調以關係大調計算（流行歌的習慣）；羅馬數字以實際主音計算
  const rel = k?.mode === 'minor' && notation.value === 'number' ? `；級數以關係大調 ${PITCH_NAMES[(k.tonic + 3) % 12]} major 計算` : ''
  return cell + rel
})

const mainLoop = computed(() => result.value.summary?.mainLoop ?? null)
const mainKey = computed(() => mainLoop.value?.degrees.join('-'))

// 跟主要循環是同一個進行的就不重複列
const known = computed(() => result.value.known.filter((k) => k.id !== mainLoop.value?.family?.id))

const degreesText = (degrees) =>
  (notation.value === 'roman' ? degrees.map((d) => numberToRoman(d, result.value.key)) : degrees).join(' – ')

const degreeText = (deg) => (!deg ? 'N' : notation.value === 'roman' ? deg.roman : deg.label)

function functionOf(deg) {
  if (!deg) return 'none'
  if (deg.kind !== 'diatonic') return 'out'
  return FUNCTION_GROUP[deg.number] ?? 'out'
}

function prettyChord(label) {
  return prettyChordIn(label, result.value.key)
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60)
  return `${m}:${(sec % 60).toFixed(1).padStart(4, '0')}`
}

// 4 小節一組（一個樂句）：半小節時 8 格一組
const barGroups = computed(() => {
  const bars = result.value.bars
  const size = result.value.unit === 'half-bar' ? 8 : 4
  const groups = []
  for (let i = 0; i < bars.length; i += size) groups.push(bars.slice(i, i + size))
  return groups
})

// ---------------------------------------------------------------------------
// 選取與標示
// ---------------------------------------------------------------------------
const highlightedBars = computed(() => {
  const s = selected.value
  const occ = !s
    ? []
    : s.type === 'known'
      ? (result.value.known.find((k) => k.id === s.key)?.occurrences ?? [])
      : (result.value.loops.find((l) => l.degrees.join('-') === s.key)?.occurrences ?? [])
  const set = new Set()
  for (const o of occ) for (let i = o.startBar; i <= o.endBar; i++) set.add(i)
  return set
})

function select(type, key) {
  selected.value = isSelected(type, key) ? null : { type, key }
}

function isSelected(type, key) {
  return selected.value?.type === type && selected.value?.key === key
}

// ---------------------------------------------------------------------------
// 播放同步
// ---------------------------------------------------------------------------
const currentCell = computed(() => {
  if (!pb?.active.value) return -1
  const t = pb.current.value
  const bars = result.value.bars
  let lo = 0
  let hi = bars.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (t < bars[mid].start) hi = mid - 1
    else if (t >= bars[mid].end) lo = mid + 1
    else return bars[mid].index
  }
  return -1
})

function cellTitle(b) {
  const alt = b.alt ? `（另有 ${prettyChord(b.alt)}）` : ''
  const sec = b.degree?.secondaryLabel ? `　${b.degree.secondaryLabel}` : ''
  const no = result.value.unit === 'bar' ? `第 ${b.index + 1} 小節` : `第 ${b.index + 1} 格`
  return `${no}　${fmtTime(b.start)}　${prettyChord(b.chord)}${alt}${sec}`
}

// 換資料或換每格長度時清掉選取（格子編號會變）
watch(
  () => [props.timeline, props.keyName, unit.value],
  () => {
    selected.value = null
  },
)
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">和弦進行</h3>
        <p class="card-desc">{{ desc }}</p>
      </div>
      <div v-if="result.bars.length" class="toggles">
        <div class="seg" role="group" aria-label="級數寫法">
          <button type="button" :class="{ on: notation === 'number' }" :aria-pressed="notation === 'number'" @click="notation = 'number'">簡譜</button>
          <button type="button" :class="{ on: notation === 'roman' }" :aria-pressed="notation === 'roman'" @click="notation = 'roman'">羅馬</button>
        </div>
        <div v-if="result.unit !== 'chord'" class="seg" role="group" aria-label="每格長度">
          <button type="button" :class="{ on: unit === 'bar' }" :aria-pressed="unit === 'bar'" @click="unit = 'bar'">1 小節</button>
          <button type="button" :class="{ on: unit === 'half' }" :aria-pressed="unit === 'half'" @click="unit = 'half'">半小節</button>
        </div>
      </div>
    </div>

    <div v-if="!result.bars.length" class="note">沒有足夠的和弦資料可以分析</div>

    <template v-else>
      <div v-if="mainLoop || known.length" class="patterns">
        <button
          v-if="mainLoop"
          type="button"
          class="main-loop"
          :class="{ active: isSelected('loop', mainKey) }"
          :aria-pressed="isSelected('loop', mainKey)"
          title="點一下在下方標出位置"
          @click="select('loop', mainKey)"
        >
          <span class="ml-label">主要循環<template v-if="mainLoop.family">・{{ mainLoop.family.name }}</template></span>
          <span class="ml-degrees">{{ degreesText(mainLoop.degrees) }}</span>
          <span class="ml-count">×{{ mainLoop.count }}</span>
        </button>

        <button
          v-for="k in known"
          :key="k.id"
          type="button"
          class="chip"
          :class="{ active: isSelected('known', k.id) }"
          :aria-pressed="isSelected('known', k.id)"
          title="點一下在下方標出位置"
          @click="select('known', k.id)"
        >
          <span class="k-name">{{ k.name }}</span>
          <span class="k-deg">{{ degreesText(k.degrees) }}</span>
          <span class="k-count">×{{ k.count }}</span>
        </button>
      </div>

      <div class="bars">
        <div v-for="(group, gi) in barGroups" :key="gi" class="group">
          <button
            v-for="b in group"
            :key="b.index"
            type="button"
            class="cell"
            :class="['fn-' + functionOf(b.degree), { hl: highlightedBars.has(b.index), dim: highlightedBars.size && !highlightedBars.has(b.index), now: currentCell === b.index }]"
            :title="cellTitle(b)"
            :aria-label="`${cellTitle(b)}，級數 ${degreeText(b.degree)}，點一下從這裡播放`"
            @click="pb?.seek(b.start)"
          >
            <span class="bar-no">{{ b.index + 1 }}</span>
            <span class="deg" :class="{ long: degreeText(b.degree).length > 3 }">{{ degreeText(b.degree) }}</span>
            <span class="chord">{{ prettyChord(b.chord) }}</span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* 主要循環＋常見進行（同一列） */
.patterns {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 1.25rem;
}

.main-loop,
.chip {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  color: var(--text);
  transition: border-color 0.15s, background 0.15s;
}

.main-loop {
  padding: 0.5rem 1rem;
}

.chip {
  padding: 0.4rem 0.85rem;
  font-size: 0.95rem;
}

.main-loop:hover,
.chip:hover {
  border-color: var(--accent);
}

.main-loop.active,
.chip.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.ml-label {
  font-size: 0.9rem;
  color: var(--text2);
}

.ml-degrees {
  font-family: var(--font-mono);
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.ml-count,
.k-count {
  color: var(--muted);
  font-size: 0.85rem;
}

.k-name {
  color: var(--text2);
  white-space: nowrap;
}

.k-deg {
  font-family: var(--font-mono);
  font-weight: 700;
  white-space: nowrap;
}

/* 級數格 */
.bars {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cell {
  position: relative;
  width: 66px;
  height: 68px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--fc, var(--surface3)) var(--tint), var(--surface));
  border: 1px solid var(--border);
  border-top: 6px solid var(--fc, var(--border));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text);
  padding: 0;
  transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
}

.cell:hover {
  border-color: var(--border-strong);
  border-top-color: var(--fc, var(--border-strong));
}

.cell.fn-none {
  background: var(--surface2);
  border-top-color: var(--surface3);
}

.cell.hl {
  box-shadow: 0 0 0 3px var(--accent);
  transform: translateY(-2px);
}

.cell.dim {
  opacity: 0.35;
}

.cell.now {
  opacity: 1;
  box-shadow: 0 0 0 3px var(--playhead);
  transform: translateY(-3px) scale(1.04);
  z-index: 1;
}

.bar-no {
  position: absolute;
  top: 1px;
  left: 5px;
  font-size: 11px;
  color: var(--muted);
}

.deg {
  font-family: var(--font-mono);
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.15;
  margin-top: 6px;
}

/* 羅馬數字較長（例如 bVIImaj7）時縮小 */
.deg.long {
  font-size: 0.95rem;
  margin-top: 8px;
}

.chord {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text2);
  max-width: 62px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .main-loop {
    flex-wrap: wrap;
    gap: 0 10px;
  }

  .ml-label {
    flex-basis: 100%;
    text-align: left;
  }

  .cell {
    width: 58px;
  }
}
</style>
