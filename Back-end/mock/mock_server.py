#!/usr/bin/env python3
"""
ChordLab 假後端（Mock Server）
================================

用途：在不跑 BTC 模型與 Essentia 的情況下調整前端。
回傳格式與 Back-end/backend/main.py 的 POST /api/analyze 相同：

    {
      "BTC": {
        "tuning": {"a4_hz": 440.0, "tuning_offset_cents": -12.0,
                   "status": "flat", "status_text": "偏低 12.0 cents"},
        "timeline": [{"chord": "N", "start": 0.0, "dur": 0.743}, ...]
      },
      "Essentia": {
        "essentia": {"LUFS": -14.2, "LoudnessRange": 6.4, "BPM": 96.3, "Beats": [0.412, 1.035, 1.659, ...],
                     "Key": "C major", "KeyStrength": 0.82, "KeyProfile": "bgate",
                     "PitchContour": {"hop": 0.0495, "midi": [null, 64.02, 64.1, ...]},
                     "LoudnessCurve": {"hop": 0.5, "lufs": [-31.2, -20.5, ...]}},
        "image_base64": "<png base64>",
        "image_mime": "image/png"
      }
    }

為了讓格式和真後端完全一致，這支程式會：
  1. 先產生「BTC test.py 會寫出來的」 .lab 與 _tuning.json 檔
  2. 先產生「pitch.py 會寫出來的」 EssentiaOutput.json 與 fig.png
  3. 再交給 backend/btc_runner.py、backend/essentia_runner.py 裡原本的
     parse_lab_file / parse_tuning_file /
     parse_essentia_file / encode_image_base64 去解析
  （找不到 backend 資料夾時會用本檔內的等價實作）

只用 Python 標準庫，不需要 pip install。

啟動：
    python3 mock_server.py                     # 預設 port 8080（對應目前 vite.config.js 的 proxy）
    python3 mock_server.py --port 8000         # 改成跟正式後端一樣的 8000
    python3 mock_server.py --scenario minor --delay 3

執行中切換情境（不用重啟）：
    curl "http://localhost:8080/api/mock/config?scenario=error500"
    curl "http://localhost:8080/api/mock/config?tuning=sharp&delay=0"
    curl  http://localhost:8080/api/mock/config          # 查看目前設定與所有情境
"""

from __future__ import annotations

import argparse
import base64
import email.parser
import email.policy
import json
import math
import random
import shutil
import socket
import struct
import sys
import tempfile
import threading
import time
import zlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent  # .../MusicAI
BACKEND_DIR = HERE.parent / "backend"
FIG_PNG = PROJECT_ROOT / "Front-end" / "chordlab" / "src" / "assets" / "fig.png"

MAX_UPLOAD = 50 * 1024 * 1024  # 與 main.py 相同：50 MB

# ---------------------------------------------------------------------------
# 重用真後端的解析函式（確保輸出格式一致）
# ---------------------------------------------------------------------------
USING_REAL_PARSERS = False
try:
    sys.path.insert(0, str(BACKEND_DIR))
    from btc_runner import parse_lab_file, parse_tuning_file  # noqa: E402
    from essentia_runner import encode_image_base64, parse_essentia_file  # noqa: E402

    USING_REAL_PARSERS = True
except Exception:  # pragma: no cover - 只在 backend 資料夾不在時使用
    def parse_tuning_file(tuning_path: Path) -> dict:
        if not tuning_path.exists():
            return {"a4_hz": 440.0, "tuning_offset_cents": 0.0,
                    "status": "unknown", "status_text": "無調音資料"}
        return json.loads(tuning_path.read_text())

    def parse_lab_file(lab_path: Path) -> list:
        timeline = []
        for line in lab_path.read_text().splitlines():
            parts = line.strip().split()
            if len(parts) < 3:
                continue
            start, end, chord = float(parts[0]), float(parts[1]), parts[2]
            timeline.append({"chord": chord, "start": round(start, 3),
                             "dur": round(end - start, 3)})
        return timeline

    def parse_essentia_file(json_path: Path) -> dict:
        if not json_path.exists():
            return {"LUFS": None, "BPM": None, "Beats": None, "Key": None, "KeyStrength": None,
                    "status": "unknown", "status_text": "無 Essentia 分析資料"}
        return json.loads(json_path.read_text())

    def encode_image_base64(png_path: Path):
        if not png_path.exists():
            return None
        return base64.b64encode(png_path.read_bytes()).decode("utf-8")


