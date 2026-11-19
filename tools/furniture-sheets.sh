#!/bin/sh
# Usage: tools/furniture-sheets.sh <outdir> <prefix>  -> labelled 3x contact sheets of all furniture down sprites, 16 per sheet
D=$1; P=$2; ids=$(ls client/src/assets/sprites/furniture | grep -v -E "_(up|right|ready|cold|fire|dry|wet|lever|nolever)\.png" | sed 's/\.png//')
n=0; chunk=""; k=1
for id in $ids; do chunk="$chunk,$id"; n=$((n+1)); if [ $n -eq 16 ]; then node tools/furniture-sheet.mjs $D/${P}_$k.png 3 4 ${chunk#,}; chunk=""; n=0; k=$((k+1)); fi; done
[ -n "$chunk" ] && node tools/furniture-sheet.mjs $D/${P}_$k.png 3 4 ${chunk#,}
