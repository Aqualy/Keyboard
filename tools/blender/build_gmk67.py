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
LAYOUTS_DIR = ROOT / "src/data/layouts"
LAYOUT_ID = os.environ.get("GMK_LAYOUT") or "65-ansi"
LAYOUT = json.loads((LAYOUTS_DIR / f"{LAYOUT_ID}.json").read_text(encoding="utf-8"))
OUT = ROOT / "public/models"
PREVIEW = ROOT / "tools/blender/preview"
ONLY = set(filter(None, os.environ.get("GMK_ONLY", "").split(",")))

PITCH = LAYOUT["pitch"]
CASE = LAYOUT["case"]
KEYS = LAYOUT["keys"]
TILT = math.radians(CASE["tiltDegrees"])
KEY_AREA_W = LAYOUT["columns"] * PITCH
KEY_AREA_D = LAYOUT["rows"] * PITCH

# Ports and feet were placed on the 65% case. Larger cases keep them the same distance from
# their nearest edges.
PORT_SHIFT = 16.25 - CASE["width"] / 2  # added to x: negative moves left
SEAM_START = CASE["seamStartY"]
SEAM_END = CASE["seamEndY"]
UPPER_WALL = 0.34
LOWER_STEP = 0.03
TRAY_INSET = 0.5
PORT_RECESS = 0.14
USB_DEPTH = 0.2


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


def merge_flat_faces(obj):
    """Boolean cuts leave sliver triangles whose stray normals streak across flat walls."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bmesh.ops.dissolve_degenerate(bm, dist=0.0005, edges=bm.edges)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1), verts=bm.verts, edges=bm.edges)
    bm.to_mesh(obj.data)
    bm.free()


def assert_outward(obj):
    """Browsers hide back faces, so an inside-out part vanishes there but not in Blender."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    volume = bm.calc_volume(signed=True)
    bm.free()
    if volume <= 0:
        raise RuntimeError(f"{obj.name} is inside out (volume {volume:.2f})")


def flatten_large_faces(obj):
    """Stops big flat panels picking up shading from the small bevels around them."""
    mod = obj.modifiers.new("weighted", "WEIGHTED_NORMAL")
    mod.mode = "FACE_AREA"
    mod.weight = 100
    mod.keep_sharp = True
    bake(obj)


def key_cutter(name, half=0.7):
    bm = bmesh.new()
    for key in KEYS:
        add_box(bm, key["x"] - half, key["x"] + half, key["y"] - half, key["y"] + half, -5, 5)
    return to_object(name, bm)


def stab_offset(key):
    return 5.0 if key["width"] >= 6 else 1.19


def desk_z(y):
    """Underside of the case, a straight wedge resting on the desk."""
    return CASE["frontBottomZ"] - (y + CASE["depth"] / 2) * math.tan(TILT)


def rear_wall():
    """Y of the lower lid's back wall, which sits just inside the upper lid."""
    return CASE["depth"] / 2 - LOWER_STEP


def seam_z(y):
    """The S-curve between the lids. The upper lid wraps the front down to the desk."""
    t = min(max((y - SEAM_START) / (SEAM_END - SEAM_START), 0.0), 1.0)
    ease = t * t * t * (t * (6 * t - 15) + 10)
    return desk_z(y) + (CASE["partingZ"] - desk_z(y)) * ease


def extruded_profile(name, profile):
    """Extrudes a (y, z) polygon across the whole width of the board."""
    bm = bmesh.new()
    left = [bm.verts.new((-20, y, z)) for y, z in profile]
    right = [bm.verts.new((20, y, z)) for y, z in profile]
    bm.faces.new(list(reversed(left)))
    bm.faces.new(right)
    count = len(profile)
    for i in range(count):
        j = (i + 1) % count
        bm.faces.new([left[i], left[j], right[j], right[i]])
    # The polygon can arrive in either direction, and an inverted cutter inverts the result.
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return to_object(name, bm)


# Keyboard ------------------------------------------------------------------------


def case_outline(segments=10, inset=0.0):
    return rounded_outline(
        CASE["width"] / 2 - inset,
        CASE["depth"] / 2 - inset,
        CASE["cornerRadius"] - inset,
        segments,
    )


def opening_cutter(z0, z1, name="opening"):
    """Key well, leaving a raised pad under the knob in the top right corner, and a tab of the
    case reaching in from the front wall to carry the LED indicator."""
    hw = KEY_AREA_W / 2 + 0.1
    hd = KEY_AREA_D / 2 + 0.1
    # The pad is the knob's own key slot, from its left and front edges to the case's corner.
    notch_x = LAYOUT["knob"]["x"] - PITCH / 2 + LAYOUT["knob"]["wellMargin"]
    notch_y = LAYOUT["knob"]["y"] - PITCH / 2 + LAYOUT["knob"]["wellMargin"]
    front = [(-hw, -hd)]
    indicator = LAYOUT["indicator"]
    if indicator:
        x0 = indicator["x"] - indicator["width"] / 2
        x1 = indicator["x"] + indicator["width"] / 2
        y1 = indicator["y"] + indicator["depth"] / 2
        front += [(x0, -hd), (x0, y1), (x1, y1), (x1, -hd)]
    outline = front + [(hw, -hd), (hw, notch_y), (notch_x, notch_y), (notch_x, hd), (-hw, hd)]
    return prism(name, outline, z0, z1)


