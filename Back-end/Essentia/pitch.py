import sys
import json
import essentia.standard as es
import matplotlib.pyplot as plt
import numpy as np

# ---------------------------------------------------------------------------
# 接收命令列參數作為音樂檔路徑（第一個參數）
# 用法: python pitch.py <音樂檔路徑> [輸出圖檔路徑] [輸出JSON路徑]
# ---------------------------------------------------------------------------
if len(sys.argv) < 2:
    print("Usage: python pitch.py <music_file> [output_png] [output_json]")
    sys.exit(1)

music = sys.argv[1]
output_png = sys.argv[2] if len(sys.argv) > 2 else "fig.png"
output_json = sys.argv[3] if len(sys.argv) > 3 else "EssentiaOutput"

audio = es.EqloudLoader(filename=music, sampleRate=44100)()

pitch_extractor = es.PredominantPitchMelodia(frameSize=2048, hopSize=128)
pitch_values, pitch_confidence = pitch_extractor(audio)

time_stamps = np.arange(len(pitch_values)) * (128 / 44100.0)


def hz_to_note(freq):
    if freq <= 0:
        return None
    A4 = 440.0
    note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    semitones = 12 * np.log2(freq / A4)
    note_index = int(round(semitones + 9)) % 12
    octave = 4 + (semitones + 9) // 12
    return f"{note_names[note_index]} {octave}"


audio_stereo = es.AudioLoader(filename=music)()[0]
loudness_extractor = es.LoudnessEBUR128()
momentary, shotterm, integrated, range_lu = loudness_extractor(audio_stereo)

audio = es.MonoLoader(filename=music, sampleRate=44100)()
rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
bpm, beats, beats_confidence, _, beats_intervals = rhythm_extractor(audio)

# ---------------------------------------------------------------------------
# 調性分析（取代原本 BTC 端 btc_runner.infer_key 的結果）
# KeyExtractor 輸出 key（A~G）、scale（major / minor）、strength（調性強度）
# KEY_PROFILE 可改成 "temperley"、"krumhansl"、"edma" 等，預設 "bgate"
# ---------------------------------------------------------------------------
KEY_PROFILE = "bgate"
key_extractor = es.KeyExtractor(profileType=KEY_PROFILE, sampleRate=44100)
key, scale, key_strength = key_extractor(audio)

# ---------------------------------------------------------------------------
# 給前端自己畫圖的資料（前端用 SVG 畫，可切換深淺色、跟播放同步、算占比）
#   PitchContour：主旋律音高，約每 50ms 一點，MIDI 音高（A4 = 69，可帶小數），null = 沒有旋律
#   LoudnessCurve：短時響度（3 秒視窗），每 0.5 秒一點，單位 LUFS
# ---------------------------------------------------------------------------
PITCH_HOP_SEC = 0.05
pitch_frame_sec = 128 / 44100.0
pitch_step = max(1, int(round(PITCH_HOP_SEC / pitch_frame_sec)))
pitch_arr = np.asarray(pitch_values, dtype=float)
pitch_contour = []
for i in range(0, len(pitch_arr), pitch_step):
    window = pitch_arr[i:i + pitch_step]
    voiced = window[window > 0]
    # 視窗內一半以上的幀有旋律才算有音
    if len(voiced) * 2 < len(window):
        pitch_contour.append(None)
    else:
        pitch_contour.append(round(float(69 + 12 * np.log2(np.median(voiced) / 440.0)), 2))

LOUDNESS_HOP_SEC = 0.5
loudness_step = max(1, int(round(LOUDNESS_HOP_SEC / 0.1)))  # LoudnessEBUR128 預設 hopSize = 0.1 秒
loudness_curve = [
    round(float(max(v, -70.0)), 1) if np.isfinite(v) else -70.0
    for v in np.asarray(shotterm, dtype=float)[::loudness_step]
]

with open(output_json, "w") as f:
    json.dump({
        "LUFS": round(float(integrated), 2),
        "LoudnessRange": round(float(range_lu), 2),
        "BPM": round(float(bpm), 2),
        # 每一拍的時間點（秒），前端用來畫節拍時間軸
        "Beats": [round(float(t), 3) for t in beats],
        "Key": f"{key} {scale}",            # 例如 "C major"、"F# minor"
        "KeyStrength": round(float(key_strength), 3),
        "KeyProfile": KEY_PROFILE,
        "PitchContour": {"hop": round(pitch_step * pitch_frame_sec, 5), "midi": pitch_contour},
        "LoudnessCurve": {"hop": loudness_step * 0.1, "lufs": loudness_curve},
    }, f, ensure_ascii=False)


def hz_to_semitone(freq, A4=440.0):
    with np.errstate(divide='ignore', invalid='ignore'):
        semitones = 12 * np.log2(freq / A4)
    return semitones


note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']


def semitone_to_note_name(semitone_int):
    note_index = (semitone_int + 9) % 12
    octave = 4 + (semitone_int + 9) // 12
    return f"{note_names[note_index]}{octave}"


pitches_arr = np.array(pitch_values)

masked_pitch = np.where((pitches_arr > 0), pitches_arr, np.nan)
semitone_values = hz_to_semitone(masked_pitch)

# ---------------------------------------------------------------------------
# 繪圖樣式美化：加大字體、使用較現代的配色與網格風格
# ---------------------------------------------------------------------------
plt.rcParams.update({
    "font.size": 16,
    "axes.titlesize": 22,
    "axes.labelsize": 18,
    "xtick.labelsize": 13,
    "ytick.labelsize": 13,
    "font.family": "sans-serif",
})

plt.style.use("seaborn-v0_8-whitegrid")

fig, ax = plt.subplots(figsize=(16, 6), dpi=120)
fig.patch.set_facecolor("#ffffff")
ax.set_facecolor("#f7f7fa")

ax.plot(
    time_stamps,
    semitone_values,
    linewidth=2.2,
    color="#4C72B0",
    solid_capstyle="round",
)

valid = semitone_values[~np.isnan(semitone_values)]
if len(valid) > 0:
    min_st = int(np.floor(valid.min()))
    max_st = int(np.ceil(valid.max()))

    tick_positions = np.arange(min_st, max_st + 1)
    tick_labels = [semitone_to_note_name(s) for s in tick_positions]

    ax.set_yticks(tick_positions)
    ax.set_yticklabels(tick_labels)

ax.set_xlabel("Time (s)", fontweight="bold", labelpad=12)
ax.set_ylabel("Note", fontweight="bold", labelpad=12)
ax.set_title("Pitch", fontweight="bold", pad=18)
ax.grid(axis="y", alpha=0.4, linestyle="--")
ax.grid(axis="x", alpha=0.15, linestyle="--")

for spine in ["top", "right"]:
    ax.spines[spine].set_visible(False)
for spine in ["left", "bottom"]:
    ax.spines[spine].set_color("#888888")

plt.tight_layout()
plt.savefig(output_png, facecolor=fig.get_facecolor())
