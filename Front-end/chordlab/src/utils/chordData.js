/**
 * Color palette for chord blocks.
 * Extend or replace with your own colors as needed.
 */
export const CHORD_COLORS = [
  '#7c6af5',
  '#4ecfb3',
  '#f5a623',
  '#e84393',
  '#5cb8ff',
  '#a8d455',
  '#ff7043',
  '#ba68c8',
  '#4db6ac',
  '#ffd54f',
]

/**
 * Chord metadata: notes and harmonic function.
 * Add more chords here as needed.
 *
 * @type {Record<string, { notes: string, func: string }>}
 */
export const CHORD_INFO = {
  C: { notes: 'C E G', func: '主和弦 (I)' },
  Am: { notes: 'A C E', func: '副和弦 (vi)' },
  F: { notes: 'F A C', func: '下屬和弦 (IV)' },
  G: { notes: 'G B D', func: '屬和弦 (V)' },
  Dm: { notes: 'D F A', func: '副和弦 (ii)' },
  Em: { notes: 'E G B', func: '中間和弦 (iii)' },
  Bdim: { notes: 'B D F', func: '導和弦 (vii°)' },
  G7: { notes: 'G B D F', func: '屬七和弦 (V7)' },
  Fmaj7: { notes: 'F A C E', func: '大七和弦 (IV△7)' },
  'C/E': { notes: 'C E G', func: '第一轉位 (I⁶)' },
  Cmaj7: { notes: 'C E G B', func: '大七和弦 (I△7)' },
  Am7: { notes: 'A C E G', func: '小七和弦 (vi7)' },
  Dm7: { notes: 'D F A C', func: '小七和弦 (ii7)' },
}

/**
 * Roman numeral symbols for diatonic chords.
 * Used in the key analysis panel.
 */
export const ROMAN_NUMERALS = {
  C: 'I',
  Dm: 'ii',
  Em: 'iii',
  F: 'IV',
  G: 'V',
  Am: 'vi',
  Bdim: 'vii°',
  G7: 'V⁷',
  Fmaj7: 'IV△⁷',
  'C/E': 'I⁶',
  Cmaj7: 'I△⁷',
  Am7: 'vi⁷',
  Dm7: 'ii⁷',
}
