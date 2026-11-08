<script setup>
/**
 * 和弦占比：依出現時間計算
 * - 上方：和聲功能（主／下屬／屬／調外）占整首歌的比例，也是這個分頁的顏色圖例
 * - 下方：前幾名和弦的占比，其餘合併成「其他」
 */
import { computed } from 'vue'
import ShareBars from '@/components/common/ShareBars.vue'
import { FUNCTION_NAMES, chordShares } from '@/utils/chords.js'
import { splitTop } from '@/utils/stats.js'

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

const rows = computed(() => {
  const { top, rest } = splitTop(shares.value.byChord)
  const out = top.map(({ chord, share }) => {
    const info = props.chordInfo.get(chord)
    return { key: chord, name: info.name, sub: info.degree?.label ?? '', share, color: fnColor(info.fn), title: info.fnName }
  })
  if (rest.length) out.push({ key: 'other', name: `其他 ${rest.length} 種`, share: rest.reduce((s, r) => s + r.share, 0), other: true })
  return out
})
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
