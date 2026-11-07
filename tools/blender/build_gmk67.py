"""Builds every GMK67 3D asset from src/data/layout.gmk67.json.

Run through `npm run model`. Blender coordinates: X right, Y toward the back of
the board, Z up, 1 unit = 1 cm. The plate's top surface is z = 0, and everything
is authored in that tilted frame. The app applies the typing tilt at runtime.
"""

import json
import math
import os
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
LAYOUT = json.loads((ROOT / "src/data/layout.gmk67.json").read_text(encoding="utf-8"))
OUT = ROOT / "public/models"
PREVIEW = ROOT / "tools/blender/preview"
ONLY = set(filter(None, os.environ.get("GMK_ONLY", "").split(",")))

PITCH = LAYOUT["pitch"]
CASE = LAYOUT["case"]
KEYS = LAYOUT["keys"]
TILT = math.radians(CASE["tiltDegrees"])
KEY_AREA_W = LAYOUT["columns"] * PITCH
KEY_AREA_D = LAYOUT["rows"] * PITCH


# Scene helpers ---------------------------------------------------------------


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for addon in ("io_scene_gltf2",):
        bpy.ops.preferences.addon_enable(module=addon)


def material(name, color=(0.8, 0.8, 0.8), metallic=0.0, roughness=0.5):
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def to_object(name, bm, mat=None):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if mat:
        mesh.materials.append(mat)
    return obj


def add_box(bm, x0, x1, y0, y1, z0, z1):
    verts = [
        bm.verts.new((x, y, z))
        for x in (x0, x1)
        for y in (y0, y1)
        for z in (z0, z1)
    ]
    faces = ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3))
    for face in faces:
        bm.faces.new([verts[i] for i in face])


def add_cylinder(bm, cx, cy, radius, z0, z1, sides=16):
    bottom = []
    top = []
    for i in range(sides):
        a = math.tau * i / sides
        x, y = cx + radius * math.cos(a), cy + radius * math.sin(a)
        bottom.append(bm.verts.new((x, y, z0)))
        top.append(bm.verts.new((x, y, z1)))
    bm.faces.new(list(reversed(bottom)))
    bm.faces.new(top)
    for i in range(sides):
        j = (i + 1) % sides
        bm.faces.new([bottom[i], bottom[j], top[j], top[i]])


def rounded_outline(half_w, half_d, radius, segments=6, cx=0.0, cy=0.0):
    """Counter-clockwise rounded rectangle with a fixed vertex count."""
    radius = min(radius, half_w - 1e-4, half_d - 1e-4)
    points = []
    corners = (
        (half_w - radius, -half_d + radius, -90),
        (half_w - radius, half_d - radius, 0),
        (-half_w + radius, half_d - radius, 90),
        (-half_w + radius, -half_d + radius, 180),
    )
    for ox, oy, start in corners:
        for i in range(segments + 1):
            a = math.radians(start + 90 * i / segments)
            points.append((cx + ox + radius * math.cos(a), cy + oy + radius * math.sin(a)))
    return points


def add_prism(bm, outline, z0, z1):
    bottom = [bm.verts.new((x, y, z0)) for x, y in outline]
    top = [bm.verts.new((x, y, z1)) for x, y in outline]
    bm.faces.new(list(reversed(bottom)))
    bm.faces.new(top)
    count = len(outline)
    for i in range(count):
        j = (i + 1) % count
        bm.faces.new([bottom[i], bottom[j], top[j], top[i]])


def prism(name, outline, z0, z1, mat=None):
    bm = bmesh.new()
    add_prism(bm, outline, z0, z1)
    return to_object(name, bm, mat)


def boolean(obj, cutter, operation="DIFFERENCE"):
    mod = obj.modifiers.new("bool", "BOOLEAN")
    mod.operation = operation
    mod.object = cutter
    mod.solver = "MANIFOLD"
    bake(obj)
    bpy.data.objects.remove(cutter)
    return obj


