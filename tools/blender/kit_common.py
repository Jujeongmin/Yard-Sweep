"""Shared helpers for Yardsweep's procedural Blender kits (cleanables, scenery).

Conventions: meters, Blender Z-up (exported as three.js Y-up), front of a model faces Blender -Y
(three.js +Z), origin at the ground center, per-face vertex colors in attribute "Col", and only
the shared materials below. Variant names are "<kind>_<variant>"; the game groups by the prefix.
"""
import math
import random
import sys

import bpy
import bmesh
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "out.glb"
PREVIEW = argv[1] if len(argv) > 1 else None
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb(hex_color):
    """'#rrggbb' -> RGBA tuple (BYTE_COLOR attributes take sRGB values). Tuples pass through."""
    if isinstance(hex_color, tuple):
        return hex_color
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)


# ── shared materials ──────────────────────────────────────────────────────────
def make_material(name, roughness, metallic=0.0, alpha=1.0, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = False
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    attr = nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    mat.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        try:
            mat.surface_render_method = "BLENDED"
        except AttributeError:
            mat.blend_method = "BLEND"
    if emission:
        key = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
        bsdf.inputs[key].default_value = srgb(emission)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


MATS = {
    "matte": make_material("Matte", 0.85),
    "shiny": make_material("Shiny", 0.32, metallic=0.55),
    "glass": make_material("Glass", 0.12, alpha=0.78),
    "gold": make_material("GoldGlow", 0.28, metallic=0.7, emission="#6b3c00", emission_strength=0.6),
    "gem": make_material("GemGlow", 0.25, metallic=0.3, emission="#1a8fb0", emission_strength=0.8),
}
MAT_ORDER = list(MATS.keys())


# ── part helpers ──────────────────────────────────────────────────────────────
def finish_part(obj, color, mat="matte", jitter=0.0, color_fn=None):
    """Bake transforms, optional vertex jitter, paint flat per-face colors, assign material."""
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)
    mesh = obj.data
    if jitter:
        for v in mesh.vertices:
            v.co += Vector((random.uniform(-jitter, jitter) for _ in range(3)))
    for poly in mesh.polygons:
        poly.use_smooth = False
    attr = mesh.color_attributes.get("Col") or mesh.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    mesh.calc_loop_triangles()
    for poly in mesh.polygons:
        c = color_fn(poly) if color_fn else color
        c = srgb(c) if isinstance(c, str) else c
        for li in poly.loop_indices:
            attr.data[li].color_srgb = c  # hex palette is sRGB; .color would treat it as linear (washed out)
    mesh.materials.clear()
    for key in MAT_ORDER:  # same slot order on every part so join() keeps indices stable
        mesh.materials.append(MATS[key])
    idx = MAT_ORDER.index(mat)  # set after the slots exist (clear() zeroes indices)
    for poly in mesh.polygons:
        poly.material_index = idx
    return obj


def cube(size, loc=(0, 0, 0), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = size
    return o


def cyl(radius, depth, verts=10, loc=(0, 0, 0), rot=(0, 0, 0), radius2=None):
    if radius2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=radius, radius2=radius2, depth=depth, location=loc, rotation=rot)
    return bpy.context.active_object


def ico(radius, subdiv=1, loc=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=radius, location=loc)
    o = bpy.context.active_object
    o.scale = scale
    return o


def uvsphere(radius, seg=8, rings=6, loc=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=radius, location=loc)
    o = bpy.context.active_object
    o.scale = scale
    return o


def torus(major, minor, loc=(0, 0, 0), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=10, minor_segments=5,
                                     location=loc, rotation=rot)
    return bpy.context.active_object


def mesh_from(verts, faces, name="part"):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def assemble(name, parts):
    """Join parts into one mesh, put its lowest point on z=0 and center it in XY."""
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    mesh = obj.data
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    offset = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)))
    for v in mesh.vertices:
        v.co -= offset
    # Drop material slots this variant never uses (fewer glTF primitives = fewer draw calls).
    used = sorted({p.material_index for p in mesh.polygons})
    remap = {old: new for new, old in enumerate(used)}
    keep = [mesh.materials[i] for i in used]
    new_index = [remap[p.material_index] for p in mesh.polygons]
    mesh.materials.clear()  # note: this resets every polygon's material_index to 0
    for m in keep:
        mesh.materials.append(m)
    for p, idx in zip(mesh.polygons, new_index):
        p.material_index = idx
    obj.select_set(False)
    return obj


def shade(base, amount):
    """Darken (amount<0) or lighten (amount>0) a hex color."""
    r, g, b, _ = srgb(base)
    f = lambda c: max(0.0, min(1.0, c + amount))
    return (f(r), f(g), f(b), 1.0)


def by_height(base, top, split=0.5):
    """Face color by normal: upward faces get `top`, others `base` (moss caps, lit tops)."""
    return lambda poly: srgb(top) if poly.normal.z > split else srgb(base)




def export_and_preview(built, cols=6, spacing=1.9, ortho=12.5, cam_loc=(5.0, -14.5, 9.5)):
    bpy.ops.object.select_all(action="DESELECT")
    for o in built:
        o.select_set(True)
    export_kwargs = dict(filepath=OUT, export_format="GLB", use_selection=True, export_apply=True,
                         export_yup=True, export_texcoords=False, export_normals=True)
    for extra in ({"export_vertex_color": "ACTIVE"}, {"export_colors": True}, {}):
        try:
            bpy.ops.export_scene.gltf(**export_kwargs, **extra)
            break
        except TypeError:
            continue
    print("EXPORTED", OUT, [o.name for o in built], sum(len(o.data.polygons) for o in built), "faces")

    if PREVIEW:
        # Contact sheet: lay variants out on a grid and render with Workbench (vertex colors).
        for i, o in enumerate(built):
            o.location = ((i % cols) * spacing, -(i // cols) * spacing, 0)
        bpy.ops.object.camera_add(location=cam_loc, rotation=(math.radians(55), 0, 0))
        cam = bpy.context.active_object
        cam.data.type = "ORTHO"
        cam.data.ortho_scale = ortho
        bpy.context.scene.camera = cam
        scene = bpy.context.scene
        scene.render.engine = "BLENDER_WORKBENCH"
        scene.display.shading.light = "STUDIO"
        scene.display.shading.color_type = "VERTEX"
        scene.display.shading.show_shadows = True
        scene.render.resolution_x = 1400
        scene.render.resolution_y = 1000
        scene.render.filepath = PREVIEW
        bpy.ops.render.render(write_still=True)
        print("PREVIEW", PREVIEW)