# ---------------------------------------------------------------------------
# 情境設定
# ---------------------------------------------------------------------------
SCENARIOS = {
    "normal":       "隨機大調或小調，正常結果（預設）",
    "major":        "固定大調",
    "minor":        "固定小調",
    "complex":      "大量七和弦、sus、轉位外的延伸和弦（測試標籤顯示）",
    "long":         "忽略音檔長度，固定產生 4 分鐘的長曲",
    "short":        "忽略音檔長度，固定產生 5 秒的短曲",
    "silent":       "整段都是 N（BTC 沒抓到和弦；Essentia 仍給 key，但 strength 很低）",
    "low_key":      "Essentia 調性信心度很低（KeyStrength 0.2~0.4）",
    "no_image":     "Essentia 沒產生 fig.png（image_base64 = null）",
    "no_essentia":  "pitch.py 沒寫出 json（走 parse_essentia_file 的 fallback）",
    "no_tuning":    "BTC 沒寫出 _tuning.json（走 parse_tuning_file 的 fallback）",
    "error500":     "回傳 500（模擬 BTC failed）",
    "timeout504":   "回傳 504（模擬 BTC 分析逾時）",
    "error413":     "回傳 413（檔案過大）",
    "network_fail": "直接斷線不回應（測試前端 catch 分支）",
}
TUNING_MODES = ["random", "standard", "sharp", "flat"]

CONFIG_LOCK = threading.Lock()
CONFIG = {"scenario": "normal", "tuning": "random", "delay": 1.5, "seed": None}

# BTC 的和弦字彙（utils/mir_eval_modules.py：root_list / quality_list）
ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
# BTC 預設 hop_length=2048、sr=22050 → 每幀約 0.0929 秒，邊界會落在這個格點上
FRAME = 2048 / 22050


# Essentia 輸出的調名寫法（推測：升降混用，與前端 KEY_MOOD_MAP 主鍵一致；前端 aliases 也接受另一種寫法）
KEY_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def chord_label(root_idx: int, quality: str) -> str:
    """產生跟 BTC idx2voca_chord 一樣的標籤：maj 只寫根音，其他寫 root:quality"""
    root = ROOTS[root_idx % 12]
    return root if quality == "maj" else f"{root}:{quality}"


# 依調性級數（半音距離, 品質）
MAJOR_DEGREES = {
    "I": (0, "maj"), "ii": (2, "min"), "iii": (4, "min"), "IV": (5, "maj"),
    "V": (7, "maj"), "vi": (9, "min"), "vii": (11, "dim"),
}
MAJOR_EXT = {
    "I": ["maj7", "sus4", "maj6"], "ii": ["min7"], "iii": ["min7"],
    "IV": ["maj7", "sus2"], "V": ["7", "sus4"], "vi": ["min7"], "vii": ["hdim7"],
}
MAJOR_PROGRESSIONS = [
    ["I", "V", "vi", "IV"], ["I", "vi", "IV", "V"], ["ii", "V", "I", "I"],
    ["I", "IV", "V", "I"], ["vi", "IV", "I", "V"], ["I", "iii", "IV", "V"],
]
MINOR_DEGREES = {
    "i": (0, "min"), "ii": (2, "dim"), "III": (3, "maj"), "iv": (5, "min"),
    "v": (7, "min"), "V": (7, "maj"), "VI": (8, "maj"), "VII": (10, "maj"),
}
MINOR_EXT = {
    "i": ["min7", "minmaj7", "min6"], "ii": ["hdim7"], "III": ["maj7"],
    "iv": ["min7"], "v": ["min7"], "V": ["7"], "VI": ["maj7"], "VII": ["7"],
}
MINOR_PROGRESSIONS = [
    ["i", "VI", "III", "VII"], ["i", "iv", "V", "i"], ["i", "VII", "VI", "V"],
    ["i", "iv", "VII", "III"], ["i", "VI", "iv", "V"],
]


