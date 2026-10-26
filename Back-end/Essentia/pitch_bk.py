import essentia.standard as es
import matplotlib.pyplot as plt

#music = 'scale_piano_2.mp3'
music = 'chord-test1-C-FC-GB-C.wav'

audio = es.EqloudLoader(filename=music, sampleRate=44100)()


#pitch_extractor = es.PitchMelodia(frameSize=2048, hopSize=128)
pitch_extractor = es.PredominantPitchMelodia(frameSize=2048, hopSize=128)

pitch_values, pitch_confidence = pitch_extractor(audio)

import numpy as np
time_stamps = np.arange(len(pitch_values))*(128/44100.0)


def hz_to_note(freq):
    if freq <= 0:
        return None
    #print(f"{freq}")
    A4 = 440.0
    note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    semitones = 12 * np.log2(freq / A4)
    #print(f"semi {semitones}")
    note_index = int(round(semitones+9)) % 12
   # print(f"index{note_index}")
    octave = 4 + (semitones+9)// 12
    return f"{note_names[note_index]} {octave}"


#for i in range(16, 262):
#    print(hz_to_note(i))


#for t, f in zip(time_stamps, pitch_values):
    #print(f"{t:.3f}s:{f:.2f} Hz")
    #print(hz_to_note(f))


audio_stereo = es.AudioLoader(filename=music)()[0]
loudness_extractor = es.LoudnessEBUR128()
momentary, shotterm, integrated, range_lu = loudness_extractor(audio_stereo)

#print(f"Integrated Loudness: {integrated:.2f} LUFS")
#print(f"Loudness Range: {range_lu:.2f} LU")

audio = es.MonoLoader(filename=music, sampleRate=44100)()
rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
bpm, beats, beats_confidence, _, beats_intervals = rhythm_extractor(audio)

with open("EssentiaOutput", "w") as f:
    f.write(f'{{"LUFS": {integrated:.2f},')
    f.write(f'"BPM": {bpm:.2f},')
  #  f.write(f"Confidence: {beats_confidence:.2f}")
    f.write(f'"Beats": {len(beats)}}}')
 #   f.write(f"beats: {beats}")

#print(f"BPM: {bpm:.2f}")
#print(f"Confidence: {beats_confidence:.2f}")
#print(f"Beats: {len(beats)}")
#print(f"beats: {beats}")

#pitch_value_pl = np.array(pitch_values)
#masked = np.where(pitch_value_pl > 0, pitch_value_pl, np.nan)
#semitone_values = hz_to_semitone(masked_pitch)
#
#plt.figure(figsize=(15, 5))
##plt.plot(time_stamps)
#plt.plot(time_stamps, masked)
#plt.xlabel('Time (s)')
#ax.ylabel('Note')
##ax.set_ylabel('Note')
#plt.title('Pitch Contour')
#plt.show()

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
#confidences_arr = np.array(confidences)

masked_pitch = np.where((pitches_arr > 0), pitches_arr, np.nan)
#masked_pitch = np.where((pitches_arr > 0) & (confidences_arr > 0.5), pitches_arr, np.nan)
semitone_values = hz_to_semitone(masked_pitch)

fig, ax = plt.subplots(figsize=(15, 5))
ax.plot(time_stamps, semitone_values, linewidth=1)

valid = semitone_values[~np.isnan(semitone_values)]
if len(valid) > 0:
    min_st = int(np.floor(valid.min()))
    max_st = int(np.ceil(valid.max()))

    tick_positions = np.arange(min_st, max_st + 1)
    tick_labels = [semitone_to_note_name(s) for s in tick_positions]

    ax.set_yticks(tick_positions)
    ax.set_yticklabels(tick_labels)

ax.set_xlabel('Time (s)')
ax.set_ylabel('Note')
ax.set_title('Pitch Contour (Note Names)')
ax.grid(axis='y', alpha=0.3)
plt.savefig('fig.png')
plt.show()
