<script setup>
/**
 * 情緒輪座標圖：和弦、音高、速度、綜合軌跡與最終值五張卡共用的那一張圖
 * 底圖（色輪、座標軸、圓外的情緒詞）在 EmotionWheelBackdrop.vue，點與標籤的規格在 utils/emotionWheel.js
 *
 * 圖上畫四層點，由弱到強（規格見 utils/emotionWheel.js 的 DOT_R）：
 *   refPoints  參考點：這首歌沒用到、但先標出來當比例尺的位置
 *   anchors    錨點：這首歌用到的固定位置（和弦性質、最終值的三個分項）
 *   steps      軌跡點：依時間排的每一步。同一個座標的步合成一個點，停留越多段畫越大，
 *              第一步標「N 起」、最後一步標「N 終」；中間的點用「·」串編號
 *   mark／播放中的紅點   現在：播放到的位置，或最終值的最終座標
 *
 * - 有 playback（useTrajectoryPlayback() 的結果）時會畫整首歌的軌跡、最近幾步的紅色軌跡與紅點
 * - 標籤只放「這是誰」，數值留給右邊的面板；重疊的標籤會自動往下錯開（spreadLabels）
 * - 整首歌的軌跡線由淺到深＝時間先後，所以不用每一段都畫箭頭；只有播放中的紅色軌跡有箭頭
 * - 滑過任何一個點時用 v-model:hover 回報它的 key，提示框的內容由使用的元件用 #tip 插槽決定
 */
import { computed } from 'vue'
import EmotionWheelBackdrop from '@/components/common/EmotionWheelBackdrop.vue'
import { W, H, px, py, curve, DOT_R, LABEL_SIZE, labelPos, spreadLabels, stepRadius, dotBox, WHEEL_TEXTS } from '@/utils/emotionWheel.js'
import { posKey } from '@/composables/useTrajectoryPlayback.js'

const props = defineProps({
  // { emo: { x, y, short }, start, end }[]，依時間排序
  steps: { type: Array, default: () => [] },
  // useTrajectoryPlayback() 的結果；沒有播放同步（最終值）時給 null
  playback: { type: Object, default: null },
  // SVG 裡 marker、clipPath 的 id 前綴；同一頁有好幾張圖時要不一樣
  idPrefix: { type: String, required: true },
  label: { type: String, default: '' },
  // { key, x, y, label?, data? }[]
  refPoints: { type: Array, default: () => [] },
  // { key, x, y, label, now?, data? }[]
  anchors: { type: Array, default: () => [] },
  // 整首歌的移動；不給就直接用 steps 依序連起來。{ key, d, width? }[]
  edges: { type: Array, default: null },
  // 虛線（最終值：各分項 → 最終座標）。{ key, from: { x, y }, to: { x, y } }[]
  links: { type: Array, default: () => [] },
  // 靜態的強調點（最終值的最終座標）。{ x, y, label }
  mark: { type: Object, default: null },
  // 多邊形（和弦：目前這一段用到的性質圍成的範圍），SVG points 字串
  shape: { type: String, default: null },
})

const hover = defineModel('hover', { type: String, default: null })

const moveProgress = computed(() => props.playback?.moveProgress.value ?? 1)
const markerPos = computed(() => props.playback?.markerPos.value ?? null)
const trail = computed(() => props.playback?.trail.value ?? [])
const currentStep = computed(() => props.playback?.currentStep.value ?? null)

// 同一個座標的步合成一個點；跟錨點重疊的交給錨點畫（和弦的「和弦順序」版本會這樣）
const anchorKeys = computed(() => new Set(props.anchors.map((a) => posKey(a))))
const stepPoints = computed(() => {
  const map = new Map()
  for (const s of props.steps) {
    const k = posKey(s.emo)
    if (!map.has(k)) map.set(k, { key: k, kind: 'step', x: s.emo.x, y: s.emo.y, steps: [] })
    map.get(k).steps.push(s)
  }
  const first = props.steps[0]
  const last = props.steps[props.steps.length - 1]
  // 整首只落在一個座標上時（例如速度從頭到尾同一區）沒有方向可言，就不要標起終
  const moves = map.size > 1
  return [...map.values()].map((p) => {
    const nums = p.steps.map((s) => s.emo.short).filter(Boolean)
    // 起、終標在點旁邊，軌跡的方向不用另外看圖例就讀得出來。
    // 這種點只標它自己那一段（例如「1 起」），不把同座標合併進來的其他段號也列出來，不然會看成「第 1、5 段都是起點」
    const tag = !moves
      ? []
      : [
          p.steps.includes(first) && `${first.emo.short} 起`,
          p.steps.includes(last) && `${last.emo.short} 終`,
        ].filter(Boolean)
    return {
      ...p,
      tag: tag.length > 0,
      text: tag.length ? tag.join('／') : nums.length > 2 ? `${nums.slice(0, 2).join('·')}…` : nums.join('·'),
      // 同一個座標停留越多段畫越大
      r: stepRadius(p.steps.length),
      // 剛好落在錨點上的那一步（例如整段只用了一種和弦性質）由錨點畫，編號照樣標出來
      dot: !anchorKeys.value.has(p.key),
      now: !!currentStep.value && p.steps.includes(currentStep.value) && moveProgress.value >= 1,
    }
  })
})

