#!/usr/bin/env python3
"""Build out/gallery.html: every rendered mp4 with its structure provenance."""

import html
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")

CAPTIONS = {
    "retatrutide_complex": ("Retatrutide in GLP-1R", "PDB 8YW3, cryo-EM"),
    "tirzepatide_complex": ("Tirzepatide in GLP-1R", "PDB 7FIM, cryo-EM"),
    "semaglutide_complex": ("Semaglutide + GLP-1R ECD", "PDB 4ZGM, X-ray"),
    "igf1_solo": ("IGF-1", "PDB 1IMX, X-ray 1.8 A"),
    "bpc157_solo": ("BPC-157", "built from sequence, no experimental structure"),
    "ghk-cu_solo": ("GHK", "built from sequence, no experimental structure"),
    "retatrutide_mn": ("Retatrutide complex, Blender", "PDB 8YW3, Cycles"),
    "tirzepatide_mn": ("Tirzepatide complex, Blender", "PDB 7FIM, Cycles"),
    "igf1_mn": ("IGF-1, Blender", "PDB 1IMX, Cycles"),
}

CSS = """
body{background:#0b0b0c;color:#e8e8ea;font:15px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;
     margin:0;padding:40px}
h1{font-weight:600;font-size:22px;margin:0 0 4px}
p.sub{color:#8b8b93;margin:0 0 32px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:24px}
figure{margin:0}
video{width:100%;border-radius:10px;background:#000;display:block}
figcaption{margin-top:8px}
.name{font-weight:600}
.src{color:#8b8b93;font-size:13px}
"""


def main():
    files = sorted(f for f in os.listdir(OUT) if f.endswith(".mp4"))
    cards = []
    for f in files:
        stem = re.sub(r"\.mp4$", "", f)
        name, src = CAPTIONS.get(stem, (stem.replace("_", " "), ""))
        cards.append(
            f'<figure><video src="{html.escape(f)}" autoplay loop muted playsinline></video>'
            f'<figcaption><div class="name">{html.escape(name)}</div>'
            f'<div class="src">{html.escape(src)}</div></figcaption></figure>'
        )
    page = (
        "<!doctype html><meta charset='utf-8'><title>Peptide animations</title>"
        f"<style>{CSS}</style><h1>Peptide animations</h1>"
        "<p class='sub'>Structures from the RCSB Protein Data Bank unless noted otherwise.</p>"
        f"<div class='grid'>{''.join(cards)}</div>"
    )
    path = os.path.join(OUT, "gallery.html")
    with open(path, "w") as fh:
        fh.write(page)
    print(path)


main()
