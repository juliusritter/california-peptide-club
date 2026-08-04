# Peptide molecular animations

Spinning 3D animations of peptide structures (retatrutide, tirzepatide, semaglutide, IGF-1, BPC-157, GHK-Cu) for posts, slides and the wiki.

Two render paths, same source data:

| Path | Script | Look | Speed |
|---|---|---|---|
| PyMOL | `render_peptide.py` | scientific: rainbow cartoon, transparent surface, black background | ~2 s/frame solo, ~10 s/frame for a receptor complex |
| Blender + Molecular Nodes | `mn_render.py` | cinematic: soft key/rim lighting, backdrop, Cycles path tracing | ~4 s/frame on Metal GPU |

Both write `out/<name>.mp4` and a 600 px `.gif`.

## Where the structures come from

Every animation except BPC-157 and GHK-Cu uses a real experimental structure pulled live from the RCSB Protein Data Bank:

- `8YW3` / `8YW4` / `8YW5`: cryo-EM, retatrutide bound to GLP-1R, GIPR and GCGR (its three receptors)
- `7FIM`: cryo-EM, tirzepatide bound to GLP-1R
- `4ZGM`: X-ray, semaglutide backbone with the GLP-1R extracellular domain
- `1IMX`: X-ray at 1.8 Å, human IGF-1
- `1B9G`: NMR ensemble, human IGF-1

BPC-157 and GHK-Cu have no deposited structure. The script builds an idealized extended backbone from the sequence with PyMOL's `fab`, so those two illustrate the sequence rather than a measured fold. BPC-157 is a 15-mer that stays mostly disordered in solution anyway.

## Usage

```bash
# PyMOL, peptide on its own
pymol -cq render_peptide.py -- igf1

# PyMOL, peptide sitting in its receptor
pymol -cq render_peptide.py -- retatrutide --mode complex --frames 120 --size 1000

# one still instead of a movie
pymol -cq render_peptide.py -- bpc157 --still --size 1200

# Blender + Molecular Nodes
ANIM_DIR=$PWD /Applications/Blender.app/Contents/MacOS/Blender -b --python mn_render.py -- \
  8YW3 --name retatrutide --style cartoon --frames 90 --res 1000

./render_all.sh    # the whole PyMOL set
./mn_all.sh        # the whole Blender set
```

Targets live in the `TARGETS` dict at the top of `render_peptide.py`. To add a target you need a PDB code and a note.

## Setup

```bash
brew install pymol
brew install --cask blender
/Applications/Blender.app/Contents/MacOS/Blender --online-mode \
  --command extension install -s -e molecularnodes
```

`ffmpeg` does the encoding. Molecular Nodes imports as `bl_ext.blender_org.molecularnodes`, not `molecularnodes`.

## Notes for editing the look

- `mn.Canvas()` loads the Molecular Nodes template scene and wipes the file, so build the canvas before fetching a structure.
- Molecular Nodes only accepts `common`, `plddt`, or the name of a color attribute for `color=`. Anything else silently renders black.
- EEVEE renders black in headless mode on this machine; Cycles with the Metal GPU works, so that is the default.
- The PyMOL script drops ambient occlusion and surface quality once a scene passes 5000 atoms, which is what keeps the receptor complexes from taking a minute per frame.