def bake(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(evaluated)
    materials = list(obj.data.materials)
    obj.modifiers.clear()
    obj.data = mesh
    if not mesh.materials:
        for mat in materials:
            mesh.materials.append(mat)


def soften(obj, width=0.05, segments=3, angle=35, smooth=38):
    mod = obj.modifiers.new("bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(angle)
    mod.harden_normals = False
    mod.profile = 0.6
    bake(obj)
    smooth_shade(obj, smooth)


def smooth_shade(obj, angle=38):
    obj.data.set_sharp_from_angle(angle=math.radians(angle))


def key_cutter(name, half=0.7):
    bm = bmesh.new()
    for key in KEYS:
        add_box(bm, key["x"] - half, key["x"] + half, key["y"] - half, key["y"] + half, -5, 5)
    return to_object(name, bm)


def stab_offset(key):
    return 5.0 if key["width"] >= 6 else 1.19


def desk_z(y):
    """Underside of the case: wedge with a concave swoop toward the front."""
    front = -CASE["depth"] / 2
    line = CASE["frontBottomZ"] - (y - front) * math.tan(TILT)
    lift = max(0.0, (-1.2 - y) / (-1.2 - front)) ** 2 * 0.55
    return line + lift


# Keyboard ------------------------------------------------------------------------


def case_outline(segments=8):
    return rounded_outline(CASE["width"] / 2, CASE["depth"] / 2, CASE["cornerRadius"], segments)


def opening_cutter(z0, z1, name="opening"):
    """Key well, leaving material around the knob in the top right corner."""
    hw = KEY_AREA_W / 2 + 0.1
    hd = KEY_AREA_D / 2 + 0.1
    notch_x = LAYOUT["knob"]["x"] - PITCH / 2 + 0.04
    notch_y = LAYOUT["knob"]["y"] - PITCH / 2 + 0.04
    outline = [(-hw, -hd), (hw, -hd), (hw, notch_y), (notch_x, notch_y), (notch_x, hd), (-hw, hd)]
    return prism(name, outline, z0, z1)


def build_upper_lid(mat):
    lid = prism("upperLid", case_outline(), CASE["partingZ"], CASE["topZ"], mat)
    boolean(lid, opening_cutter(-3, 3))
    bm = bmesh.new()
    add_cylinder(bm, LAYOUT["knob"]["x"], LAYOUT["knob"]["y"], 0.42, -3, 3, 24)
    boolean(lid, to_object("knobHole", bm))
    soften(lid, 0.07, 3)
    return lid


def build_lower_lid(mat):
    outline = case_outline()
    lid = prism("lowerLid", outline, -5, CASE["partingZ"], mat)

    # Side profile, extruded across X and intersected with the plan shape.
    half = CASE["depth"] / 2 + 0.2
    samples = [(-half + 2 * half * i / 40) for i in range(41)]
    profile = [(y, desk_z(y)) for y in samples] + [(half, 1.0), (-half, 1.0)]
    bm = bmesh.new()
    left = [bm.verts.new((-20, y, z)) for y, z in profile]
    right = [bm.verts.new((20, y, z)) for y, z in profile]
    bm.faces.new(list(reversed(left)))
    bm.faces.new(right)
    count = len(profile)
    for i in range(count):
        j = (i + 1) % count
        bm.faces.new([left[i], left[j], right[j], right[i]])
    boolean(lid, to_object("profile", bm), "INTERSECT")

    wall = 0.34
    cavity = prism(
        "cavity",
        rounded_outline(CASE["width"] / 2 - wall, CASE["depth"] / 2 - wall, 0.2, 4),
        -1.12,
        1,
    )
    boolean(lid, cavity)

    # Recessed port panel on the back edge.
    bm = bmesh.new()
    back = CASE["depth"] / 2
    add_box(bm, 6.6, 15.1, back - 0.12, back + 1, -1.9, -0.72)
    boolean(lid, to_object("portRecess", bm))
    bm = bmesh.new()
    add_box(bm, 13.1, 14.2, back - 1.2, back, -1.5, -1.02)
    boolean(lid, to_object("usbPort", bm))
    bm = bmesh.new()
    add_box(bm, 7.0, 9.5, back - 0.6, back, -1.68, -0.95)
    boolean(lid, to_object("receiverSlot", bm))
    soften(lid, 0.07, 3, 32, 34)
    return lid


def build_rear_details(mat_dark, mat_case):
    back = CASE["depth"] / 2
    bm = bmesh.new()
    add_box(bm, 13.25, 14.05, back - 0.5, back - 0.16, -1.34, -1.17)  # USB-C tongue
    dark = to_object("rearDark", bm, mat_dark)

    bm = bmesh.new()
    add_box(bm, 7.15, 9.35, back - 0.34, back - 0.06, -1.58, -1.05)  # 2.4G receiver
    add_box(bm, 10.3, 11.1, back - 0.2, back - 0.04, -1.42, -1.14)  # mode switch
    add_box(bm, 11.75, 12.45, back - 0.2, back - 0.04, -1.42, -1.14)  # OS switch
    light = to_object("rearLight", bm, mat_case)
    soften(light, 0.03, 2)
    return [dark, light]


def build_plate(mat):
    half_w = KEY_AREA_W / 2 + 0.75
    half_d = KEY_AREA_D / 2 + 0.75
    plate = prism("plate", rounded_outline(half_w, half_d, 0.3, 4), -0.15, 0, mat)
    boolean(plate, key_cutter("plateCut"))

    bm = bmesh.new()
    for key in KEYS:
        if not key["stabilized"]:
            continue
        offset = stab_offset(key)
        for side in (-1, 1):
            cx = key["x"] + side * offset
            add_box(bm, cx - 0.36, cx + 0.36, key["y"] - 0.62, key["y"] + 0.72, -1, 1)
    boolean(plate, to_object("stabCut", bm))

    bm = bmesh.new()
    add_box(
        bm,
        LAYOUT["indicator"]["x"] - 0.4,
        LAYOUT["indicator"]["x"] + 0.4,
        LAYOUT["indicator"]["y"] - 0.86,
        LAYOUT["indicator"]["y"] + 0.86,
        -1,
        1,
    )
    boolean(plate, to_object("indicatorCut", bm))
    return plate


def build_foam(name, z0, z1, mat, holes=True):
    half_w = KEY_AREA_W / 2 + 0.68
    half_d = KEY_AREA_D / 2 + 0.68
    foam = prism(name, rounded_outline(half_w, half_d, 0.3, 3), z0, z1, mat)
    if holes:
        boolean(foam, key_cutter(f"{name}Cut", 0.76))
    return foam


def build_pcb(mat, mat_gold):
    half_w = KEY_AREA_W / 2 + 0.68
    half_d = KEY_AREA_D / 2 + 0.68
    pcb = prism("pcb", rounded_outline(half_w, half_d, 0.3, 3), -0.66, -0.5, mat)
    bm = bmesh.new()
    for key in KEYS:
        add_cylinder(bm, key["x"], key["y"], 0.2, -2, 2, 8)
    boolean(pcb, to_object("pcbCut", bm))
    return pcb


def build_stabilizers(mat, mat_wire):
    bm = bmesh.new()
    for key in KEYS:
        if not key["stabilized"]:
            continue
        offset = stab_offset(key)
        for side in (-1, 1):
            cx = key["x"] + side * offset
            add_box(bm, cx - 0.33, cx + 0.33, key["y"] - 0.58, key["y"] + 0.68, -0.42, 0.34)
            add_box(bm, cx - 0.17, cx + 0.17, key["y"] - 0.2, key["y"] + 0.2, 0.34, 0.86)
    housing = to_object("stabilizers", bm, mat)
    soften(housing, 0.03, 1, 40)

    bm = bmesh.new()
    for key in KEYS:
        if not key["stabilized"]:
            continue
        offset = stab_offset(key)
        add_box(
            bm,
            key["x"] - offset,
            key["x"] + offset,
            key["y"] + 0.62,
            key["y"] + 0.68,
            -0.26,
            -0.2,
        )
    wires = to_object("stabilizerWires", bm, mat_wire)
    return [housing, wires]


def build_screws(mat):
    points = [
        (-12.5, 2.0),
        (-12.5, -2.9),
        (12.4, 2.05),
        (12.4, -2.9),
        (-1.0, -3.8),
        (0.9, 2.86),
    ]
    bm = bmesh.new()
    for x, y in points:
        add_cylinder(bm, x, y, 0.2, 0.0, 0.1, 12)
        add_cylinder(bm, x, y, 0.1, -0.9, 0.0, 8)
    screws = to_object("screws", bm, mat)
    smooth_shade(screws, 30)
    return screws


def build_indicator(mat_body, mat_light):
    x, y = LAYOUT["indicator"]["x"], LAYOUT["indicator"]["y"]
    bm = bmesh.new()
    add_box(bm, x - 0.36, x + 0.36, y - 0.82, y + 0.82, -0.3, 0.42)
    body = to_object("ledIndicator", bm, mat_body)
    soften(body, 0.04, 2)
    bm = bmesh.new()
    add_cylinder(bm, x, y + 0.42, 0.07, 0.42, 0.43, 10)
    add_cylinder(bm, x, y - 0.42, 0.07, 0.42, 0.43, 10)
    return [body, to_object("ledIndicatorLights", bm, mat_light)]


def build_knob(mat):
    x, y = LAYOUT["knob"]["x"], LAYOUT["knob"]["y"]
    bm = bmesh.new()
    add_cylinder(bm, 0, 0, 0.85, CASE["topZ"] + 0.06, CASE["topZ"] + 1.06, 56)
    add_cylinder(bm, 0, 0, 0.34, -0.3, CASE["topZ"] + 0.06, 16)
    knob = to_object("knob", bm, mat)
    soften(knob, 0.09, 4, 40)
    # The origin sits on the rotation axis so the app can spin it.
    knob.location = (x, y, 0)
    return knob


def build_gaskets(mat):
    bm = bmesh.new()
    half_w = CASE["width"] / 2 - 0.34
    half_d = CASE["depth"] / 2 - 0.34
    for i in range(5):
        x = -13 + i * 6.5
        add_box(bm, x - 1.1, x + 1.1, half_d - 0.14, half_d, -0.82, -0.16)
        add_box(bm, x - 1.1, x + 1.1, -half_d, -half_d + 0.14, -0.82, -0.16)
    for y in (-3, 3):
        add_box(bm, half_w - 0.14, half_w, y - 1, y + 1, -0.82, -0.16)
        add_box(bm, -half_w, -half_w + 0.14, y - 1, y + 1, -0.82, -0.16)
    return to_object("gasketStrips", bm, mat)


def build_feet(mat):
    bm = bmesh.new()
    for x in (-13.5, 13.5):
        z = desk_z(4.6)
        add_box(bm, x - 1.4, x + 1.4, 3.9, 5.3, z - 0.04, z + 0.2)
    z = desk_z(-0.9)
    add_box(bm, -14.5, 14.5, -1.1, -0.7, z - 0.04, z + 0.2)
    feet = to_object("feet", bm, mat)
    return feet


def build_shadow_plane(mat):
    """Lies on the desk in the world frame. The app must not tilt it."""
    half_w = CASE["width"] / 2 + 8
    half_d = CASE["depth"] / 2 + 8
    mesh = bpy.data.meshes.new("shadowPlane")
    bm = bmesh.new()
    verts = [
        bm.verts.new(p)
        for p in ((-half_w, -half_d, 0), (half_w, -half_d, 0), (half_w, half_d, 0), (-half_w, half_d, 0))
    ]
    face = bm.faces.new(verts)
    uv = bm.loops.layers.uv.new("UVMap")
    for loop, coord in zip(face.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop[uv].uv = coord
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("shadowPlane", mesh)
    bpy.context.scene.collection.objects.link(obj)
    mesh.materials.append(mat)
    return obj


def build_keyboard():
    clear_scene()
    white = material("case", (0.88, 0.88, 0.87), 0.1, 0.42)
    lower = material("caseLower", (0.88, 0.88, 0.87), 0.1, 0.42)
    plate = material("plate", (0.8, 0.84, 0.86), 0, 0.5)
    foam = material("foam", (0.018, 0.018, 0.02), 0, 0.95)
    pcb = material("pcb", (0.02, 0.022, 0.025), 0.2, 0.32)
    teal = material("stabilizer", (0.16, 0.56, 0.5), 0, 0.2)
    wire = material("wire", (0.7, 0.7, 0.7), 1, 0.3)
    brass = material("brass", (0.86, 0.6, 0.2), 1, 0.25)
    dark = material("dark", (0.012, 0.012, 0.014), 0.2, 0.3)
    led = material("led", (0.85, 0.9, 1), 0, 0.3)
    rubber = material("rubber", (0.02, 0.02, 0.02), 0, 0.8)
    shadow = material("shadow", (0, 0, 0), 0, 1)

    parts = [
        build_upper_lid(white),
        build_lower_lid(lower),
        build_plate(plate),
        build_foam("plateFoam", -0.35, -0.15, foam),
        build_foam("pcbFoam", -0.5, -0.35, foam),
        build_pcb(pcb, brass),
        build_foam("foamBase", -1.0, -0.72, foam, holes=False),
        build_screws(brass),
        build_gaskets(foam),
        build_feet(rubber),
        build_knob(material("knob", (0.9, 0.9, 0.9), 0.9, 0.3)),
        build_shadow_plane(shadow),
    ]
    parts += build_stabilizers(teal, wire)
    parts += build_indicator(dark, led)
    parts += build_rear_details(dark, lower)
    for part in parts:
        if part.name != "shadowPlane":
            assert part.data.polygons, part.name
    return parts


# Keycaps -------------------------------------------------------------------------

PROFILES = {
    # height per sculpt row, top tilt per row in degrees, top size, dish depth, spherical?
    "cherry": dict(
        heights={1: 1.02, 2: 0.86, 3: 0.82, 4: 0.9},
        tilts={1: 9, 2: 4, 3: 0, 4: -7},
        top=1.27,
        dish=0.05,
        spherical=False,
        wall_curve=0.12,
        rim=0.05,
    ),
    "sa": dict(
        heights={1: 1.46, 2: 1.28, 3: 1.2, 4: 1.28},
        tilts={1: 12, 2: 6, 3: 0, 4: -8},
        top=1.22,
        dish=0.09,
        spherical=True,
        wall_curve=0.05,
        rim=0.13,
    ),
    "xda": dict(
        heights={1: 0.92, 2: 0.92, 3: 0.92, 4: 0.92},
        tilts={1: 0, 2: 0, 3: 0, 4: 0},
        top=1.52,
        dish=0.05,
        spherical=True,
        wall_curve=0.02,
        rim=0.09,
    ),
}


def build_keycap(name, width, row, homing, profile):
    """Lofts a keycap as rings of a rounded rectangle, from skirt to dish centre."""
    p = PROFILES[profile]
    height = p["heights"][row]
    tilt = math.tan(math.radians(p["tilts"][row]))
    base_hw = width * PITCH / 2 - 0.045
    base_hd = PITCH / 2 - 0.045
    inset = (1.8 - p["top"]) / 2
    top_hw = base_hw - inset
    top_hd = base_hd - inset
    rim = p["rim"]

    def surface(x, y):
        nx = min(abs(x) / top_hw, 1)
        ny = min(abs(y) / top_hd, 1)
        depth = 1 - nx * nx if not p["spherical"] else 1 - min(nx * nx + ny * ny, 1)
        if not p["spherical"] and width > 1:
            depth = 1 - min(abs(x) / (top_hw + 0.2), 1) ** 6
        return height + tilt * y - p["dish"] * depth

    bm = bmesh.new()
    rings = []

    def ring(hw, hd, radius, z_of):
        pts = rounded_outline(hw, hd, radius, 5)
        rings.append([bm.verts.new((x, y, z_of(x, y))) for x, y in pts])

    # Inside cavity, then the bottom lip.
    wall = 0.13
    cavity_top = height * 0.62
    ring(base_hw * 0.1, base_hd * 0.1, 0.04, lambda x, y: cavity_top)
    ring(base_hw - wall - inset, base_hd - wall - inset, 0.1, lambda x, y: cavity_top)
    ring(base_hw - wall, base_hd - wall, 0.1, lambda x, y: 0.0)
    ring(base_hw, base_hd, 0.12, lambda x, y: 0.0)

    # Outer wall with a gentle belly.
    steps = 6
    for i in range(1, steps + 1):
        t = i / steps
        k = t + p["wall_curve"] * math.sin(t * math.pi)
        hw = base_hw - inset * k
        hd = base_hd - inset * k
        corner = 0.12 + (0.2 - 0.12) * t

        def wall_z(x, y, t=t):
            edge = surface(math.copysign(top_hw, x) * min(abs(x) / max(hw, 1e-6), 1), y)
            return (edge - rim) * t

        ring(hw, hd, corner, wall_z)

    # Rounded shoulder into the top surface.
    for i in range(1, 5):
        a = i / 4 * math.pi / 2
        inward = rim * (1 - math.cos(a))
        rise = rim * math.sin(a)

        def shoulder(x, y, rise=rise):
            return surface(x, y) - rim + rise

        ring(top_hw - inward, top_hd - inward, 0.2, shoulder)

    # The dish, stepping in to the centre.
    for scale in (0.8, 0.55, 0.3, 0.1):
        hw = (top_hw - rim) * scale
        hd = (top_hd - rim) * scale
        ring(hw, hd, max(0.2 * scale, 0.02), surface)

    for a, b in zip(rings, rings[1:]):
        count = len(a)
        for i in range(count):
            j = (i + 1) % count
            bm.faces.new([a[i], a[j], b[j], b[i]])
    # Fans closing both ends.
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])

    # Cross stem socket.
    add_box(bm, -0.28, 0.28, -0.28, 0.28, 0.08, cavity_top + 0.01)

    if homing:
        add_box(bm, -0.26, 0.26, -0.48, -0.42, surface(0, -0.45) - 0.03, surface(0, -0.45) + 0.03)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = to_object(name, bm, material("keycap", (0.92, 0.92, 0.9), 0, 0.5))
    smooth_shade(obj, 50)
    return obj


def keycap_shapes():
    shapes = {}
    for key in KEYS:
        row = min(key["row"] + 1, 4)
        name = f"w{round(key['width'] * 100)}_r{row}{'_h' if key['homing'] else ''}"
        shapes[name] = (key["width"], row, key["homing"])
    return shapes


def build_keycaps(profile):
    clear_scene()
    return [
        build_keycap(name, width, row, homing, profile)
        for name, (width, row, homing) in keycap_shapes().items()
    ]


# Switch --------------------------------------------------------------------------


def tapered_box(bm, lower, upper):
    """Loft between (half_x, half_y, z) squares."""
    rings = []
    for hx, hy, z in (lower, upper):
        rings.append(
            [
                bm.verts.new((sx * hx, sy * hy, z))
                for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))
            ]
        )
    a, b = rings
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([a[i], a[j], b[j], b[i]])


