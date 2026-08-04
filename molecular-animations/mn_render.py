"""Blender + Molecular Nodes turntable render.

Usage:
    /Applications/Blender.app/Contents/MacOS/Blender -b --python mn_render.py -- 8YW3 \
        --name retatrutide --frames 120 --res 1080 --engine EEVEE

Renders a PNG sequence and muxes it into out/<name>_mn.mp4 + .gif
"""

import argparse
import math
import os
import shutil
import subprocess
import sys

import bpy
import bl_ext.blender_org.molecularnodes as mn

HERE = os.path.dirname(os.path.abspath(bpy.data.filepath or __file__)) or os.getcwd()
PROJECT = os.environ.get("ANIM_DIR", os.getcwd())
OUT = os.path.join(PROJECT, "out")
CACHE = os.path.join(PROJECT, ".mn_cache")


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("code", help="PDB code, e.g. 8YW3")
    ap.add_argument("--name", default=None)
    ap.add_argument("--frames", type=int, default=120)
    ap.add_argument("--res", type=int, default=1080)
    ap.add_argument("--engine", default="CYCLES", choices=["EEVEE", "CYCLES"])
    ap.add_argument("--samples", type=int, default=64)
    ap.add_argument("--style", default="cartoon+surface",
                    choices=["cartoon", "surface", "cartoon+surface", "spheres", "ribbon"])
    ap.add_argument("--color", default="common",
                    help="'common' (element colors), 'plddt', or a color attribute name")
    return ap.parse_args(argv)


def use_gpu(samples):
    """Cycles on Apple silicon: Metal GPU + a modest sample count."""
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for device in prefs.devices:
            device.use = True
        bpy.context.scene.cycles.device = "GPU"
    except Exception as exc:
        print(f"  GPU unavailable, rendering on CPU ({exc})")
    bpy.context.scene.cycles.samples = samples


def add_styles(mol, style, color):
    if style in ("cartoon", "cartoon+surface"):
        mol.add_style(mn.StyleCartoon(quality=3, peptide_rounded=True), color=color)
    if style in ("surface", "cartoon+surface"):
        mol.add_style(mn.StyleSurface(quality=3, probe_size=1.2), color=color)
    if style == "spheres":
        mol.add_style(mn.StyleSpheres(), color=color)
    if style == "ribbon":
        mol.add_style(mn.StyleRibbon(), color=color)


def turntable(canvas, obj, frames, frame_dir):
    """Spin the object a full 360 deg around Z, one snapshot per step.

    Rendered frame by frame rather than keyframed: Blender 4.4+ moved fcurves
    behind action slots, and stepping manually keeps this version-proof.
    """
    obj.rotation_mode = "XYZ"
    for i in range(frames):
        obj.rotation_euler[2] = 2 * math.pi * i / frames
        bpy.context.view_layer.update()
        canvas.snapshot(path=os.path.join(frame_dir, f"f{i:04d}.png"))
        if i % 20 == 0:
            print(f"  frame {i}/{frames}", flush=True)


def encode(stem, frame_dir, fps=30):
    mp4 = os.path.join(OUT, f"{stem}_mn.mp4")
    gif = os.path.join(OUT, f"{stem}_mn.gif")
    frames = sorted(f for f in os.listdir(frame_dir) if f.endswith(".png"))
    if not frames:
        raise SystemExit(f"no frames rendered in {frame_dir}")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps),
         "-pattern_type", "glob", "-i", os.path.join(frame_dir, "*.png"),
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", mp4],
        check=True,
    )
    palette = os.path.join(frame_dir, "palette.png")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", mp4, "-vf",
                    "fps=20,scale=600:-1:flags=lanczos,palettegen", palette], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", mp4, "-i", palette,
                    "-lavfi", "fps=20,scale=600:-1:flags=lanczos[x];[x][1:v]paletteuse", gif],
                   check=True)
    shutil.rmtree(frame_dir, ignore_errors=True)
    return mp4, gif


def main():
    args = parse_args()
    name = args.name or args.code.lower()
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(CACHE, exist_ok=True)

    # Canvas loads the Molecular Nodes template scene, which wipes anything
    # already in the file - so build it before fetching the structure.
    canvas = mn.Canvas(engine=args.engine, resolution=(args.res, args.res))
    if args.engine == "CYCLES":
        use_gpu(args.samples)

    mol = mn.Molecule.fetch(args.code, cache=CACHE)
    add_styles(mol, args.style, args.color)
    canvas.frame_object(mol)

    frame_dir = os.path.join(OUT, f"_mnframes_{name}")
    shutil.rmtree(frame_dir, ignore_errors=True)
    os.makedirs(frame_dir, exist_ok=True)
    turntable(canvas, mol.object, args.frames, frame_dir)

    mp4, gif = encode(name, frame_dir)
    print(f"wrote {mp4}\nwrote {gif}")


main()