# ---------------------------------------------------------------------------
# 產生假資料
# ---------------------------------------------------------------------------
def wav_duration(data: bytes) -> float | None:
    """讀 RIFF 標頭算秒數（支援 PCM 與 float WAV），失敗回傳 None"""
    try:
        if data[:4] != b"RIFF" or data[8:12] != b"WAVE":
            return None
        pos, byte_rate, data_size = 12, None, None
        while pos + 8 <= len(data):
            cid = data[pos:pos + 4]
            size = struct.unpack("<I", data[pos + 4:pos + 8])[0]
            if cid == b"fmt ":
                byte_rate = struct.unpack("<I", data[pos + 16:pos + 20])[0]
            elif cid == b"data":
                data_size = min(size, len(data) - pos - 8)
                break
            pos += 8 + size + (size & 1)
        if byte_rate and data_size:
            return data_size / byte_rate
    except Exception:
        pass
    return None


def snap(t: float) -> float:
    return round(t / FRAME) * FRAME


def make_lab(rng: random.Random, duration: float, bpm: float, scenario: str):
    """產生 BTC test.py 格式的 .lab 文字：'start end chord' 每行一筆
    回傳 (lab 文字, 主音 index, "major"/"minor")，主音給假的 Essentia key 用"""
    mode = {"major": "major", "minor": "minor"}.get(scenario) or rng.choice(["major", "minor"])
    tonic = rng.randrange(12)
    if scenario == "silent":
        return "%.3f %.3f %s\n" % (0.0, snap(duration), "N"), tonic, mode

    degrees, ext, progs = (
        (MAJOR_DEGREES, MAJOR_EXT, MAJOR_PROGRESSIONS) if mode == "major"
        else (MINOR_DEGREES, MINOR_EXT, MINOR_PROGRESSIONS)
    )
    ext_prob = 0.6 if scenario == "complex" else 0.15
    bar = 4 * 60.0 / bpm

    lines = []
    t = 0.0
    lead_in = snap(rng.uniform(0.3, 1.2))
    lines.append((0.0, lead_in, "N"))
    t = lead_in
    prog = rng.choice(progs)
    i = 0
    while t < duration - 0.5:
        if i and i % (len(prog) * 2) == 0 and rng.random() < 0.5:
            prog = rng.choice(progs)  # 換段落
        deg = prog[i % len(prog)]
        interval, quality = degrees[deg]
        if rng.random() < ext_prob:
            quality = rng.choice(ext[deg])
        label = chord_label(tonic + interval, quality)
        length = bar * rng.choice([1, 1, 1, 2, 0.5])
        end = min(snap(t + length + rng.uniform(-0.12, 0.12)), snap(duration))
        if end - t < FRAME:
            break
        # BTC 只在和弦改變時切段，連續相同的和弦會合併
        if lines and lines[-1][2] == label:
            lines[-1] = (lines[-1][0], end, label)
        else:
            lines.append((t, end, label))
        t = end
        i += 1
    if snap(duration) - t >= FRAME:
        lines.append((t, snap(duration), "N"))
    return "".join("%.3f %.3f %s\n" % ln for ln in lines), tonic, mode