def build_switch():
    clear_scene()
    bm = bmesh.new()
    add_box(bm, -0.69, 0.69, -0.69, 0.69, -0.5, 0.0)
    add_box(bm, -0.78, 0.78, -0.78, 0.78, 0.0, 0.08)
    tapered_box(bm, (0.72, 0.72, 0.08), (0.52, 0.52, 0.52))
    add_cylinder(bm, 0, 0, 0.2, -0.82, -0.5, 10)
    add_cylinder(bm, -0.5, 0, 0.09, -0.82, -0.5, 6)
    add_cylinder(bm, 0.5, 0, 0.09, -0.82, -0.5, 6)
    housing = to_object("housing", bm, material("housing", (0.9, 0.9, 0.9), 0, 0.3))
    soften(housing, 0.025, 1, 30)

    bm = bmesh.new()
    add_box(bm, -0.29, 0.29, -0.29, 0.29, 0.3, 0.56)
    add_box(bm, -0.2, 0.2, -0.06, 0.06, 0.56, 0.9)
    add_box(bm, -0.06, 0.06, -0.2, 0.2, 0.56, 0.9)
    stem = to_object("stem", bm, material("stem", (0.8, 0.1, 0.1), 0, 0.3))
    return [housing, stem]


# Export --------------------------------------------------------------------------


