/**
 * 情緒輪座標圖的共用部分：和弦／音高／速度／綜合軌跡與最終值五張卡都用這一套
 * - 座標換算（x 效價 Valence、y 喚醒度 Arousal，範圍約 ±10）→ SVG 座標
 * - 圓外的情緒詞、軸標示、象限文字的位置
 * - 軌跡曲線的幾何計算
 * - 點與標籤的規格（DOT_R、LABEL_SIZE）與標籤避讓（spreadLabels）
 * 畫的地方：底圖在 components/common/EmotionWheelBackdrop.vue，
 * 點、線、標籤與播放紅點在 components/common/EmotionTrajectoryMap.vue
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
  // X 軸（效價 Valence）：負向情緒 至 正向情緒；軸名放在右端上方
  { key: 'neg', x: -9.6, y: 0.55, anchor: 'start', text: '← 負向情緒' },
  { key: 'pos', x: 9.6, y: 0.55, anchor: 'end', text: '正向情緒 →' },
  { key: 'x-name', x: 9.6, y: 1.35, anchor: 'end', text: 'X 軸：效價 Valence', sub: true },
  // Y 軸（喚醒度 Arousal）：低生理喚醒 Low Arousal / Relax 至 高生理喚醒 High Arousal / Tense
  // 英文放第二行（字太長放一行會壓到圓外的情緒詞）；軸名放在上端左邊
  { key: 'high', x: 0.35, y: 9.2, anchor: 'start', text: '↑ 高生理喚醒' },
  { key: 'high-en', x: 0.35, y: 8.5, anchor: 'start', text: 'High Arousal / Tense', sub: true },
  { key: 'low', x: 0.35, y: -9.0, anchor: 'start', text: '↓ 低生理喚醒' },
  { key: 'low-en', x: 0.35, y: -9.65, anchor: 'start', text: 'Low Arousal / Relax', sub: true },
  { key: 'y-name', x: -0.35, y: 9.2, anchor: 'end', text: 'Y 軸：喚醒度 Arousal', sub: true },
]
export const QUADRANTS = [
  { key: 'nh', x: -4.6, y: 7.6, text: '負向・高張力' },
  { key: 'ph', x: 4.6, y: 7.6, text: '正向・高張力' },
  { key: 'nl', x: -4.6, y: -7.9, text: '負向・低張力' },
  { key: 'pl', x: 4.6, y: -7.9, text: '正向・低張力' },
]
export const AXIS_TICKS = [-10, -5, 5, 10]

// 圓心到圓周的分隔線：每 15 度一條，整圈 24 條（線的樣子在 EmotionWheelBackdrop.vue 的 .spoke）
// 色輪的顏色是連續漸層，光看顏色分不出一個點落在哪一個方位；把每一片的邊界畫出來之後，
// 圓內的點、圓周的刻度、圓外的情緒詞三者就對得起來，角度本身的意義才讀得出來。
// 0、90、180、270 度這四條就是座標軸，上面的軸線已經畫了（比較粗、比較亮），這裡跳過不重畫。
// 只回傳圓周那一端的座標，圓心那一端一律是 px(0), py(0)
const SPOKE_STEP = 15
export const SPOKES = Array.from({ length: 360 / SPOKE_STEP }, (_, i) => i * SPOKE_STEP)
  .filter((deg) => deg % 90 !== 0)
  .map((deg) => ({ key: deg, x: px(R * Math.cos(rad(deg))), y: py(R * Math.sin(rad(deg))) }))

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

/**
 * 完整曲線；同一點（不會發生，保險起見）回傳空字串
 * @param {number} [trim]  終點往回縮多少 px：縮到圓點邊上，線才不會插進點裡
 */
export function curve(a, b, trim = 12) {
  const { x1, y1, x2, y2, cx, cy } = geom(a, b)
  if (x1 === x2 && y1 === y2) return ''
  const ex = x2 - ((x2 - cx) / Math.hypot(x2 - cx, y2 - cy)) * trim
  const ey = y2 - ((y2 - cy) / Math.hypot(x2 - cx, y2 - cy)) * trim
  return `M${x1},${y1} Q${cx},${cy} ${ex},${ey}`
}

// ---------------------------------------------------------------------------
// 點與標籤的共用規格（五張情緒軌跡圖一致，畫法在 components/common/EmotionTrajectoryMap.vue）
//
// 點分四層，由弱到強：
//   ref    參考點   這首歌沒用到、但先標出來當比例尺的位置（和弦沒用到的性質、速度的六個區間）
//   anchor 錨點     這首歌用到的固定位置（和弦性質、最終值的三個分項）
//   step   軌跡點   軌跡上依時間排的一步
//   now    現在     播放到的位置，或最終值的最終座標
//
// 標籤只放「這是誰」，數值一律留給右邊的面板，圖上才不會跟底圖的情緒詞、刻度擠在一起。
// ---------------------------------------------------------------------------
export const DOT_R = { ref: 6, anchor: 10, step: 10, now: 13 }
export const LABEL_SIZE = { ref: 17, anchor: 20, step: 20 }

