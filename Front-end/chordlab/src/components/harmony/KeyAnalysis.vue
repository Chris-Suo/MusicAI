<script setup>
/**
 * 調性與和弦進行分析
 * 使用 utils/progression.js：把 BTC 和弦 + Essentia 調性／拍點轉成每小節的級數，
 * 並找出已知和弦進行（1-5-6-4、6-4-5-1…）與這首歌反覆出現的循環。
 * 播放時目前的小節會亮起來；點格子從那個小節開始播放。
 */
import { ref, computed, watch } from 'vue'
import { analyzeProgression, FUNCTION_GROUP } from '@/utils/progression.js'
import { prettyChord as prettyChordIn, FUNCTION_NAMES, FUNCTION_DEGREES } from '@/utils/music.js'
import { usePlayback } from '@/composables/usePlayback.js'

const props = defineProps({
  timeline: { type: Array, required: true },
  keyName: { type: String, default: '' },
  // keyName 是依和弦推估出來的（Essentia 沒有給調性）
  keyEstimated: { type: Boolean, default: false },
  beats: { type: Array, default: () => [] },
  beatsPerBar: { type: Number, default: 4 },
})

const pb = usePlayback()

const emit = defineEmits(['highlight'])

const unit = ref('bar') // 'bar' | 'half'
const notation = ref('number') // 'number'（簡譜）| 'roman'
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

const keyLine = computed(() => {
  const k = result.value.key
  if (!k) return null
  const rel = k.mode === 'minor' ? `${PITCH_NAMES[(k.tonic + 3) % 12]} major` : null
  return { name: k.name, estimated: props.keyEstimated || !!k.estimated, relative: rel }
})

const unitText = computed(
  () => ({ bar: '每格＝1 小節', 'half-bar': '每格＝半小節', chord: '沒有拍點資料，每格＝1 個和弦' })[result.value.unit] ?? '',
)

const mainLoop = computed(() => result.value.summary?.mainLoop ?? null)

// 已知進行之外、自己反覆出現的循環
const extraLoops = computed(() => result.value.loops.filter((l) => l !== mainLoop.value).slice(0, 6))

const KIND_TEXT = {
  secondaryDominant: '副屬和弦',
  borrowed: '借用和弦',
  chromatic: '調外和弦',
}

// 調外和弦依和弦名稱合併
const nonDiatonicGroups = computed(() => {
  const map = new Map()
  for (const n of result.value.nonDiatonic) {
    const k = n.chord
    if (!map.has(k)) map.set(k, { ...n, count: 0 })
    map.get(k).count++
  }
  return [...map.values()]
})

function degreeText(deg) {
  if (!deg) return 'N'
  return notation.value === 'roman' ? deg.roman : deg.label
}

function degreesText(degrees) {
  return degrees.join(' – ')
}

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

// 小節依 4 格一組（一個樂句）排列
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
const selectedOccurrences = computed(() => {
  const s = selected.value
  if (!s) return []
  if (s.type === 'known') return result.value.known.find((k) => k.id === s.key)?.occurrences ?? []
  return result.value.loops.find((l) => l.degrees.join('-') === s.key)?.occurrences ?? []
})

const highlightedBars = computed(() => {
  const set = new Set()
  for (const o of selectedOccurrences.value) for (let i = o.startBar; i <= o.endBar; i++) set.add(i)
  return set
})

function select(type, key) {
  selected.value = selected.value?.type === type && selected.value?.key === key ? null : { type, key }
}

function isSelected(type, key) {
  return selected.value?.type === type && selected.value?.key === key
}

watch(selectedOccurrences, (occ) => emit('highlight', occ.map((o) => ({ start: o.start, end: o.end }))))

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

function playFrom(bar) {
  pb?.seek(bar.start)
}

function cellLabel(b) {
  const alt = b.alt ? `，另有 ${prettyChord(b.alt)}` : ''
  return `第 ${b.index + 1} 格，${fmtTime(b.start)}，級數 ${degreeText(b.degree)}，${prettyChord(b.chord)}${alt}`
}

