<script setup>
/**
 * 總樂性元・最終值：在情緒輪上標出這首歌的最終座標（計算方式見 utils/overall.js overallPoint）
 *   最終座標 = 60% 和弦情緒軌跡平均 ＋ 20% 音高情緒軌跡平均 ＋ 20% 速度情緒軌跡平均
 * - 左邊：跟和弦／音高／速度情緒軌跡同一張圖；三個小點是各項的平均座標，虛線連到最終座標
 * - 右邊：最終座標，以及每一項的平均座標、權重、加權後的值，可以對照算式
 */
import { computed } from 'vue'
import EmotionWheelBackdrop from '@/components/common/EmotionWheelBackdrop.vue'
import { W, H, px, py } from '@/utils/emotionWheel.js'
import { overallPoint } from '@/utils/overall.js'

const props = defineProps({
  timeline: { type: Array, required: true },
  // utils/pitch.js normalizeContour() 的結果
  contour: { type: Object, default: null },
  beats: { type: Array, default: () => [] },
  // 整首歌長度（秒）
  length: { type: Number, required: true },
  // 調性：音名寫法、速度軌跡用大調或小調的位置
  keyInfo: { type: Object, default: null },
})

const r = computed(() =>
  overallPoint({ timeline: props.timeline, contour: props.contour, beats: props.beats, length: props.length, key: props.keyInfo }),
)

const missing = computed(() => r.value.parts.filter((p) => !p.mean).map((p) => p.name))

// 各項的標籤放在點的哪一側：離最終座標遠的那一邊，避免跟最終座標疊在一起；
// 同一側的兩個標籤靠太近時（例如和弦與音高的平均座標差不多），後面那個往下錯開一行
const LABEL_GAP = 28
const partPoints = computed(() => {
  const pts = r.value.parts
    .filter((p) => p.mean)
    .map((p) => {
      const right = !r.value.final || p.mean.x >= r.value.final.x
      return { ...p, x: px(p.mean.x), y: py(p.mean.y), lx: px(p.mean.x) + (right ? 16 : -16), ly: py(p.mean.y) + 7, anchor: right ? 'start' : 'end' }
    })
  for (let i = 1; i < pts.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = pts[j]
      const b = pts[i]
      if (a.anchor === b.anchor && Math.abs(a.lx - b.lx) < 140 && Math.abs(a.ly - b.ly) < LABEL_GAP) b.ly = a.ly + LABEL_GAP
    }
  }
  return pts
})

