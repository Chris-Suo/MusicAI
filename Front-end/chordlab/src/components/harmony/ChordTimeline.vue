<script setup>
/**
 * 和弦時間軸
 * - 色塊顏色＝和聲功能，上面寫級數與和弦名稱；1× 時整首歌放進一個畫面
 * - 點色塊：從那裡開始播放，並在下方顯示這個和弦的組成音
 * - 上方的小節號跟「和弦進行」的級數格一致
 */
import { computed, ref, watch } from 'vue'
import TimeRuler from '@/components/common/TimeRuler.vue'
import ZoomControl from '@/components/common/ZoomControl.vue'
import PlayHead from '@/components/common/PlayHead.vue'
import { useTimeAxis } from '@/composables/useTimeAxis.js'
import { usePlayback, useFollowPlayhead } from '@/composables/usePlayback.js'
import { segmentAt, fmtClock } from '@/utils/stats.js'
import { FUNCTION_NAMES } from '@/utils/music.js'

const props = defineProps({
  timeline: { type: Array, required: true },
  chordInfo: { type: Map, required: true },
  beats: { type: Array, default: () => [] },
  beatsPerBar: { type: Number, default: 4 },
  total: { type: Number, required: true },
  // 和弦進行分析選到的段落：[{ start, end }]
  highlights: { type: Array, default: () => [] },
})

const pb = usePlayback()
const { scroller, zoomIdx, pxPerSec, contentWidth, x, ticks, setZoom, eventTime, reveal, tipStyle } = useTimeAxis(computed(() => props.total))
useFollowPlayhead(scroller, x)

const blocks = computed(() =>
  props.timeline.map((c, i) => {
    const info = props.chordInfo.get(c.chord)
    const w = Math.max(1, x(c.dur) - 2)
    const name = info?.name ?? c.chord
    return {
      i,
      left: x(c.start),
      w,
      fn: info?.fn ?? 'none',
      name: w >= name.length * 9 + 10 ? name : '',
      degree: info?.degree?.label && w >= 22 ? info.degree.label : '',
    }
  }),
)

// 小節號：寬度不夠時每幾小節標一次
const barMarks = computed(() => {
  const b = props.beats
  if (b.length < props.beatsPerBar) return []
  const marks = []
  for (let i = 0; i < b.length; i += props.beatsPerBar) marks.push({ n: i / props.beatsPerBar + 1, left: x(b[i]) })
  const spacing = marks.length > 1 ? marks[1].left - marks[0].left : 100
  const stride = [1, 2, 4, 8, 16].find((s) => s * spacing >= 30) ?? 32
  return marks.map((m) => ({ ...m, label: (m.n - 1) % stride === 0 }))
})

// ---------------------------------------------------------------------------
// 互動
// ---------------------------------------------------------------------------
const hover = ref(null)
const selected = ref(null)

function infoAt(e) {
  const { px, t } = eventTime(e)
  const i = segmentAt(props.timeline, t)
  return i >= 0 ? { px, i } : null
}

function onMove(e) {
  const hit = infoAt(e)
  if (!hit) {
    hover.value = null
    return
  }
  const c = props.timeline[hit.i]
  hover.value = { px: hit.px, chord: c, info: props.chordInfo.get(c.chord) }
}

function onClick(e) {
  const hit = infoAt(e)
  if (!hit) return
  const c = props.timeline[hit.i]
  selected.value = { chord: c, info: props.chordInfo.get(c.chord) }
  pb?.seek(c.start)
}