def make_tuning(rng: random.Random, mode: str) -> dict:
    """複製 BTC test.py analyze_tuning() 的計算方式（含其 a4_hz 公式）"""
    if mode == "random":
        mode = rng.choice(["standard", "sharp", "flat"])
    if mode == "standard":
        cents = rng.uniform(-4.9, 4.9)
    elif mode == "sharp":
        cents = rng.uniform(5, 45)
    else:
        cents = -rng.uniform(5, 45)
    tuning_offset = cents / 100  # librosa.estimate_tuning 回傳的單位（半音的比例）
    a4_hz = 440.0 * (2 ** (tuning_offset / 1200))  # 與 test.py 相同寫法
    if abs(cents) < 5:
        status, status_text = "standard", "標準 440 Hz"
    elif cents > 0:
        status, status_text = "sharp", f"偏高 {cents:.1f} cents"
    else:
        status, status_text = "flat", f"偏低 {abs(cents):.1f} cents"
    return {"a4_hz": round(a4_hz, 2), "tuning_offset_cents": round(cents, 1),
            "status": status, "status_text": status_text}


def make_beats(rng: random.Random, duration: float, bpm: float) -> list:
    """模擬 RhythmExtractor2013 的 beats：每一拍的時間（秒），帶一點抖動與緩慢的速度漂移"""
    beats, t = [], rng.uniform(0.1, 0.6)
    period = 60.0 / bpm
    drift = rng.uniform(-0.03, 0.03)  # 整首歌速度最多漂移約 ±3%
    while t < duration - 0.05:
        beats.append(round(t, 3))
        progress = t / max(duration, 1e-6)
        t += period * (1 + drift * progress) + rng.gauss(0, 0.008)
    return beats


def section_of(t: float, bpm: float) -> int:
    """每 8 小節換一段：0 = 主歌、1 = 副歌（給旋律高低與響度起伏用）"""
    return int(t / (8 * 4 * 60.0 / bpm)) % 2


def make_pitch_contour(rng: random.Random, duration: float, bpm: float,
                       tonic: int, mode: str, scenario: str) -> dict:
    """模擬 pitch.py 的 PitchContour：約每 50ms 一點的 MIDI 音高，null = 沒有旋律
    旋律走調內音、一句一句有休息，長音有抖音，副歌比主歌高"""
    hop = round(7 * 128 / 44100.0, 5)
    n = int(duration / hop)
    midi = [None] * n
    if scenario == "silent":
        return {"hop": hop, "midi": midi}

    scale = [0, 2, 4, 5, 7, 9, 11] if mode == "major" else [0, 2, 3, 5, 7, 8, 10]
    base = 60 + tonic if tonic <= 6 else 48 + tonic  # 主音落在 G3～F#4
    notes = sorted({base + octave * 12 + s for octave in (-1, 0, 1) for s in scale})
    notes = [m for m in notes if base - 5 <= m <= base + 16]
    beat = 60.0 / bpm
    idx = len(notes) // 3
    t = rng.uniform(0.5, 2.0)
    prev = None
    while t < duration - 0.3:
        lift = 2 if section_of(t, bpm) else 0  # 副歌往上兩個音階音
        for _ in range(rng.randint(4, 10)):
            length = beat * rng.choice([0.5, 0.5, 1, 1, 1.5, 2])
            idx = max(0, min(len(notes) - 3, idx + rng.choice([-2, -1, -1, 0, 1, 1, 2])))
            target = notes[min(len(notes) - 1, idx + lift)]
            start = int(t / hop)
            end = min(n, int((t + length * 0.92) / hop))
            for k in range(start, end):
                dt = (k - start) * hop
                value = target + rng.gauss(0, 0.06)
                if prev is not None and dt < 0.05:  # 從上一個音滑過來
                    value = prev + (target - prev) * (dt / 0.05)
                if dt > 0.25:  # 長音的抖音
                    value += 0.25 * math.sin(2 * math.pi * 5.5 * dt)
                midi[k] = round(value, 2)
            prev = target
            t += length
            if t >= duration - 0.3:
                break
        t += beat * rng.choice([1, 2, 2, 3])  # 句尾換氣
        prev = None
    return {"hop": hop, "midi": midi}


