from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from btc_runner import run_btc
from essentia_runner import run_essentia
import asyncio
import subprocess

# ---------------------------------------------------------------------------
# 上傳限制（前端 src/utils/api.js、mock/mock_server.py 要跟著改）
# - 檔案 99 MB：nginx 的 client_max_body_size 是 100M，算的是整個請求（multipart 的
#   邊界與標頭會多出幾百 bytes），留 1 MB 餘裕，避免剛好 100 MB 的檔案被 nginx 擋掉
# - 長度 15 分鐘：BTC 和 Essentia 的耗時與記憶體看的是「音檔長度」不是檔案大小。
#   99 MB 的 CD 音質（44.1kHz/16bit/立體聲）約 9.8 分鐘，但低取樣率、單聲道的 WAV
#   同樣大小可能長達數小時，librosa 重取樣後會吃掉好幾 GB 記憶體並逾時
# ---------------------------------------------------------------------------
MAX_UPLOAD_MB = 99
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
MAX_DURATION_MIN = 15


def wav_duration(content: bytes) -> float | None:
    """從 WAV 標頭算長度（秒）：data 區塊大小 ÷ 每秒 bytes 數；讀不懂時回傳 None"""
    if len(content) < 12 or content[:4] != b"RIFF" or content[8:12] != b"WAVE":
        return None
    byte_rate = None
    i = 12
    while i + 8 <= len(content):
        cid = content[i:i + 4]
        size = int.from_bytes(content[i + 4:i + 8], "little")
        if cid == b"fmt " and size >= 12:
            byte_rate = int.from_bytes(content[i + 16:i + 20], "little")
        elif cid == b"data":
            # 串流錄音的 data 大小可能寫 0 或 0xFFFFFFFF，以實際剩下的長度為準
            data_size = len(content) - i - 8
            if 0 < size < data_size:
                data_size = size
            return data_size / byte_rate if byte_rate else None
        i += 8 + size + (size & 1)
    return None

app = FastAPI(title="ChordLab API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/analyze")
async def analyze(audio: UploadFile = File(...)):
    if not audio.filename.lower().endswith(".wav"):
        raise HTTPException(status_code=400, detail="只接受 .wav 檔案")

    # 先看上傳的大小，太大就不用讀進記憶體
    if audio.size is not None and audio.size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"檔案過大（上限 {MAX_UPLOAD_MB} MB）")
    content = await audio.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"檔案過大（上限 {MAX_UPLOAD_MB} MB）")

    duration = wav_duration(content)
    if duration is not None and duration > MAX_DURATION_MIN * 60:
        raise HTTPException(
            status_code=413,
            detail=f"音檔太長（{duration / 60:.1f} 分鐘，上限 {MAX_DURATION_MIN} 分鐘）",
        )

    try:
        loop = asyncio.get_event_loop()
        #result = await loop.run_in_executor(
        #    None, run_btc, content, audio.filename
        #)
        result1, result2 = await asyncio.gather(
            loop.run_in_executor(None, run_btc, content, audio.filename),
            loop.run_in_executor(None, run_essentia, content, audio.filename)
        )
        return {"BTC": result1, "Essentia": result2}
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except (asyncio.TimeoutError, subprocess.TimeoutExpired):
        # btc_runner／essentia_runner 的 subprocess 超過 timeout 時丟的是 TimeoutExpired
        raise HTTPException(status_code=504, detail="分析逾時")

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/hello")
def hello():
    return {"message": "Hello2 from Python!"}


@app.get("/api/test2")
def hello():
    return {"message": "test!"}


