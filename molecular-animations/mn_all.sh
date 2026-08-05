#!/bin/bash
# Render the Blender + Molecular Nodes versions (Cycles, Metal GPU).
set -euo pipefail
cd "$(dirname "$0")"
export ANIM_DIR="$PWD"
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender

run() {  # code name style
  echo "### $2 ($3)"
  "$BLENDER" -b --python mn_render.py -- "$1" --name "$2" --style "$3" \
    --frames "${4:-90}" --res "${5:-800}" --samples "${6:-48}"
}

highlight() {  # code name — ghosted receptor, lit-up peptide
  echo "### $2 (highlight)"
  "$BLENDER" -b --python mn_render.py -- "$1" --name "$2" --highlight \
    --frames "${3:-90}" --res "${4:-800}" --samples "${5:-48}"
}

run 1IMX igf1 cartoon
run 8YW3 retatrutide cartoon
run 7FIM tirzepatide cartoon

highlight 8YW3 retatrutide-highlight
highlight 7FIM tirzepatide-highlight
highlight 8YW4 retatrutide-gipr-highlight

echo "done -> $PWD/out"