def make_loudness_curve(rng: random.Random, duration: float, bpm: float, lufs: float) -> dict:
    """模擬 pitch.py 的 LoudnessCurve：短時響度，每 0.5 秒一點；副歌較大聲、頭尾淡入淡出"""
    hop = 0.5
    values = []
    level = lufs
    for i in range(int(duration / hop) + 1):
        t = i * hop
        target = lufs + (2.5 if section_of(t, bpm) else -2.5)
        fade = min(1.0, t / 4.0, max(0.0, duration - t) / 4.0)
        level += (target - level) * 0.3 + rng.gauss(0, 0.4)
        values.append(round(max(-70.0, level - (1 - fade) * 18), 1))
    return {"hop": hop, "lufs": values}


def make_essentia(rng: random.Random, duration: float, bpm: float,
                  tonic: int, mode: str, scenario: str) -> dict:
    """pitch.py 寫出的 EssentiaOutput.json（含 KeyExtractor 結果）"""
    if scenario in ("silent", "low_key"):
        strength = rng.uniform(0.2, 0.4)
    else:
        strength = rng.uniform(0.55, 0.92)
    lufs = round(rng.uniform(-24, -8), 2)
    loudness = make_loudness_curve(rng, duration, bpm, lufs)
    audible = sorted(v for v in loudness["lufs"] if v > -60)
    loudness_range = (audible[int(len(audible) * 0.95) - 1] - audible[int(len(audible) * 0.1)]) if len(audible) > 10 else 0.0
    return {
        "LUFS": lufs,
        "LoudnessRange": round(loudness_range, 2),
        "BPM": round(bpm, 2),
        "Beats": make_beats(rng, duration, bpm),
        "Key": f"{KEY_NAMES[tonic]} {mode}",
        "KeyStrength": round(strength, 3),
        "KeyProfile": "bgate",
        "PitchContour": make_pitch_contour(rng, duration, bpm, tonic, mode, scenario),
        "LoudnessCurve": loudness,
    }


def _png(width: int, height: int, pixels: bytearray) -> bytes:
    raw = b"".join(b"\x00" + bytes(pixels[y * width * 3:(y + 1) * width * 3]) for y in range(height))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))


def make_pitch_png(rng: random.Random, path: Path) -> None:
    """有 src/assets/fig.png 就用它（看起來最像真的），否則畫一張簡單的音高曲線圖"""
    if FIG_PNG.exists():
        shutil.copyfile(FIG_PNG, path)
        return
    w, h = 1500, 500
    px = bytearray(b"\xff" * (w * h * 3))
    for gy in range(50, h, 50):  # 格線
        for x in range(w):
            px[(gy * w + x) * 3:(gy * w + x) * 3 + 3] = b"\xe6\xe6\xe6"
    phase = rng.uniform(0, 6.28)
    prev = None
    for x in range(w):
        y = int(h / 2 + 120 * math.sin(x / 90 + phase) + 40 * math.sin(x / 23))
        y = max(2, min(h - 3, y))
        ys = range(min(prev, y), max(prev, y) + 1) if prev is not None else [y]
        for yy in ys:
            for dy in (-1, 0, 1):
                i = ((yy + dy) * w + x) * 3
                px[i:i + 3] = b"\x1f\x77\xb4"
        prev = y
    path.write_bytes(_png(w, h, px))