def export_glb(name):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=10,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
    )
    print(f"exported {path.name}: {path.stat().st_size / 1024:.0f} KB")


# Shadow, environment and previews ------------------------------------------------


def tilt_for_desk(objects):
    """Rotates parts from the plate frame into world space, resting on the desk."""
    from mathutils import Matrix

    lift = Matrix.Translation((0, 0, -desk_z(0) * math.cos(TILT)))
    world = lift @ Matrix.Rotation(TILT, 4, "X")
    bpy.context.view_layer.update()
    for obj in objects:
        if obj.name != "shadowPlane":
            obj.matrix_world = world @ obj.matrix_world


def instance_keycaps(profile="cherry"):
    caps = build_keycaps_into_scene(profile)
    objs = []
    for key in KEYS:
        row = min(key["row"] + 1, 4)
        name = f"w{round(key['width'] * 100)}_r{row}{'_h' if key['homing'] else ''}"
        obj = bpy.data.objects.new(f"cap_{key['code']}", caps[name].data)
        bpy.context.scene.collection.objects.link(obj)
        obj.location = (key["x"], key["y"], 0.66)
        objs.append(obj)
    for cap in caps.values():
        cap.hide_render = True
        cap.hide_viewport = True
    return objs


def build_keycaps_into_scene(profile):
    return {
        name: build_keycap(f"src_{name}", width, row, homing, profile)
        for name, (width, row, homing) in keycap_shapes().items()
    }


