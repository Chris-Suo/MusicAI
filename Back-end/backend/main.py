from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from btc_runner import run_btc
from essentia_runner import run_essentia
import asyncio

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

    content = await audio.read()
    if len(content) > 50 * 1024 * 1024:   # 50 MB 上限
        raise HTTPException(status_code=413, detail="檔案過大（上限 50 MB）")

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
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="BTC 分析逾時")

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/hello")
def hello():
    return {"message": "Hello2 from Python!"}


@app.get("/api/test2")
def hello():
    return {"message": "test!"}


