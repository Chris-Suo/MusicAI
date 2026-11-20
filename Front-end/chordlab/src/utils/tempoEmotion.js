/**
 * 速度情緒：每 15 秒一個區間，用平均 BPM 找出所在的速度區間，取該區間在情緒座標上的位置
 *
 * 區間與座標照使用者提供的 bpm2.html（BPM_ZONES）：
 *   6 個區間（56–75、76–90、91–108、109–120、121–144、145–168+ BPM），每個區間有大調與小調兩個位置
 *   原圖的座標是 x 效價 -5.5～5.5、y 喚醒度 1～7 分（4 分是象限分界），
 *   這裡換算成跟和弦情緒軌跡相同的 ±10：x × 2、(y − 4) × 10 / 3
 * - 大調／小調依這首歌的調性決定（原圖的「大調／規律」「小調／張力」切換）
 * - 平均 BPM 先限制在 56～168（原圖滑桿的範圍）；區間用上限判斷（≤ 75 是第一區、≤ 90 是第二區…），
 *   所以 75.5 這種帶小數的速度也會落在下一區（原圖只處理整數 BPM）
 * - 連續好幾段落在同一個區間時合併成一步，軌跡上不會原地打轉
 */
import { windowTempos } from '@/utils/rhythm.js'
import { WINDOW_SEC } from '@/utils/chordEmotion.js'

export const TEMPO_SOURCES = {
  yang2025: { label: 'Yang et al. (2025)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11893886/' },
  liu2018: { label: 'Liu et al. (2018)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6243583/' },
  fs2016: { label: 'Fernández-Sotos et al. (2016)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4971092/' },
  gagnon2003: { label: 'Gagnon & Peretz (2003)', url: 'https://pubmed.ncbi.nlm.nih.gov/29715736/' },
  webster2005: {
    label: 'Webster & Weir (2005)',
    url: 'https://www.semanticscholar.org/paper/Emotional-Responses-to-Music%3A-Interactive-Effects-Webster-Weir/2400921781bb55b9bb1db9537d6c65ef38f3ae56',
  },
  juslin2004: { label: 'Juslin & Laukka (2004)', url: 'https://www.tandfonline.com/doi/pdf/10.1080/0929821042000317813' },
  fpsyg2022: { label: 'Frontiers in Psychology (2022)', url: 'https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.952488/full' },
  droit2013: { label: 'Droit-Volet et al. (2013)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3713348/' },
  zwaag2011: {
    label: 'van der Zwaag et al. (2011)',
    url: 'https://www.researchgate.net/publication/228473265_Emotional_and_psychophysiological_responses_to_tempo_mode_and_percussiveness',
  },
}

