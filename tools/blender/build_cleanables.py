"""Yardsweep cleanable objects — low-poly cartoon models built procedurally in Blender.

Run (Blender 4.2+/5.x, headless):
  blender --background --factory-startup --python tools/blender/build_cleanables.py -- <out.glb> [preview.png]
Helpers and conventions live in kit_common.py.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit_common import *  # noqa: E402,F403
import bmesh  # noqa: E402

# ── objects ───────────────────────────────────────────────────────────────────
def leaf(variant, color, vein):
    # Curled oak-ish leaf: pointed ellipse along X, V-fold along the midrib, tips curling up.
    n = 7
    verts, faces = [], []
    for i in range(n + 1):
        t = i / n
        x = -0.45 + 0.9 * t
        w = 0.24 * math.sin(math.pi * t) ** 0.75 * (1 + 0.18 * math.sin(t * math.pi * 3))
        curl = 0.035 * (2 * t - 1) ** 2  # tips lift just a little: from eye height a big curl reads as a banana
        verts += [(x, 0, 0.012 + curl), (x, w, 0.03 + curl), (x, -w, 0.03 + curl)]
    for i in range(n):
        a, b = i * 3, (i + 1) * 3
        faces.append((a, b, b + 1, a + 1))
        faces.append((a, a + 2, b + 2, b))
    blade = mesh_from(verts, faces, "leaf")
    mid = lambda poly: srgb(vein) if abs(poly.center.y) < 0.05 else srgb(color)
    finish_part(blade, color, color_fn=mid)
    stem = cyl(0.015, 0.16, verts=4, loc=(-0.52, 0, 0.04), rot=(0, math.pi / 2, 0))
    finish_part(stem, vein)
    return assemble(f"leaf_{variant}", [blade, stem])


def can(variant, body, stripe):
    parts = [finish_part(cyl(0.16, 0.48, 10, loc=(0, 0, 0.16), rot=(0, math.pi / 2, 0)), body, "shiny")]
    parts.append(finish_part(cyl(0.165, 0.14, 10, loc=(0.02, 0, 0.16), rot=(0, math.pi / 2, 0)), stripe, "shiny"))
    for side in (-1, 1):
        parts.append(finish_part(cyl(0.17, 0.035, 10, loc=(0.245 * side, 0, 0.16), rot=(0, math.pi / 2, 0)), "#dde4e7", "shiny"))
    # pull tab
    parts.append(finish_part(cube((0.02, 0.08, 0.05), loc=(0.27, 0, 0.22)), "#c9d1d6", "shiny"))
    return assemble(f"can_{variant}", parts)


def gold_can():
    parts = [finish_part(cyl(0.19, 0.55, 12, loc=(0, 0, 0.19), rot=(0, math.pi / 2, 0)), "#ffc928", "gold")]
    parts.append(finish_part(cyl(0.195, 0.12, 12, loc=(0, 0, 0.19), rot=(0, math.pi / 2, 0)), "#fff1a8", "gold"))
    for side in (-1, 1):
        parts.append(finish_part(cyl(0.205, 0.035, 12, loc=(0.29 * side, 0, 0.19), rot=(0, math.pi / 2, 0)), "#ffef9a", "gold"))
    for i in range(3):  # sparkle studs
        a = i * 2.1
        parts.append(finish_part(ico(0.04, 0, loc=(-0.12 + i * 0.12, math.cos(a) * 0.2, 0.19 + math.sin(a) * 0.2)), "#ffffff", "gold"))
    return assemble("goldCan_0", parts)


def chest(kind, wood, trim, trim_mat, gem=None):
    parts = [finish_part(cube((0.82, 0.58, 0.42), loc=(0, 0, 0.21)), wood)]
    # planks: darker grooves
    for z in (0.11, 0.3):
        parts.append(finish_part(cube((0.83, 0.59, 0.02), loc=(0, 0, z)), shade(wood, -0.12)))
    lid = cyl(0.29, 0.86, 8, loc=(0, 0, 0.42), rot=(0, math.pi / 2, 0))
    bm = bmesh.new()
    bm.from_mesh(lid.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.x > 0.001 and False], context="VERTS")
    bm.to_mesh(lid.data)
    bm.free()
    lid.scale = (1, 1, 0.75)
    parts.append(finish_part(lid, shade(wood, 0.06)))
    for x in (-0.3, 0.3):
        parts.append(finish_part(cube((0.08, 0.62, 0.46), loc=(x, 0, 0.23)), trim, trim_mat))
        band = cyl(0.3, 0.08, 8, loc=(x, 0, 0.42), rot=(0, math.pi / 2, 0))
        band.scale = (1, 1, 0.77)
        parts.append(finish_part(band, trim, trim_mat))
    parts.append(finish_part(cube((0.16, 0.06, 0.2), loc=(0, -0.31, 0.38)), trim, trim_mat))
    parts.append(finish_part(cube((0.05, 0.02, 0.07), loc=(0, -0.345, 0.36)), "#2a1b0c"))
    if gem:
        parts.append(finish_part(ico(0.11, 0, loc=(0, 0, 0.72), scale=(1, 1, 1.4)), gem, "gem"))
    return assemble(f"{kind}_0", parts)


def grass(variant, colors, blades):
    parts = []
    for i in range(blades):
        ang = (i / blades) * math.tau + random.uniform(-0.3, 0.3)
        h = random.uniform(0.55, 0.85)
        lean = random.uniform(0.15, 0.35)
        w = random.uniform(0.07, 0.1)
        dx, dy = math.cos(ang), math.sin(ang)
        px, py = -dy, dx
        r0 = random.uniform(0.02, 0.12)
        base = Vector((dx * r0, dy * r0, 0))
        mid = base + Vector((dx * lean * 0.4, dy * lean * 0.4, h * 0.55))
        tip = base + Vector((dx * lean, dy * lean, h))
        verts = [base + Vector((px * w, py * w, 0)), base - Vector((px * w, py * w, 0)),
                 mid - Vector((px * w * 0.6, py * w * 0.6, 0)), mid + Vector((px * w * 0.6, py * w * 0.6, 0)), tip]
        blade = mesh_from([tuple(v) for v in verts], [(0, 1, 2, 3), (3, 2, 4)], "blade")
        col = colors[i % len(colors)]
        finish_part(blade, col, color_fn=lambda poly, c=col: srgb(c) if poly.center.z < 0.35 else shade(c, 0.1))
        parts.append(blade)
    return assemble(f"grass_{variant}", parts)


def stone(variant, color, size):
    rock = ico(size, 1, loc=(0, 0, size * 0.6), scale=(1.1, 0.95, 0.62))
    finish_part(rock, color, jitter=size * 0.12, color_fn=by_height(color, shade(color, 0.08), 0.55))
    return assemble(f"stone_{variant}", [rock])


def gold_stone():
    rock = ico(0.45, 1, loc=(0, 0, 0.3), scale=(1.1, 1, 0.7))
    finish_part(rock, "#8a8580", jitter=0.05, color_fn=by_height("#7d7873", "#99938c", 0.5))
    parts = [rock]
    for (x, y, z, s) in [(0.25, 0.1, 0.5, 0.13), (-0.2, 0.22, 0.45, 0.11), (0.05, -0.28, 0.42, 0.12), (-0.28, -0.12, 0.3, 0.09), (0.0, 0.05, 0.6, 0.1)]:
        parts.append(finish_part(ico(s, 0, loc=(x, y, z)), "#ffc62f", "gold", jitter=0.02))
    return assemble("goldStone_0", parts)


def trash_bag(variant, color):
    bag = uvsphere(0.4, 8, 6, loc=(0, 0, 0.38), scale=(1.05, 0.92, 0.95))
    finish_part(bag, color, "shiny", jitter=0.035, color_fn=by_height(color, shade(color, 0.1), 0.6))
    neck = cyl(0.14, 0.2, 6, loc=(0, 0, 0.78), radius2=0.06)
    finish_part(neck, shade(color, -0.05), "shiny")
    parts = [bag, neck]
    for side in (-1, 1):  # knot ears
        ear = cyl(0.07, 0.22, 4, loc=(0.09 * side, 0, 0.93), rot=(0, 0.6 * side, 0), radius2=0.01)
        parts.append(finish_part(ear, color, "shiny"))
    parts.append(finish_part(torus(0.07, 0.025, loc=(0, 0, 0.82)), "#ffd84a"))
    return assemble(f"trashBag_{variant}", parts)


def bottle(variant, color):
    parts = [finish_part(cyl(0.12, 0.42, 8, loc=(0, 0, 0.12), rot=(0, math.pi / 2, 0)), color, "glass")]
    parts.append(finish_part(cyl(0.12, 0.2, 8, loc=(0.3, 0, 0.12), rot=(0, math.pi / 2, 0), radius2=0.05), color, "glass"))
    parts.append(finish_part(cyl(0.055, 0.06, 8, loc=(0.42, 0, 0.12), rot=(0, math.pi / 2, 0)), "#ff6b6b"))
    parts.append(finish_part(cyl(0.125, 0.16, 8, loc=(-0.03, 0, 0.12), rot=(0, math.pi / 2, 0)), "#fff4d6"))  # label
    return assemble(f"bottle_{variant}", parts)


def bush(variant, greens, berry):
    parts = []
    blobs = [(0, 0, 0.45, 0.5), (0.38, 0.18, 0.32, 0.38), (-0.36, -0.14, 0.3, 0.4), (0.05, -0.36, 0.33, 0.34), (-0.1, 0.34, 0.3, 0.32)]
    for i, (x, y, z, s) in enumerate(blobs):
        g = greens[i % len(greens)]
        parts.append(finish_part(ico(s, 1, loc=(x, y, z)), g, jitter=s * 0.12, color_fn=by_height(g, shade(g, 0.08), 0.4)))
    if berry:
        for _ in range(7):
            a = random.uniform(0, math.tau)
            parts.append(finish_part(ico(0.06, 1, loc=(math.cos(a) * 0.48, math.sin(a) * 0.48, random.uniform(0.3, 0.75))), berry))
    return assemble(f"bush_{variant}", parts)


def seaweed(variant, color):
    parts = []
    for i in range(6):
        ang = i / 6 * math.pi + random.uniform(-0.2, 0.2)
        L = random.uniform(0.55, 0.8)
        verts, faces = [], []
        segs = 6
        for s in range(segs + 1):
            t = s / segs
            d = (t - 0.5) * L
            wave = math.sin(t * math.pi * 3 + i) * 0.05
            w = 0.05 * (1 - abs(t - 0.5))
            cx, cy = math.cos(ang) * d - math.sin(ang) * wave, math.sin(ang) * d + math.cos(ang) * wave
            px, py = -math.sin(ang) * w, math.cos(ang) * w
            z = 0.02 + i * 0.008 + 0.02 * math.sin(t * math.pi * 2)
            verts += [(cx + px, cy + py, z), (cx - px, cy - py, z)]
        for s in range(segs):
            a = s * 2
            faces.append((a, a + 1, a + 3, a + 2))
        strand = mesh_from(verts, faces, "strand")
        c = shade(color, (i % 3 - 1) * 0.05)
        finish_part(strand, c)
        parts.append(strand)
    parts.append(finish_part(ico(0.07, 1, loc=(0, 0, 0.06)), "#8a7a2f"))
    return assemble(f"seaweed_{variant}", parts)


def boulder(variant, color, moss):
    rock = ico(0.7, 2, loc=(0, 0, 0.5), scale=(1.15, 1.0, 0.75))
    finish_part(rock, color, jitter=0.07, color_fn=by_height(color, moss, 0.55))
    parts = [rock]
    for (x, y, s) in [(0.75, 0.3, 0.22), (-0.7, -0.35, 0.18)]:
        pebble = ico(s, 1, loc=(x, y, s * 0.5), scale=(1.2, 1, 0.7))
        parts.append(finish_part(pebble, shade(color, -0.04), jitter=0.03))
    return assemble(f"boulder_{variant}", parts)


built = [
    leaf(0, "#e8892b", "#a8541a"), leaf(1, "#d9482e", "#8c2a1a"), leaf(2, "#f2c23a", "#b8821e"),
    can(0, "#e83e35", "#ffffff"), can(1, "#2f7fe0", "#ffe14a"),
    gold_can(),
    chest("goldChest", "#a8641f", "#ffd54a", "gold"),
    chest("gemChest", "#6b35c8", "#69e9ff", "gem", gem="#7af5ff"),
    grass(0, ["#4fae3c", "#3f9c35", "#63c24a"], 9), grass(1, ["#5bbd45", "#46a83a"], 7),
    stone(0, "#8a8f8c", 0.36), stone(1, "#7f8488", 0.32), stone(2, "#969a92", 0.4),
    gold_stone(),
    trash_bag(0, "#6cc79a"), trash_bag(1, "#3d4a5c"),
    bottle(0, "#4fbf7a"), bottle(1, "#6fc3e8"),
    bush(0, ["#4a9a3a", "#5aac44", "#3f8a33"], "#e8435a"), bush(1, ["#3f8f4a", "#52a35a"], None),
    seaweed(0, "#5f8f3a"), seaweed(1, "#7a9a32"),
    boulder(0, "#7b8086", "#6aa944"), boulder(1, "#8d8478", "#7fb24c"),
]

export_and_preview(built)