/**
 * 軌跡點的半徑：同一個座標停留越多段畫越大（最多 1.6 倍）
 * 「這首歌在哪裡待最久」原本圖上看不出來，只能從右邊的清單數
 */
export const stepRadius = (n) => DOT_R.step * Math.min(1.6, 1 + 0.28 * (n - 1))

/**
 * 標籤的位置：第一順位，加上擋到東西時改放的 alt（第二順位）
 * - step、now：點的正上方置中；擋到就改放正下方（編號很短，上下都放得下）
 * - ref、anchor：點的內側（朝圓心那一邊），擋到就改放外側
 *   這些點多半靠近圓周，所以先往內放，才不會壓到圓外的情緒詞
 * @param {{ x: number, y: number }} p  情緒座標
 * @param {'ref'|'anchor'|'step'|'now'} kind
 * @param {number} size  字級，用來算上下的間距
 */
export function labelPos(p, kind, size, r = DOT_R[kind] ?? DOT_R.step) {
  if (kind === 'step' || kind === 'now') {
    return {
      x: px(p.x),
      y: py(p.y) - r - 9,
      anchor: 'middle',
      alt: { x: px(p.x), y: py(p.y) + r + size, anchor: 'middle' },
    }
  }
  const side = (dir) => ({ x: px(p.x) + dir * (r + 9), y: py(p.y) + 6, anchor: dir > 0 ? 'start' : 'end' })
  const inward = p.x > 0 ? -1 : 1 // 朝圓心的方向
  return { ...side(inward), alt: side(-inward) }
}

// 中日文是全形、其餘約半形，用來估標籤的寬度（SVG 沒辦法在算版面時直接量文字）
const textWidth = (text, size) => [...text].reduce((w, ch) => w + (ch.charCodeAt(0) < 0x2e80 ? 0.56 : 1) * size, 0)

/** 標籤的外框（SVG 座標）：文字的基線在 y，往上一個字高、往下留一點行距 */
function labelBox(l) {
  const w = textWidth(l.text, l.size)
  const x1 = l.anchor === 'end' ? l.x - w : l.anchor === 'middle' ? l.x - w / 2 : l.x
  return { x1, x2: x1 + w, y1: l.y - l.size, y2: l.y + 5 }
}

const overlaps = (a, b) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2

/** 圖上一個點的外框，給 spreadLabels() 當障礙物用（標籤不要壓在圓點上） */
export function dotBox(p, kind, r = DOT_R[kind] ?? DOT_R.step) {
  return { x1: px(p.x) - r, x2: px(p.x) + r, y1: py(p.y) - r, y2: py(p.y) + r }
}

/**
 * 標籤避讓：擋到別的字就換位置
 *   1. 先試第一順位，擋到就試 alt（上面改下面、內側改外側）
 *   2. 兩個都擋到就從第一順位往下移，直到不重疊
 * 傳進來的順序就是優先順序（前面的先占位子），所以重要的放前面
 * @param {{ x, y, anchor, alt?, text, size }[]} labels
 * @param {({ x, y, anchor, text, size } | { x1, x2, y1, y2 })[]} [obstacles]
 *        不會移動的東西：底圖的軸名、刻度、情緒詞（給文字），或圖上的點（直接給外框）
 * @returns {同樣的陣列，位置可能被改過}
 */
export function spreadLabels(labels, obstacles = []) {
  const taken = obstacles.map((o) => (o.x1 === undefined ? labelBox(o) : o))
  const out = []
  for (const l of labels) {
    const hit = (c) => taken.find((t) => overlaps(t, labelBox(c)))
    let chosen = [{ ...l }, l.alt && { ...l, ...l.alt }].filter(Boolean).find((c) => !hit(c))
    // placed：放在第一順位／alt 都算貼著點，crowded 是兩個都擠不下、只能往下推（點太密集）
    let placed = chosen ? (chosen.y === l.y && chosen.x === l.x ? 'primary' : 'alt') : 'crowded'
    if (!chosen) {
      // 都擋到：從第一順位往下移；最多移 10 次，避免極端資料跑不完
      chosen = { ...l }
      for (let guard = 0; guard < 10; guard++) {
        const t = hit(chosen)
        if (!t) break
        chosen.y = t.y2 + chosen.size
      }
    }
    delete chosen.alt
    chosen.placed = placed
    taken.push(labelBox(chosen))
    out.push(chosen)
  }
  return out
}

/**
 * 底圖上固定的字（軸名、刻度、象限、圓外的情緒詞），給 spreadLabels() 當障礙物用
 * 位置與字級要跟 components/common/EmotionWheelBackdrop.vue 畫的一致
 */