watch(
  () => props.highlights,
  (hl) => {
    if (hl?.length && !pb?.playing.value) reveal(hl[0].start)
  },
)
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">和弦時間軸</h3>
        <p class="card-desc">顏色代表和聲功能，數字是級數；點一下色塊就從那裡開始播放</p>
      </div>
      <ZoomControl :zoom-idx="zoomIdx" @zoom="setZoom" />
    </div>

    <div v-if="!timeline.length" class="note">沒有和弦資料</div>
    <template v-else>
      <div class="chart-wrap">
        <div ref="scroller" class="scroll">
          <div class="inner" :style="{ width: contentWidth + 'px' }">
            <TimeRuler :ticks="ticks" :px-per-sec="pxPerSec" />

            <div v-if="barMarks.length" class="bar-lane" aria-hidden="true">
              <span v-for="m in barMarks" :key="m.n" class="bar-mark" :class="{ labeled: m.label }" :style="{ left: m.left + 'px' }">
                <template v-if="m.label">{{ m.n }}</template>
              </span>
            </div>

            <div class="chord-lane" @mousemove="onMove" @mouseleave="hover = null" @click="onClick">
              <div
                v-for="b in blocks"
                :key="b.i"
                class="block"
                :class="['fn-' + b.fn, { sel: selected && selected.chord === timeline[b.i] }]"
                :style="{ left: b.left + 'px', width: b.w + 'px' }"
              >
                <span v-if="b.degree" class="b-deg">{{ b.degree }}</span>
                <span v-if="b.name" class="b-name">{{ b.name }}</span>
              </div>

              <div
                v-for="(h, i) in highlights"
                :key="'h' + i"
                class="hl"
                :style="{ left: x(h.start) + 'px', width: Math.max(3, x(h.end) - x(h.start)) + 'px' }"
              ></div>
            </div>

            <PlayHead :px-per-sec="pxPerSec" />
          </div>
        </div>
        <div v-if="hover" class="chart-tip" :style="{ ...tipStyle(hover.px), top: '24px' }">
          <strong>{{ hover.info?.name ?? hover.chord.chord }}</strong>
          <span v-if="hover.info?.degree">級數 {{ hover.info.degree.label }}・{{ hover.info.fnName }}</span>
          <span v-if="hover.info?.tones.length">組成音 {{ hover.info.tones.join(' ') }}</span>
          <span class="muted">{{ fmtClock(hover.chord.start) }} 起・{{ hover.chord.dur.toFixed(2) }} 秒</span>
        </div>
      </div>

      <div class="foot">
        <div class="legend">
          <span v-for="fn in ['T', 'S', 'D', 'out']" :key="fn" :class="'fn-' + fn"><i class="swatch"></i>{{ FUNCTION_NAMES[fn] }}</span>
          <span><i class="swatch none-swatch"></i>無和弦（N）</span>
          <span v-if="highlights.length"><i class="swatch hl-swatch"></i>選取的和弦進行</span>
        </div>
      </div>

      <div v-if="selected" class="detail" :class="'fn-' + (selected.info?.fn ?? 'none')">
        <span class="d-name">{{ selected.info?.name ?? selected.chord.chord }}</span>
        <dl class="d-facts">
          <div v-if="selected.info?.degree">
            <dt>級數</dt>
            <dd class="mono">{{ selected.info.degree.label }}（{{ selected.info.degree.roman }}）</dd>
          </div>
          <div>
            <dt>功能</dt>
            <dd>{{ selected.info?.fnName ?? '—' }}<template v-if="selected.info?.degree?.secondaryLabel">・{{ selected.info.degree.secondaryLabel }}</template></dd>
          </div>
          <div v-if="selected.info?.tones.length">
            <dt>組成音</dt>
            <dd>{{ selected.info.tones.join('・') }}</dd>
          </div>
          <div>
            <dt>時間</dt>
            <dd>{{ fmtClock(selected.chord.start) }}，持續 {{ selected.chord.dur.toFixed(2) }} 秒</dd>
          </div>
        </dl>
        <button class="btn close" type="button" aria-label="關閉" @click="selected = null">✕</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.chart-wrap {
  position: relative;
}

.scroll {
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 6px;
}

.inner {
  position: relative;
  /* 最右邊的刻度、小節號超出內容寬度時裁掉，避免整首（1×）時出現捲軸 */
  overflow-x: clip;
}

.bar-lane {
  position: relative;
  height: 20px;
  margin-top: 2px;
}

.bar-mark {
  position: absolute;
  top: 6px;
  height: 14px;
  border-left: 1px solid var(--axis);
}

.bar-mark.labeled {
  top: 0;
  height: 20px;
  border-left: 2px solid var(--border-strong);
  padding-left: 3px;
  font-size: 12px;
  line-height: 14px;
  font-weight: 700;
  color: var(--text2);
}

.chord-lane {
  position: relative;
  height: 60px;
  cursor: pointer;
}

.block {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 4px;
  background: color-mix(in srgb, var(--fc) var(--tint), var(--surface));
  border-top: 5px solid var(--fc);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 5px;
  overflow: hidden;
  line-height: 1.2;
  white-space: nowrap;
}

.block.fn-none {
  background: var(--surface2);
  border-top-color: var(--surface3);
}

.block.sel {
  outline: 2px solid var(--text);
  outline-offset: -2px;
}

.b-deg {
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}

.b-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text2);
}

.hl {
  position: absolute;
  top: -4px;
  bottom: -4px;
  border: 3px solid var(--accent);
  border-radius: 6px;
  pointer-events: none;
}

.foot {
  margin-top: 0.75rem;
}

.hl-swatch {
  background: transparent;
  border: 3px solid var(--accent);
}

.none-swatch {
  background: var(--surface2);
  border: 1px solid var(--border-strong);
}

.detail {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.5rem;
  margin-top: 1rem;
  padding: 0.85rem 3rem 0.85rem 1rem;
  border-radius: var(--radius-md);
  background: var(--surface2);
  border-left: 6px solid var(--fc);
}

.d-name {
  font-size: 1.6rem;
  font-weight: 700;
}

.d-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.75rem;
}

.d-facts dt {
  font-size: 0.8rem;
  color: var(--muted);
}

.d-facts dd {
  font-weight: 700;
}

.mono {
  font-family: var(--font-mono);
}

.close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  padding: 0;
}
</style>
