import os
import mir_eval
import numpy as np
import json
import librosa
import pretty_midi as pm
from utils import logger
from btc_model import *
from utils.mir_eval_modules import audio_file_to_features, idx2chord, idx2voca_chord, get_audio_paths
import argparse
import warnings

warnings.filterwarnings('ignore')
logger.logging_verbosity(1)
use_cuda = torch.cuda.is_available()
device = torch.device("cuda" if use_cuda else "cpu")

def print_cqt_info(feature_raw, audio_path, feature_per_second, song_length_second):
    """
    feature_raw : audio_file_to_features 回傳的原始 feature，
                  shape = [n_bins, n_frames]（轉置前）
    """
    HOP_LENGTH   = 2048
    SR           = 22050
    N_BINS       = 144          # 6 octaves × 24 bins/octave
    BINS_PER_OCT = 24
    FMIN         = librosa.note_to_hz('C1')   # 32.7 Hz

    freqs      = librosa.cqt_frequencies(N_BINS, fmin=FMIN,
                                          bins_per_octave=BINS_PER_OCT)
    note_names = [librosa.hz_to_note(f) for f in freqs]

    # feature_raw 的 shape 是 [n_bins, n_frames]
    C = np.array(feature_raw)
    n_frames = C.shape[1]

    print("\n" + "=" * 64)
    print(f"  CQT 頻率分析：{os.path.basename(audio_path)}")
    print("=" * 64)
    print(f"  音訊長度     : {song_length_second:.2f} 秒")
    print(f"  時間幀數     : {n_frames} frames")
    print(f"  每幀時長     : {1.0 / feature_per_second * 1000:.1f} ms")
    print(f"  頻率範圍     : {freqs[0]:.1f} Hz (C1) ~ {freqs[-1]:.1f} Hz (B6)")
    print(f"  頻率 bins    : {N_BINS}（{BINS_PER_OCT} bins/octave）")
    print()

    # ── 各時間幀能量最強的音符 ──
    print("  ── 各時間幀主要頻率 ──")
    print(f"  {'時間(s)':<10} {'音符':<6} {'頻率(Hz)':<12} {'能量':<10}")
    print("  " + "-" * 42)
    for i in range(n_frames):
        t   = i / feature_per_second
        idx = np.argmax(C[:, i])
        print(f"  {t:<10.3f} {note_names[idx]:<6} {freqs[idx]:<12.2f} {C[idx, i]:.4f}")

    print()

    # ── 整體音高能量排行（前 12）──
    avg_energy = C.mean(axis=1)
    top12      = np.argsort(avg_energy)[::-1][:12]
    print("  ── 整體音高平均能量排行（前 12）──")
    print(f"  {'排名':<5} {'音符':<6} {'頻率(Hz)':<12} {'平均能量'}")
    print("  " + "-" * 36)
    for rank, idx in enumerate(top12, 1):
        print(f"  {rank:<5} {note_names[idx]:<6} {freqs[idx]:<12.2f} {avg_energy[idx]:.4f}")

    print("=" * 64 + "\n")


def analyze_tuning(audio_path, config):
    """計算調音基準，回傳 dict"""
# SR = config.feature['sr']
    SR           = 22050
    y, _ = librosa.load(audio_path, sr=SR, mono=True)

    tuning_offset = librosa.estimate_tuning(y=y, sr=SR)   # cents（-0.5 ~ 0.5）
    a4_hz = 440.0 * (2 ** (tuning_offset / 1200))
    cents = tuning_offset * 100  # 轉成 cents 整數單位

    if abs(cents) < 5:
        status = "standard"
        status_text = "標準 440 Hz"
    elif cents > 0:
        status = "sharp"
        status_text = f"偏高 {cents:.1f} cents"
    else:
        status = "flat"
        status_text = f"偏低 {abs(cents):.1f} cents"

    return {
        "a4_hz": round(a4_hz, 2),
        "tuning_offset_cents": round(cents, 1),
        "status": status,          # "standard" | "sharp" | "flat"
        "status_text": status_text,
    }

# hyperparameters
parser = argparse.ArgumentParser()
parser.add_argument('--voca', default=True, type=lambda x: (str(x).lower() == 'true'))
parser.add_argument('--audio_dir', type=str, default='./test')
parser.add_argument('--save_dir', type=str, default='./test')
args = parser.parse_args()

config = HParams.load("run_config.yaml")

if args.voca is True:
    config.feature['large_voca'] = True
    config.model['num_chords'] = 170
    model_file = './test/btc_model_large_voca.pt'
    idx_to_chord = idx2voca_chord()
    logger.info("label type: large voca")
