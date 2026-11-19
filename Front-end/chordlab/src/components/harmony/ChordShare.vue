<script setup>
/**
 * 和弦占比：依出現時間計算
 * - 上方：和聲功能（主／下屬／屬／調外）占整首歌的比例，也是這個分頁的顏色圖例
 * - 下方：每個和弦的占比，依占比由多到少排
 */
import { computed } from 'vue'
import ShareBars from '@/components/common/ShareBars.vue'
import { FUNCTION_NAMES, chordShares } from '@/utils/chords.js'

const props = defineProps({
  timeline: { type: Array, required: true },
  // utils/chords.js buildChordInfo() 的結果
  chordInfo: { type: Map, required: true },
})

const fnColor = (fn) => (fn === 'none' ? 'var(--c-muted-series)' : `var(--f-${fn})`)

const shares = computed(() => chordShares(props.timeline, props.chordInfo))

const groups = computed(() =>
  ['T', 'S', 'D', 'out', 'none']
    .map((fn) => ({ key: fn, label: FUNCTION_NAMES[fn], share: shares.value.byFunction[fn], color: fnColor(fn), muted: fn === 'none' }))
    // 「無和弦」只有明顯時才列出
    .filter((g) => (g.key === 'none' ? g.share >= 0.01 : g.share > 0)),
)

// 每個和弦一條，依占比由多到少排（chordShares() 的 byChord 已經排好）
// 依音階排的版本（簡譜 1 → 7，同一級占比多的在前）：在 .map 前面加上
//   .sort((a, b) => (props.chordInfo.get(a.chord).degree?.semitone ?? 12) - (props.chordInfo.get(b.chord).degree?.semitone ?? 12))
const rows = computed(() =>
  shares.value.byChord.map(({ chord, share }) => {
    const info = props.chordInfo.get(chord)
    return { key: chord, name: info.name, sub: info.degree?.label ?? '', share, color: fnColor(info.fn), title: info.fnName }
  }),
)
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">和弦占比</h3>
        <p class="card-desc">依出現時間計算</p>
      </div>
    </div>

    <ShareBars :groups="groups" :rows="rows" label="和聲功能" />
  </div>
</template>