def key_strips():
    """The key well as rows of touching keys, each row one strip with a little clearance.
    Gaps between key groups stay solid case, as on a real 75% or TKL top case."""
    u = PITCH
    cells = []
    for key in KEYS:
        x, y = key["x"], key["y"]
        if key.get("shape") == "isoEnter":
            # The L spans two rows: wide on top, narrower below, the switch on the line between.
            cells.append((x - 0.875 * u, x + 0.625 * u, y + u / 2))
            cells.append((x - 0.625 * u, x + 0.625 * u, y - u / 2))
        else:
            half = key["width"] * u / 2
            cells.append((x - half, x + half, y))
    rows = {}
    for x0, x1, y in cells:
        rows.setdefault(round(y, 3), []).append((x0, x1))
    strips = []
    for y, spans in rows.items():
        spans.sort()
        start, end = spans[0]
        for x0, x1 in spans[1:]:
            if x0 <= end + 1e-3:
                end = max(end, x1)
            else:
                strips.append((start, end, y))
                start, end = x0, x1
        strips.append((start, end, y))
    margin = 0.1
    return [(x0 - margin, x1 + margin, y - u / 2 - margin, y + u / 2 + margin) for x0, x1, y in strips]


def build_upper_lid(mat):
    lid = prism("upperLid", case_outline(), -6, CASE["topZ"], mat)
    soften(lid, 0.2, 6, 35, 34)

    half = CASE["depth"] / 2 + 0.2
    samples = [-half + 2 * half * i / 60 for i in range(61)]
    profile = [(y, seam_z(y)) for y in samples] + [(half, 2.0), (-half, 2.0)]
    boolean(lid, extruded_profile("upperProfile", profile), "INTERSECT")

    if LAYOUT["size"] == "65":
        boolean(lid, opening_cutter(-3, 3))
    else:
        for i, (x0, x1, y0, y1) in enumerate(key_strips()):
            bm = bmesh.new()
            add_box(bm, x0, x1, y0, y1, -3, 3)
            boolean(lid, to_object(f"keyStrip{i}", bm))
    boolean(lid, prism("upperHollow", case_outline(4, UPPER_WALL), -6, 0))
    bm = bmesh.new()
    add_cylinder(bm, LAYOUT["knob"]["x"], LAYOUT["knob"]["y"], 0.42, -3, 3, 24)
    boolean(lid, to_object("knobHole", bm))
    soften(lid, 0.035, 2, 40, 34)
    flatten_large_faces(lid)
    assert_outward(lid)
    return lid


def build_lower_lid(mat):
    half = CASE["depth"] / 2 + 0.2

    # The visible wedge, sitting just inside the upper lid behind the seam.
    lid = prism("lowerLid", case_outline(10, LOWER_STEP), -6, 2, mat)
    samples = [SEAM_START + (half - SEAM_START) * i / 40 for i in range(41)]
    # Overlaps the upper lid slightly, so no crack shows along the seam.
    top = [(y, seam_z(y) + 0.02) for y in samples]
    bottom = [(y, desk_z(y)) for y in reversed(samples)]
    boolean(lid, extruded_profile("wedge", bottom + top), "INTERSECT")

    # The tray that carries the stack, hidden inside the upper lid at the front.
    tray = prism("tray", case_outline(4, UPPER_WALL + 0.02), -6, CASE["partingZ"], mat)
    samples = [-half + 2 * half * i / 8 for i in range(9)]
    floor = [(y, desk_z(y)) for y in samples] + [(half, 1.0), (-half, 1.0)]
    boolean(tray, extruded_profile("trayFloor", floor), "INTERSECT")
    boolean(lid, tray, "UNION")

    boolean(lid, prism("cavity", case_outline(4, TRAY_INSET), -1.12, 1))

    # Recessed port panel on the back wall, toward the keyboard's left.
    wall = rear_wall()
    bm = bmesh.new()
    add_box(bm, -15.1 + PORT_SHIFT, -6.2 + PORT_SHIFT, wall - PORT_RECESS, wall + 1, -1.86, -0.72)
    boolean(lid, to_object("portRecess", bm))
    # A shallow pocket, so the opening never reaches the hollow inside of the case.
    bm = bmesh.new()
    add_box(
        bm, -14.25 + PORT_SHIFT, -13.15 + PORT_SHIFT, wall - PORT_RECESS - USB_DEPTH, wall, -1.48, -1.02
    )
    boolean(lid, to_object("usbPort", bm))

    # No bevel here. Its small faces would smear shading across these large flat walls.
    merge_flat_faces(lid)
    smooth_shade(lid, 30)
    assert_outward(lid)
    return lid