def build_result(audio: bytes, filename: str, cfg: dict) -> dict:
    scenario = cfg["scenario"]
    rng = random.Random(cfg["seed"]) if cfg["seed"] is not None else random.Random()

    duration = wav_duration(audio) or 30.0
    if scenario == "long":
        duration = 240.0
    elif scenario == "short":
        duration = 5.0
    bpm = rng.uniform(70, 140)

    work = Path(tempfile.mkdtemp(prefix="chordlab_mock_"))
    try:
        stem = Path(filename).stem
        # --- BTC 端：test.py 寫出的檔案 ---
        lab_path = work / f"{stem}.lab"
        tuning_path = work / f"{stem}_tuning.json"
        lab_text, tonic, mode = make_lab(rng, duration, bpm, scenario)
        lab_path.write_text(lab_text)
        if scenario != "no_tuning":
            tuning_path.write_text(json.dumps(make_tuning(rng, cfg["tuning"]), ensure_ascii=False, indent=2))

        # --- Essentia 端：pitch.py 寫出的檔案 ---
        png_path = work / "fig.png"
        json_path = work / "EssentiaOutput.json"
        if scenario != "no_essentia":
            json_path.write_text(json.dumps(make_essentia(rng, duration, bpm, tonic, mode, scenario)))
        if scenario not in ("no_image", "no_essentia"):
            make_pitch_png(rng, png_path)

        # --- 用真後端的函式解析（同 run_btc / run_essentia 的回傳結構）---
        timeline = parse_lab_file(lab_path)
        btc = {"tuning": parse_tuning_file(tuning_path), "timeline": timeline}
        essentia = {
            "essentia": parse_essentia_file(json_path),
            "image_base64": encode_image_base64(png_path),
            "image_mime": "image/png",
        }
        return {"BTC": btc, "Essentia": essentia}
    finally:
        shutil.rmtree(work, ignore_errors=True)


# ---------------------------------------------------------------------------
# HTTP 伺服器
# ---------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    server_version = "ChordLabMock/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("[mock] %s - %s\n" % (self.address_string(), fmt % args))

    def _send(self, status: int, payload) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "*")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/health":
            return self._send(200, {"status": "ok"})
        if url.path == "/api/hello":
            return self._send(200, {"message": "Hello2 from Python!"})
        if url.path == "/api/test2":
            return self._send(200, {"message": "test!"})
        if url.path == "/api/mock/config":
            return self._config(parse_qs(url.query))
        return self._send(404, {"detail": "Not Found"})

    def _config(self, q: dict):
        with CONFIG_LOCK:
            try:
                if "scenario" in q:
                    s = q["scenario"][0]
                    if s not in SCENARIOS:
                        return self._send(400, {"detail": f"未知情境 {s}", "scenarios": SCENARIOS})
                    CONFIG["scenario"] = s
                if "tuning" in q:
                    m = q["tuning"][0]
                    if m not in TUNING_MODES:
                        return self._send(400, {"detail": f"tuning 只能是 {TUNING_MODES}"})
                    CONFIG["tuning"] = m
                if "delay" in q:
                    CONFIG["delay"] = max(0.0, float(q["delay"][0]))
                if "seed" in q:
                    v = q["seed"][0]
                    CONFIG["seed"] = None if v in ("", "none", "null") else int(v)
            except ValueError as e:
                return self._send(400, {"detail": str(e)})
            cfg = dict(CONFIG)
        return self._send(200, {"config": cfg, "scenarios": SCENARIOS, "tuning_modes": TUNING_MODES})

    def do_POST(self):
        url = urlparse(self.path)
        if url.path != "/api/analyze":
            return self._send(404, {"detail": "Not Found"})

        with CONFIG_LOCK:
            cfg = dict(CONFIG)
        # 單次請求也可用 query 覆蓋，例如 /api/analyze?scenario=minor
        q = parse_qs(url.query)
        if q.get("scenario", [None])[0] in SCENARIOS:
            cfg["scenario"] = q["scenario"][0]
        if q.get("tuning", [None])[0] in TUNING_MODES:
            cfg["tuning"] = q["tuning"][0]

        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else b""

        time.sleep(cfg["delay"])  # 模擬分析耗時，讓前端進度條跑得出來
        scenario = cfg["scenario"]

        if scenario == "network_fail":
            self.close_connection = True
            try:
                self.connection.shutdown(2)
            except OSError:
                pass
            return

        upload = self._parse_upload(body)
        if upload is None:
            # FastAPI 缺少必填欄位時的 422 格式
            return self._send(422, {"detail": [{"type": "missing", "loc": ["body", "audio"],
                                                "msg": "Field required", "input": None}]})
        filename, content = upload

        # 與 main.py 相同的檢查與錯誤訊息
        if not filename.lower().endswith(".wav"):
            return self._send(400, {"detail": "只接受 .wav 檔案"})
        if len(content) > MAX_UPLOAD or scenario == "error413":
            return self._send(413, {"detail": "檔案過大（上限 50 MB）"})
        if scenario == "error500":
            return self._send(500, {"detail": "BTC failed:\nTraceback (most recent call last):\n  (mock) RuntimeError: CUDA out of memory"})
        if scenario == "timeout504":
            return self._send(504, {"detail": "BTC 分析逾時"})

        try:
            result = build_result(content, filename, cfg)
        except Exception as e:  # 理論上不會發生，保險起見
            return self._send(500, {"detail": f"mock error: {e}"})
        return self._send(200, result)

    def _parse_upload(self, body: bytes):
        ctype = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in ctype:
            return None
        msg = email.parser.BytesParser(policy=email.policy.HTTP).parsebytes(
            b"Content-Type: " + ctype.encode("latin-1") + b"\r\n\r\n" + body)
        if not msg.is_multipart():
            return None
        for part in msg.iter_parts():
            if part.get_param("name", header="content-disposition") == "audio":
                return part.get_filename() or "", part.get_payload(decode=True) or b""
        return None


