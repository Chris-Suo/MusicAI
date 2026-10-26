import sys
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

with open(output_json, "w") as f:
    f.write(f'{{"LUFS": {integrated:.2f},')
    f.write(f'"BPM": {bpm:.2f},')
    f.write(f'"Beats": {len(beats)}}}')


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