/**
 * 整首歌的軌跡。edges 不管是自己接的還是外面給的都照時間排，所以可以用序號算濃度：
 * 線由淺到深＝時間先後。這樣就不必每一段都畫箭頭（十幾個箭頭疊在一起反而看不清楚），
 * 方向改由濃淡與點上的「起／終」來讀；播放中的紅色軌跡仍然有箭頭。
 */
const edgePaths = computed(() => {
  const list =
    props.edges ??
    props.steps
      .slice(1)
      .map((s, i) => ({ key: `${i}-${s.emo.key}`, d: curve(props.steps[i].emo, s.emo) }))
      .filter((e) => e.d)
  const lastI = list.length - 1
  return list.map((e, i) => ({
    ...e,
    // 播放中整條路徑一起壓淡，讓紅色的那幾步跳出來
    opacity: (0.25 + 0.47 * (lastI > 0 ? i / lastI : 1)) * (trail.value.length ? 0.45 : 1),
  }))
})

// 滑過得到的點：參考點、錨點、軌跡點都可以滑
const hoverable = computed(() => [
  ...props.refPoints.map((p) => ({ ...p, kind: 'ref' })),
  ...props.anchors.map((p) => ({ ...p, kind: 'anchor' })),
  ...stepPoints.value,
])
const hoverPoint = computed(() => hoverable.value.find((p) => p.key === hover.value) ?? null)

const tipStyle = computed(() => {
  const p = hoverPoint.value
  if (!p) return {}
  const left = (px(p.x) / W) * 100
  const top = (py(p.y) / H) * 100
  // 點在右半邊時提示放左邊，避免超出卡片
  return { left: `${left}%`, top: `${top}%`, transform: `translate(${left > 55 ? 'calc(-100% - 16px)' : '16px'}, -50%)` }
})

// 圖上所有的點，當作標籤的障礙物（標籤不要壓在圓點上）
const dotBoxes = computed(() => [
  ...props.refPoints.map((p) => dotBox(p, 'ref')),
  ...props.anchors.map((p) => dotBox(p, 'anchor')),
  ...stepPoints.value.filter((p) => p.dot).map((p) => dotBox(p, 'step', p.r)),
  ...(props.mark ? [dotBox(props.mark, 'now')] : []),
])

/**
 * 所有標籤一起算位置，擋到底圖的字、圖上的點或別的標籤就換位置（上面改下面、內側改外側）
 * 順序就是優先順序：最終座標 → 軌跡點 → 錨點 → 參考點（越重要的越先占位子）
 */
const labels = computed(() => {
  const items = []
  if (props.mark?.label) items.push({ id: 'mark', kind: 'now', ...props.mark, text: props.mark.label })
  // 起點、終點先占位子：軌跡的方向就靠它們讀，再擠也一定要標出來
  const ends = stepPoints.value.filter((p) => p.tag)
  for (const p of [...ends, ...stepPoints.value.filter((p) => !p.tag)])
    if (p.text) items.push({ id: `s${p.key}`, kind: 'step', ...p })
  for (const a of props.anchors) if (a.label) items.push({ id: `a${a.key}`, kind: 'anchor', ...a, text: a.label })
  for (const r of props.refPoints) if (r.label) items.push({ id: `r${r.key}`, kind: 'ref', ...r, text: r.label })
  return spreadLabels(
    items.map((it) => {
      const size = LABEL_SIZE[it.kind] ?? LABEL_SIZE.step
      return { id: it.id, kind: it.kind, text: it.text, size, keep: !!it.tag, ...labelPos(it, it.kind, size, it.r) }
    }),
    [...WHEEL_TEXTS, ...dotBoxes.value],
    // 軌跡點很多時（區間平均座標常常擠在圓心附近）硬塞編號會很雜：
    // 貼不到自己的點旁邊就不標，點本身還在，滑過看得到，逐段明細那張卡也列得出來
  ).filter((l) => l.keep || l.kind !== 'step' || l.placed !== 'crowded')
})
const labelOf = computed(() => new Map(labels.value.map((l) => [l.id, l])))
</script>