class V6Server(ThreadingHTTPServer):
    address_family = socket.AF_INET6
    daemon_threads = True


def make_servers(host: str, port: int) -> list:
    """localhost 時同時開 127.0.0.1 與 ::1，避免 Vite 把 localhost 解析成 ::1 時連不到"""
    if host != "localhost":
        cls = V6Server if ":" in host else ThreadingHTTPServer
        srv = cls((host, port), Handler)
        srv.daemon_threads = True
        return [srv]
    servers = []
    v4 = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    v4.daemon_threads = True
    servers.append(v4)
    try:
        servers.append(V6Server(("::1", port), Handler))
    except OSError:
        pass  # 系統沒有 IPv6 就只用 IPv4
    return servers


def main():
    p = argparse.ArgumentParser(description="ChordLab mock backend（BTC + Essentia 假資料）")
    p.add_argument("--host", default="localhost",
                   help="預設 localhost＝同時聽 127.0.0.1 與 ::1；要讓區網其他裝置連線可用 0.0.0.0")
    p.add_argument("--port", type=int, default=8080, help="預設 8080，對應目前 vite.config.js 的 proxy")
    p.add_argument("--scenario", default="normal", choices=list(SCENARIOS))
    p.add_argument("--tuning", default="random", choices=TUNING_MODES)
    p.add_argument("--delay", type=float, default=1.5, help="每次分析假裝花幾秒（預設 1.5）")
    p.add_argument("--seed", type=int, default=None, help="固定亂數種子，每次結果都一樣")
    args = p.parse_args()
    CONFIG.update(scenario=args.scenario, tuning=args.tuning, delay=args.delay, seed=args.seed)

    servers = make_servers(args.host, args.port)
    print(f"ChordLab mock backend 啟動於 http://{args.host}:{args.port}")
    print(f"  解析函式：{'backend/ 內的真實函式' if USING_REAL_PARSERS else '本檔內建（找不到 backend/）'}")
    print(f"  音高圖：{'src/assets/fig.png' if FIG_PNG.exists() else '程式產生'}")
    print(f"  情境={args.scenario} tuning={args.tuning} delay={args.delay}s seed={args.seed}")
    print(f"  切換情境：curl 'http://localhost:{args.port}/api/mock/config?scenario=minor'")
    for extra in servers[1:]:
        threading.Thread(target=extra.serve_forever, daemon=True).start()
    try:
        servers[0].serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")


if __name__ == "__main__":
    main()
