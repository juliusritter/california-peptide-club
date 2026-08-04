#!/bin/bash
# Render the standard set of peptide animations at social-post quality (PyMOL).
set -euo pipefail
cd "$(dirname "$0")"

run() {
  echo "### $1 ($2)"
  pymol -cq render_peptide.py -- "$1" --mode "$2" --frames "$3" --size "$4"
}

# Receptor complexes are ~10x heavier to ray-trace, so fewer/smaller frames.
run retatrutide complex 90 800
run tirzepatide complex 90 800
run semaglutide complex 90 800

run igf1 solo 120 900
run bpc157 solo 120 900
run ghk-cu solo 120 900

echo "done -> $(pwd)/out"
