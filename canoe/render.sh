#!/usr/bin/env bash
# Rebuild index.html, render frames, and export out/output.mp4 + out/output.gif
set -euo pipefail
cd "$(dirname "$0")"
python3 build.py
NODE_PATH=$(npm root -g) node export.js
ffmpeg -v error -y -framerate 10 -i out/frames/f%03d.png -vf "fps=30,format=yuv420p" \
  -c:v libx264 -preset slow -crf 18 -movflags +faststart out/output.mp4
# GIF: shared palette weighted toward the canoe so the browns survive
ffmpeg -v error -y -i out/frames/f020.png -i out/frames/f060.png -i out/frames/f040.png \
  -filter_complex "[0]scale=800:-1[a];[1]scale=800:-1[b];[2]crop=420:200:800:600,scale=800:-1[c];[a][b][c]vstack=3,palettegen=max_colors=160" out/palette.png
ffmpeg -v error -y -framerate 10 -i out/frames/f%03d.png -i out/palette.png \
  -filter_complex "[0]scale=800:-1:flags=lanczos,hqdn3d=3:3:0:0[v];[v][1]paletteuse=dither=none" -loop 0 out/output.gif
rm -f out/frames/*.png out/palette.png
ls -la out