// 換資料或換單位時清掉選取
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
        <p class="card-desc">把每個小節的和弦換成級數，找出常見進行與這首歌反覆出現的循環；點格子從那個小節開始播放</p>
      </div>
      <div v-if="result.bars.length" class="toggles">
        <div class="seg" role="group" aria-label="級數寫法">
          <button :class="{ on: notation === 'number' }" type="button" @click="notation = 'number'">簡譜 1 5 6 4</button>
          <button :class="{ on: notation === 'roman' }" type="button" @click="notation = 'roman'">羅馬 I V vi IV</button>
        </div>
        <div class="seg" role="group" aria-label="每格長度">
          <button :class="{ on: unit === 'bar' }" type="button" @click="unit = 'bar'">每格 1 小節</button>
          <button :class="{ on: unit === 'half' }" type="button" @click="unit = 'half'">半小節</button>
        </div>
      </div>
    </div>

    <div v-if="!result.bars.length" class="note">沒有足夠的和弦資料可以分析</div>

    <template v-else>
      <div v-if="keyLine" class="key-info">
        <span class="key-chip">{{ keyLine.name }}</span>
        <span v-if="keyLine.estimated" class="note">（Essentia 沒有調性，依和弦推估）</span>
        <span v-if="keyLine.relative && notation === 'number'" class="note">簡譜級數以關係大調 {{ keyLine.relative }} 計算</span>
      </div>

      <div class="summary">
        <!-- 主要循環 -->
        <button
          v-if="mainLoop"
          type="button"
          class="main-loop"
          :class="{ active: isSelected('loop', mainLoop.degrees.join('-')) }"
          :aria-pressed="isSelected('loop', mainLoop.degrees.join('-'))"
          @click="select('loop', mainLoop.degrees.join('-'))"
        >
          <span class="ml-label">這首歌的主要循環</span>
          <span class="ml-degrees">{{ degreesText(mainLoop.degrees) }}</span>
          <span class="ml-meta">
            出現 {{ mainLoop.count }} 次<template v-if="mainLoop.family">・屬於「{{ mainLoop.family.name }}」</template>
            <span class="ml-hint">{{ isSelected('loop', mainLoop.degrees.join('-')) ? '已在下方標示，再點一次取消' : '點一下在下方標示' }}</span>
          </span>
        </button>

        <div class="lists">
          <div class="sub-title">找到的常見和弦進行</div>
          <div v-if="result.known.length" class="chip-list">
            <button
              v-for="k in result.known"
              :key="k.id"
              type="button"
              class="chip"
              :class="{ active: isSelected('known', k.id) }"
              :aria-pressed="isSelected('known', k.id)"
              @click="select('known', k.id)"
            >
              <span class="k-name">{{ k.name }}</span>
              <span class="k-deg">{{ degreesText(k.degrees) }}</span>
              <span class="k-count">×{{ k.count }}</span>
              <span v-if="k.exactCount < k.count" class="k-fuzzy" title="其中有幾次差一個同功能和弦">含 {{ k.count - k.exactCount }} 次近似</span>
            </button>
          </div>
          <div v-else class="note">沒有找到字典裡的常見進行</div>

          <template v-if="extraLoops.length">
            <div class="sub-title">其他反覆出現的循環</div>
            <div class="chip-list">
              <button
                v-for="l in extraLoops"
                :key="l.degrees.join('-')"
                type="button"
                class="chip"
                :class="{ active: isSelected('loop', l.degrees.join('-')) }"
                :aria-pressed="isSelected('loop', l.degrees.join('-'))"
                @click="select('loop', l.degrees.join('-'))"
              >
                <span class="k-deg">{{ degreesText(l.degrees) }}</span>
                <span class="k-count">×{{ l.count }}</span>
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- 選取的出現位置 -->
      <div v-if="selectedOccurrences.length" class="occ">
        <span class="occ-label">出現位置</span>
        <button
          v-for="(o, i) in selectedOccurrences"
          :key="i"
          type="button"
          class="occ-item"
          :class="{ fuzzy: !o.exact }"
          :title="o.exact ? '點一下從這裡播放' : '近似（差一個同功能和弦），點一下從這裡播放'"
          @click="pb?.seek(o.start)"
        >
          {{ fmtTime(o.start) }}–{{ fmtTime(o.end) }}（{{ o.chords.map(prettyChord).join(' ') }}）
        </button>
      </div>

      <!-- 每小節級數 -->
      <div class="sub-title">級數序列 <span class="note">{{ unitText }}，4 格一組</span></div>
      <div class="bars">
        <div v-for="(group, gi) in barGroups" :key="gi" class="group">
          <button
            v-for="b in group"
            :key="b.index"
            type="button"
            class="cell"
            :class="['fn-' + functionOf(b.degree), { hl: highlightedBars.has(b.index), dim: highlightedBars.size && !highlightedBars.has(b.index), now: currentCell === b.index }]"
            :title="`${fmtTime(b.start)}　${prettyChord(b.chord)}${b.alt ? '（另有 ' + prettyChord(b.alt) + '）' : ''}${b.degree?.secondaryLabel ? '　' + b.degree.secondaryLabel : ''}`"
            :aria-label="cellLabel(b)"
            @click="playFrom(b)"
          >
            <span class="bar-no">{{ b.index + 1 }}</span>
            <span class="deg">{{ degreeText(b.degree) }}</span>
            <span class="chord">{{ prettyChord(b.chord) }}<span v-if="b.alt" class="alt">*</span></span>
          </button>
        </div>
      </div>

      <!-- 調外和弦 -->
      <template v-if="nonDiatonicGroups.length">
        <div class="sub-title">調外和弦</div>
        <div class="chip-list">
          <div v-for="n in nonDiatonicGroups" :key="n.chord" class="out fn-out">
            <span class="o-chord">{{ prettyChord(n.chord) }}</span>
            <span class="o-deg">{{ notation === 'roman' ? n.roman : n.label }}</span>
            <span class="o-kind">{{ n.secondaryLabel ? `${KIND_TEXT[n.kind]} ${n.secondaryLabel}` : KIND_TEXT[n.kind] }}</span>
            <span v-if="n.count > 1" class="k-count">×{{ n.count }}</span>
          </div>
        </div>
      </template>

      <div class="legend foot">
        <span v-for="fn in ['T', 'S', 'D']" :key="fn" :class="'fn-' + fn"><i class="swatch"></i>{{ FUNCTION_NAMES[fn] }}（{{ FUNCTION_DEGREES[fn] }}）</span>
        <span class="fn-out"><i class="swatch"></i>{{ FUNCTION_NAMES.out }}</span>
        <span><i class="swatch now-swatch"></i>正在播放</span>
        <span>* 該格內有第二個和弦</span>
      </div>
      <p class="caveat">
        小節以每 {{ beatsPerBar }} 拍為一組、從第一個拍點起算（弱起拍的歌曲會偏移）；結果取決於 BTC 和弦、Essentia 調性與拍點的準確度。
      </p>
    </template>
  </div>
