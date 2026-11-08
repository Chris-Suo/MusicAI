# ChordLab

WAV 音樂分析器 — Vue 3 前端介面。上傳 WAV 後顯示三大類分析：**和弦調性**、**音高頻率**、**速度節拍**。

## 畫面規劃

| 區塊 | 內容 |
|---|---|
| 上傳 | 拖曳或點選 WAV，選好就自動開始分析 |
| 播放器（固定在上方） | 檔名、播放／暫停（空白鍵，← → 前後 5 秒）、進度條可拖曳跳轉、正在播放的和弦、換檔案 |
| 分頁 | 三個分頁上直接顯示重點數字：調性、A4 頻率、BPM |
| 和弦調性 | 調性（信心度、音階、情緒與情境）、和弦占比（和聲功能＋前幾名和弦）、和弦進行（主要循環、常見進行、級數格；可切換簡譜／羅馬、每格 1 小節／半小節） |
| 音高頻率 | 調音基準（音分偏差尺）、旋律音域（鋼琴鍵盤）、音高占比（各音區 Hz、最常出現的音）、旋律音高曲線（可縮放，左邊音名、右邊 Hz） |
| 速度節拍 | 速度（速度術語尺）、BPM 占比、節拍時間軸（小節線＋速度曲線）、音量（響度參考尺、響度變化） |

- 畫面以簡潔為原則：同一個數字只出現在一個地方，沒有資料的區塊合併成一行說明
- 圖表預設把整首歌放進一個畫面（旋律音高曲線可放大到 8×），共用同一個播放位置；點圖表或級數格都會從該處播放
- 三個占比（和弦、音高、BPM）用同一種圖，都放在分頁右上角：上方是 100% 色條＋圖例，下方是前幾名的橫條，「其他」只寫加總
- 白天／黑夜主題（右上角切換，記在 localStorage，預設跟系統設定），色票以投影幕清楚為目標
- 和聲功能四色（主／下屬／屬／調外）經過色盲模擬檢查，旁邊一定有級數或和弦名稱

## 程式架構

資料只往一個方向走：**後端回傳 → `utils/analysis.js` 整理 → 元件顯示**。

| 層 | 負責 | 規則 |
|---|---|---|
| `utils/api.js` | 呼叫後端（連不到時改用示範資料） | 只管傳輸，不碰資料內容 |
| `utils/analysis.js` | 把後端回傳整理成畫面用的資料 | 唯一直接讀後端欄位的地方，後端格式改了只改這裡 |
| `utils/` 的計算檔（theory、chords、progression、pitch、rhythm、loudness、stats、time） | 樂理與統計計算 | 純函式：不依賴 Vue、不碰畫面，同樣的輸入一定得到同樣的結果 |
| `components/` | 顯示與互動 | 只吃整理好的資料；顏色、文字、版面在這裡決定 |
| `composables/` | 跨元件共用的狀態 | 播放器、時間軸縮放、主題 |

`utils/` 之間的依賴：`theory` ← `chords` ← `progression`；`pitch`、`rhythm`、`loudness` 各自獨立；`analysis` 把它們組起來。

## 專案結構

```
chordlab/
├── src/
│   ├── App.vue                   # 流程：選檔 → 分析 → 結果
│   ├── main.js
│   ├── assets/
│   │   └── main.css              # 白天／黑夜色票、共用樣式（卡片、按鈕、圖例、時間軸圖表…）
│   ├── composables/
│   │   ├── usePlayback.js        # 全頁共用播放器（provide / inject）
│   │   ├── useTimeAxis.js        # 時間軸（寬度、刻度、縮放、浮動提示位置）
│   │   └── useTheme.js           # 主題切換
│   ├── components/
│   │   ├── AppHeader.vue / ThemeToggle.vue
│   │   ├── UploadZone.vue        # 拖放上傳
│   │   ├── AnalysisStatus.vue    # 分析中進度／失敗重試
│   │   ├── ResultsPanel.vue      # 結果版面：播放器＋三個分頁
│   │   ├── PlayerBar.vue         # 共用播放器
│   │   ├── common/               # AppIcon、FilePickButton、PlayHead、ShareBars（占比圖）、TabBar、TimeRuler、ZoomControl
│   │   ├── harmony/              # KeyCard、ChordShare、KeyAnalysis（和弦進行）
│   │   ├── pitch/                # TuningCard、PitchRange、PitchShare、PitchContour
│   │   └── rhythm/               # TempoCard、TempoShare、BeatTimeline、LoudnessCard
│   └── utils/
│       ├── api.js                # 呼叫後端 /api/analyze
│       ├── mockResponse.js       # 示範資料（連不到後端時使用）
│       ├── analysis.js           # 後端回傳 → 畫面用的資料
│       ├── theory.js             # 基礎樂理：音名拼寫、調、音階、MIDI ↔ Hz
│       ├── chords.js             # 和弦：解析、級數（簡譜／羅馬）、和聲功能、占比、推估調性
│       ├── progression.js        # 和弦進行：小節切分、常見進行、反覆出現的循環
│       ├── pitch.js              # 主旋律音高統計：音域、各音與各音區占比
│       ├── rhythm.js             # 節拍：拍點統計、BPM 分布、速度術語
│       ├── loudness.js           # 響度：曲線整理、白話描述
│       ├── stats.js              # 中位數、百分位數、占比排行
│       ├── time.js               # 時間軸搜尋、刻度、時間格式
│       ├── storage.js            # 記住使用者的選擇（localStorage）
│       └── keyMoodData.js        # 調性情緒對照表
├── index.html
├── vite.config.js
└── package.json
```

