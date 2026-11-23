<script setup>
/**
 * 旋律音域：最低音到最高音（排除最極端 1% 的偵測誤差），畫在鋼琴鍵盤上
 * （最常出現的音在「音高占比」，這裡不重複）
 * 下面附音區對照表（八度編號、名稱、該八度 C～B 的頻率），這首歌涵蓋到的音區會標起來。
 * 表的內容與顏色跟「音高占比」「音高占比(Hz)」共用 utils/pitch.js 的 OCTAVE_TABLE、octaveColor
 */
import { computed } from 'vue'
import { fmtHz } from '@/utils/theory.js'
import { OCTAVE_TABLE, octaveColor } from '@/utils/pitch.js'

const props = defineProps({
  // utils/pitch.js analyzePitch() 的結果（後端沒有音高資料時 ResultsPanel 不顯示這張卡）
  stats: { type: Object, required: true },
})

const KEY_W = 22
const KEY_H = 78
const BLACK_H = 48
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11]
const BLACK_OFFSET = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 } // 黑鍵在第幾個白鍵右邊

const ready = computed(() => !!props.stats.low)

// 鍵盤範圍：涵蓋音域的完整八度，至少兩個八度
const keyboard = computed(() => {
  if (!ready.value) return null
  const { low, high } = props.stats
  let firstOct = Math.floor(low.midi / 12)
  let lastOct = Math.floor(high.midi / 12)
  if (lastOct - firstOct < 1) lastOct = firstOct + 1
  const whites = []
  const blacks = []
  for (let o = firstOct; o <= lastOct; o++) {
    const base = (o - firstOct) * 7
    WHITE_PCS.forEach((pc, i) => {
      const m = o * 12 + pc
      whites.push({ m, x: (base + i) * KEY_W, inRange: m >= low.midi && m <= high.midi, label: pc === 0 ? `C${o - 1}` : '' })
    })
    for (const [pc, after] of Object.entries(BLACK_OFFSET)) {
      const m = o * 12 + Number(pc)
      blacks.push({ m, x: (base + after + 1) * KEY_W - 7, inRange: m >= low.midi && m <= high.midi })
    }
  }
  return { whites, blacks, width: whites.length * KEY_W }
})

// 音區對照表；這首歌的音域碰到的那幾列標起來（這個八度的 C～B 與音域有重疊就算）
const rows = computed(() =>
  OCTAVE_TABLE.map((o) => {
    const lo = (o.octave + 1) * 12
    return {
      ...o,
      color: octaveColor(o.octave),
      inRange: ready.value && lo + 11 >= props.stats.low.midi && lo <= props.stats.high.midi,
    }
  }),
)

const keyCenter = (k) => (k.black ? k.x + 7 : k.x + KEY_W / 2)
const octaves = (semis) => (semis / 12).toFixed(1)
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">旋律音域</h3>
      </div>
    </div>

    <div v-if="!ready" class="note">這首歌沒有偵測到明顯的主旋律</div>
    <template v-else>
      <p class="range">
        <strong>{{ stats.low.name }} – {{ stats.high.name }}</strong>
        <span class="range-hz">{{ fmtHz(stats.low.hz) }} – {{ fmtHz(stats.high.hz) }}・{{ stats.rangeSemis }} 個半音（約 {{ octaves(stats.rangeSemis) }} 個八度）</span>
      </p>

      <svg
        v-if="keyboard"
        class="piano"
        :viewBox="`-2 -2 ${keyboard.width + 4} ${KEY_H + 26}`"
        role="img"
        :aria-label="`音域 ${stats.low.name} 到 ${stats.high.name}`"
      >
        <rect
          v-for="k in keyboard.whites"
          :key="'w' + k.m"
          :x="k.x"
          y="0"
          :width="KEY_W"
          :height="KEY_H"
          rx="3"
          class="white"
          :class="{ in: k.inRange }"
        />
        <rect
          v-for="k in keyboard.blacks"
          :key="'b' + k.m"
          :x="k.x"
          y="0"
          width="14"
          :height="BLACK_H"
          rx="2"
          class="black"
          :class="{ in: k.inRange }"
        />
        <!-- C 的音名 -->
        <text v-for="k in keyboard.whites.filter((w) => w.label)" :key="'l' + k.m" :x="k.x + KEY_W / 2" :y="KEY_H + 16" text-anchor="middle" class="svg-axis-text">
          {{ k.label }}{{ k.label === 'C4' ? ' 中央C' : '' }}
        </text>
      </svg>

      <div class="sub-title">音區對照</div>
      <table class="octaves">
        <thead>
          <tr>
            <th scope="col">八度</th>
            <th scope="col">名稱</th>
            <th scope="col" class="num">標準頻率（C～B）</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in rows" :key="o.octave" :class="{ in: o.inRange }">
            <td class="oct"><span class="chip" :style="{ background: o.color }" />{{ o.octave }}</td>
            <td>{{ o.name }}</td>
            <td class="num">{{ fmtHz(o.fromHz) }} – {{ fmtHz(o.toHz) }}</td>
          </tr>
        </tbody>
      </table>
      <p class="note">標起來的是這首歌的旋律碰到的音區；八度編號用科學音高記號，中央 C 是 C4</p>
    </template>
  </div>
</template>

<style scoped>
.range {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 14px;
}

.range strong {
  font-size: 2rem;
  line-height: 1.2;
}

.range-hz {
  font-size: 0.95rem;
  color: var(--text2);
}

.piano {
  display: block;
  width: 100%;
  height: auto;
  max-height: 150px;
  margin-top: 1.25rem;
}

/* 鍵盤保持真實鋼琴的黑白，兩種主題都一樣 */
.white {
  fill: #fbfbfd;
  stroke: #9ea5b9;
  stroke-width: 1;
}

.white.in {
  fill: color-mix(in srgb, var(--c-pitch) 35%, #ffffff);
}

.black {
  fill: #262a36;
}

.black.in {
  fill: var(--c-pitch);
}

/* 音區對照表 */
.octaves {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.octaves th {
  text-align: left;
  font-weight: 600;
  color: var(--muted);
  padding: 4px 8px;
  border-bottom: 1px solid var(--border-strong);
  white-space: nowrap;
}

.octaves td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--border);
  color: var(--text2);
}

.octaves tbody tr:last-child td {
  border-bottom: none;
}

/* 這首歌碰到的音區 */
.octaves tr.in td {
  background: var(--surface2);
  color: var(--text);
  font-weight: 600;
}

.octaves .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.octaves .oct {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* 顏色跟「音高占比」上方的音區色條一致 */
.chip {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  margin-right: 6px;
  vertical-align: baseline;
}
</style>
