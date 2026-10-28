<script setup>
/**
 * 調性與和弦進行分析
 * 使用 utils/progression.js：把 BTC 和弦 + Essentia 調性／拍點轉成每小節的級數，
 * 並找出已知和弦進行（1-5-6-4、6-4-5-1…）與這首歌反覆出現的循環。
 */
import { ref, computed, watch } from 'vue'
import SectionLabel from '@/components/SectionLabel.vue'
import { analyzeProgression, FUNCTION_GROUP } from '@/utils/progression.js'

const props = defineProps({
  timeline: { type: Array, required: true },
  keyName: { type: String, default: '' },
  beats: { type: Array, default: () => [] },
  beatsPerBar: { type: Number, default: 4 },
})

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
  return { name: k.name, estimated: !!k.estimated, relative: rel }
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
  if (!label || label === 'N') return 'N'
  const [root, q = 'maj'] = label.split(':')
  const short = { maj: '', min: 'm', '7': '7', maj7: 'maj7', min7: 'm7', dim: '°', hdim7: 'ø7', dim7: '°7', aug: '+', min6: 'm6', maj6: '6', minmaj7: 'm(maj7)', sus2: 'sus2', sus4: 'sus4' }
  return root + (short[q.split('/')[0]] ?? ':' + q)
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

// 換資料或換單位時清掉選取
watch(
  () => [props.timeline, props.keyName, unit.value],
  () => {
    selected.value = null
  },
)
</script>