<template>
  <div class="map-wrap">
    <svg class="map" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="label">
      <defs>
        <marker :id="`${idPrefix}-arrow-now`" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="30" markerHeight="30" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" class="arrow-now" />
        </marker>
      </defs>

      <!-- 背景色輪、座標軸、外圈情緒詞 -->
      <EmotionWheelBackdrop :uid="idPrefix" />

      <!-- 參考點 -->
      <circle
        v-for="r in refPoints"
        :key="r.key"
        :cx="px(r.x)"
        :cy="py(r.y)"
        :r="DOT_R.ref"
        class="dot-ref"
        :class="{ hover: hover === r.key }"
        @pointerenter="hover = r.key"
        @pointerleave="hover = null"
      />

      <!-- 和弦：目前這一段用到的性質圍成的範圍 -->
      <polygon v-if="shape" :points="shape" class="shape" />

      <!-- 最終值：各分項 → 最終座標 -->
      <line v-for="l in links" :key="l.key" :x1="px(l.from.x)" :y1="py(l.from.y)" :x2="px(l.to.x)" :y2="py(l.to.y)" class="link" />

      <!-- 整首歌的軌跡 -->
      <path v-for="e in edgePaths" :key="e.key" :d="e.d" class="edge" :stroke-width="e.width ?? 3.5" :style="{ strokeOpacity: e.opacity }" />

      <!-- 播放中：最近幾步 -->
      <path
        v-for="t in trail"
        :key="t.key"
        :d="t.d"
        class="trail"
        :style="{ opacity: t.opacity }"
        :marker-end="t.arrow ? `url(#${idPrefix}-arrow-now)` : null"
      />

      <!-- 錨點 -->
      <g
        v-for="a in anchors"
        :key="a.key"
        class="pt"
        :class="{ hover: hover === a.key, now: a.now }"
        @pointerenter="hover = a.key"
        @pointerleave="hover = null"
      >
        <circle :cx="px(a.x)" :cy="py(a.y)" :r="DOT_R.anchor" class="dot-anchor" />
      </g>

      <!-- 軌跡點 -->
      <g
        v-for="p in stepPoints"
        v-show="p.dot"
        :key="p.key"
        class="pt"
        :class="{ hover: hover === p.key, now: p.now }"
        @pointerenter="hover = p.key"
        @pointerleave="hover = null"
      >
        <circle :cx="px(p.x)" :cy="py(p.y)" :r="p.r" class="dot-step" />
      </g>

      <!-- 靜態的強調點（最終值） -->
      <g v-if="mark" :transform="`translate(${px(mark.x)}, ${py(mark.y)})`">
        <circle :r="DOT_R.now * 1.8" class="halo" />
        <circle :r="DOT_R.now" class="dot-now" />
      </g>

      <!-- 播放到的位置 -->
      <g v-if="markerPos" :transform="`translate(${markerPos.x}, ${markerPos.y})`">
        <circle :r="DOT_R.now * 1.7" class="pulse" />
        <circle :r="DOT_R.now" class="dot-now" />
      </g>

      <!-- 所有標籤畫在最上面，才不會被點蓋住 -->
      <text
        v-for="l in labels"
        :key="l.id"
        :x="l.x"
        :y="l.y"
        :text-anchor="l.anchor"
        :font-size="l.size"
        class="dot-label"
        :class="l.kind"
        aria-hidden="true"
      >
        {{ l.text }}
      </text>
    </svg>

    <div v-if="hoverPoint" class="chart-tip" :style="tipStyle">
      <slot name="tip" :point="hoverPoint" />
    </div>
  </div>
</template>

