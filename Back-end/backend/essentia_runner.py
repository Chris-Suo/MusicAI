import subprocess
import uuid
import shutil
import json
import base64
from pathlib import Path

PITCH_DIR = Path("/home/musicai/Projects/Essentia")
PITCH_SCRIPT = PITCH_DIR / "pitch.py"
PITCH_PYTHON = "/home/musicai/.pyenv/shims/python3.14"
#PITCH_PYTHON = PITCH_DIR / "../venv/bin/python"


def parse_essentia_file(json_path: Path) -> dict:
    """讀取 pitch.py 產生的 EssentiaOutput json"""
    if not json_path.exists():
        return {
            "LUFS": None,
            "BPM": None,
            "Beats": None,
            "status": "unknown",
            "status_text": "無 Essentia 分析資料",
        }
    with open(json_path, "r") as f:
        return json.load(f)


def encode_image_base64(png_path: Path) -> str | None:
    """將圖檔轉成 base64 字串，方便前端直接以 data URL 顯示"""
    if not png_path.exists():
        return None
    with open(png_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def run_essentia(audio_bytes: bytes, filename: str) -> dict:
    job_id = uuid.uuid4().hex
    work_dir = Path(f"/tmp/pitch_work_{job_id}")
    work_dir.mkdir(parents=True)

    audio_path = work_dir / filename
    output_png = work_dir / "fig.png"
    output_json = work_dir / "EssentiaOutput.json"

    try:
        audio_path.write_bytes(audio_bytes)

        result = subprocess.run(
            [
                str(PITCH_PYTHON), str(PITCH_SCRIPT),
                str(audio_path),
                str(output_png),
                str(output_json),
            ],
            cwd=str(PITCH_DIR),
            capture_output=True,
            text=True,
            timeout=120,      # 最多等 2 分鐘
        )

        if result.returncode != 0:
            raise RuntimeError(f"pitch.py failed:\n{result.stderr}")

        essentia_data = parse_essentia_file(output_json)
        image_base64 = encode_image_base64(output_png)

        return {
            "essentia": essentia_data,
            "image_base64": image_base64,
            "image_mime": "image/png",
        }

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
