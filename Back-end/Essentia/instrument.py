#Import essentia.standard as es
#
#Audio = es.MonoLoader(filename='scale_piano_1.mp3', sampleRate=16000)()
#
#Model = es.TensorflowPredictMusiCNN(
#    graphFilename='mtg_jamendo_instrument-discogs-effnet-1.pb'
#)
#
#Predictions = model(audio)
#
#Print(predictions)

import json

from essentia.standard import MonoLoader, TensorflowPredictEffnetDiscogs, TensorflowPredict2D

audio = MonoLoader(filename="scale_piano_1.mp3", sampleRate=16000, resampleQuality=4)()
embedding_model = TensorflowPredictEffnetDiscogs(graphFilename="discogs-effnet-bs64-1.pb", output="PartitionedCall:1")
embeddings = embedding_model(audio)

model = TensorflowPredict2D(graphFilename="mtg_jamendo_instrument-discogs-effnet-1.pb")
predictions = model(embeddings)

with open("mtg_jamendo_instrument-discogs-effnet-1.json") as f:
    meta = json.load(f)
classes = meta["classes"]

for name, score in zip(classes, predictions):
    print(name, score)

#print(predictions)