<style scoped>
/* 這一整塊（底板、色輪、點線字、tooltip）不跟主題走，白天黑夜都是深色版：
   色輪是飽和色，淺底會把它洗淡，深底才濃得起來。
   深色色票是在 assets/main.css 把 .map-wrap 掛進 :root[data-theme='dark'] 那組宣告，
   所以這裡不用再寫顏色，只排版。色輪本身在 EmotionWheelBackdrop.vue。

   外框刻意不跟著卡片那一套柔影走（assets/main.css 的 --lift／--press）：
   這塊是一張圖，不是一個可以按的東西，一條實線邊框把「圖的範圍到哪裡」講得最清楚，
   深色底板配柔影反而會糊掉邊緣。邊框色用整頁的 --border（不是圓裡面那組深色），
   所以淺色主題下看得到一條淺灰的框，跟 main 一樣 */
.map-wrap {
  position: relative;
  background: var(--wheel-plate);
  border: 1px solid var(--page-border);
  border-radius: var(--radius-md);
}

.map {
  display: block;
  width: 100%;
  height: auto;
}

/* --- 點：四層由弱到強 --- */
.dot-ref {
  fill: var(--muted);
  opacity: 0.4;
  cursor: help;
  transition: opacity 0.15s;
}

.dot-ref.hover {
  opacity: 0.9;
}

.pt {
  cursor: help;
}

/* 錨點是底板色實心＋深色框，軌跡點反過來；兩種都靠底板色的環跟色輪隔開 */
.dot-anchor {
  fill: var(--wheel-plate);
  stroke: var(--text2);
  stroke-width: 3;
  transition:
    fill 0.15s,
    stroke 0.15s;
}

.dot-step {
  fill: var(--text2);
  stroke: var(--wheel-plate);
  stroke-width: 3;
  transition: fill 0.15s;
}

.pt.hover .dot-anchor,
.pt.now .dot-anchor {
  fill: var(--accent);
  stroke: var(--wheel-plate);
}

.pt.hover .dot-step,
.pt.now .dot-step {
  fill: var(--accent);
}

.dot-now {
  fill: var(--playhead);
  stroke: var(--wheel-plate);
  stroke-width: 3.5;
}

.halo {
  fill: var(--playhead);
  opacity: 0.22;
}

.pulse {
  fill: none;
  stroke: var(--playhead);
  stroke-width: 4;
  transform-box: fill-box;
  transform-origin: center;
  animation: pulse 1.2s ease-out infinite;
}

@keyframes pulse {
  from {
    transform: scale(0.7);
    opacity: 0.9;
  }
  to {
    transform: scale(1.8);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pulse {
    animation: none;
    opacity: 0.5;
  }
}

/* --- 線 --- */
/* 濃度由 edgePaths 算：越晚的那一段越濃（線由淺到深＝時間先後） */
.edge {
  fill: none;
  stroke: var(--text2);
  stroke-linecap: round;
  transition: stroke-opacity 0.2s;
}

/* 播放中的那幾步：描一圈底板色，壓在整首軌跡上也分得出來 */
.trail {
  fill: none;
  stroke: var(--playhead);
  stroke-width: 7;
  stroke-linecap: round;
  filter: drop-shadow(0 0 3px var(--wheel-plate));
}

.arrow-now {
  fill: var(--playhead);
}

/* 最終值：各分項 → 最終座標，用虛線表示這不是時間上的移動 */
.link {
  stroke: var(--text2);
  stroke-width: 2.5;
  stroke-dasharray: 8 7;
  opacity: 0.45;
}

/* 和弦：目前這一段用到的性質圍成的範圍 */
.shape {
  fill: var(--playhead);
  fill-opacity: 0.1;
  stroke: var(--playhead);
  stroke-opacity: 0.55;
  stroke-width: 3;
  stroke-dasharray: 10 8;
  stroke-linejoin: round;
}

/* --- 標籤：一般文字色，底板色的細外框當柔光，在彩色上也讀得到 --- */
.dot-label {
  fill: var(--text);
  font-weight: 700;
  font-family: var(--font-sans);
  paint-order: stroke;
  stroke: var(--wheel-plate);
  stroke-width: 4px;
  stroke-linejoin: round;
  pointer-events: none;
}

.dot-label.ref {
  fill: var(--muted);
  font-weight: 600;
  stroke-width: 3.5px;
  opacity: 0.85;
}

.chart-tip {
  white-space: normal;
  width: max-content;
  max-width: 300px;
}
</style>
