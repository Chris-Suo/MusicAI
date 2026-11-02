# ChordLab

WAV 音樂分析器 — Vue 3 前端介面。上傳 WAV 後顯示三大類分析：**和弦調性**、**音高頻率**、**速度節拍**。

## 畫面規劃

| 區塊 | 內容 |
|---|---|
| 上傳 | 拖曳或點選 WAV，選好就自動開始分析 |
| 播放器（固定在上方） | 檔名、播放／暫停（空白鍵，← → 前後 5 秒）、進度條可拖曳跳轉、正在播放的和弦、換檔案 |
| 分頁 | 三個分頁上直接顯示重點數字：調性、A4 頻率、BPM |
| 和弦調性 | 調性（信心度、音階、情緒與情境）、和弦占比（和聲功能＋前幾名和弦）、和弦進行（主要循環、常見進行、級數格；可切換簡譜／羅馬、每格 1 小節／半小節） |
| 音高頻率 | 調音基準（音分偏差尺）、旋律音域（鋼琴鍵盤）、旋律音高曲線（可縮放，左邊音名、右邊 Hz）、音高占比（音名、音區頻率 Hz） |
| 速度節拍 | 速度（速度術語尺）、BPM 占比、節拍時間軸（小節線＋速度曲線）、音量（響度參考尺、響度變化） |

- 畫面以簡潔為原則：同一個數字只出現在一個地方，沒有資料的區塊合併成一行說明
- 圖表預設把整首歌放進一個畫面（旋律音高曲線可放大到 8×），共用同一個播放位置；點圖表或級數格都會從該處播放
- 白天／黑夜主題（右上角切換，記在 localStorage，預設跟系統設定），色票以投影幕清楚為目標
- 和聲功能四色（主／下屬／屬／調外）經過色盲模擬檢查，旁邊一定有級數或和弦名稱

## 專案結構

```
chordlab/
├── src/
│   ├── assets/
│   │   └── main.css              # 白天／黑夜色票、共用樣式（.card、.seg、.btn、.legend…）
│   ├── composables/
│   │   ├── useTheme.js           # 主題切換
│   │   ├── usePlayback.js        # 全頁共用播放器（provide / inject）
│   │   └── useTimeAxis.js        # 時間軸（寬度、刻度、縮放、浮動提示位置）
│   ├── components/
│   │   ├── AppHeader.vue / ThemeToggle.vue
│   │   ├── UploadZone.vue        # 拖放上傳
│   │   ├── AnalysisStatus.vue    # 分析中進度／失敗重試
│   │   ├── ResultsPanel.vue      # 結果容器：資料整理、播放器、三個分頁
│   │   ├── PlayerBar.vue         # 共用播放器
│   │   ├── common/               # AppIcon、FilePickButton、PlayHead、TimeRuler、ZoomControl
│   │   ├── harmony/              # KeyCard、ChordShare、KeyAnalysis（和弦進行）
│   │   ├── pitch/                # TuningCard、PitchRange、PitchContour、PitchShare
│   │   └── rhythm/               # TempoCard、TempoShare、BeatTimeline、LoudnessCard
│   ├── utils/
│   │   ├── api.js                # 後端 API 呼叫（含 mock fallback）
│   │   ├── progression.js        # 和弦進行分析（級數、常見進行、循環）
│   │   ├── music.js              # 音名拼寫、和弦組成音、和聲功能、MIDI↔Hz、速度術語
│   │   ├── pitch.js              # 主旋律音高統計（音域、音名占比、音區占比）
│   │   ├── stats.js              # 中位數、二分搜尋、時間格式
│   │   └── keyMoodData.js        # 調性情緒對照表
│   ├── App.vue
│   └── main.js
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

`src/utils/api.js` 的 `analyzeAudio()` 會以 `multipart/form-data`（欄位 `audio`）POST 到 `/api/analyze`，後端回傳：

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
- 後端連不到時會改用 `getMockResponse()` 的示範資料，畫面上方會出現「示範資料」提示。

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
