# ChordLab 假後端（Mock Server）

不用跑 BTC 模型和 Essentia，就能拿到和正式後端 `POST /api/analyze` **同格式**的回應，用來調整前端。

- 只用 Python 標準庫，**不用 pip install**（需要 Python 3.8 以上）
- 直接 import `../backend/btc_runner.py`、`../backend/essentia_runner.py` 裡的解析函式，所以 `key`、`timeline`、`tuning`、`Essentia` 的結構跟正式後端一致
- 會讀上傳 WAV 的長度，產生同樣長度的和弦時間軸
- 和弦標籤使用 BTC 的字彙格式：`C`、`A:min`、`G:7`、`F:maj7`、`B:hdim7`、`N`…
- 音高圖使用 `Front-end/chordlab/src/assets/fig.png`（不存在時用程式畫一張）

## 啟動

```bash
cd Back-end/mock
python3 mock_server.py            # http://localhost:8080，對應目前 vite.config.js 的 proxy
```

另一個終端機：

```bash
cd Front-end/chordlab
npm run dev
```

常用參數：

| 參數 | 說明 |
|---|---|
| `--port 8000` | 改成跟正式後端一樣的 port（vite proxy 目前指向 8080） |
| `--scenario minor` | 啟動時的情境（見下表） |
| `--tuning sharp` | `random` / `standard` / `sharp` / `flat` |
| `--delay 3` | 假裝分析要花幾秒（預設 1.5，讓進度條看得到） |
| `--seed 42` | 固定亂數，每次結果相同，方便對照畫面 |

## 執行中切換情境（不用重啟）

```bash
curl "http://localhost:8080/api/mock/config?scenario=error500"
curl "http://localhost:8080/api/mock/config?tuning=flat&delay=0&seed=1"
curl  http://localhost:8080/api/mock/config        # 查看目前設定
```

切完直接在前端按「分析」就會套用。

| 情境 | 結果 |
|---|---|
| `normal` | 隨機大調／小調（預設） |
| `major` / `minor` | 固定大調／小調 |
| `complex` | 大量七和弦、sus、6 和弦 |
| `long` / `short` | 固定 4 分鐘／5 秒 |
| `silent` | 整段都是 `N`，key = `Unknown` |
| `no_image` | `image_base64: null` |
| `no_essentia` | Essentia 走 fallback（LUFS/BPM/Beats 都是 null） |
| `no_tuning` | tuning 走 fallback（status = `unknown`） |
| `error500` / `timeout504` / `error413` | 對應的錯誤碼與 `{"detail": ...}` |
| `network_fail` | 直接斷線，測試前端 `catch` |

非 `.wav` 檔一律回 400 `只接受 .wav 檔案`，跟正式後端一樣。

## 回應範例

```json
{
  "BTC": {
    "key": "C major",
    "tuning": { "a4_hz": 440.03, "tuning_offset_cents": 10.7, "status": "sharp", "status_text": "偏高 10.7 cents" },
    "timeline": [
      { "chord": "N", "start": 0.0, "dur": 1.207 },
      { "chord": "E:min", "start": 1.207, "dur": 1.579 },
      { "chord": "C", "start": 2.786, "dur": 6.874 }
    ]
  },
  "Essentia": {
    "essentia": { "LUFS": -21.07, "BPM": 70.79, "Beats": 23 },
    "image_base64": "iVBORw0KGgo...",
    "image_mime": "image/png"
  }
}
```

> `EssentiaOutput.json` 的欄位（LUFS / BPM / Beats）是依 `essentia_runner.py` 的 fallback 與前端用到的欄位推測的。`pitch.py` 不在這個 repo，若它實際輸出更多欄位，在 `make_essentia()` 補上即可。