<template>
  <div class="section">
    <SectionLabel>和弦進行分析</SectionLabel>
    <div class="wrap">
      <div v-if="!result.bars.length" class="empty">沒有足夠的和弦資料可以分析</div>

      <template v-else>
        <!-- 調性與設定 -->
        <div class="toolbar">
          <div v-if="keyLine" class="key-info">
            <span class="key-chip">{{ keyLine.name }}</span>
            <span v-if="keyLine.estimated" class="note">（Essentia 沒有調性，依和弦推估）</span>
            <span v-if="keyLine.relative && notation === 'number'" class="note">
              簡譜級數以關係大調 {{ keyLine.relative }} 計算
            </span>
          </div>
          <div class="toggles">
            <div class="seg">
              <button :class="{ on: notation === 'number' }" type="button" @click="notation = 'number'">1 5 6 4</button>
              <button :class="{ on: notation === 'roman' }" type="button" @click="notation = 'roman'">I V vi IV</button>
            </div>
            <div class="seg">
              <button :class="{ on: unit === 'bar' }" type="button" @click="unit = 'bar'">小節</button>
              <button :class="{ on: unit === 'half' }" type="button" @click="unit = 'half'">半小節</button>
            </div>
          </div>
        </div>

        <!-- 主要循環 -->
        <div v-if="mainLoop" class="main-loop" :class="{ active: isSelected('loop', mainLoop.degrees.join('-')) }"
             @click="select('loop', mainLoop.degrees.join('-'))">
          <div class="ml-label">這首歌的主要循環</div>
          <div class="ml-degrees">{{ degreesText(mainLoop.degrees) }}</div>
          <div class="ml-meta">
            出現 {{ mainLoop.count }} 次
            <span v-if="mainLoop.family">．屬於「{{ mainLoop.family.name }}」</span>
            <span class="ml-hint">點擊在下方標示</span>
          </div>
        </div>

        <!-- 已知進行 -->
        <div class="sub-title">找到的常見和弦進行</div>
        <div v-if="result.known.length" class="known-list">
          <button
            v-for="k in result.known"
            :key="k.id"
            type="button"
            class="known"
            :class="{ active: isSelected('known', k.id) }"
            @click="select('known', k.id)"
          >
            <span class="k-name">{{ k.name }}</span>
            <span class="k-deg">{{ degreesText(k.degrees) }}</span>
            <span class="k-count">×{{ k.count }}</span>
            <span v-if="k.exactCount < k.count" class="k-fuzzy" title="其中有幾次差一個同功能和弦">
              含 {{ k.count - k.exactCount }} 次近似
            </span>
          </button>
        </div>
        <div v-else class="note">沒有找到字典裡的常見進行</div>

        <!-- 其他反覆循環 -->
        <template v-if="extraLoops.length">
          <div class="sub-title">其他反覆出現的循環</div>
          <div class="loop-list">
            <button
              v-for="l in extraLoops"
              :key="l.degrees.join('-')"
              type="button"
              class="loop"
              :class="{ active: isSelected('loop', l.degrees.join('-')) }"
              @click="select('loop', l.degrees.join('-'))"
            >
              {{ degreesText(l.degrees) }} <span class="k-count">×{{ l.count }}</span>
            </button>
          </div>
        </template>

        <!-- 選取的出現位置 -->
        <div v-if="selectedOccurrences.length" class="occ">
          <span v-for="(o, i) in selectedOccurrences" :key="i" class="occ-item" :class="{ fuzzy: !o.exact }">
            {{ fmtTime(o.start) }}–{{ fmtTime(o.end) }}（{{ o.chords.map(prettyChord).join(' ') }}）
          </span>
        </div>

        <!-- 每小節級數 -->
        <div class="sub-title">
          級數序列 <span class="note">{{ unitText }}</span>
        </div>
        <div class="bars">
          <div v-for="(group, gi) in barGroups" :key="gi" class="group">
            <div
              v-for="b in group"
              :key="b.index"
              class="cell"
              :class="['f-' + functionOf(b.degree), { hl: highlightedBars.has(b.index), dim: highlightedBars.size && !highlightedBars.has(b.index) }]"
              :title="`${fmtTime(b.start)}　${prettyChord(b.chord)}${b.alt ? '（另有 ' + prettyChord(b.alt) + '）' : ''}${b.degree?.secondaryLabel ? '　' + b.degree.secondaryLabel : ''}`"
            >
              <span class="bar-no">{{ b.index + 1 }}</span>
              <span class="deg">{{ degreeText(b.degree) }}</span>
              <span class="chord">{{ prettyChord(b.chord) }}<span v-if="b.alt" class="alt">*</span></span>
            </div>
          </div>
        </div>

        <!-- 調外和弦 -->
        <template v-if="nonDiatonicGroups.length">
          <div class="sub-title">調外和弦</div>
          <div class="out-list">
            <div v-for="n in nonDiatonicGroups" :key="n.chord" class="out">
              <span class="o-chord">{{ prettyChord(n.chord) }}</span>
              <span class="o-deg">{{ notation === 'roman' ? n.roman : n.label }}</span>
              <span class="o-kind">{{ n.secondaryLabel ? `${KIND_TEXT[n.kind]} ${n.secondaryLabel}` : KIND_TEXT[n.kind] }}</span>
              <span v-if="n.count > 1" class="k-count">×{{ n.count }}</span>
            </div>
          </div>
        </template>

        <div class="legend">
          <span><i class="sw f-T"></i>主功能（1 3 6）</span>
          <span><i class="sw f-S"></i>下屬功能（2 4）</span>
          <span><i class="sw f-D"></i>屬功能（5 7）</span>
          <span><i class="sw f-out"></i>調外和弦</span>
          <span>* 該格內有第二個和弦</span>
        </div>
        <div class="caveat">
          小節以每 {{ beatsPerBar }} 拍為一組、從第一個拍點起算（弱起拍的歌曲會偏移）；結果取決於 BTC 和弦、Essentia 調性與拍點的準確度。
        </div>
      </template>
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
  --f-T: #4ecfb3;
  --f-S: #f5a623;
  --f-D: #e84393;
  --f-out: #5cb8ff;
}

.empty,
.note {
  font-size: 12px;
  color: var(--muted);
}

/* 工具列 */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 1rem;
}

.key-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.key-chip {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
  background: rgba(124, 106, 245, 0.12);
  border: 0.5px solid rgba(124, 106, 245, 0.35);
  border-radius: 6px;
  padding: 3px 10px;
}

.toggles {
  display: flex;
  gap: 8px;
}

