#!/usr/bin/env bash
# Mezcla los stems de compose.py en una pista en bucle (OGG). Uso: render.sh <carpeta_stems> <salida.ogg>
set -euo pipefail
S="$1"; O="$2"
ffmpeg -y -loglevel error \
  -i "$S/drone.wav" -i "$S/pad.wav" -i "$S/bass.wav" -i "$S/arp.wav" -i "$S/perc.wav" -filter_complex "\
[0]lowpass=f=420,volume=0.95[d];\
[1]lowpass=f=1800,highpass=f=180,aecho=0.8:0.85:120|260|430:0.45|0.32|0.22,volume=0.55[p];\
[2]lowpass=f=900,highpass=f=40,volume=0.5[b];\
[3]lowpass=f=3200,highpass=f=300,aecho=0.8:0.8:375|750:0.45|0.25,volume=0.32[a];\
[4]highpass=f=60,lowpass=f=8000,aecho=0.8:0.7:90|210:0.3|0.15,volume=0.42[c];\
[d][p][b][a][c]amix=inputs=5:normalize=0,acompressor=threshold=0.25:ratio=3:attack=20:release=300,\
alimiter=limit=0.85,afade=t=in:d=2,afade=t=out:st=155:d=5" -c:a libvorbis -q:a 5 "$O"
