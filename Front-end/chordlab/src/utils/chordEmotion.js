/**
 * 和弦情緒座標：依「和弦性質」（大三、小七、屬七…）把和弦放到情緒輪座標上，
 * 再依和弦出現順序串成軌跡
 *
 * - 座標只看和弦性質、不看根音：C 和 G 都是大三和弦，位置相同
 * - 連續出現同一種性質（例如 C → G）合併成一步，軌跡上不會原地打轉
 * - 沒有定義座標的性質（例如 sus4）不畫進軌跡，另外列出占比
 *
 * 兩種軌跡（回傳格式相同，ChordEmotionMap.vue 改一行就能切換）：
 * - buildEmotionPath()：依和弦出現順序，每換一種性質就是一步
 * - buildWindowPath()：每 15 秒一個區間，取區間內所有和弦座標的重心（x、y 各自平均），一個區間一步
 *
 * 座標範圍約 -10～10，背景圖（assets/emotion-wheel.webp）裁成正方形、中心是原點，
 * ±10 剛好落在外圈上，整張圖涵蓋 ±12（見 ChordEmotionMap.vue 的 RANGE）
 */
import { isNoChord } from '@/utils/chords.js'

/**
 * key：和弦性質（BTC／Harte 的寫法，冒號後、斜線前那段）
 * alias：其他後端可能用的寫法
 * BTC large vocabulary 會出現的是 maj、min、7、maj7、min7、dim、dim7、hdim7、aug、
 * maj6、min6、minmaj7、sus2、sus4；其他的先放著，之後換模型或加和弦種類就能直接用
 */
export const CHORD_EMOTIONS = [
  // 明亮、有張力
  { key: 'maj', alias: [''], name: '大三和弦', short: '大三', x: 8, y: 5, desc: '純粹的陽光，極度穩定。' },
  { key: '7', name: '屬七和弦', short: '屬七', x: 6, y: 6, desc: '充滿前進動力，帶有戲劇性的催促感。' },
  { key: 'maj9', name: '大九和弦', short: '大九', x: 7, y: 4, desc: '極致的奢華與開闊感。' },
  { key: '9', name: '屬九和弦', short: '屬九', x: 5, y: 7, desc: '比屬七更豐滿，帶有爵士的律動能量。' },
  { key: '11', name: '屬十一和弦', short: '屬十一', x: 3, y: 8, desc: '高度擴張，甚至帶有一種現代英雄的氣概。' },
  { key: 'maj13', name: '大十三和弦', short: '大十三', x: 6, y: 5, desc: '豐富、斑斕，如陽光折射在稜鏡上。' },
  { key: 'maj7(#11)', alias: ['maj7#11'], name: '大七升十一和弦', short: '大七#11', x: 5, y: 8, desc: '充滿「未來感」與奇幻色彩的強烈光明。' },
  { key: 'aug(9)', alias: ['aug9', 'augadd9', 'aug(add9)'], name: '增三加九和弦', short: '增三add9', x: 2, y: 9, desc: '奇異且劇烈的光明，像是在強光下產生的幻覺。' },

  // 黑暗、有張力
  { key: 'dim7', name: '減七和弦', short: '減七', x: -3, y: 9, desc: '驚悚、絕望的尖叫。' },
  { key: 'dim', name: '減三和弦', short: '減三', x: -5, y: 7, desc: '萎縮、寒冷且不安。' },
  { key: 'aug', name: '增三和弦', short: '增三', x: -2, y: 8, desc: '扭曲的擴張，充滿超現實的驚疑感。' },
  { key: 'minmaj7', name: '小大七和弦', short: '小大七', x: -6, y: 8, desc: '007 電影式的冷酷張力，黑暗中帶著利刃。' },
  { key: '7(#9)', alias: ['7#9'], name: '屬七升九和弦', short: '7#9', x: -4, y: 9, desc: '所謂的「Hendrix Chord」，狂野、焦慮且充滿攻擊性。' },
  { key: '7(b9)', alias: ['7b9'], name: '屬七降九和弦', short: '7b9', x: -7, y: 8, desc: '命運的壓迫感，黑暗且無法逃避。' },
  { key: '7alt', alias: ['alt'], name: '變化屬七和弦', short: '7alt', x: -8, y: 9, desc: '極致的混亂與扭曲，情緒的引爆點。' },
  { key: '7(b9,b13)', alias: ['7b9b13'], name: '屬七降九降十三', short: '7b9b13', x: -9, y: 10, desc: '崩潰邊緣，深淵般的沈重張力。' },

  // 黑暗、平靜
  { key: 'min', name: '小三和弦', short: '小三', x: -7, y: -4, desc: '典型的哀愁，靜謐的傷感。' },
  { key: 'min7', name: '小七和弦', short: '小七', x: -5, y: -3, desc: '柔和的藍調感，帶著些許遺憾。' },
  { key: 'hdim7', alias: ['min7(b5)', 'm7b5'], name: '半減七和弦', short: '半減七', x: -4, y: -6, desc: '糾結、委屈，一種想哭卻沒有眼淚的抑鬱。' },
  { key: 'min9', name: '小九和弦', short: '小九', x: -6, y: -5, desc: '更加深邃的孤寂感。' },
  { key: 'min11', name: '小十一和弦', short: '小十一', x: -4, y: -4, desc: '帶著空靈感的憂傷，如雨後的石階。' },
  { key: 'min13', name: '小十三和弦', short: '小十三', x: -3, y: -3, desc: '複雜而細膩的暗色，像是一篇冗長的悼文。' },
  { key: 'min6', name: '小六和弦', short: '小六', x: -8, y: -5, desc: '懷舊、老電影般的淒美感。' },
  { key: 'add(b9)', alias: ['addb9', 'maj(b9)', '(b9)'], name: '加降九和弦', short: 'add b9', x: -9, y: -2, desc: '壓抑至極的窒息感。' },

  // 明亮、平靜
  { key: 'maj7', name: '大七和弦', short: '大七', x: 5, y: -2, desc: '慵懶的午後，高級的寂寞感。' },
  { key: 'sus2', name: '掛留二和弦', short: 'sus2', x: 4, y: -5, desc: '極度透明、空曠且不具攻擊性。' },
  { key: 'maj6', alias: ['6'], name: '大六和弦', short: '大六', x: 7, y: -3, desc: '甜美、復古且安穩的幸福。' },
  { key: 'maj11', name: '大十一和弦', short: '大十一', x: 2, y: -4, desc: '像是漂浮在雲端，有一種不著邊際的淡然。' },
  { key: 'maj(b5,9)', alias: ['add9(b5)', 'b5add9', '(b5,9)'], name: '降五加九和弦', short: 'b5add9', x: 3, y: -6, desc: '迷幻、脫俗，像是在水中呼吸。' },
]

