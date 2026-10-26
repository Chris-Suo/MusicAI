import essentia
import essentia.standard as es

def analyze_chords(audio_path):
    print(f"Loading audio file: {audio_path}...")
    
    # 1. Load the audio file in mono, downsampled to 44.1kHz
    loader = es.MonoLoader(filename=audio_path, sampleRate=44100)
    audio = loader()

    # 2. Define the algorithms for frame-by-frame analysis
    frame_size = 4096
    hop_size = 2048
    
    windowing = es.Windowing(type='blackmanharris62')
    spectrum = es.Spectrum()
    spectral_peaks = es.SpectralPeaks(
        orderBy='magnitude',
        magnitudeThreshold=0.00001,
        minFrequency=20,
        maxFrequency=3500,
        maxPeaks=60
    )
    # HPCP computes the chromagram (12 pitch classes)
    hpcp = es.HPCP()

    # We will store the HPCP values for each frame in an Essentia Pool
    pool = essentia.Pool()

    print("Extracting Harmonic Pitch Class Profiles (HPCP)...")
    
    # 3. Iterate over the audio in chunks (frames)
    for frame in es.FrameGenerator(audio, frameSize=frame_size, hopSize=hop_size, startFromZero=True):
        # Apply windowing, get the spectrum, and find the spectral peaks
        frame_windowed = windowing(frame)
        frame_spectrum = spectrum(frame_windowed)
        frequencies, magnitudes = spectral_peaks(frame_spectrum)
        
        # Calculate HPCP for the frame and add it to our pool
        frame_hpcp = hpcp(frequencies, magnitudes)
        pool.add('hpcp', frame_hpcp)

    print("Detecting chords from HPCPs...")
    
    # 4. Initialize the Chords Detection algorithm
    # It takes a sequence (matrix) of HPCPs as input
    chords_detection = es.ChordsDetection()
    
    # Extract chords and their corresponding strengths
    chords, chords_strength = chords_detection(pool['hpcp'])

    # 5. Output the results
    # To avoid printing a chord for every fraction of a second, 
    # we can condense the output to show when the chord *changes*.
    
    print("\n--- Chord Progression ---")
    current_chord = None
    
    for i, chord in enumerate(chords):
        if chord != current_chord and chord != "N": # "N" means no chord detected
            # Calculate the time in seconds based on frame index and hop size
            time_seconds = (i * hop_size) / 44100.0
            strength = chords_strength[i]
            
            print(f"Time: {time_seconds:05.2f}s | Chord: {chord:5s} | Confidence: {strength:.2f}")
            current_chord = chord

if __name__ == "__main__":
    # Replace with the path to your actual audio file (wav, mp3, flac, etc.)
    audio_file_path = "Level3.6 String Orchestra.mp3" 
    
    try:
        analyze_chords(audio_file_path)
    except RuntimeError as e:
        print(f"Error processing audio: {e}")
        print("Please ensure the file path is correct and points to a valid audio file.")

