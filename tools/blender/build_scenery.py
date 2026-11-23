"""Yardsweep scenery kit — houses, trees, hedges, flowers, palms, slabs, clouds.

Run (Blender 4.2+/5.x, headless):
  blender --background --factory-startup --python tools/blender/build_scenery.py -- <out.glb> [preview.png]

The game draws every kit item with InstancedMesh (sceneryKit.ts), so each variant is one mesh
with per-face vertex colors and shared materials. Sizes match the code shapes they replace:
  houses   ~6-8.5 m wide, walls 3.4-4.8 m, front door faces -Y (three.js +Z)
  trees    ~5-6 m tall at scale 1 (roundTree/pineTree used s = 0.9-1.9)
  hedge    1.3 x 0.9 x 0.9, flowers ~0.5 m, slabs ~1 m
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit_common import *  # noqa: E402,F403

random.seed(11)


def crown_color(base, top):
    return by_height(base, top, 0.35)


# ── trees ─────────────────────────────────────────────────────────────────────
def trunk(height, r0, r1, color="#85532f", lean=0.0):
    t = cyl(r0, height, 7, loc=(lean / 2, 0, height / 2), radius2=r1)
    return finish_part(t, color, jitter=0.02, color_fn=lambda p: srgb(color) if p.normal.x < 0.3 else shade(color, 0.06))


def tree_round(variant, blobs, green, light, h=2.8):
    parts = [trunk(h, 0.3, 0.2)]
    # two short branches into the crown
    for ang in (0.7, -2.2):
        b = cyl(0.08, 1.0, 5, loc=(math.cos(ang) * 0.35, math.sin(ang) * 0.35, h - 0.2),
                rot=(0, 0.9, ang), radius2=0.05)
        parts.append(finish_part(b, "#7a4b2a"))
    for (x, y, z, r) in blobs:
        parts.append(finish_part(ico(r, 1, loc=(x, y, h + z)), green, jitter=r * 0.1, color_fn=crown_color(green, light)))
    return assemble(f"treeRound_{variant}", parts)


def tree_pine(variant, tiers, green, light):
    parts = [trunk(1.6, 0.25, 0.18, "#7a4d2c")]
    z = 1.0
    for i in range(tiers):
        r = 1.6 * (1 - i / (tiers + 0.6))
        hgt = 2.0 * (1 - i * 0.12)
        cone = cyl(r, hgt, 8, loc=(0, 0, z + hgt / 2), radius2=0.0)
        parts.append(finish_part(cone, green, jitter=0.06, color_fn=crown_color(green, light)))
        z += hgt * 0.55
    return assemble(f"treePine_{variant}", parts)


def tree_blossom():
    parts = [trunk(2.4, 0.26, 0.17, "#6b4429")]
    for (x, y, z, r) in [(0, 0, 0.9, 1.35), (0.9, 0.3, 0.5, 0.85), (-0.8, -0.4, 0.55, 0.9), (0.1, -0.8, 0.8, 0.75)]:
        parts.append(finish_part(ico(r, 1, loc=(x, y, 2.4 + z)), "#f28fb6", jitter=r * 0.1, color_fn=crown_color("#ee7fa8", "#ffc3da")))
    return assemble("treeBlossom_0", parts)


def palm():
    parts = []
    x = 0.0
    segs = 6
    for i in range(segs):
        z = i * 0.82
        dx = 0.06 * i * i
        seg = cyl(0.22 * (1 - i * 0.05), 0.85, 7, loc=(dx, 0, z + 0.42), rot=(0, 0.06 * i, 0), radius2=0.2 * (1 - i * 0.05))
        parts.append(finish_part(seg, "#a07445" if i % 2 else "#8c6239"))
        x = dx
    top = (x + 0.1, 0, segs * 0.82)
    for k in range(7):
        ang = k / 7 * math.tau
        L = 2.1
        verts = []
        steps = 4
        for s in range(steps + 1):
            t = s / steps
            d = t * L
            droop = -0.9 * t * t + 0.35 * t
            w = 0.38 * math.sin(math.pi * min(1, t * 1.15))
            cx, cy = top[0] + math.cos(ang) * d, top[1] + math.sin(ang) * d
            px, py = -math.sin(ang) * w, math.cos(ang) * w
            verts += [(cx + px, cy + py, top[2] + droop), (cx - px, cy - py, top[2] + droop)]
        faces = [(s * 2, s * 2 + 1, s * 2 + 3, s * 2 + 2) for s in range(steps)]
        frond = mesh_from(verts, faces, "frond")
        g = "#3f9c45" if k % 2 else "#55b84a"
        parts.append(finish_part(frond, g))
    for k in range(3):
        a = k * 2.1
        parts.append(finish_part(ico(0.16, 1, loc=(top[0] + math.cos(a) * 0.22, math.sin(a) * 0.22, top[2] - 0.25)), "#7a5a2a"))
    return assemble("palm_0", parts)


# ── small greenery ────────────────────────────────────────────────────────────
def hedge():
    parts = []
    for (x, r) in [(-0.4, 0.5), (0.1, 0.56), (0.5, 0.45)]:
        parts.append(finish_part(ico(r, 1, loc=(x, 0, 0.5), scale=(1, 0.85, 0.95)), "#3f8a3a", jitter=0.04,
                                 color_fn=crown_color("#3f8a3a", "#5aa848")))
    return assemble("hedge_0", parts)


def shrub():
    parts = [finish_part(ico(0.72, 1, loc=(0, 0, 0.5), scale=(1.15, 1, 0.7)), "#4f913f", jitter=0.06,
                         color_fn=crown_color("#4f913f", "#69ad4f"))]
    return assemble("shrub_0", parts)


def flowers(variant, petal, center="#ffd23f"):
    parts = []
    spots = [(0, 0), (0.22, 0.12), (-0.2, 0.1), (0.05, -0.22), (-0.12, -0.15)]
    for i, (x, y) in enumerate(spots):
        h = 0.32 + random.uniform(0, 0.18)
        parts.append(finish_part(cyl(0.022, h, 4, loc=(x, y, h / 2)), "#3f7a2f"))
        for k in range(5):
            a = k / 5 * math.tau + i
            parts.append(finish_part(ico(0.07, 0, loc=(x + math.cos(a) * 0.08, y + math.sin(a) * 0.08, h), scale=(1, 1, 0.55)), petal))
        parts.append(finish_part(ico(0.05, 0, loc=(x, y, h + 0.02)), center))
    for k in range(4):  # leaves at the base
        a = k / 4 * math.tau + 0.4
        leaf = ico(0.12, 0, loc=(math.cos(a) * 0.14, math.sin(a) * 0.14, 0.05), scale=(1.6, 0.6, 0.3))
        leaf.rotation_euler = (0, 0, a)
        parts.append(finish_part(leaf, "#4c9a3a"))
    return assemble(f"flowers_{variant}", parts)


def slab(variant):
    s = cyl(0.55, 0.12, 7, loc=(0, 0, 0.06))
    s.scale = (1.0 + variant * 0.25, 0.75, 1)
    return assemble(f"slab_{variant}", [finish_part(s, "#9a9188", jitter=0.03, color_fn=by_height("#8d857c", "#a59d93", 0.5))])


def cloud(variant):
    parts = []
    puffs = [(0, 0, 0, 1.6), (1.6, 0.2, -0.2, 1.2), (-1.5, -0.1, -0.3, 1.25), (0.6, -0.3, 0.7, 1.05), (-0.5, 0.4, 0.6, 0.95)][: 3 + variant]
    for (x, y, z, r) in puffs:
        parts.append(finish_part(ico(r, 1, loc=(x, y, z + 1.6), scale=(1, 1, 0.8)), "#ffffff",
                                 color_fn=by_height("#e9f1f8", "#ffffff", 0.2)))
    return assemble(f"cloud_{variant}", parts)


# ── houses ────────────────────────────────────────────────────────────────────
PALETTES = [
    ("#ffd6a5", "#e76f51", "#8a5a33"),
    ("#a8d8ff", "#5b8bd9", "#f7f2e6"),
    ("#fff1a8", "#2a9d8f", "#7a4a2a"),
    ("#ffc4d6", "#9b6fd6", "#f7f2e6"),
]


def gable_roof(w, d, h, overhang, color, z0):
    hw, hd = w / 2 + overhang, d / 2 + overhang
    t = 0.12  # roof thickness so the eaves read as a slab
    verts = [(-hw, -hd, z0), (hw, -hd, z0), (hw, hd, z0), (-hw, hd, z0),
             (-hw, -hd, z0 + h), (hw, -hd, z0 + h)]
    # ridge runs along X; faces: two slopes, two gable ends, bottom
    verts = [(-hw, -hd, z0), (-hw, hd, z0), (-hw, 0, z0 + h), (hw, -hd, z0), (hw, hd, z0), (hw, 0, z0 + h),
             (-hw, -hd, z0 - t), (-hw, hd, z0 - t), (hw, -hd, z0 - t), (hw, hd, z0 - t)]
    faces = [(0, 3, 5, 2), (4, 1, 2, 5), (0, 2, 1), (3, 4, 5), (6, 8, 3, 0), (1, 4, 9, 7), (6, 0, 1, 7), (8, 9, 4, 3), (6, 7, 9, 8)]
    roof = mesh_from(verts, faces, "roof")
    return finish_part(roof, color, color_fn=lambda p: shade(color, -0.08) if p.normal.z < 0.2 else srgb(color))


def window(x, z, front_y, frame="#f7f2e6", w=1.1, h=1.0):
    parts = [finish_part(cube((w + 0.2, 0.08, h + 0.2), loc=(x, front_y - 0.02, z)), frame)]
    parts.append(finish_part(cube((w, 0.08, h), loc=(x, front_y - 0.06, z)), "#83cceb", "shiny"))
    parts.append(finish_part(cube((0.06, 0.09, h), loc=(x, front_y - 0.08, z)), frame))
    parts.append(finish_part(cube((w, 0.09, 0.06), loc=(x, front_y - 0.08, z)), frame))
    parts.append(finish_part(cube((w + 0.3, 0.22, 0.1), loc=(x, front_y - 0.1, z - h / 2 - 0.1)), frame))  # sill
    return parts


def house(shape, palette_index):
    wall, roof, trim = PALETTES[palette_index]
    door = "#8a5a33" if trim != "#8a5a33" else "#5b8bd9"
    parts = []
    if shape == 0:  # cottage
        w, d, h = 6.4, 5.2, 3.5
        parts.append(finish_part(cube((w, d, h), loc=(0, 0, h / 2)), wall, color_fn=lambda p: shade(wall, -0.06) if abs(p.normal.x) > 0.5 else srgb(wall)))
        parts.append(gable_roof(w, d, 2.0, 0.35, roof, h))
        fy = -d / 2
        parts.append(finish_part(cube((1.1, 0.1, 2.1), loc=(1.3, fy - 0.02, 1.05)), door))
        parts.append(finish_part(ico(0.07, 0, loc=(1.7, fy - 0.1, 1.05)), "#ffd23f", "shiny"))
        parts += window(-1.4, 2.0, fy)
        parts.append(finish_part(cube((0.7, 0.7, 1.6), loc=(-1.8, 0.8, h + 1.3)), "#b0563a"))
        parts.append(finish_part(cube((1.6, 0.9, 0.18), loc=(1.3, fy - 0.45, 0.09)), "#cfc6b8"))  # doorstep
    elif shape == 1:  # two-story
        w, d, h = 5.6, 5.0, 5.0
        parts.append(finish_part(cube((w, d, h), loc=(0, 0, h / 2)), wall, color_fn=lambda p: shade(wall, -0.06) if abs(p.normal.x) > 0.5 else srgb(wall)))
        parts.append(finish_part(cube((w + 0.1, d + 0.1, 0.16), loc=(0, 0, 2.45)), trim))  # floor band
        parts.append(gable_roof(w, d, 2.2, 0.35, roof, h))
        fy = -d / 2
        parts.append(finish_part(cube((1.1, 0.1, 2.1), loc=(0, fy - 0.02, 1.05)), door))
        parts.append(finish_part(ico(0.07, 0, loc=(0.4, fy - 0.1, 1.05)), "#ffd23f", "shiny"))
        parts += window(-1.7, 1.4, fy, w=0.9, h=0.9)
        parts += window(1.7, 1.4, fy, w=0.9, h=0.9)
        parts += window(-1.3, 3.7, fy, w=1.0, h=1.0)
        parts += window(1.3, 3.7, fy, w=1.0, h=1.0)
        # door canopy
        parts.append(finish_part(cube((1.8, 0.8, 0.12), loc=(0, fy - 0.4, 2.35), rot=(-0.25, 0, 0)), roof))
    else:  # wide house with porch
        w, d, h = 8.0, 5.6, 3.4
        parts.append(finish_part(cube((w, d, h), loc=(0, 0, h / 2)), wall, color_fn=lambda p: shade(wall, -0.06) if abs(p.normal.x) > 0.5 else srgb(wall)))
        parts.append(gable_roof(w, d, 2.1, 0.35, roof, h))
        fy = -d / 2
        parts.append(finish_part(cube((w - 1.0, 1.6, 0.2), loc=(0, fy - 0.8, 0.1)), "#cfa77a"))  # porch deck
        parts.append(finish_part(cube((w - 0.8, 1.9, 0.14), loc=(0, fy - 0.85, 2.75), rot=(-0.18, 0, 0)), roof))  # porch roof
        for x in (-(w - 1.4) / 2, -1.2, 1.2, (w - 1.4) / 2):
            parts.append(finish_part(cyl(0.09, 2.6, 6, loc=(x, fy - 1.5, 1.4)), trim))
        parts.append(finish_part(cube((1.1, 0.1, 2.1), loc=(0, fy - 0.02, 1.15)), door))
        parts += window(-2.6, 2.0, fy)
        parts += window(2.6, 2.0, fy)
        parts.append(finish_part(cube((0.7, 0.7, 1.4), loc=(2.6, 1.0, h + 1.4)), "#b0563a"))
    return assemble(f"house_{shape}{palette_index}", parts)


built = [
    tree_round(0, [(0, 0, 0.9, 1.7), (0.8, 0.5, 0.4, 1.05), (-0.7, -0.3, 0.5, 1.0)], "#5fa83a", "#86c552"),
    tree_round(1, [(0, 0, 0.8, 1.45), (0, 0.1, 2.0, 1.05)], "#4f913f", "#6fb052", h=3.0),
    tree_round(2, [(0, 0, 0.7, 1.6), (1.0, 0.4, 0.3, 1.1), (-1.0, 0.2, 0.35, 1.05), (0.2, -0.9, 0.5, 0.95)], "#6eae35", "#97cf5a", h=2.5),
    tree_pine(0, 3, "#3d7d3a", "#5a9e4c"), tree_pine(1, 4, "#2f6e3f", "#4b8f55"),
    tree_blossom(), palm(),
    hedge(), shrub(),
    flowers(0, "#e85f8a"), flowers(1, "#f2b6d4"), flowers(2, "#9b6fd6"), flowers(3, "#f7e14a", "#ff8a3d"),
    slab(0), slab(1),
    cloud(0), cloud(1), cloud(2),
] + [house(shape, p) for shape in range(3) for p in range(len(PALETTES))]

export_and_preview(built, cols=6, spacing=9.5, ortho=62, cam_loc=(24, -70, 48))
