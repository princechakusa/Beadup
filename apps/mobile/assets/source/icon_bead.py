# Beadup 3D app icon: one water bead on glossy coated paint (the "beading" you
# see on a fresh ceramic coating). Render headless:
#   blender -b -P apps/mobile/assets/source/icon_bead.py -- <out_dir> [samples] [variant]
# variant "icon" = full 1024x1024 square; "foreground" = bead only on a
# transparent background (Android adaptive icon / splash).
# Palette (CLAUDE.md): Midnight #0A0C10, Gunmetal #161A21, Bead Blue #4DD8FF.
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.getcwd(), "render")
SAMPLES = int(argv[1]) if len(argv) > 1 else 256
VARIANT = argv[2] if len(argv) > 2 else "icon"
os.makedirs(OUT, exist_ok=True)


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1.0,)


MIDNIGHT, GUNMETAL, BEAD = srgb("#0A0C10"), srgb("#161A21"), srgb("#4DD8FF")

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# --- Render settings -------------------------------------------------------
scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 24
scene.cycles.transmission_bounces = 24
scene.cycles.glossy_bounces = 12
scene.cycles.caustics_refractive = True
scene.cycles.caustics_reflective = True
scene.render.resolution_x = scene.render.resolution_y = 1024
scene.render.film_transparent = VARIANT == "foreground"
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA" if VARIANT == "foreground" else "RGB"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.get_devices()
    for kind in ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"):
        try:
            prefs.compute_device_type = kind
            if any(d.type == kind for d in prefs.devices):
                for d in prefs.devices:
                    d.use = True
                scene.cycles.device = "GPU"
                break
        except TypeError:
            continue
except Exception:
    scene.cycles.device = "CPU"

# --- World: near-black with a faint blue lift --------------------------------
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = MIDNIGHT
bg.inputs["Strength"].default_value = 0.35


def principled(name, **inputs):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    for k, v in inputs.items():
        p.inputs[k].default_value = v
    return m


# --- Paint panel: gunmetal with a glossy clear coat --------------------------
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
panel = bpy.context.object
paint = principled(
    "CoatedPaint",
    **{"Base Color": GUNMETAL, "Metallic": 0.6, "Roughness": 0.35, "Coat Weight": 1.0, "Coat Roughness": 0.03},
)
panel.data.materials.append(paint)
if VARIANT == "foreground":
    panel.is_holdout = True  # keep reflections/shadow off the transparent cut-out

# --- The bead: a sessile water drop (flattened sphere, cut at the surface) ---
# A flattened sphere sunk into the paint: high contact angle, like water on a
# hydrophobic coating. (No boolean cut: it left shading artifacts at the rim.)
bpy.ops.mesh.primitive_uv_sphere_add(segments=256, ring_count=128, radius=1.0, location=(0, 0, 0.42))
bead = bpy.context.object
bead.scale = (1.0, 1.0, 0.70)
bpy.ops.object.shade_smooth()
water = principled(
    "Water",
    **{
        "Base Color": (0.93, 0.99, 1.0, 1.0),
        "Roughness": 0.0,
        "IOR": 1.333,
        "Transmission Weight": 1.0,
        "Specular IOR Level": 0.8,
    },
)
bead.data.materials.append(water)

# Two tiny satellite beads for scale and the "beading" read.
for (x, y, r) in ((1.45, -0.95, 0.19), (-1.30, 0.95, 0.12)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=r, location=(x, y, r * 0.42))
    s = bpy.context.object
    s.scale = (1, 1, 0.72)
    bpy.ops.object.shade_smooth()
    s.data.materials.append(water)

# Light focused through the drop pools on the paint under it: a soft bead blue
# glow disc just under the bead, so the drop reads blue instead of black.
bpy.ops.mesh.primitive_circle_add(vertices=128, radius=0.92, fill_type="NGON", location=(0, 0, 0.002))
glow = bpy.context.object
gm = bpy.data.materials.new("Caustic")
gm.use_nodes = True
nt = gm.node_tree
nt.nodes.remove(nt.nodes["Principled BSDF"])
em = nt.nodes.new("ShaderNodeEmission")
em.inputs["Color"].default_value = BEAD
em.inputs["Strength"].default_value = 1.3
# Fade to the edge with a radial gradient so there is no hard disc.
tc = nt.nodes.new("ShaderNodeTexCoord")
grad = nt.nodes.new("ShaderNodeTexGradient")
grad.gradient_type = "SPHERICAL"
mapping = nt.nodes.new("ShaderNodeMapping")
mapping.inputs["Scale"].default_value = (1.09, 1.09, 1.09)
ramp = nt.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].position = 0.0
ramp.color_ramp.elements[1].position = 0.85
mix = nt.nodes.new("ShaderNodeMixShader")
tr = nt.nodes.new("ShaderNodeBsdfTransparent")
nt.links.new(tc.outputs["Object"], mapping.inputs["Vector"])
nt.links.new(mapping.outputs["Vector"], grad.inputs["Vector"])
nt.links.new(grad.outputs["Fac"], ramp.inputs["Fac"])
nt.links.new(ramp.outputs["Color"], mix.inputs["Fac"])
nt.links.new(tr.outputs["BSDF"], mix.inputs[1])
nt.links.new(em.outputs["Emission"], mix.inputs[2])
nt.links.new(mix.outputs["Shader"], nt.nodes["Material Output"].inputs["Surface"])
glow.data.materials.append(gm)

# --- Lights ------------------------------------------------------------------
def area(name, loc, size, energy, color, target=(0, 0, 0.3)):
    d = bpy.data.lights.new(name, "AREA")
    d.size = size
    d.energy = energy
    d.color = color[:3]
    o = bpy.data.objects.new(name, d)
    scene.collection.objects.link(o)
    o.location = loc
    direction = Vector(target) - Vector(loc)
    o.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return o


key = area("Key", (-1.8, -1.0, 6.5), 2.4, 700, (1.0, 1.0, 1.0))    # soft top light: the window highlight
area("Rim", (1.0, 10.0, 0.45), 3.0, 6000, BEAD)                         # bead blue glow from behind, out of frame
area("Fill", (4.0, -4.0, 3.0), 5.0, 90, (0.75, 0.9, 1.0))              # lifts the shadow side

# Light linking: the key lights only the beads, so its bright square doesn't
# mirror in the glossy paint (it was the white block in the frame).
beads = bpy.data.collections.new("Beads")
scene.collection.children.link(beads)
for o in [o for o in scene.objects if o.type == "MESH" and o.active_material and o.active_material.name == "Water"]:
    beads.objects.link(o)
key.light_linking.receiver_collection = beads

# --- Camera: three-quarter view looking down at the bead ---------------------
cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 85
cam_data.dof.use_dof = True
cam_data.dof.aperture_fstop = 2.2
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam.location = (0.0, -7.2, 8.4)
look = Vector((0, 0, 0.35)) - cam.location
cam.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
cam_data.dof.focus_distance = look.length
# Frame so the bead fills ~55% of the icon (inside the iOS/Android safe area).
cam_data.lens = 92 if VARIANT == "icon" else 80

out = os.path.join(OUT, f"{VARIANT}.png")
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print("RENDERED", out)