def setup_cycles(samples, width, height):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 4
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for backend in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = backend
            prefs.get_devices()
            if any(d.type == backend for d in prefs.devices):
                for device in prefs.devices:
                    device.use = device.type == backend
                scene.cycles.device = "GPU"
                break
        except TypeError:
            continue


def uniform_world(value):
    world = bpy.data.worlds.new("world")
    world.use_nodes = True
    next(n for n in world.node_tree.nodes if n.type == "BACKGROUND").inputs[
        "Color"
    ].default_value = (value, value, value, 1)
    bpy.context.scene.world = world


def bake_shadow():
    """Top-down render of the shadow the keyboard casts on a white desk."""
    parts = build_keyboard()
    caps = instance_keycaps()
    tilt_for_desk(parts + caps)
    plane = next(p for p in parts if p.name == "shadowPlane")
    plane.data.materials.clear()
    plane.data.materials.append(material("desk", (1, 1, 1), 0, 1))
    for obj in bpy.context.scene.objects:
        if obj is not plane:
            obj.visible_camera = False
    uniform_world(1.0)

    half_w = CASE["width"] / 2 + 8
    half_d = CASE["depth"] / 2 + 8
    cam_data = bpy.data.cameras.new("shadowCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = half_w * 2
    cam = bpy.data.objects.new("shadowCam", cam_data)
    cam.location = (0, 0, 40)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam

    setup_cycles(96, 1024, round(1024 * half_d / half_w))
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 80
    scene.render.filepath = str(OUT / "shadow.webp")
    OUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)