def build_rear_details(mat_dark, mat_case):
    panel = rear_wall() - PORT_RECESS
    bm = bmesh.new()
    o = PORT_SHIFT
    add_box(bm, -14.25 + o, -13.15 + o, panel - USB_DEPTH, panel - USB_DEPTH + 0.01, -1.48, -1.02)  # USB back
    add_box(bm, -14.0 + o, -13.4 + o, panel - USB_DEPTH, panel - 0.05, -1.31, -1.19)  # USB-C tongue
    dark = to_object("rearDark", bm, mat_dark)

    bm = bmesh.new()
    add_box(bm, -8.85 + o, -6.75 + o, panel - 0.02, panel + 0.07, -1.56, -1.05)  # 2.4G receiver
    add_box(bm, -11.0 + o, -10.2 + o, panel - 0.1, panel + 0.05, -1.42, -1.14)  # mode switch
    add_box(bm, -12.5 + o, -11.8 + o, panel - 0.1, panel + 0.05, -1.42, -1.14)  # OS switch
    light = to_object("rearLight", bm, mat_case)
    soften(light, 0.03, 2)
    return [dark, light]


def build_plate(mat):
    half_w = KEY_AREA_W / 2 + 0.6
    half_d = KEY_AREA_D / 2 + 0.6
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

    if not LAYOUT["indicator"]:
        return plate
    bm = bmesh.new()
    add_box(
        bm,
        LAYOUT["indicator"]["x"] - LAYOUT["indicator"]["width"] / 2 - 0.03,
        LAYOUT["indicator"]["x"] + LAYOUT["indicator"]["width"] / 2 + 0.03,
        LAYOUT["indicator"]["y"] - LAYOUT["indicator"]["depth"] / 2 - 0.03,
        LAYOUT["indicator"]["y"] + LAYOUT["indicator"]["depth"] / 2 + 0.03,
        -1,
        1,
    )
    boolean(plate, to_object("indicatorCut", bm))
    return plate


def build_foam(name, z0, z1, mat, holes=True):
    half_w = KEY_AREA_W / 2 + 0.45
    half_d = KEY_AREA_D / 2 + 0.45
    foam = prism(name, rounded_outline(half_w, half_d, 0.3, 3), z0, z1, mat)
    if holes:
        boolean(foam, key_cutter(f"{name}Cut", 0.76))
    return foam


def build_pcb(mat, mat_gold):
    half_w = KEY_AREA_W / 2 + 0.45
    half_d = KEY_AREA_D / 2 + 0.45
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
            # The stems stay still when a key is pressed, so they stop at the switch stem's
            # shoulder and never reach the top of a pressed cap.
            add_box(bm, cx - 0.17, cx + 0.17, key["y"] - 0.2, key["y"] + 0.2, 0.34, 0.56)
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
    points = LAYOUT["screws"]
    bm = bmesh.new()
    for x, y in points:
        add_cylinder(bm, x, y, 0.2, 0.0, 0.1, 12)
        add_cylinder(bm, x, y, 0.1, -0.9, 0.0, 8)
    screws = to_object("screws", bm, mat)
    smooth_shade(screws, 30)
    return screws


def build_indicator(mat_body, mat_face, mat_light):
    """The indicator's face and lights, set into the case tab beside the arrow keys. The body
    fills the space under the tab, down to the plate, out of sight."""
    if not LAYOUT["indicator"]:
        return []
    x, y = LAYOUT["indicator"]["x"], LAYOUT["indicator"]["y"]
    hw = LAYOUT["indicator"]["width"] / 2
    hd = LAYOUT["indicator"]["depth"] / 2
    top = CASE["topZ"]
    bm = bmesh.new()
    add_box(bm, x - hw + 0.02, x + hw - 0.02, y - hd + 0.02, y + hd - 0.02, -0.3, 0.0)
    body = to_object("ledIndicator", bm, mat_body)

    bm = bmesh.new()
    add_box(bm, x - hw + 0.09, x + hw - 0.09, y - hd + 0.09, y + hd - 0.09, top - 0.02, top + 0.012)
    face = to_object("ledIndicatorFace", bm, mat_face)

    bm = bmesh.new()
    add_cylinder(bm, x, y + 0.42, 0.055, top + 0.012, top + 0.02, 10)
    add_cylinder(bm, x, y - 0.42, 0.055, top + 0.012, top + 0.02, 10)
    return [body, face, to_object("ledIndicatorLights", bm, mat_light)]


def build_knob(mat):
    x, y = LAYOUT["knob"]["x"], LAYOUT["knob"]["y"]
    bm = bmesh.new()
    add_cylinder(bm, 0, 0, LAYOUT["knob"]["radius"], CASE["topZ"] + 0.05, CASE["topZ"] + 1.16, 64)
    add_cylinder(bm, 0, 0, 0.34, -0.3, CASE["topZ"] + 0.05, 16)
    knob = to_object("knob", bm, mat)
    soften(knob, 0.09, 4, 40)
    # The origin sits on the rotation axis so the app can spin it.
    knob.location = (x, y, 0)
    return knob


def build_gaskets(mat):
    bm = bmesh.new()
    half_w = CASE["width"] / 2 - TRAY_INSET
    half_d = CASE["depth"] / 2 - TRAY_INSET
    count = round(CASE["width"] / 6.5)
    spread = CASE["width"] / 2 - 3.25
    for i in range(count):
        x = -spread + i * 2 * spread / (count - 1)
        add_box(bm, x - 1.1, x + 1.1, half_d - 0.1, half_d, -0.82, -0.3)
        add_box(bm, x - 1.1, x + 1.1, -half_d, -half_d + 0.1, -0.82, -0.3)
    side = CASE["depth"] / 2 - 2.825
    for y in (-side, side):
        add_box(bm, half_w - 0.1, half_w, y - 1, y + 1, -0.82, -0.3)
        add_box(bm, -half_w, -half_w + 0.1, y - 1, y + 1, -0.82, -0.3)
    return to_object("gasketStrips", bm, mat)