const BY_QUALITY = new Map()
for (const e of CHORD_EMOTIONS) {
  BY_QUALITY.set(e.key, e)
  for (const a of e.alias ?? []) BY_QUALITY.set(a, e)
}

/** 'C:maj7/3' → 'maj7'；'C' → 'maj'（斜線後是低音，不影響性質） */
export function chordQuality(label) {
  if (isNoChord(label)) return null
  const rest = String(label).split(':')[1] ?? ''
  return rest.split('/')[0] || 'maj'
}

/** 和弦標籤 → 情緒座標資料；沒有定義時回傳 null */
export function chordEmotion(label) {
  const q = chordQuality(label)
  return q === null ? null : (BY_QUALITY.get(q) ?? null)
}

/**
 * 把和弦時間軸轉成情緒軌跡
 * @param {{ chord: string, start: number, dur: number }[]} timeline
 * @returns {{
 *   steps: { emo: object, start: number, end: number, chords: string[] }[],  // 依時間排序、連續同性質已合併
 *   edges: { from: object, to: object, count: number }[],                    // 每種「A → B」移動出現幾次
 *   usage: { emo: object, share: number, count: number, firstStart: number }[], // 各性質占有和弦時間的比例，由多到少
 *   unmapped: { quality: string, share: number }[],                          // 沒有座標的性質
 * }}
 */