## 快速開始

```bash
npm install
npm run dev
```

開啟瀏覽器至 http://localhost:5173

## 連接後端 API

`src/utils/api.js` 的 `analyzeAudio()` 會以 `multipart/form-data`（欄位 `audio`）POST 到 `/api/analyze`，回傳的資料由 `src/utils/analysis.js` 整理。後端回傳：

```json
{
  "BTC": {
    "tuning": { "a4_hz": 440.0, "tuning_offset_cents": -1.0, "status": "standard", "status_text": "標準 440 Hz" },
    "timeline": [{ "chord": "C", "start": 0.0, "dur": 2.1 }, { "chord": "A:min", "start": 2.1, "dur": 2.0 }]
  },
  "Essentia": {
    "essentia": {
      "LUFS": -16.9, "LoudnessRange": 6.4, "BPM": 90.0, "Beats": [0.41, 1.07, 1.73],
      "Key": "F# major", "KeyStrength": 0.94, "KeyProfile": "bgate",
      "PitchContour": { "hop": 0.0493, "midi": [null, 66.02, 66.1] },
      "LoudnessCurve": { "hop": 0.5, "lufs": [-31.2, -20.5] }
    },
    "image_base64": "<png>",
    "image_mime": "image/png"
  }
}
```

- `PitchContour`（主旋律音高，MIDI，A4 = 69，null = 沒有旋律）與 `LoudnessCurve`（短時響度）由新版 `Back-end/Essentia/pitch.py` 輸出。
  後端還是舊版時，音高曲線會退回顯示 `image_base64` 的 PNG，音域／音高占比／響度曲線則不顯示。
- A4 頻率由 `tuning_offset_cents` 換算（`440 × 2^(cents/1200)`），不使用 `a4_hz`。
- 後端連不到時會改用 `src/utils/mockResponse.js` 的示範資料，畫面上方會出現「示範資料」提示。

Vite 已設定 proxy，`/api/*` 會自動轉發到 `http://localhost:8000`，可在 `vite.config.js` 修改目標位址。
不跑模型時可以用假後端：`python Back-end/mock/mock_server.py --port 8000`（見 `Back-end/mock/README.md`）。

## 建置部署（Linux 伺服器）

前端建置後是純靜態檔，由 Nginx 從 `/var/www/html` 提供；`/api/` 由 Nginx 轉給 uvicorn（port 8000）。設定檔見 `Back-end/default`、`Back-end/chordBackend.service`。需要 Node.js 18 / 20 / 22 以上。

```bash
cd ~/Projects/MusicAI && git pull                       # 取得包含新版前端的分支
cd Front-end/chordlab
npm ci && npm run build                                 # 產出 dist/
sudo cp -r /var/www/html ~/html.bak.$(date +%Y%m%d)     # 備份舊網頁，可隨時還原
sudo rm -rf /var/www/html/assets                        # 清掉舊版的 js/css
sudo cp -r dist/. /var/www/html/
```

音高曲線、音域、音高占比、響度曲線需要新版 `Back-end/Essentia/pitch.py`。`essentia_runner.py` 執行的是 `/home/musicai/Projects/Essentia/pitch.py`（不在 repo 裡），要複製過去：

```bash
cp ~/Projects/Essentia/pitch.py ~/Projects/Essentia/pitch.py.bak
cp ~/Projects/MusicAI/Back-end/Essentia/pitch.py ~/Projects/Essentia/pitch.py
```

`pitch.py` 每次分析都會重新執行，不用重啟後端。部署後在瀏覽器按 Ctrl+F5 重新整理；畫面上方若出現「示範資料」，代表 `/api/analyze` 失敗，顯示的是假資料。