def build_feet(mat):
    bm = bmesh.new()
    hw = CASE["width"] / 2 - 2.75
    hd = CASE["depth"] / 2
    for x in (-hw, hw):
        z = desk_z(hd - 1.225)
        add_box(bm, x - 1.4, x + 1.4, hd - 1.925, hd - 0.525, z - 0.02, z + 0.2)
    z = desk_z(-hd + 1.425)
    for x in (-hw, hw):
        add_box(bm, x - 1.4, x + 1.4, -hd + 1.025, -hd + 1.825, z - 0.02, z + 0.2)
    return to_object("feet", bm, mat)


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
    parts += build_indicator(lower, material("indicatorFace", (0.62, 0.64, 0.66), 0.7, 0.32), led)
    parts += build_rear_details(dark, lower)
    for part in parts:
        if part.name != "shadowPlane":
            assert part.data.polygons, part.name
    return parts


# Keycaps -------------------------------------------------------------------------

# Half the gap between neighbouring caps at the skirt, so caps sit 0.6 mm apart.
CAP_CLEARANCE = 0.03

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


def rounded_polygon(points, radii, segments=5):
    """Rounds each corner of a right-angled polygon. Works for inner (concave) corners too."""
    out = []
    count = len(points)
    for i, (vx, vy) in enumerate(points):
        px, py = points[i - 1]
        nx, ny = points[(i + 1) % count]
        u1 = ((px - vx), (py - vy))
        u2 = ((nx - vx), (ny - vy))
        l1 = math.hypot(*u1)
        l2 = math.hypot(*u2)
        u1 = (u1[0] / l1, u1[1] / l1)
        u2 = (u2[0] / l2, u2[1] / l2)
        r = min(radii[i], 0.45 * l1, 0.45 * l2)
        cx = vx + r * (u1[0] + u2[0])
        cy = vy + r * (u1[1] + u2[1])
        for k in range(segments + 1):
            a = k / segments * math.pi / 2
            out.append(
                (
                    cx - r * (math.cos(a) * u2[0] + math.sin(a) * u1[0]),
                    cy - r * (math.cos(a) * u2[1] + math.sin(a) * u1[1]),
                )
            )
    return out


def iso_enter_outline(d, scale, radius):
    """The L of an ISO Enter, inset by d, with the switch at the origin."""
    u = PITCH
    g = CAP_CLEARANCE + d
    points = [
        (-0.875 * u + g, u - g),
        (0.625 * u - g, u - g),
        (0.625 * u - g, -u + g),
        (-0.625 * u + g, -u + g),
        (-0.625 * u + g, g),
        (-0.875 * u + g, g),
    ]
    centre = (-0.125 * u, 0.25 * u)
    points = [(centre[0] + (x - centre[0]) * scale, centre[1] + (y - centre[1]) * scale) for x, y in points]
    # The inside corner gets a small fillet; the outside ones the usual rounding.
    radii = [radius, radius, radius, radius, min(radius, 0.06), radius]
    return rounded_polygon(points, radii)


def build_keycap(name, width, row, homing, profile, iso=False):
    """Lofts a keycap as rings of its outline, from skirt to dish centre."""
    p = PROFILES[profile]
    height = p["heights"][row]
    tilt = math.tan(math.radians(p["tilts"][row]))
    inset = (1.8 - p["top"]) / 2
    rim = p["rim"]
    if iso:
        # The top's dish runs across the wide upper part.
        centre_x = -0.125 * PITCH
        top_hw = 0.75 * PITCH - CAP_CLEARANCE - inset
        top_hd = PITCH - CAP_CLEARANCE - inset
    else:
        centre_x = 0.0
        base_hw = width * PITCH / 2 - CAP_CLEARANCE
        base_hd = PITCH / 2 - CAP_CLEARANCE
        top_hw = base_hw - inset
        top_hd = base_hd - inset

    def outline(d, scale, radius):
        if iso:
            return iso_enter_outline(d, scale, radius)
        return rounded_outline((base_hw - d) * scale, (base_hd - d) * scale, radius, 5)

    def surface(x, y):
        x = x - centre_x
        nx = min(abs(x) / top_hw, 1)
        ny = min(abs(y) / top_hd, 1)
        depth = 1 - nx * nx if not p["spherical"] else 1 - min(nx * nx + ny * ny, 1)
        if not p["spherical"] and (width > 1 or iso):
            depth = 1 - min(abs(x) / (top_hw + 0.2), 1) ** 6
        return height + tilt * y - p["dish"] * depth

    bm = bmesh.new()
    rings = []

    def ring(d, scale, radius, z_of):
        rings.append([bm.verts.new((x, y, z_of(x, y))) for x, y in outline(d, scale, radius)])

    # Inside cavity, then the bottom lip.
    wall = 0.13
    cavity_top = height * 0.62
    ring(0, 0.1, 0.04, lambda x, y: cavity_top)
    ring(wall + inset, 1, 0.1, lambda x, y: cavity_top)
    ring(wall, 1, 0.1, lambda x, y: 0.0)
    ring(0, 1, 0.12, lambda x, y: 0.0)

    # Outer wall with a gentle belly.
    steps = 6
    for i in range(1, steps + 1):
        t = i / steps
        k = t + p["wall_curve"] * math.sin(t * math.pi)
        hw = (base_hw if not iso else top_hw + inset) - inset * k
        corner = 0.12 + (0.2 - 0.12) * t

        def wall_z(x, y, t=t, hw=hw):
            if iso:
                edge_x = min(max(x, centre_x - top_hw), centre_x + top_hw)
            else:
                edge_x = math.copysign(top_hw, x) * min(abs(x) / max(hw, 1e-6), 1)
            return (surface(edge_x, y) - rim) * t

        ring(inset * k, 1, corner, wall_z)

    # Rounded shoulder into the top surface.
    for i in range(1, 5):
        a = i / 4 * math.pi / 2
        inward = rim * (1 - math.cos(a))
        rise = rim * math.sin(a)

        def shoulder(x, y, rise=rise):
            return surface(x, y) - rim + rise

        ring(inset + inward, 1, 0.2, shoulder)

    # The dish, stepping in to the centre.
    for scale in (0.8, 0.55, 0.3, 0.1):
        ring(inset + rim, scale, max(0.2 * scale, 0.02), surface)

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


