# ChordLab

WAV 音樂和弦分析器 — Vue 3 前端介面。

## 專案結構

```
chordlab/
├── src/
│   ├── assets/
│   │   └── main.css          # 全域樣式與 CSS 變數
│   ├── components/
│   │   ├── AppHeader.vue     # 頂部標題列
│   │   ├── UploadZone.vue    # 檔案上傳區（拖曳 / 點擊）
│   │   ├── AnalyzeButton.vue # 分析按鈕
│   │   ├── ProgressBar.vue   # 分析進度條
│   │   ├── ResultsPanel.vue  # 分析結果容器
│   │   ├── StatsGrid.vue     # 統計數字卡片
│   │   ├── ChordTimeline.vue # 時間軸與和弦詳情
│   │   ├── FrequencyChart.vue# 使用頻率長條圖
│   │   ├── KeyAnalysis.vue   # 調性羅馬數字分析
│   │   └── SectionLabel.vue  # 區塊標籤（共用）
│   ├── utils/
│   │   ├── api.js            # 後端 API 呼叫（含 mock fallback）
│   │   └── chordData.js      # 和弦資料與顏色設定
│   ├── App.vue               # 根元件
│   └── main.js               # 應用進入點
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

編輯 `src/utils/api.js`，`analyzeAudio()` 函式已設定對接 `/api/analyze`。

後端需接受 `multipart/form-data` POST 請求，欄位名稱為 `audio`，並回傳：

```json
{
  "key": "C major",
  "timeline": [
    { "chord": "C",  "start": 0.0, "dur": 2.1 },
    { "chord": "Am", "start": 2.1, "dur": 2.0 }
  ]
}
```

若後端未啟動，會自動使用 `getMockResponse()` 的假資料，方便開發 UI。

Vite 已設定 proxy，`/api/*` 會自動轉發到 `http://localhost:8000`，可在 `vite.config.js` 修改目標位址。

## 新增和弦資料

在 `src/utils/chordData.js` 的 `CHORD_INFO` 與 `ROMAN_NUMERALS` 中新增對應資料：

```js
export const CHORD_INFO = {
  // 新增
  Bm: { notes: 'B D F#', func: '副和弦 (ii)' },
}

export const ROMAN_NUMERALS = {
  // 新增
  Bm: 'ii',
}
```

## 建置部署

```bash
npm run build
# 產出於 dist/ 資料夾，複製到 Nginx 的 /var/www/html/
```