export function buildEmotionPath(timeline) {
  const steps = []
  const usage = new Map()
  const unmapped = new Map()
  let chordTime = 0

  for (const seg of timeline) {
    const q = chordQuality(seg.chord)
    if (q === null) continue
    chordTime += seg.dur
    const emo = BY_QUALITY.get(q)
    if (!emo) {
      unmapped.set(q, (unmapped.get(q) ?? 0) + seg.dur)
      continue
    }
    const u = usage.get(emo.key) ?? { emo, dur: 0, count: 0, starts: [] }
    u.dur += seg.dur

    const last = steps[steps.length - 1]
    if (last && last.emo === emo) {
      last.end = seg.start + seg.dur
      if (last.chords[last.chords.length - 1] !== seg.chord) last.chords.push(seg.chord)
    } else {
      steps.push({ emo, start: seg.start, end: seg.start + seg.dur, chords: [seg.chord] })
      u.count += 1
      u.starts.push(seg.start)
    }
    usage.set(emo.key, u)
  }

  const edgeMap = new Map()
  for (let i = 1; i < steps.length; i++) {
    const k = steps[i - 1].emo.key + '→' + steps[i].emo.key
    const e = edgeMap.get(k) ?? { from: steps[i - 1].emo, to: steps[i].emo, count: 0 }
    e.count += 1
    edgeMap.set(k, e)
  }

  const share = (d) => (chordTime ? d / chordTime : 0)
  return {
    steps,
    edges: [...edgeMap.values()],
    usage: [...usage.values()]
      .map((u) => ({ emo: u.emo, share: share(u.dur), count: u.count, starts: u.starts }))
      .sort((a, b) => b.share - a.share),
    unmapped: [...unmapped].map(([quality, d]) => ({ quality, share: share(d) })).sort((a, b) => b.share - a.share),
  }
}

// ---------------------------------------------------------------------------
// 區間重心軌跡
// ---------------------------------------------------------------------------

/** 每個區間幾秒 */
export const WINDOW_SEC = 15

const round2 = (v) => Math.round(v * 100) / 100
const fmtSec = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

/**
 * 凸包（Andrew monotone chain），逆時針；共線的點會去掉
 * 只用來在畫面上畫出區間內的點圍成的範圍，不影響重心
 * @param {{ x: number, y: number }[]} points
 */
export function convexHull(points) {
  const pts = [...new Map(points.map((p) => [`${p.x},${p.y}`, p])).values()].sort((a, b) => a.x - b.x || a.y - b.y)
  if (pts.length < 3) return pts
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

/**
 * 重心：所有點的 x 平均、y 平均
 * @param {{ x: number, y: number }[]} points
 */
export function centroid(points) {
  const n = points.length
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / n,
    y: points.reduce((sum, p) => sum + p.y, 0) / n,
  }
}

/**
 * 每 windowSec 秒一個區間：區間內出現過的和弦性質（有重疊就算；同一種性質只算一個點，不論長短、次數），
 * 取這些點的重心（x 相加 ÷ 點數、y 相加 ÷ 點數）當作這個區間的位置，再依區間順序連成軌跡
 * - 沒有和弦（或都沒有座標）的區間跳過
 * - 相鄰區間重心完全相同時合併成一步
 * - usage、unmapped 跟 buildEmotionPath() 一樣是整首歌的和弦性質統計
 *
 * 回傳格式同 buildEmotionPath()，另外：
 *   steps[].emo 是區間重心：{ key, x, y, name, short, desc, window, members }
 *     members：區間內用到的和弦性質（CHORD_EMOTIONS 的項目）
 *   mode: 'window'、windowSec
 */
export function buildWindowPath(timeline, windowSec = WINDOW_SEC) {
  const base = buildEmotionPath(timeline)
  const segs = []
  for (const seg of timeline) {
    const emo = chordEmotion(seg.chord)
    if (emo) segs.push({ ...seg, emo })
  }
  const songEnd = segs.reduce((m, s) => Math.max(m, s.start + s.dur), 0)

  const steps = []
  for (let w = 0; w * windowSec < songEnd; w++) {
    const ws = w * windowSec
    const we = ws + windowSec
    const inWin = segs.filter((s) => s.start < we && s.start + s.dur > ws)
    if (!inWin.length) continue

    const members = [...new Set(inWin.map((s) => s.emo))]
    const c = centroid(members)
    const chords = [...new Set(inWin.map((s) => s.chord))]
    const x = round2(c.x)
    const y = round2(c.y)

    const last = steps[steps.length - 1]
    if (last && last.emo.x === x && last.emo.y === y && last.end >= ws) {
      last.end = Math.min(we, songEnd)
      for (const ch of chords) if (!last.chords.includes(ch)) last.chords.push(ch)
      continue
    }

    steps.push({
      emo: {
        key: `win-${w}`,
        x,
        y,
        window: w + 1,
        name: `${fmtSec(ws)}–${fmtSec(Math.min(we, songEnd))} 的重心`,
        short: String(w + 1),
        desc: `區間內的和弦性質：${members.map((e) => e.short).join('、')}`,
        members,
      },
      start: ws,
      end: Math.min(we, songEnd),
      chords,
    })
  }

  const edges = []
  for (let i = 1; i < steps.length; i++) edges.push({ from: steps[i - 1].emo, to: steps[i].emo, count: 1 })

  return { ...base, steps, edges, mode: 'window', windowSec }
}