def shape_name(key):
    """Mesh name for a key's cap. Matches keycapMeshName in src/data/layout.ts."""
    if key.get("shape") == "isoEnter":
        return "iso_enter"
    row = min(key["row"] + 1, 4)
    return f"w{round(key['width'] * 100)}_r{row}{'_h' if key['homing'] else ''}"


def keycap_shapes():
    """Every cap shape any layout uses, so one keycap file serves every board."""
    shapes = {}
    for path in sorted(LAYOUTS_DIR.glob("*.json")):
        for key in json.loads(path.read_text(encoding="utf-8"))["keys"]:
            iso = key.get("shape") == "isoEnter"
            # The ISO Enter spans the tab and home rows; it takes the home row's sculpt.
            row = 3 if iso else min(key["row"] + 1, 4)
            shapes[shape_name(key)] = (key["width"], row, key["homing"], iso)
    return shapes


def build_keycaps(profile):
    clear_scene()
    return [
        build_keycap(name, width, row, homing, profile, iso)
        for name, (width, row, homing, iso) in keycap_shapes().items()
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
    """Every switch family the configurator offers, each as named parts sharing one frame:
    the plate's top at z 0, the stem's shoulder at 0.56 and its tip at 0.9, so keycaps sit the
    same on all of them. Parts are `<family>_top`, `_bottom`, `_stem` and `_metal`."""
    clear_scene()
    plastic = material("switchPlastic", (0.85, 0.85, 0.85), 0, 0.35)
    steel = material("switchSteel", (0.75, 0.75, 0.76), 1, 0.3)
    parts = []
    for family, builder in (
        ("mx", build_mx_switch),
        ("box", build_box_switch),
        ("alps", build_alps_switch),
        ("topre", build_topre_switch),
        ("buckling", build_buckling_switch),
    ):
        for part, obj in builder(plastic, steel).items():
            obj.name = obj.data.name = f"{family}_{part}"
            parts.append(obj)
    return parts


def spring_mesh(name, radius, z0, z1, turns, wire, mat, cx=0.0, cy=0.0, bow=0.0):
    """A coil spring as a mesh, optionally bowed sideways like a buckling spring."""
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = wire
    curve.bevel_resolution = 1
    spline = curve.splines.new("POLY")
    steps = int(turns * 14)
    spline.points.add(steps)
    for i in range(steps + 1):
        t = i / steps
        a = math.tau * turns * t
        offset = math.sin(t * math.pi) * bow
        spline.points[i].co = (
            cx + radius * math.cos(a) + offset,
            cy + radius * math.sin(a),
            z0 + (z1 - z0) * t,
            1,
        )
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    bpy.data.objects.remove(obj)
    bpy.data.curves.remove(curve)
    result = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(result)
    mesh.materials.append(mat)
    return result


def join(objects, name):
    """Merges parts into one mesh, keeping the first part's material."""
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = joined.data.name = name
    return joined


def solid(name, mat, *shapes):
    """Unions closed shapes, each drawn by a function into its own bmesh, into one clean solid."""
    objects = []
    for i, draw in enumerate(shapes):
        bm = bmesh.new()
        draw(bm)
        objects.append(to_object(f"{name}_{i}", bm, mat))
    result = objects[0]
    for other in objects[1:]:
        boolean(result, other, "UNION")
    result.name = result.data.name = name
    return result


def cut_box(obj, x0, x1, y0, y1, z0, z1):
    bm = bmesh.new()
    add_box(bm, x0, x1, y0, y1, z0, z1)
    boolean(obj, to_object("cut", bm))


def mx_bottom(plastic, clips=True):
    """The bottom housing below the plate: 14 mm square, centre post and plastic PCB legs."""
    bottom = solid(
        "bottom",
        plastic,
        lambda bm: add_box(bm, -0.69, 0.69, -0.69, 0.69, -0.5, 0.0),
        lambda bm: add_cylinder(bm, 0, 0, 0.2, -0.83, -0.49, 16),
        lambda bm: add_cylinder(bm, -0.508, 0, 0.09, -0.8, -0.49, 10),
        lambda bm: add_cylinder(bm, 0.508, 0, 0.09, -0.8, -0.49, 10),
    )
    if clips:
        # The four latches that hold the halves together show as notches on the sides.
        for sy in (-1, 1):
            cut_box(bottom, -0.3, 0.3, sy * 0.71 - 0.05, sy * 0.71 + 0.05, -0.16, 0.01)
    soften(bottom, 0.02, 1, 30)
    return bottom


def mx_pins(steel):
    bm = bmesh.new()
    add_cylinder(bm, -0.381, 0.254, 0.05, -0.86, -0.5, 8)
    add_cylinder(bm, 0.254, 0.508, 0.05, -0.86, -0.5, 8)
    return to_object("pins", bm, steel)


def mx_top(plastic, led_window=True):
    """The top housing: a skirt on the plate, sloping shoulders, the stem hole and the LED window."""
    top = solid(
        "top",
        plastic,
        lambda bm: add_prism(bm, rounded_outline(0.78, 0.78, 0.06, 3), 0.0, 0.2),
        lambda bm: tapered_box(bm, (0.76, 0.76, 0.19), (0.56, 0.6, 0.52)),
    )
    # Hollow it, so a clear housing shows the stem and spring inside.
    hollow = solid(
        "hollow",
        None,
        lambda bm: add_box(bm, -0.7, 0.7, -0.7, 0.7, -0.01, 0.14),
        lambda bm: tapered_box(bm, (0.68, 0.68, 0.13), (0.48, 0.52, 0.44)),
    )
    boolean(top, hollow)
    cut_box(top, -0.31, 0.31, -0.31, 0.31, 0.3, 0.6)
    if led_window:
        cut_box(top, -0.26, 0.26, 0.4, 0.58, 0.3, 0.6)
    # Latch slots on the sides of the skirt.
    for sx in (-1, 1):
        cut_box(top, sx * 0.79 - 0.05, sx * 0.79 + 0.05, -0.22, 0.22, 0.03, 0.15)
    soften(top, 0.02, 1, 30)
    return top


def mx_stem_body(bm, legs=True):
    add_box(bm, -0.29, 0.29, -0.29, 0.29, 0.05, 0.56)
    if legs:
        # The leg that rides against the contact leaf, toward the front.
        add_box(bm, -0.24, -0.12, -0.42, -0.29, -0.3, 0.3)


def mx_cross(bm, top=0.9):
    add_box(bm, -0.2, 0.2, -0.06, 0.06, 0.56, top)
    add_box(bm, -0.06, 0.06, -0.2, 0.2, 0.56, top)


def mx_metal(steel, extra=()):
    spring = spring_mesh("spring", 0.2, -0.48, 0.1, 9, 0.022, steel)
    bm = bmesh.new()
    # Contact leaves at the front: the fixed one and the springy one the leg holds open.
    add_box(bm, -0.34, -0.06, -0.58, -0.56, -0.48, 0.12)
    add_box(bm, -0.34, -0.06, -0.5, -0.48, -0.48, 0.0)
    leaves = to_object("leaves", bm, steel)
    return join([spring, leaves, mx_pins(steel), *extra], "metal")


def build_mx_switch(plastic, steel):
    bottom = mx_bottom(plastic)
    top = mx_top(plastic)
    bm = bmesh.new()
    mx_stem_body(bm)
    mx_cross(bm)
    stem = to_object("stem", bm, plastic)
    return {"top": top, "bottom": bottom, "stem": stem, "metal": mx_metal(steel)}


def build_box_switch(plastic, steel):
    """Kailh Box: the cross stands inside a square box, ringed by a raised collar on the top
    housing, and a thick click bar sits across the front."""
    bottom = mx_bottom(plastic)
    top = mx_top(plastic, led_window=False)
    bm = bmesh.new()
    add_prism(bm, rounded_outline(0.42, 0.42, 0.05, 3), 0.44, 0.55)
    collar = to_object("collar", bm, plastic)
    cut_box(collar, -0.33, 0.33, -0.33, 0.33, 0.3, 0.7)
    top = join([top, collar], "top")
    bm = bmesh.new()
    mx_stem_body(bm)
    stem = to_object("stem", bm, plastic)
    bm = bmesh.new()
    add_box(bm, -0.31, 0.31, -0.31, 0.31, 0.56, 0.86)
    box = to_object("box", bm, plastic)
    cut_box(box, -0.25, 0.25, -0.25, 0.25, 0.6, 1.0)
    bm = bmesh.new()
    mx_cross(bm)
    cross = to_object("cross", bm, plastic)
    stem = join([stem, box, cross], "stem")
    bm = bmesh.new()
    add_box(bm, -0.46, 0.46, -0.6, -0.52, 0.08, 0.16)
    add_box(bm, -0.46, -0.4, -0.6, -0.3, 0.08, 0.16)
    add_box(bm, 0.4, 0.46, -0.6, -0.3, 0.08, 0.16)
    bar = to_object("clickBar", bm, steel)
    return {"top": top, "bottom": bottom, "stem": stem, "metal": mx_metal(steel, [bar])}


def build_alps_switch(plastic, steel):
    """Alps SKCM: a wide, flat rectangular housing, 15.5 by 12.8 mm, and a rectangular slider."""
    bm = bmesh.new()
    add_box(bm, -0.69, 0.69, -0.6, 0.6, -0.55, 0.0)
    bottom = to_object("bottom", bm, plastic)
    soften(bottom, 0.02, 1, 30)
    top = solid(
        "top",
        plastic,
        lambda bm: add_prism(bm, rounded_outline(0.775, 0.64, 0.05, 3), 0.0, 0.36),
        lambda bm: tapered_box(bm, (0.76, 0.62, 0.35), (0.7, 0.56, 0.44)),
    )
    # The rectangular slider hole, with the slits beside it that identify a genuine Alps.
    cut_box(top, -0.25, 0.25, -0.14, 0.14, 0.2, 0.6)
    for sx in (-1, 1):
        cut_box(top, sx * 0.34 - 0.025, sx * 0.34 + 0.025, -0.12, 0.12, 0.38, 0.6)
    # The long side tabs that clip the switch into the plate.
    bm = bmesh.new()
    for sx in (-1, 1):
        add_box(bm, sx * 0.775 - 0.04, sx * 0.775 + 0.04, -0.3, 0.3, -0.3, 0.06)
    tabs = to_object("tabs", bm, plastic)
    top = join([top, tabs], "top")
    soften(top, 0.02, 1, 30)
    bm = bmesh.new()
    add_box(bm, -0.36, 0.36, -0.22, 0.22, 0.05, 0.3)
    add_box(bm, -0.225, 0.225, -0.11, 0.11, 0.3, 0.9)
    stem = to_object("stem", bm, plastic)
    soften(stem, 0.015, 1, 30)
    bm = bmesh.new()
    add_cylinder(bm, -0.25, -0.38, 0.05, -0.85, -0.55, 8)
    add_cylinder(bm, 0.25, -0.38, 0.05, -0.85, -0.55, 8)
    pins = to_object("metal", bm, steel)
    return {"top": top, "bottom": bottom, "stem": stem, "metal": pins}


def build_topre_switch(plastic, steel):
    """Topre: a housing with a round well, and a round slider riding in it over a rubber dome."""
    bm = bmesh.new()
    add_prism(bm, rounded_outline(0.72, 0.72, 0.12, 4), -0.55, 0.0)
    bottom = to_object("bottom", bm, plastic)
    soften(bottom, 0.02, 1, 30)
    top = solid(
        "top",
        plastic,
        lambda bm: add_prism(bm, rounded_outline(0.76, 0.76, 0.14, 4), 0.0, 0.3),
        lambda bm: add_cylinder(bm, 0, 0, 0.56, 0.29, 0.5, 40),
    )
    bm = bmesh.new()
    add_cylinder(bm, 0, 0, 0.46, 0.1, 0.7, 40)
    boolean(top, to_object("well", bm))
    soften(top, 0.02, 1, 30)
    stem = solid(
        "stem",
        plastic,
        lambda bm: add_cylinder(bm, 0, 0, 0.43, 0.12, 0.5, 40),
        lambda bm: add_cylinder(bm, 0, 0, 0.3, 0.49, 0.56, 32),
    )
    # The mount: a round post with a cross slot, as on MX-compatible Topre sliders.
    bm = bmesh.new()
    add_cylinder(bm, 0, 0, 0.24, 0.56, 0.9, 32)
    post = to_object("post", bm, plastic)
    cut_box(post, -0.3, 0.3, -0.055, 0.055, 0.62, 1.0)
    cut_box(post, -0.055, 0.055, -0.3, 0.3, 0.62, 1.0)
    stem = join([stem, post], "stem")
    soften(stem, 0.012, 1, 30)
    # The conical spring inside the dome, glimpsed in the well.
    metal = spring_mesh("metal", 0.16, 0.0, 0.3, 4, 0.015, steel)
    return {"top": top, "bottom": bottom, "stem": stem, "metal": metal}


def build_buckling_switch(plastic, steel):
    """IBM Model M: a tall square barrel on the barrel plate, the spring standing up out of it,
    and the flipper under it that the spring rocks onto the membrane."""
    bm = bmesh.new()
    tapered_box(bm, (0.66, 0.66, -0.45), (0.6, 0.6, 0.52))
    barrel = to_object("top", bm, plastic)
    bm = bmesh.new()
    tapered_box(bm, (0.52, 0.52, -0.6), (0.46, 0.46, 0.7))
    boolean(barrel, to_object("bore", bm))
    # The two side slots the keycap's plunger catches in.
    for sx in (-1, 1):
        cut_box(barrel, sx * 0.63 - 0.08, sx * 0.63 + 0.08, -0.12, 0.12, 0.16, 0.42)
    soften(barrel, 0.02, 1, 30)
    bm = bmesh.new()
    # The flipper: a paddle pivoting on its back edge, the spring seated on its front.
    add_box(bm, -0.55, 0.55, -0.42, 0.42, -0.6, -0.5)
    add_box(bm, -0.55, 0.55, 0.32, 0.42, -0.68, -0.5)
    flipper = to_object("bottom", bm, plastic)
    soften(flipper, 0.02, 1, 30)
    spring = spring_mesh("stem", 0.21, -0.48, 0.9, 13, 0.028, plastic)
    return {"top": barrel, "bottom": flipper, "stem": spring}


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
        obj = bpy.data.objects.new(f"cap_{key['code']}", caps[shape_name(key)].data)
        bpy.context.scene.collection.objects.link(obj)
        obj.location = (key["x"], key["y"], LAYOUT["keycapBaseZ"])
        objs.append(obj)
    for cap in caps.values():
        cap.hide_render = True
        cap.hide_viewport = True
    return objs


def build_keycaps_into_scene(profile):
    return {
        name: build_keycap(f"src_{name}", width, row, homing, profile, iso)
        for name, (width, row, homing, iso) in keycap_shapes().items()
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
    scene.render.filepath = str(OUT / f"shadow-{LAYOUT_ID}.webp")
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
        ground = 0.66 + 0.16 * v
        sky = 0.8 + 0.2 * v
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
    folder = PREVIEW / LAYOUT_ID
    folder.mkdir(parents=True, exist_ok=True)
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
        bpy.context.scene.render.filepath = str(folder / f"{name}.png")
        bpy.ops.render.render(write_still=True)

    shoot("front", (0, -95, 62))
    shoot("three-quarter", (-55, -75, 42))
    shoot("top", (0, -2, 110))
    shoot("bare", (0, -2, 110), hide_caps=True)
    shoot("back", (25, 90, 22))
    shoot("side", (110, 0, 4))
    shoot("corner", (70, -80, 34), target=(5, -2, 1))
    shoot("rear-corner", (-62, 88, 30), target=(-5, 2, 1))
    shoot("indicator", (20, -34, 26), target=(9, -3.6, 1))

    # Tinted close-ups, since white hides problems in the case surfaces.
    for name in ("case", "caseLower"):
        bsdf = next(n for n in bpy.data.materials[name].node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = (0.3, 0.45, 0.7, 1)
    bpy.data.worlds["world"].node_tree.nodes["Background"].inputs["Color"].default_value = (0.6, 0.6, 0.6, 1)
    cam_data.lens = 90
    shoot("close-ports", (-22, 42, 10), target=(-10, 6, 1.6))
    shoot("close-rear-left", (-44, 34, 9), target=(-16, 6, 1.5))
    shoot("close-rear-right", (44, 34, 9), target=(16, 6, 1.5))
    shoot("close-front-right", (46, -34, 12), target=(16, -6, 1))
    shoot("close-front-left", (-46, -34, 12), target=(-16, -6, 1))



# Real colours for the switch preview: top, bottom, stem, and how see-through the top is.
SWITCH_LOOKS = {
    "mx": ((0.09, 0.09, 0.1), (0.09, 0.09, 0.1), (0.75, 0.2, 0.08), 0.0),
    "box": ((0.9, 0.92, 0.94), (0.94, 0.94, 0.92), (0.1, 0.16, 0.36), 0.75),
    "alps": ((0.16, 0.16, 0.17), (0.16, 0.16, 0.17), (0.42, 0.5, 0.6), 0.0),
    "topre": ((0.14, 0.14, 0.15), (0.14, 0.14, 0.15), (0.78, 0.78, 0.76), 0.0),
    "buckling": ((0.2, 0.2, 0.21), (0.07, 0.07, 0.08), (0.7, 0.7, 0.72), 0.0),
}


def preview_switches():
    """Every switch family in a row, whole and with the top housing hidden, for checking shapes."""
    PREVIEW.mkdir(parents=True, exist_ok=True)
    parts = build_switch()
    for obj in parts:
        family, part = obj.name.split("_")
        index = list(SWITCH_LOOKS).index(family)
        obj.location.x = (index - 2) * 2.4
        top, bottom, stem, clear = SWITCH_LOOKS[family]
        colour = {"top": top, "bottom": bottom, "stem": stem}.get(part)
        if part == "metal" or (family == "buckling" and part == "stem"):
            mat = material("previewSteel", (0.8, 0.8, 0.82), 1, 0.25)
        else:
            mat = material(f"preview_{family}_{part}", colour, 0, 0.3)
            if part == "top" and clear:
                bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
                bsdf.inputs["Transmission Weight"].default_value = clear
                bsdf.inputs["Roughness"].default_value = 0.08
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -0.9))
    bpy.context.object.data.materials.append(material("floor", (0.9, 0.9, 0.9), 0, 0.7))
    uniform_world(1.0)
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 100
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    setup_cycles(48, 1600, 560)

    def shoot(name, location, target):
        cam.location = location
        cam.rotation_euler = (Vector(target) - cam.location).to_track_quat("-Z", "Y").to_euler()
        bpy.context.scene.render.filepath = str(PREVIEW / f"{name}.png")
        bpy.ops.render.render(write_still=True)

    shoot("switches", (0, -36, 13), (0, 0, 0.1))
    shoot("switches-top", (0, -12, 34), (0, 0, 0.2))
    for obj in parts:
        if obj.name.endswith("_top"):
            obj.hide_render = True
    shoot("switches-open", (0, -36, 13), (0, 0, 0.1))


TASKS = {
    "keyboard": lambda: (build_keyboard(), export_glb(LAYOUT_ID)),
    "switch": lambda: (build_switch(), export_glb("switches")),
    "switch-preview": preview_switches,
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