</template>

<style scoped>
.toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.key-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 1rem;
}

.key-chip {
  font-weight: 700;
  color: var(--text);
  background: var(--accent-soft);
  border: 1px solid var(--accent);
  border-radius: 6px;
  padding: 2px 12px;
}

/* 主要循環＋清單 */
.summary {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) 2fr;
  gap: 1.25rem;
  align-items: start;
}

.main-loop {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  text-align: left;
  background: var(--surface2);
  border: 2px solid var(--border);
  border-left: 6px solid var(--accent);
  border-radius: var(--radius-md);
  padding: 1rem 1.25rem;
  color: var(--text);
  transition: border-color 0.15s, background 0.15s;
}

.main-loop:hover {
  border-color: var(--border-strong);
  border-left-color: var(--accent);
}

.main-loop.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.ml-label {
  font-size: 0.9rem;
  color: var(--text2);
}

.ml-degrees {
  font-family: var(--font-mono);
  font-size: 2.4rem;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: 1px;
}

.ml-meta {
  font-size: 0.9rem;
  color: var(--text2);
}

.ml-hint {
  display: block;
  font-size: 0.8rem;
  color: var(--accent);
  font-weight: 500;
  margin-top: 2px;
}

.lists .sub-title:first-child {
  margin-top: 0;
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  text-align: left;
  background: var(--surface2);
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 5px 12px;
  color: var(--text);
  font-size: 0.95rem;
  transition: border-color 0.15s, background 0.15s;
}

.chip:hover {
  border-color: var(--border-strong);
}

.chip.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.k-name {
  font-weight: 700;
  white-space: nowrap;
}

.k-deg {
  font-family: var(--font-mono);
  font-weight: 700;
  white-space: nowrap;
}

.k-count {
  color: var(--muted);
  font-size: 0.85rem;
}

.k-fuzzy {
  color: var(--text2);
  font-size: 0.8rem;
  border-bottom: 2px dotted var(--warning);
}

/* 出現位置 */
.occ {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 1rem;
}

.occ-label {
  font-size: 0.85rem;
  color: var(--muted);
  margin-right: 4px;
}

.occ-item {
  font-size: 0.85rem;
  color: var(--text);
  background: var(--accent-soft);
  border: 1px solid var(--accent);
  border-radius: 6px;
  padding: 2px 10px;
}

.occ-item.fuzzy {
  border-style: dashed;
}

/* 級數格 */
.bars {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.group {
  display: flex;
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

.chord {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text2);
  max-width: 62px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alt {
  color: var(--text);
  font-weight: 700;
}

/* 調外和弦 */
.out {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-left: 5px solid var(--fc);
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 0.95rem;
}

.o-chord {
  font-weight: 700;
}

.o-deg {
  font-family: var(--font-mono);
  font-weight: 700;
}

.o-kind {
  color: var(--text2);
  font-size: 0.85rem;
}

.foot {
  margin-top: 1.25rem;
}

.now-swatch {
  background: transparent;
  border: 3px solid var(--playhead);
}

.caveat {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--muted);
}

@media (max-width: 760px) {
  .summary {
    grid-template-columns: 1fr;
  }

  .cell {
    width: 58px;
  }
}
</style>