export const WHEEL_TEXTS = [
  ...AXIS_TICKS.flatMap((t) => [
    { x: px(t), y: py(0) + 28, anchor: 'middle', text: String(t), size: 18 },
    ...(Math.abs(t) < R ? [{ x: px(0) - 12, y: py(t) + 7, anchor: 'end', text: String(t), size: 18 }] : []),
  ]),
  ...QUADRANTS.map((q) => ({ x: px(q.x), y: py(q.y), anchor: 'middle', text: q.text, size: 20 })),
  ...AXIS_LABELS.map((a) => ({ x: px(a.x), y: py(a.y), anchor: a.anchor, text: a.text, size: a.sub ? 17 : 22 })),
  ...ringLabels.flatMap((g) => g.lines.map((l) => ({ x: g.x, y: l.y, anchor: g.anchor, text: `${l.zh} ${l.en}`, size: 19 }))),
]

// ---------------------------------------------------------------------------
// 底圖的色輪：改用向量畫（原本是點陣圖 assets/emotion-color-wheel.webp）
//
// 角度在 Russell 模型裡本身有意義，所以顏色照八個方位定錨、中間內插，跟圓外的情緒詞對得起來。
// 色相、明度、彩度三個數字都是從原本那張點陣圖量出來的（取樣後換算成 OKLCH），
// 所以向量版的濃烈程度跟原圖一致：
//                                       色相 h  明度 l  彩度 c
//   0°   右   快樂 happy      黃綠        121    0.70   0.147
//   45°  右上 興奮 excited    黃           87    0.85   0.174
//   90°  上   激昂 aroused    橘           43    0.70   0.199
//   135° 左上 生氣 angry      紅           26    0.57   0.217
//   180° 左   悲慘 miserable  緋紅          8    0.47   0.158
//   225° 左下 沮喪 depressed  紫          276    0.37   0.121
//   270° 下   想睡 sleepy     藍          235    0.52   0.095
//   315° 右下 放鬆 relaxed    綠          157    0.66   0.115
//
// 明度必須跟著色相走，不能整圈固定成同一個值：sRGB 裡最濃的黃在 l≈0.85、最濃的紫在 l≈0.48，
// 固定明度時再怎麼拉彩度都會被色域擋掉，藍紫一律變灰。原圖就是靠「黃亮、紅中、紫暗」這條
// 明度曲線才濃得起來的。用 OKLCH 不用 HSL，是因為 OKLCH 的 L 才是感知亮度。
// 淺色與深色主題的差別只有 main.css 的 --wheel-dl（整體提亮）與 --wheel-sat（彩度倍率）。
// ---------------------------------------------------------------------------
const WHEEL_ANCHORS = [
  { h: 121, l: 0.7, c: 0.147 },
  { h: 87, l: 0.85, c: 0.174 },
  { h: 43, l: 0.7, c: 0.199 },
  { h: 26, l: 0.57, c: 0.217 },
  { h: 8, l: 0.47, c: 0.158 },
  { h: 276, l: 0.37, c: 0.121 },
  { h: 235, l: 0.52, c: 0.095 },
  { h: 157, l: 0.66, c: 0.115 },
]

/** 角度（度）→ 色輪上的 OKLCH 顏色 {h,l,c}；相鄰定錨之間內插，色相走色環上較短的一邊 */
export function wheelColor(deg) {
  const n = WHEEL_ANCHORS.length
  const slot = (((deg / (360 / n)) % n) + n) % n
  const i = Math.floor(slot)
  const t = slot - i
  const a = WHEEL_ANCHORS[i]
  const b = WHEEL_ANCHORS[(i + 1) % n]
  const dh = ((b.h - a.h + 540) % 360) - 180 // 較短的那一邊
  return {
    h: (((a.h + dh * t) % 360) + 360) % 360,
    l: a.l + (b.l - a.l) * t,
    c: a.c + (b.c - a.c) * t,
  }
}

// 切成 96 片扇形拼成圓；每片多畫 0.6°跟隔壁重疊，免得接縫處透出底色的白線
const WEDGE_N = 96
const WEDGE_STEP = 360 / WEDGE_N
const polar = (deg, r) => `${px(r * Math.cos(rad(deg)))},${py(r * Math.sin(rad(deg)))}`
const r3 = (v) => Math.round(v * 1000) / 1000
export const WHEEL_WEDGES = Array.from({ length: WEDGE_N }, (_, i) => {
  const from = i * WEDGE_STEP
  const { h, l, c } = wheelColor(from + WEDGE_STEP / 2)
  return {
    key: i,
    h: r3(h),
    l: r3(l),
    c: r3(c),
    // SVG 的 y 是反的，所以角度變大（數學上的逆時針）對應 sweep-flag 0
    d: `M${px(0)},${py(0)} L${polar(from, R)} A${R * UNIT},${R * UNIT} 0 0 0 ${polar(from + WEDGE_STEP + 0.6, R)} Z`,
  }
})