else:
    model_file = './test/btc_model.pt'
    idx_to_chord = idx2chord
    logger.info("label type: Major and minor")

model = BTC_model(config=config.model).to(device)

# Load model
if os.path.isfile(model_file):
    checkpoint = torch.load(model_file, map_location=torch.device("cpu"))
    mean = checkpoint['mean']
    std = checkpoint['std']
    model.load_state_dict(checkpoint['model'])
    logger.info("restore model")

# Audio files with format of wav and mp3
audio_paths = get_audio_paths(args.audio_dir)

# Chord recognition and save lab file
for i, audio_path in enumerate(audio_paths):
    logger.info("======== %d of %d in progress ========" % (i + 1, len(audio_paths)))
    # Load mp3
    feature, feature_per_second, song_length_second = audio_file_to_features(audio_path, config)
    logger.info("audio file loaded and feature computation success : %s" % audio_path)

    print_cqt_info(feature, audio_path, feature_per_second, song_length_second)

    # Majmin type chord recognition
    feature = feature.T
    feature = (feature - mean) / std
    time_unit = feature_per_second
    n_timestep = config.model['timestep']

    num_pad = n_timestep - (feature.shape[0] % n_timestep)
    feature = np.pad(feature, ((0, num_pad), (0, 0)), mode="constant", constant_values=0)
    num_instance = feature.shape[0] // n_timestep

    start_time = 0.0
    lines = []
    with torch.no_grad():
        model.eval()
        feature = torch.tensor(feature, dtype=torch.float32).unsqueeze(0).to(device)
        for t in range(num_instance):
            self_attn_output, _ = model.self_attn_layers(feature[:, n_timestep * t:n_timestep * (t + 1), :])
            prediction, _ = model.output_layer(self_attn_output)
            prediction = prediction.squeeze()
            for i in range(n_timestep):
                if t == 0 and i == 0:
                    prev_chord = prediction[i].item()
                    continue
                if prediction[i].item() != prev_chord:
                    lines.append(
                        '%.3f %.3f %s\n' % (start_time, time_unit * (n_timestep * t + i), idx_to_chord[prev_chord]))
                    start_time = time_unit * (n_timestep * t + i)
                    prev_chord = prediction[i].item()
                if t == num_instance - 1 and i + num_pad == n_timestep:
                    if start_time != time_unit * (n_timestep * t + i):
                        lines.append('%.3f %.3f %s\n' % (start_time, time_unit * (n_timestep * t + i), idx_to_chord[prev_chord]))
                    break

    # lab file write
    if not os.path.exists(args.save_dir):
        os.makedirs(args.save_dir)
    save_path = os.path.join(args.save_dir, os.path.split(audio_path)[-1].replace('.mp3', '').replace('.wav', '') + '.lab')
    with open(save_path, 'w') as f:
        for line in lines:
            f.write(line)

    logger.info("label file saved : %s" % save_path)

    tuning_info = analyze_tuning(audio_path, config)
    tuning_path = save_path.replace('.lab', '_tuning.json')
    with open(tuning_path, 'w') as f:
        json.dump(tuning_info, f, ensure_ascii=False, indent=2)
    logger.info("tuning info saved : %s" % tuning_path)

    # lab file to midi file
    

    starts, ends, pitchs = list(), list(), list()

    intervals, chords = mir_eval.io.load_labeled_intervals(save_path)
    for p in range(12):
        for i, (interval, chord) in enumerate(zip(intervals, chords)):
            root_num, relative_bitmap, _ = mir_eval.chord.encode(chord)
            tmp_label = mir_eval.chord.rotate_bitmap_to_root(relative_bitmap, root_num)[p]
            if i == 0:
                start_time = interval[0]
                label = tmp_label
                continue
            if tmp_label != label:
                if label == 1.0:
                    starts.append(start_time), ends.append(interval[0]), pitchs.append(p + 48)
                start_time = interval[0]
                label = tmp_label
            if i == (len(intervals) - 1): 
                if label == 1.0:
                    starts.append(start_time), ends.append(interval[1]), pitchs.append(p + 48)

    midi = pm.PrettyMIDI()
    instrument = pm.Instrument(program=0)

    for start, end, pitch in zip(starts, ends, pitchs):
        pm_note = pm.Note(velocity=120, pitch=pitch, start=start, end=end)
        instrument.notes.append(pm_note)

    midi.instruments.append(instrument)
    midi.write(save_path.replace('.lab', '.midi'))    

