<script setup>
/**
 * 總樂性元・最終值：在情緒輪上標出這首歌的最終座標（計算方式見 utils/overall.js overallPoint）
 *   最終座標 = 60% 和弦情緒軌跡平均 ＋ 20% 音高情緒軌跡平均 ＋ 20% 速度情緒軌跡平均
 * - 左邊：跟和弦／音高／速度情緒軌跡同一張圖（components/common/EmotionTrajectoryMap.vue）
 *   三個白色錨點是各項的平均座標，虛線連到紅色的最終座標；虛線代表這不是時間上的移動，是加權合成
 * - 右邊：最終座標，以及每一項的平均座標、權重、加權後的值，可以對照算式
 * - 這張卡沒有播放同步（最終值是整首歌一個值，不隨播放改變）
 */
import { ref, computed } from 'vue'
import EmotionTrajectoryMap from '@/components/common/EmotionTrajectoryMap.vue'
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

// 各項的平均座標＝錨點；圖上只標項目名稱，數值在右邊的算式表
const anchors = computed(() => r.value.parts.filter((p) => p.mean).map((p) => ({ key: p.key, ...p.mean, label: p.name, part: p })))
const links = computed(() => (r.value.final ? anchors.value.map((a) => ({ key: a.key, from: a, to: r.value.final })) : []))
const mark = computed(() => (r.value.final ? { ...r.value.final, label: '最終' } : null))

const hoverKey = ref(null)

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

    <div class="emo-layout">
      <EmotionTrajectoryMap
        v-model:hover="hoverKey"
        :anchors="anchors"
        :links="links"
        :mark="mark"
        id-prefix="overall"
        :label="r.final ? `最終座標 ${coord(r.final)}` : '最終座標無法計算'"
      >
        <template #tip="{ point }">
          <strong>{{ point.part.name }}情緒軌跡 {{ coord(point.part.mean) }}</strong>
          <span>權重 {{ pct(point.part.weight) }}</span>
          <span class="muted">加權後 ({{ num(point.part.mean.x * point.part.weight) }}, {{ num(point.part.mean.y * point.part.weight) }})</span>
        </template>
      </EmotionTrajectoryMap>

      <div class="side">
        <div class="now-box" :class="{ empty: !r.final }">
          <div v-if="r.final" class="final">
            <span class="f-label">最終座標</span>
            <span class="hero-value">{{ coord(r.final) }}</span>
            <span class="f-sub">x 效價 Valence {{ num(r.final.x) }}・y 喚醒度 Arousal {{ num(r.final.y) }}</span>
          </div>
          <p v-else class="note">缺少{{ missing.join('、') }}的情緒軌跡（{{ missing.includes('音高') ? '沒有主旋律音高' : '' }}{{ missing.includes('速度') ? '沒有拍點' : '' }}{{ missing.includes('和弦') ? '和弦都沒有座標' : '' }}），無法算出最終座標</p>
        </div>

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
            <tr
              v-for="p in r.parts"
              :key="p.key"
              :class="{ now: hoverKey === p.key }"
              @pointerenter="hoverKey = p.mean ? p.key : null"
              @pointerleave="hoverKey = null"
            >
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
/* 版面與 .now-box 那一塊的共用樣式在 assets/main.css（五張情緒軌跡卡一致） */
.final {
  display: flex;
  flex-direction: column;
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

/* 滑過表格的一列時，圖上對應的點會跟著亮起來 */
.calc tbody tr.now td {
  background: var(--surface2);
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
</style>