.seg {
  display: inline-flex;
  background: var(--surface2);
  border: 0.5px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.seg button {
  background: none;
  border: none;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 4px 10px;
  cursor: pointer;
}

.seg button.on {
  background: rgba(124, 106, 245, 0.2);
  color: var(--text);
}

/* 主要循環 */
.main-loop {
  background: var(--surface2);
  border: 0.5px solid var(--border);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius-md);
  padding: 0.9rem 1rem;
  margin-bottom: 1rem;
  cursor: pointer;
  transition: border-color 0.15s;
}

.main-loop.active {
  border-color: var(--accent);
}

.ml-label {
  font-size: 11px;
  color: var(--muted);
}

.ml-degrees {
  font-family: var(--font-mono);
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text);
}

.ml-meta {
  font-size: 12px;
  color: var(--muted);
}

.ml-hint {
  margin-left: 8px;
  opacity: 0.6;
}

.sub-title {
  font-size: 12px;
  color: var(--muted);
  margin: 1rem 0 0.5rem;
  display: flex;
  gap: 8px;
  align-items: baseline;
}

/* 已知進行 / 循環 */
.known-list,
.loop-list,
.out-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.known,
.loop {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  background: var(--surface2);
  border: 0.5px solid var(--border);
  border-radius: 8px;
  padding: 6px 12px;
  color: var(--text);
  cursor: pointer;
  font-size: 12px;
  font-family: var(--font-mono);
  transition: border-color 0.15s, background 0.15s;
}

.known:hover,
.loop:hover {
  border-color: rgba(124, 106, 245, 0.5);
}

.known.active,
.loop.active {
  border-color: var(--accent);
  background: rgba(124, 106, 245, 0.15);
}

.k-name {
  font-family: var(--font-sans);
  font-weight: 700;
}

.k-deg {
  color: var(--accent2);
}

.k-count {
  color: var(--muted);
  font-size: 11px;
}

.k-fuzzy {
  color: var(--accent3);
  font-size: 10px;
  font-family: var(--font-sans);
}

/* 出現位置 */
.occ {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 0.6rem;
}

.occ-item {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text);
  background: rgba(124, 106, 245, 0.12);
  border-radius: 4px;
  padding: 2px 8px;
}

.occ-item.fuzzy {
  background: rgba(245, 166, 35, 0.12);
}

/* 級數格 */
.bars {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.group {
  display: flex;
  gap: 3px;
}

.cell {
  position: relative;
  width: 52px;
  height: 54px;
  border-radius: 6px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-top: 3px solid var(--fc, var(--border));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s, transform 0.15s;
}

.cell.f-T { --fc: var(--f-T); }
.cell.f-S { --fc: var(--f-S); }
.cell.f-D { --fc: var(--f-D); }
.cell.f-out { --fc: var(--f-out); }
.cell.f-none { opacity: 0.5; }

.cell.hl {
  background: rgba(124, 106, 245, 0.22);
  border-color: var(--accent);
  border-top-color: var(--fc, var(--accent));
  transform: translateY(-2px);
}

.cell.dim {
  opacity: 0.35;
}

.bar-no {
  position: absolute;
  top: 1px;
  left: 4px;
  font-size: 8px;
  font-family: var(--font-mono);
  color: var(--muted);
}

.deg {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 700;
  color: var(--fc, var(--muted));
  line-height: 1.1;
}

.chord {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--muted);
  max-width: 48px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alt {
  color: var(--accent3);
}

/* 調外和弦 */
.out {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  background: var(--surface2);
  border: 0.5px solid var(--border);
  border-left: 3px solid var(--f-out);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
}

.o-chord {
  font-family: var(--font-mono);
  font-weight: 700;
}

.o-deg {
  font-family: var(--font-mono);
  color: var(--f-out);
}

.o-kind {
  color: var(--muted);
  font-size: 11px;
}

/* 圖例 */
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin-top: 1rem;
  font-size: 11px;
  color: var(--muted);
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.sw {
  display: inline-block;
  width: 12px;
  height: 4px;
  border-radius: 2px;
}

.sw.f-T { background: var(--f-T); }
.sw.f-S { background: var(--f-S); }
.sw.f-D { background: var(--f-D); }
.sw.f-out { background: var(--f-out); }

.caveat {
  margin-top: 0.5rem;
  font-size: 10px;
  color: var(--muted);
  opacity: 0.8;
}
</style>
