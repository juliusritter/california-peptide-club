"""Render a spinning molecular animation of a peptide with PyMOL.

Usage:
    pymol -cq render_peptide.py -- retatrutide
    pymol -cq render_peptide.py -- igf1 --mode complex --frames 180 --size 1200

Output lands in ./out/<name>_<mode>.mp4 and .gif
"""

import argparse
import glob
import os
import shutil
import subprocess
import sys

from pymol import cmd

# PyMOL rewrites __file__ when running a script, so anchor on the working
# directory (or ANIM_DIR) instead.
HERE = os.environ.get("ANIM_DIR") or os.getcwd()
OUT = os.path.join(HERE, "out")

# pdb  = experimental structure fetched from RCSB
# seq  = one-letter sequence, built from scratch when no experimental structure exists
TARGETS = {
    "retatrutide": {
        "pdb": "8YW3",
        "note": "cryo-EM, retatrutide bound to human GLP-1R + Gs protein",
    },
    "retatrutide-gipr": {
        "pdb": "8YW4",
        "note": "cryo-EM, retatrutide bound to human GIPR + Gs protein",
    },
    "retatrutide-gcgr": {
        "pdb": "8YW5",
        "note": "cryo-EM, retatrutide bound to human GCGR + Gs protein",
    },
    "tirzepatide": {
        "pdb": "7FIM",
        "note": "cryo-EM, tirzepatide bound to human GLP-1R + Gs protein",
    },
    "semaglutide": {
        "pdb": "4ZGM",
        "note": "X-ray, semaglutide backbone + GLP-1R extracellular domain",
    },
    "igf1": {
        "pdb": "1IMX",
        "note": "X-ray 1.8 A, human IGF-1",
    },
    "igf1-nmr": {
        "pdb": "1B9G",
        "note": "NMR ensemble, human IGF-1",
    },
    "bpc157": {
        "seq": "GEPPPGKPADDAGLV",
        "note": "no experimental structure exists; idealized extended backbone built from sequence",
    },
    "ghk-cu": {
        "seq": "GHK",
        "note": "no experimental structure of the free peptide; backbone built from sequence",
    },
}


def build_scene(name, spec, mode):
    cmd.reinitialize()
    cmd.set("assembly", "1")

    if "pdb" in spec:
        cmd.fetch(spec["pdb"], "raw", async_=0)
        cmd.remove("solvent or inorganic")
        cmd.remove("hydrogens")
        peptide_chain = shortest_protein_chain("raw")
        cmd.create("pep", f"raw and polymer.protein and chain {peptide_chain}")
        cmd.create("rest", f"raw and polymer and not chain {peptide_chain}")
        cmd.delete("raw")
    else:
        cmd.fab(spec["seq"], "pep", ss=0)
        cmd.remove("hydrogens")

    style_scene(mode)
    cmd.orient("pep")
    if mode == "solo":
        cmd.zoom("pep", 3)
    else:
        # frame the binding site rather than the whole receptor complex
        cmd.zoom("pep or (byres (rest within 18 of pep))", 4)
    return peptide_chain if "pdb" in spec else "-"


def shortest_protein_chain(obj):
    """The bound peptide is the shortest protein chain in the entry."""
    best, best_n = None, None
    for ch in cmd.get_chains(obj):
        n = cmd.count_atoms(f"{obj} and polymer.protein and chain {ch} and name CA")
        if n == 0:
            continue
        if best_n is None or n < best_n:
            best, best_n = ch, n
    return best