def bake_environment():
    """Paints a soft studio into a 1024x512 equirectangular image."""
    width, height = 1024, 512

    def softbox(u, v, cu, cv, su, sv, power):
        du = min(abs(u - cu), 1 - abs(u - cu)) / su
        dv = (v - cv) / sv
        return power * math.exp(-(du**4 + dv**4))

    pixels = [0.0] * (width * height * 4)
    for y in range(height):
        v = y / (height - 1)
        ground = 0.34 + 0.2 * v
        sky = 0.62 + 0.34 * v
        blend = min(max((v - 0.44) / 0.12, 0), 1)
        for x in range(width):
            u = x / (width - 1)
            value = ground * (1 - blend) + sky * blend
            value += softbox(u, v, 0.25, 0.86, 0.2, 0.1, 0.5)
            value += softbox(u, v, 0.75, 0.74, 0.1, 0.16, 0.42)
            value -= softbox(u, v, 0.5, 0.6, 0.05, 0.2, 0.3)
            value = min(max(value, 0), 1)
            i = (y * width + x) * 4
            pixels[i : i + 4] = (value, value, value * 1.01, 1)
    image = bpy.data.images.new("environment", width, height)
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(OUT / "environment.webp")
    image.file_format = "WEBP"
    image.save()


def preview():
    PREVIEW.mkdir(parents=True, exist_ok=True)
    parts = build_keyboard()
    caps = instance_keycaps()
    for obj in parts:
        if obj.name == "shadowPlane":
            obj.hide_render = True
    tilt_for_desk(parts + caps)
    bpy.ops.mesh.primitive_plane_add(size=300)
    bpy.context.object.data.materials.append(material("floor", (0.9, 0.9, 0.9), 0, 0.7))
    uniform_world(1.0)

    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 135
    cam_data.sensor_width = 36
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    setup_cycles(32, 1280, 720)

    def shoot(name, location, target=(0, 0, 1.5), hide_caps=False):
        cam.location = location
        direction = Vector(target) - cam.location
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        for cap in caps:
            cap.hide_render = hide_caps
        bpy.context.scene.render.filepath = str(PREVIEW / f"{name}.png")
        bpy.ops.render.render(write_still=True)

    shoot("front", (0, -95, 62))
    shoot("three-quarter", (-55, -75, 42))
    shoot("top", (0, -2, 110))
    shoot("bare", (0, -2, 110), hide_caps=True)
    shoot("back", (25, 90, 22))
    shoot("side", (110, 0, 4))


TASKS = {
    "keyboard": lambda: (build_keyboard(), export_glb("gmk67")),
    "switch": lambda: (build_switch(), export_glb("switch")),
    "keycaps": lambda: [(build_keycaps(p), export_glb(f"keycaps-{p}")) for p in PROFILES],
    "environment": bake_environment,
    "shadow": bake_shadow,
    "preview": preview,
}

DEFAULT = ("keyboard", "switch", "keycaps", "environment", "shadow")


def main():
    wanted = ONLY or DEFAULT
    unknown = set(wanted) - set(TASKS)
    if unknown:
        sys.exit(f"Unknown task: {', '.join(sorted(unknown))}")
    for name in TASKS:
        if name in wanted:
            print(f"--- {name}")
            TASKS[name]()


main()
