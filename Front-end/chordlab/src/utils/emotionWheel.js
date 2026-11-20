/**
 * 情緒輪座標圖的共用部分：和弦情緒軌跡（harmony/ChordEmotionMap.vue）與音高情緒軌跡（pitch/PitchEmotionMap.vue）
 * - 座標換算（x 正負情緒、y 張力，範圍約 ±10）→ SVG 座標
 * - 圓外的情緒詞、軸標示、象限文字的位置
 * - 軌跡曲線的幾何計算
 * 底圖與標示的畫法在 components/common/EmotionWheelBackdrop.vue
 */

// 座標 → SVG：畫布 1120×960，原點在正中央，每 1 單位 32px
// 背景色輪（以圓心裁成正方形）畫成半徑 10 的圓，±10 剛好在圓周上；圓外留白放情緒詞
export const W = 1120
export const H = 960
export const UNIT = 32
export const R = 10 // 圓周的座標半徑
export const px = (x) => W / 2 + x * UNIT
export const py = (y) => H / 2 - y * UNIT

// 圓周上的情緒詞（Russell 情緒環狀模型的 28 個詞，角度參考使用者提供的示意圖）
// deg：每個詞在圓周上的角度（0° 是右邊的正向，逆時針為正）；同一組的詞疊成一塊文字
// anchor：文字對齊方式，沒寫時依位置自動決定
const RING_WORDS = [
  { deg: [99, 96.7, 93], words: [['緊張', 'tense'], ['驚慌', 'alarmed'], ['生氣', 'angry']] },
  { deg: [73.8, 70], words: [['驚訝', 'astonished'], ['激昂', 'aroused']] },
  { deg: [48.7], words: [['興奮', 'excited']] },
  { deg: [24.9], words: [['欣喜', 'delighted']] },
  { deg: [7.8], words: [['快樂', 'happy']] },
  { deg: [-6.7, -10.6], words: [['高興', 'glad'], ['愉快', 'pleased']] },
  {
    deg: [-31.3, -37.2, -39.7, -41.2, -43, -43.7],
    words: [['平靜', 'calm'], ['放鬆', 'relaxed'], ['滿意', 'satisfied'], ['自在', 'at ease'], ['知足', 'content'], ['安詳', 'serene']],
  },
  { deg: [-92.4, -88.1], words: [['疲倦', 'tired'], ['想睡', 'sleepy']] },
  // 萎靡離疲倦很近，改成靠右對齊往左排，避免疊在一起
  { deg: [-103.5], words: [['萎靡', 'droopy']], anchor: 'end' },
  { deg: [-118.7], words: [['無聊', 'bored']] },
  { deg: [-152.5, -150.9, -149], words: [['難過', 'sad'], ['陰鬱', 'gloomy'], ['沮喪', 'depressed']] },
  { deg: [-171.3], words: [['悲慘', 'miserable']] },
  { deg: [141, 137.6], words: [['苦惱', 'distressed'], ['挫折', 'frustrated']] },
  { deg: [116.8, 122.9], words: [['害怕', 'afraid'], ['煩躁', 'annoyed']] },
]
const RING_LINE = 24 // 情緒詞的行高（px）

const rad = (d) => (d * Math.PI) / 180
export const ringTicks = RING_WORDS.flatMap((g) =>
  g.deg.map((d) => {
    const c = Math.cos(rad(d))
    const s = Math.sin(rad(d))
    return { key: d, x1: px(R * c), y1: py(R * s), x2: px((R + 0.45) * c), y2: py((R + 0.45) * s) }
  }),
)
// 每組文字放在圓外：右側靠左對齊、左側靠右對齊、上下置中；上方的往上疊、下方的往下疊、兩側垂直置中
export const ringLabels = RING_WORDS.map((g) => {
  const d = g.deg.reduce((a, b) => a + b, 0) / g.deg.length
  const c = Math.cos(rad(d))
  const s = Math.sin(rad(d))
  const x = px((R + 0.9) * c)
  const y = py((R + 0.9) * s)
  const n = g.words.length
  const anchor = g.anchor ?? (c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle')
  const top = s > 0.7 ? y - n * RING_LINE + 8 : s < -0.7 ? y + RING_LINE - 4 : y - ((n - 1) * RING_LINE) / 2 + 7
  return { key: d, x, anchor, lines: g.words.map(([zh, en], i) => ({ zh, en, y: top + i * RING_LINE })) }
})

// 圓內：座標軸兩端的方向、四個象限、刻度
export const AXIS_LABELS = [
  { key: 'neg', x: -9.6, y: 0.55, anchor: 'start', text: '← 負向 Negative' },
  { key: 'pos', x: 9.6, y: 0.55, anchor: 'end', text: '正向 Positive →' },
  { key: 'tense', x: 0.35, y: 9.2, anchor: 'start', text: '↑ 緊張 Tense' },
  { key: 'relax', x: 0.35, y: -9.6, anchor: 'start', text: '↓ 放鬆 Relaxed' },
]
export const QUADRANTS = [
  { key: 'nh', x: -4.6, y: 7.6, text: '負向・高張力' },
  { key: 'ph', x: 4.6, y: 7.6, text: '正向・高張力' },
  { key: 'nl', x: -4.6, y: -7.9, text: '負向・低張力' },
  { key: 'pl', x: 4.6, y: -7.9, text: '正向・低張力' },
]
export const AXIS_TICKS = [-10, -5, 5, 10]

export const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)

/** 往行進方向右邊彎的二次曲線：起點、控制點、終點（SVG 座標） */
export function geom(a, b, bend = 0.18) {
  const x1 = px(a.x), y1 = py(a.y), x2 = px(b.x), y2 = py(b.y)
  const dx = x2 - x1, dy = y2 - y1
  return { x1, y1, x2, y2, cx: (x1 + x2) / 2 - dy * bend, cy: (y1 + y2) / 2 + dx * bend }
}

/** 曲線上 t（0～1）的位置 */
export function pointOn(g, t) {
  const u = 1 - t
  return { x: u * u * g.x1 + 2 * u * t * g.cx + t * t * g.x2, y: u * u * g.y1 + 2 * u * t * g.cy + t * t * g.y2 }
}

/** 曲線從起點走到 t 的那一段（de Casteljau 切割） */
export function partialCurve(a, b, t) {
  const g = geom(a, b)
  const qx = g.x1 + (g.cx - g.x1) * t
  const qy = g.y1 + (g.cy - g.y1) * t
  const e = pointOn(g, t)
  return `M${g.x1},${g.y1} Q${qx},${qy} ${e.x},${e.y}`
}

/** 完整曲線；同一點（不會發生，保險起見）回傳空字串 */
export function curve(a, b) {
  const { x1, y1, x2, y2, cx, cy } = geom(a, b)
  if (x1 === x2 && y1 === y2) return ''
  // 終點往回縮一點，箭頭才不會蓋在點上
  const ex = x2 - ((x2 - cx) / Math.hypot(x2 - cx, y2 - cy)) * 18
  const ey = y2 - ((y2 - cy) / Math.hypot(x2 - cx, y2 - cy)) * 18
  return `M${x1},${y1} Q${cx},${cy} ${ex},${ey}`
}