def style_scene(mode):
    cmd.hide("everything")
    cmd.bg_color("black")
    cmd.set("ray_opaque_background", 1)
    cmd.set("antialias", 2)
    cmd.set("ray_shadows", 0)
    cmd.set("specular", 0.3)
    cmd.set("ambient", 0.14)
    cmd.set("direct", 0.5)
    cmd.set("reflect", 0.5)
    # Ambient occlusion plus a high-quality surface costs ~55 s/frame on a
    # GPCR-sized complex, so scale both down once the scene gets big.
    heavy = cmd.count_atoms("polymer") > 5000
    cmd.set("ambient_occlusion_mode", 0 if heavy else 1)
    cmd.set("surface_quality", 0 if heavy else 1)
    cmd.set("two_sided_lighting", 1)
    cmd.set("transparency_mode", 2)
    cmd.set("cartoon_fancy_helices", 1)
    cmd.set("cartoon_smooth_loops", 1)
    cmd.set("cartoon_highlight_color", "grey20")
    cmd.set("stick_radius", 0.16)

    tiny = cmd.count_atoms("pep and name CA") < 6
    if tiny:
        # too short for secondary structure: ball-and-stick reads better
        cmd.show("sticks", "pep")
        cmd.show("spheres", "pep")
        cmd.set("sphere_scale", 0.22, "pep")
        cmd.set("stick_radius", 0.11)
    else:
        cmd.show("cartoon", "pep")
        cmd.show("sticks", "pep and sidechain")
    cmd.spectrum("resv", "rainbow", "pep")  # N-terminus blue -> C-terminus red
    cmd.util.cnc("pep")  # keep the rainbow carbons, color N/O/S by element

    has_rest = "rest" in cmd.get_names() and cmd.count_atoms("rest") > 0
    if mode == "complex" and has_rest:
        cmd.show("cartoon", "rest")
        cmd.color("grey50", "rest")
        cmd.show("surface", "rest")
        cmd.set("surface_color", "slate", "rest")
        cmd.set("transparency", 0.55, "rest")
        cmd.set("cartoon_transparency", 0.2, "rest")
    else:
        if has_rest:
            cmd.disable("rest")
        if cmd.count_atoms("pep") < 1200:
            cmd.show("surface", "pep")
            cmd.set("surface_color", "grey80", "pep")
            cmd.set("transparency", 0.85 if tiny else 0.72, "pep")


def render(name, mode, frames, size, fps):
    stem = f"{name}_{mode}"
    frame_dir = os.path.join(OUT, f"_frames_{stem}")
    shutil.rmtree(frame_dir, ignore_errors=True)
    os.makedirs(frame_dir, exist_ok=True)

    step = 360.0 / frames
    for i in range(frames):
        cmd.png(
            os.path.join(frame_dir, f"f{i:04d}.png"),
            width=size,
            height=size,
            dpi=150,
            ray=1,
        )
        cmd.turn("y", step)
        if i % 20 == 0:
            print(f"  frame {i}/{frames}", flush=True)

    mp4 = os.path.join(OUT, f"{stem}.mp4")
    gif = os.path.join(OUT, f"{stem}.gif")
    pattern = os.path.join(frame_dir, "f%04d.png")

    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", pattern,
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", mp4],
        check=True,
    )
    palette = os.path.join(frame_dir, "palette.png")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", mp4,
         "-vf", "fps=20,scale=600:-1:flags=lanczos,palettegen", palette],
        check=True,
    )
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", mp4, "-i", palette,
         "-lavfi", "fps=20,scale=600:-1:flags=lanczos[x];[x][1:v]paletteuse", gif],
        check=True,
    )
    shutil.rmtree(frame_dir, ignore_errors=True)
    return mp4, gif


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("target", choices=sorted(TARGETS))
    ap.add_argument("--mode", default="solo", choices=["solo", "complex"])
    ap.add_argument("--frames", type=int, default=120)
    ap.add_argument("--size", type=int, default=900)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--still", action="store_true", help="render one PNG, skip the movie")
    args = ap.parse_args(sys.argv[1:])

    os.makedirs(OUT, exist_ok=True)
    os.chdir(OUT)  # PyMOL drops fetched .cif files in the cwd

    spec = TARGETS[args.target]
    print(f"{args.target}: {spec['note']}")
    chain = build_scene(args.target, spec, args.mode)
    print(f"peptide chain: {chain}, atoms: {cmd.count_atoms('pep')}")
    if args.still:
        png = os.path.join(OUT, f"{args.target}_{args.mode}.png")
        cmd.png(png, width=args.size, height=args.size, dpi=150, ray=1)
        print(f"wrote {png}")
        return
    mp4, gif = render(args.target, args.mode, args.frames, args.size, args.fps)
    print(f"wrote {mp4}\nwrote {gif}")


main()