const num = (v) => (Math.round(v * 10) / 10).toFixed(1)
const coord = (p) => `(${num(p.x)}, ${num(p.y)})`
const pct = (w) => `${Math.round(w * 100)}%`
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">最終值</h3>
        <p class="card-desc">和弦 60%、音高 20%、速度 20%：三條情緒軌跡的平均座標依權重加總（x 效價、y 喚醒度）</p>
      </div>
    </div>

    <div class="layout">
      <div class="map-wrap">
        <svg class="map" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="r.final ? `最終座標 ${coord(r.final)}` : '最終座標無法計算'">
          <!-- 背景色輪、座標軸、外圈情緒詞（跟其他情緒軌跡共用） -->
          <EmotionWheelBackdrop clip-id="overall-clip" />

          <!-- 各項平均座標 → 最終座標 -->
          <template v-if="r.final">
            <line
              v-for="p in partPoints"
              :key="'l' + p.key"
              :x1="p.x"
              :y1="p.y"
              :x2="px(r.final.x)"
              :y2="py(r.final.y)"
              class="link"
            />
          </template>
          <g v-for="p in partPoints" :key="p.key" class="part">
            <circle :cx="p.x" :cy="p.y" r="10" class="part-dot" />
            <text :x="p.lx" :y="p.ly" :text-anchor="p.anchor" class="part-label">{{ p.name }} {{ pct(p.weight) }}</text>
          </g>

          <!-- 最終座標 -->
          <g v-if="r.final" :transform="`translate(${px(r.final.x)}, ${py(r.final.y)})`" class="final">
            <circle r="26" class="final-halo" />
            <circle r="15" class="final-dot" />
            <!-- 標籤放在點的下方（上方常有各項的點和軸名） -->
            <text y="56" text-anchor="middle" class="final-label">最終 {{ coord(r.final) }}</text>
          </g>
        </svg>
      </div>

      <div class="side">
        <div v-if="r.final" class="final-box">
          <span class="f-label">最終座標</span>
          <span class="hero-value">{{ coord(r.final) }}</span>
          <span class="f-sub">x 效價 Valence {{ num(r.final.x) }}・y 喚醒度 Arousal {{ num(r.final.y) }}</span>
        </div>
        <p v-else class="note">缺少{{ missing.join('、') }}的情緒軌跡（{{ missing.includes('音高') ? '沒有主旋律音高' : '' }}{{ missing.includes('速度') ? '沒有拍點' : '' }}{{ missing.includes('和弦') ? '和弦都沒有座標' : '' }}），無法算出最終座標</p>

        <div class="sub-title">算式</div>
        <table class="calc">
          <thead>
            <tr>
              <th scope="col">項目</th>
              <th scope="col" class="num">平均座標</th>
              <th scope="col" class="num">權重</th>
              <th scope="col" class="num">加權後</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in r.parts" :key="p.key">
              <td>{{ p.name }}情緒軌跡</td>
              <td class="num">{{ p.mean ? coord(p.mean) : '—' }}</td>
              <td class="num">× {{ pct(p.weight) }}</td>
              <td class="num strong">{{ p.mean ? `(${num(p.mean.x * p.weight)}, ${num(p.mean.y * p.weight)})` : '—' }}</td>
            </tr>
          </tbody>
          <tfoot v-if="r.final">
            <tr>
              <td>加總＝最終座標</td>
              <td />
              <td />
              <td class="num strong">{{ coord(r.final) }}</td>
            </tr>
          </tfoot>
        </table>
        <p class="note hint">
          各項的平均座標是那條軌跡所有點依時間長短加權平均；加權後的值四捨五入到小數一位，自己加起來可能跟最終座標差 0.1
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(0, 700px) minmax(240px, 1fr);
  gap: 1.5rem;
  align-items: start;
}

/* 跟其他情緒軌跡一樣放在深色底板上 */
.map-wrap {
  background: #0d0f16;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.map {
  display: block;
  width: 100%;
  height: auto;
}

.link {
  stroke: #ffffff;
  stroke-width: 2.5;
  stroke-dasharray: 8 7;
  opacity: 0.75;
}

.part-dot {
  fill: #ffffff;
  stroke: #11131c;
  stroke-width: 4;
}

.part-label,
.final-label {
  fill: #ffffff;
  font-weight: 700;
  font-family: var(--font-sans);
  paint-order: stroke;
  stroke: #0b0d16;
  stroke-linejoin: round;
}

.part-label {
  font-size: 22px;
  stroke-width: 6px;
}

.final-label {
  font-size: 26px;
  stroke-width: 7px;
}

.final-halo {
  fill: var(--playhead);
  opacity: 0.35;
}

.final-dot {
  fill: var(--playhead);
  stroke: #ffffff;
  stroke-width: 5;
}

.final-box {
  display: flex;
  flex-direction: column;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-left: 5px solid var(--playhead);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
}

.f-label {
  font-size: 0.9rem;
  color: var(--muted);
}

.f-sub {
  font-size: 0.85rem;
  color: var(--text2);
}

.calc {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.calc th {
  text-align: left;
  font-weight: 600;
  color: var(--muted);
  padding: 4px 8px;
  border-bottom: 1px solid var(--border-strong);
}

.calc td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--border);
  color: var(--text2);
}

.calc tfoot td {
  border-bottom: none;
  border-top: 1px solid var(--border-strong);
  color: var(--text);
  font-weight: 600;
}

.calc .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.calc .strong {
  color: var(--text);
  font-weight: 700;
}

.hint {
  margin-top: 0.5rem;
}

@media (max-width: 860px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
