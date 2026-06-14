import subprocess
import uuid
import shutil
import json
from pathlib import Path

# 調整為你的 BTC 實際路徑
BTC_DIR = Path("/home/ubuntu/BTC/BTC-ISMIR19")
BTC_SCRIPT = BTC_DIR / "test.py"
BTC_PYTHON = BTC_DIR / "../venv/bin/python"

def parse_tuning_file(tuning_path: Path) -> dict:
    """讀取 BTC 產生的 _tuning.json"""
    if not tuning_path.exists():
        return {
            "a4_hz": 440.0,
            "tuning_offset_cents": 0.0,
            "status": "unknown",
            "status_text": "無調音資料",
        }
    with open(tuning_path, "r") as f:
        return json.load(f)

# 解析 .lab 格式的結果檔
def parse_lab_file(lab_path: Path) -> list[dict]:
    timeline = []
    with open(lab_path, "r") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 3:
                continue
            start, end, chord = float(parts[0]), float(parts[1]), parts[2]
            timeline.append({
                "chord": chord,
                "start": round(start, 3),
                "dur": round(end - start, 3),
            })
    return timeline

# 推測主調（出現時長最長的非 N 和弦的根音）
def infer_key(timeline: list[dict]) -> str:
    dur_map = {}
    for item in timeline:
        c = item["chord"]
        if c == "N":
            continue
        root = c.split(":")[0]
        dur_map[root] = dur_map.get(root, 0) + item["dur"]
    if not dur_map:
        return "Unknown"
    dominant = max(dur_map, key=dur_map.get)
    # 簡易大小調判斷：有 min 就標 minor，否則 major
    for item in timeline:
        c = item["chord"]
        if c.startswith(dominant + ":min"):
            return f"{dominant} minor"
    return f"{dominant} major"

# 主流程：接收 wav bytes，執行 BTC，回傳結果
def run_btc(audio_bytes: bytes, filename: str) -> dict:
    job_id = uuid.uuid4().hex
    audio_dir = Path(f"/tmp/btc_audio_{job_id}")
    save_dir  = Path(f"/tmp/btc_save_{job_id}")
    audio_dir.mkdir(parents=True)
    save_dir.mkdir(parents=True)

    wav_path = audio_dir / filename
    try:
        # 1. 存 wav 到暫存資料夾
        wav_path.write_bytes(audio_bytes)

        # 2. 執行 BTC
        result = subprocess.run(
            [
                str(BTC_PYTHON), str(BTC_SCRIPT),
                "--audio_dir", str(audio_dir),
                "--save_dir",  str(save_dir),
                "--voca", "True",
            ],
            cwd=str(BTC_DIR),
            capture_output=True,
            text=True,
            timeout=120,      # 最多等 2 分鐘
        )

        if result.returncode != 0:
            raise RuntimeError(f"BTC failed:\n{result.stderr}")

        # 3. 找對應的 .lab 結果檔
        stem = Path(filename).stem
        lab_path = save_dir / f"{stem}.lab"
        tuning_path = save_dir / f"{stem}_tuning.json"
        if not lab_path.exists():
            # BTC 有時會改副檔名，找第一個 .lab
            candidates = list(save_dir.glob("*.lab"))
            if not candidates:
                raise FileNotFoundError("No .lab file generated")
            lab_path = candidates[0]

        # 4. 解析並回傳
        timeline = parse_lab_file(lab_path)
        key = infer_key(timeline)
        tuning   = parse_tuning_file(tuning_path)
        return {"key": key, "tuning":  tuning, "timeline": timeline}

    finally:
        # 5. 清除暫存
        shutil.rmtree(audio_dir, ignore_errors=True)
        shutil.rmtree(save_dir, ignore_errors=True)