/** 照 bpm2.html 的 BPM_ZONES（majorXY／minorXY 是原圖座標：x 效價 ±5.5、y 喚醒度 1～7） */
export const TEMPO_ZONES = [
  {
    id: 'z1', range: '56–75 BPM', max: 75, term: 'Largo – Adagio', empirical: true,
    majorXY: { x: 1.2, y: 3.52 }, minorXY: { x: -3.6, y: 3.52 },
    arousal: '次低喚醒；56 BPM 實測喚醒度 3.52 ± 0.78（過慢偏離生理常態拍頻，反具輕微等待張力）',
    pos: '寧靜、深度放鬆、溫柔、內省（搭配大調與圓滑長音）',
    neg: '悲傷、哀愁、沉重（搭配小調與緩慢節奏）',
    neuro: 'Yang et al. (2025) 實測點：前額葉 Theta（154.02）與 Alpha 達峰值、額—枕葉 PLV = 0.56、副交感活性增強。',
    sources: ['yang2025', 'liu2018', 'gagnon2003', 'webster2005'],
  },
  {
    id: 'z2', range: '76–90 BPM', max: 90, term: 'Andante', empirical: false,
    majorXY: { x: 2.0, y: 2.6 }, minorXY: { x: -2.6, y: 2.6 },
    arousal: '低至平穩喚醒（跨文獻內插）；90 BPM 緊張感 2.27 / 5',
    pos: '溫和舒緩、平靜（90 BPM 快樂感 4.35 / 8）',
    neg: '悲傷感仍顯著（90 BPM 悲傷感 1.30 / 8）',
    neuro: '跨文獻歸納區間：介於慢速（60–76 BPM）與中速吸引區間（85–120 BPM）交界，主觀壓力低。',
    sources: ['fs2016', 'liu2018', 'juslin2004'],
  },
  {
    id: 'z3', range: '91–108 BPM', max: 108, term: 'Andante – Moderato', empirical: true,
    majorXY: { x: 2.8, y: 1.88 }, minorXY: { x: -1.2, y: 1.88 },
    arousal: '最低喚醒度谷底（V 型曲線最低點：106 BPM 實測僅 1.88 ± 0.54 / 7）',
    pos: '平靜專注、生理平衡、舒適無壓（貼合人類呼吸與心率諧波）',
    neg: '負向張力最低、神經警覺負荷最小',
    neuro: 'Yang et al. (2025) 實測點：屬「中速吸引區間」（500–700 ms）；頂葉 Delta 功率達 407.22、中央—顳葉 PLV = 0.69。',
    sources: ['yang2025', 'webster2005'],
  },
  {
    id: 'z4', range: '109–120 BPM', max: 120, term: 'Moderato – Allegro 下緣', empirical: false,
    majorXY: { x: 3.5, y: 4.1 }, minorXY: { x: -2.1, y: 4.1 },
    arousal: '適中喚醒（跨文獻內插）；120 BPM 緊張感 2.63 / 5（尚未觸發高壓緊繃）',
    pos: '溫暖愉悅、無壓力快樂（120 BPM 快樂感升至 4.97 / 8，+14.3%；趣味感 +16.0%）',
    neg: '悲傷感顯著下降（120 BPM 降至 0.81 / 8，-37.7%）',
    neuro: '跨文獻歸納區間：對應人類自發運動速度（SMT 100–120 BPM），最易誘發肢體律動與運動流暢感。',
    sources: ['fs2016', 'fpsyg2022'],
  },
  {
    id: 'z5', range: '121–144 BPM', max: 144, term: 'Allegro', empirical: false,
    majorXY: { x: 4.2, y: 5.5 }, minorXY: { x: -3.2, y: 5.5 },
    arousal: '高喚醒（跨文獻內插；交感活化：膚電 SCR 上升、心率變異度 HRV 下降；內在時鐘加速）',
    pos: '高度愉悅與活力（>120 BPM 效價最高 5.77 ± 0.80；大調配單純織體快樂斜率最大）',
    neg: '若轉小調或加高打擊樂強度，轉為緊張、急迫感',
    neuro: '跨文獻歸納區間：顯著激活雙側顳上回（STG, BA 22, Z = 4.51），音樂家正向效價高於非音樂家（6.08 vs. 5.57, p = 0.048）。',
    sources: ['liu2018', 'droit2013', 'zwaag2011', 'webster2005'],
  },
  {
    id: 'z6', range: '145–168+ BPM', max: Infinity, term: 'Fast Allegro – Presto', empirical: true,
    majorXY: { x: 4.8, y: 6.62 }, minorXY: { x: -4.4, y: 6.62 },
    arousal: '極高喚醒峰值；156 BPM 實測喚醒度達 6.62 ± 0.50 / 7',
    pos: '狂喜、高能量興奮（150 BPM 快樂感達 5.65 / 8；悲傷感降至 0.49 / 8）',
    neg: '緊繃壓力驟升（120→150 BPM 緊張感 +20.2% 至 3.16 / 5）；配小調／不規則重音誘發恐懼、憤怒、懸疑',
    neuro: 'Yang et al. (2025) 實測點：Beta/Gamma 功率飆升、前額葉 COV = 21.91、顳—額葉 PLV = 0.76、枕—顳葉 PLV = 0.93。',
    sources: ['yang2025', 'fs2016', 'juslin2004'],
  },
]

export const BPM_MIN = 56
export const BPM_MAX = 168

/** 平均 BPM → 所在區間（先限制在 56～168） */
export function tempoZone(bpm) {
  const b = Math.min(BPM_MAX, Math.max(BPM_MIN, bpm))
  return TEMPO_ZONES.find((z) => b <= z.max)
}

/** 原圖座標（x 效價 ±5.5、y 喚醒度 1～7，4 分是中線）→ 情緒輪的 ±10 */
export const toWheel = (xy) => ({ x: Math.round(xy.x * 2 * 100) / 100, y: Math.round(((xy.y - 4) * 10) / 3 * 100) / 100 })

/** 區間在情緒輪上的位置（mode：'major' | 'minor'） */
export const zonePoint = (zone, mode) => toWheel(mode === 'minor' ? zone.minorXY : zone.majorXY)

const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

/**
 * @param {number[]} beats
 * @param {number} length   整首歌長度（秒）
 * @param {'major'|'minor'} mode
 * @returns {{
 *   steps: { emo: { key, x, y, short, zone }, start, end, windows: { no, start, end, bpm }[] }[],
 *   windows: { no, start, end, bpm: number|null, zone }[],   // 每一段（拍點不足的段 bpm 是 null，不畫）
 *   windowSec: number,
 * }}
 */
export function buildTempoEmotionPath(beats, length, mode = 'major', windowSec = WINDOW_SEC) {
  const windows = windowTempos(beats, length, windowSec).map((w, i) => ({ ...w, no: i + 1, zone: w.bpm === null ? null : tempoZone(w.bpm) }))
  const steps = []
  for (const w of windows) {
    if (!w.zone) continue
    const last = steps[steps.length - 1]
    if (last && last.emo.zone === w.zone) {
      last.end = w.end
      last.windows.push(w)
      continue
    }
    steps.push({ emo: { key: `tw-${w.no}`, ...zonePoint(w.zone, mode), short: '', zone: w.zone }, start: w.start, end: w.end, windows: [w] })
  }
  // 編號是這一步包含的段（例如「3–5」）
  for (const s of steps) {
    const a = s.windows[0].no
    const b = s.windows[s.windows.length - 1].no
    s.emo.short = a === b ? String(a) : `${a}–${b}`
    s.emo.name = `${clock(s.start)}–${clock(s.end)}`
  }
  return { steps, windows, windowSec }
}
