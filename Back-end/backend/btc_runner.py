import subprocess
import uuid
import shutil
import json
from pathlib import Path

BTC_DIR = Path("/home/musicai/Projects/MusicAI/Back-end/BTC/BTC-ISMIR19")
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
    for item in timeline:
        c = item["chord"]
        if c.startswith(dominant + ":min"):
            return f"{dominant} minor"
    return f"{dominant} major"

def run_btc(audio_bytes: bytes, filename: str) -> dict:
    job_id = uuid.uuid4().hex
    audio_dir = Path(f"/tmp/btc_audio_{job_id}")
    save_dir  = Path(f"/tmp/btc_save_{job_id}")
    audio_dir.mkdir(parents=True)
    save_dir.mkdir(parents=True)

    wav_path = audio_dir / filename
    try:
        wav_path.write_bytes(audio_bytes)

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

        stem = Path(filename).stem
        lab_path = save_dir / f"{stem}.lab"
        tuning_path = save_dir / f"{stem}_tuning.json"
        if not lab_path.exists():
            candidates = list(save_dir.glob("*.lab"))
            if not candidates:
                raise FileNotFoundError("No .lab file generated")
            lab_path = candidates[0]

        timeline = parse_lab_file(lab_path)
        key = infer_key(timeline)
        tuning   = parse_tuning_file(tuning_path)
        return {"key": key, "tuning":  tuning, "timeline": timeline}

    finally:
        shutil.rmtree(audio_dir, ignore_errors=True)
        shutil.rmtree(save_dir, ignore_errors=True)
