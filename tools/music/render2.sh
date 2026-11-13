#!/usr/bin/env bash
# Mezcla de la v2: mucho espacio (ecos largos estéreo), sin compresión fuerte, nivel medio bajo y dinámico.
set -euo pipefail
S="$1"; O="$2"
ffmpeg -y -loglevel error -i "$S/sub.wav" -i "$S/pad.wav" -i "$S/glide.wav" -i "$S/steps.wav" -i "$S/mech.wav" -i "$S/sweep.wav" -i "$S/heart.wav" -i "$S/osc2.wav" -filter_complex "\
[0]lowpass=f=320,highpass=f=24,volume=0.8[a];\
[1]lowpass=f=1400,highpass=f=90,aecho=0.8:0.88:180|340|610:0.5|0.38|0.26,volume=0.5[b];\
[2]volume=0[c];\
[3]lowpass=f=5200,highpass=f=350,aecho=0.8:0.85:240|470:0.4|0.28,volume=0.22[d];\
[4]lowpass=f=6000,highpass=f=120,aecho=0.8:0.8:150|330:0.35|0.2,volume=0.38[e];\
[5]lowpass=f=7000,highpass=f=200,volume=0.3[f];\
[6]lowpass=f=600,aecho=0.8:0.6:140:0.25,volume=0.9[g];\
[7]lowpass=f=1700,highpass=f=200,aecho=0.8:0.88:230|470|820:0.45|0.32|0.22,volume=0.34[h];\
[a][b][c][d][e][f][g][h]amix=inputs=8:normalize=0,alimiter=limit=0.7,loudnorm=I=-20:TP=-2:LRA=11,afade=t=in:d=3,afade=t=out:st=234:d=6" -ar 44100 -c:a libvorbis -q:a 5 "$O"
