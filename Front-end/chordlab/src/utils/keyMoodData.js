/**
 * 調性情緒對照表
 * 來源：Christian Friedrich Schubart《Ideen zu einer Ästhetik der Tonkunst》（1806）
 *
 * key_id 的命名規則與 Essentia KeyExtractor 的結果（pitch.py 輸出的 Key）對應：
 *   "C major", "C minor", "C# minor", "Db major" ...
 *
 * 若輸出使用 enharmonic 等效（升降互換），aliases 欄位提供備用名稱。
 */
export const KEY_MOOD_MAP = {
  'C major': {
    nameZh:    'C 大調',
    nameEn:    'C Major',
    mood:      'Innocently Happy',
    moodZh:    '純真、明亮、單純的快樂',
    scene:     '童年、希望、校園、溫暖開場',
    color:     '#f5c842',   // 暖黃
    aliases:   [],
  },
  'C minor': {
    nameZh:    'C 小調',
    nameEn:    'C Minor',
    mood:      'Innocently Sad, Love-Sick',
    moodZh:    '純真的悲傷、失戀、渴望',
    scene:     '愛情哀歌、回憶、孤單告白',
    color:     '#7eaee8',   // 淡藍
    aliases:   [],
  },
  'C# minor': {
    nameZh:    '升 C 小調',
    nameEn:    'C# Minor',
    mood:      'Despair, Wailing, Weeping',
    moodZh:    '深層絕望、哭泣、懺悔',
    scene:     '宿命、悔恨、黑暗祈禱',
    color:     '#4a4a8a',   // 深紫藍
    aliases:   ['Db minor'],
  },
  'Db major': {
    nameZh:    '降 D 大調',
    nameEn:    'D♭ Major',
    mood:      'Grief, Depressive',
    moodZh:    '悲傷、壓抑、含淚微笑',
    scene:     '優雅悲劇、華麗憂鬱、內心崩解',
    color:     '#8a6a9a',   // 紫灰
    aliases:   ['C# major'],
  },
  'D major': {
    nameZh:    'D 大調',
    nameEn:    'D Major',
    mood:      'Triumphant, Victorious',
    moodZh:    '勝利、凱旋、英雄感',
    scene:     '戰勝困難、典禮、壯闊副歌',
    color:     '#f57c42',   // 橙紅
    aliases:   [],
  },
  'D minor': {
    nameZh:    'D 小調',
    nameEn:    'D Minor',
    mood:      'Serious, Pious, Ruminating',
    moodZh:    '嚴肅、沉思、虔敬',
    scene:     '古典悲劇、宗教感、深夜獨白',
    color:     '#7a8a6a',   // 橄欖綠
    aliases:   [],
  },
  'D# minor': {
    nameZh:    '升 D 小調',
    nameEn:    'D# Minor',
    mood:      'Deep Distress, Existential Angst',
    moodZh:    '存在焦慮、極深痛苦、幽靈感',
    scene:     '恐怖、靈魂黑夜、心理驚悚',
    color:     '#3a3a5a',   // 深暗紫
    aliases:   ['Eb minor'],
  },
  'Eb major': {
    nameZh:    '降 E 大調',
    nameEn:    'E♭ Major',
    mood:      'Devotion, Intimacy',
    moodZh:    '奉獻、親密、莊嚴柔情',
    scene:     '神聖愛、誓言、親密對話',
    color:     '#e8a0c8',   // 玫瑰粉
    aliases:   ['D# major'],
  },
  'E major': {
    nameZh:    'E 大調',
    nameEn:    'E Major',
    mood:      'Boisterous, Incomplete Pleasure',
    moodZh:    '熱烈、喧鬧、喜悅中帶衝突',
    scene:     '高張力快歌、青春躁動、爭吵喜劇',
    color:     '#f5a623',   // 亮橙
    aliases:   [],
  },
  'E minor': {
    nameZh:    'E 小調',
    nameEn:    'E Minor',
    mood:      'Amorous, Restless',
    moodZh:    '多情、不安、憂鬱流動',
    scene:     '浪漫不安、等待、內心拉扯',
    color:     '#6ab8a8',   // 青綠
    aliases:   [],
  },
  'F major': {
    nameZh:    'F 大調',
    nameEn:    'F Major',
    mood:      'Quick-Tempered, Passing Regret',
    moodZh:    '克制怒氣、短暫後悔、表面平靜',
    scene:     '壓抑情緒、暗湧、禮貌下的怒火',
    color:     '#c8a04a',   // 芥末黃
    aliases:   [],
  },
  'F minor': {
    nameZh:    'F 小調',
    nameEn:    'F Minor',
    mood:      'Plaintive, Funereal',
    moodZh:    '哀訴、葬禮感、深沉悲痛',
    scene:     '死亡、告別、極度哀傷',
    color:     '#5a5a7a',   // 暗灰紫
    aliases:   [],
  },
  'F# major': {
    nameZh:    '升 F 大調',
    nameEn:    'F# Major',
    mood:      'Conquering Difficulties',
    moodZh:    '克服困難、釋放、清澈勝利',
    scene:     '轉折後的光、突破、解放感',
    color:     '#4ecfb3',   // 青綠明亮
    aliases:   ['Gb major'],
  },
  'F# minor': {
    nameZh:    '升 F 小調',
    nameEn:    'F# Minor',
    mood:      'Gloomy, Passionate Resentment',
    moodZh:    '陰鬱、怨懟、強烈不滿',
    scene:     '復仇、壓抑怒火、情緒爆發前',
    color:     '#8a4a6a',   // 暗玫瑰
    aliases:   ['Gb minor'],
  },
  'G major': {
    nameZh:    'G 大調',
    nameEn:    'G Major',
    mood:      'Serious, Magnificent, Fantasy',
    moodZh:    '田園、詩意、溫柔、壯麗幻想',
    scene:     '自然、友情、感恩、奇幻旅程',
    color:     '#6abf6a',   // 草綠
    aliases:   [],
  },
  'G minor': {
    nameZh:    'G 小調',
    nameEn:    'G Minor',
    mood:      'Discontent, Uneasiness',
    moodZh:    '不滿、不安、計畫失敗感',
    scene:     '焦慮、失控、黑色幽默',
    color:     '#a0a05a',   // 暗黃綠
    aliases:   [],
  },
  'Ab major': {
    nameZh:    '降 A 大調',
    nameEn:    'A♭ Major',
    mood:      'Death, Eternity, Judgement',
    moodZh:    '死亡、永恆、審判、幽暗宇宙感',
    scene:     '鬼魅、墳場、命運審判',
    color:     '#3a5a6a',   // 深海藍
    aliases:   ['G# major'],
  },
  'Ab minor': {
    nameZh:    '降 A 小調',
    nameEn:    'A♭ Minor',
    mood:      'Grumbling, Moaning, Wailing',
    moodZh:    '哀號、窒息、長期受苦',
    scene:     '慢性痛苦、壓迫、生命困境',
    color:     '#2a2a4a',   // 最深暗
    aliases:   ['G# minor'],
  },
  'A major': {
    nameZh:    'A 大調',
    nameEn:    'A Major',
    mood:      'Joyful, Pastoral, Declaration of Love',
    moodZh:    '牧歌式喜悅、純愛、樂觀',
    scene:     '告白、鄉村風景、溫暖幸福',
    color:     '#f5d76e',   // 金黃
    aliases:   [],
  },
  'A minor': {
    nameZh:    'A 小調',
    nameEn:    'A Minor',
    mood:      'Tender, Plaintive, Pious',
    moodZh:    '溫柔、哀婉、優雅、撫慰',
    scene:     '民謠、祈禱、淡淡憂傷',
    color:     '#a08acd',   // 淡紫
    aliases:   [],
  },
  'Bb major': {
    nameZh:    '降 B 大調',
    nameEn:    'B♭ Major',
    mood:      'Joyful, Quaint, Cheerful',
    moodZh:    '明朗、親切、希望感',
    scene:     '友善、團圓、溫馨喜劇',
    color:     '#f5b87a',   // 蜜橙
    aliases:   ['A# major'],
  },
  'Bb minor': {
    nameZh:    '降 B 小調',
    nameEn:    'B♭ Minor',
    mood:      'Terrible, Night, Mocking',
    moodZh:    '夜色、嘲諷、絕望、黑暗信念',
    scene:     '黑色寓言、惡夢、反派獨白',
    color:     '#2a1a3a',   // 極暗紫黑
    aliases:   ['A# minor'],
  },
  'B major': {
    nameZh:    'B 大調',
    nameEn:    'B Major',
    mood:      'Harsh, Strong, Wild, Rage',
    moodZh:    '強烈、粗獷、憤怒、失控激情',
    scene:     '戰鬥、狂暴、金屬感、極端情緒',
    color:     '#e84040',   // 鮮紅
    aliases:   [],
  },
  'B minor': {
    nameZh:    'B 小調',
    nameEn:    'B Minor',
    mood:      'Solitary, Melancholic, Patience',
    moodZh:    '孤獨、耐心、宿命式憂鬱',
    scene:     '等待、命運、長夜、克制悲傷',
    color:     '#6a7a9a',   // 霧藍灰
    aliases:   [],
  },
}

/**
 * 根據 Essentia 輸出的 key 字串查找情緒資料。
 * 支援大小寫不敏感、enharmonic 別名查找。
 *
 * @param {string} keyStr  例如 "C major", "F# minor", "Bb major"
 * @returns {object|null}
 */
export function lookupKeyMood(keyStr) {
  if (!keyStr) return null

  // 標準化：首字大寫，major/minor 小寫
  const normalized = keyStr.trim()
    .replace(/Major/i, 'major')
    .replace(/Minor/i, 'minor')
    // 常見變體統一
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#')

  // 直接查找
  if (KEY_MOOD_MAP[normalized]) return KEY_MOOD_MAP[normalized]

  // 別名查找
  for (const [, data] of Object.entries(KEY_MOOD_MAP)) {
    if (data.aliases?.includes(normalized)) return data
  }

  return null
}
