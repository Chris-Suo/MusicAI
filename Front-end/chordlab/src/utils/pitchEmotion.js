/**
 * 音高情緒：每 15 秒一個區間，用主旋律的平均赫茲數換算成情緒輪上的座標
 *
 * 換算公式照使用者提供的 pitch_emotion_compact.html（computeCoords）：
 *   輸入是 平均基頻 F0、頻譜質心 SC、音量（soft／loud）、基準調音（440／432）
 *   輸出是 效價 valence（-0.92～0.92，負向～正向）與 喚醒度 arousal（-0.92～0.92，放鬆～緊張）
 * 這裡把 valence、arousal 各乘 10，放到跟和弦情緒軌跡相同的 ±10 座標（x 效價 Valence、y 喚醒度 Arousal）。
 *
 * 目前後端只有主旋律音高，所以只有 F0 是每個區間實際算出來的；
 * SC、音量、調音先用 PITCH_EMOTION_INPUT 的固定值（附件 HTML 的預設狀態）。
 * 因為其他輸入都固定，valence、arousal 都只隨 F0 變化，所有點會落在同一條斜線上。
 * 之後後端有頻譜質心或響度時，把對應的值換進 pitchToEmotion() 的參數即可。
 */
import { midiToHz, midiToName } from '@/utils/theory.js'
import { WINDOW_SEC } from '@/utils/chordEmotion.js'

/**
 * 除了 F0 以外的輸入（固定值，取自附件 HTML 的預設狀態）
 * - sc：頻譜質心（Hz）
 * - loudness：'soft' | 'loud'
 * - tuning：440 | 432；量到的赫茲數已經是實際頻率，所以用 440（不再額外換算）
 */
export const PITCH_EMOTION_INPUT = { sc: 1950, loudness: 'soft', tuning: 440 }

/** 四個象限的說明（照附件 HTML 的 QUADRANTS） */
export const PITCH_QUADRANTS = {
  q1: {
    badge: '象限 I：高喚醒 × 正向',
    title: '快樂、振奮、明亮',
    f0Text: '330–523 Hz（大調均值約 440 Hz）',
    scText: '1,600–2,400 Hz',
    bandText: '中頻 500 Hz–2 kHz 飽滿清晰，搭配 6–20 kHz 空氣感泛音',
    condText: '高音高＋輕柔或適中音量，避免 2–4 kHz 過載',
  },
  q2: {
    badge: '象限 II：高喚醒 × 負向',
    title: '恐懼、憤怒、焦慮',
    f0Text: '440–784 Hz（中頻高張力區）',
    scText: '> 2,500 Hz',
    bandText: '中高頻 2–4 kHz（嬰兒哭聲警覺帶，過量易聽覺疲勞），常搭 20–60 Hz 極低頻壓迫',
    condText: '高音高＋強音壓（Loud）與尖銳起音',
  },
  q3: {
    badge: '象限 III：低喚醒 × 負向',
    title: '悲傷、憂鬱、孤寂',
    f0Text: '130–261 Hz（小調主題均值較大調低約 25.2 Hz）',
    scText: '450–950 Hz',
    bandText: '低頻 Bass 60–250 Hz 為主，大幅削減 2–6 kHz 高頻能量',
    condText: '音高變異窄、慢速度、級進下行輪廓',
  },
  q4: {
    badge: '象限 IV：低喚醒 × 正向',
    title: '溫柔、平靜、療癒',
    f0Text: '220–349 Hz',
    scText: '800–1,400 Hz',
    bandText: '中低頻 250–500 Hz 溫暖共鳴＋圓潤中頻，大幅柔化 2–4 kHz 攻擊性',
    condText: '輕柔音量、延音與殘響縫合、432 Hz 基準調音（心率約降 4.79 bpm）',
  },
}

/**
 * 附件 HTML 的 computeCoords()，原封不動移植（只把全域的 state 改成參數）
 * @returns {{ valence: number, arousal: number, effF0: number }}
 */
export function pitchToEmotion({ f0, sc = PITCH_EMOTION_INPUT.sc, loudness = PITCH_EMOTION_INPUT.loudness, tuning = PITCH_EMOTION_INPUT.tuning }) {
  const effF0 = f0 * (tuning / 440)
  const normF0 = (Math.log2(effF0) - Math.log2(290)) / 1.18
  const normSC = (sc - 1550) / 1450
  const loudNum = loudness === 'loud' ? 0.65 : -0.35
  const alert2to4k = sc >= 2000 && sc <= 4000 ? 0.16 : 0

  let arousal = 0.48 * normF0 + 0.42 * normSC + 0.22 * loudNum + alert2to4k * 0.5 + (tuning === 432 ? -0.1 : 0.03)
  arousal = Math.max(-0.92, Math.min(0.92, arousal))

  let valence = 0.34 * normF0 + (loudness === 'soft' ? 0.28 : -0.25)
  if (loudness === 'loud' && (effF0 > 320 || sc >= 2000)) valence -= 0.78
  if (sc >= 2400) valence -= ((sc - 2400) / 1200) * 0.55
  if (effF0 < 230 && sc < 1000) valence -= tuning === 432 && effF0 >= 210 ? 0.05 : 0.55
  if (tuning === 432 && loudness === 'soft') valence += 0.22
  valence = Math.max(-0.92, Math.min(0.92, valence))

  return { valence, arousal, effF0 }
}

/** 象限（附件 HTML 的判斷方式：0 算在正向／高喚醒那邊） */
export const quadrantOf = (valence, arousal) =>
  valence >= 0 && arousal >= 0 ? 'q1' : valence < 0 && arousal >= 0 ? 'q2' : valence < 0 ? 'q3' : 'q4'

const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
const round2 = (v) => Math.round(v * 100) / 100

/**
 * 每 windowSec 秒一個區間：區間內主旋律的平均 Hz → 情緒座標，依序連成軌跡
 * 沒有旋律的區間跳過
 * @param {{ hop: number, midi: (number|null)[] } | null} contour
 * @param {number} length  整首歌長度（秒）
 * @param {object|null} key  調性（音名的升降寫法用）
 * @returns {{ steps: { emo, start, end }[], windowSec: number }}
 *   emo：{ key, x, y, hz, note, valence, arousal, quadrant, window, name, short }
 */
export function buildPitchEmotionPath(contour, length, key = null, windowSec = WINDOW_SEC) {
  const steps = []
  if (!contour) return { steps, windowSec }
  for (let ws = 0, w = 0; ws < length; ws += windowSec, w++) {
    const we = Math.min(ws + windowSec, length)
    const from = Math.floor(ws / contour.hop)
    const to = Math.min(contour.midi.length, Math.ceil(we / contour.hop))
    const hz = contour.midi.slice(from, to).filter((v) => v !== null).map(midiToHz)
    if (!hz.length) continue
    const meanHz = hz.reduce((s, v) => s + v, 0) / hz.length
    const { valence, arousal } = pitchToEmotion({ f0: meanHz })
    steps.push({
      emo: {
        key: `pw-${w}`,
        x: round2(valence * 10),
        y: round2(arousal * 10),
        hz: meanHz,
        note: midiToName(Math.round(69 + 12 * Math.log2(meanHz / 440)), key),
        valence,
        arousal,
        quadrant: quadrantOf(valence, arousal),
        window: w + 1,
        name: `${clock(ws)}–${clock(we)}`,
        short: String(w + 1),
      },
      start: ws,
      end: we,
    })
  }
  return { steps, windowSec }
}
