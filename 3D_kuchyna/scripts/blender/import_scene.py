import json
import math
import os
import sys

import bpy
from mathutils import Vector


def _argv_after_double_dash(argv):
    if "--" not in argv:
        return []
    i = argv.index("--")
    return argv[i + 1 :]


def _read_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _as_vec3(v, fallback):
    if isinstance(v, list) and len(v) == 3 and all(isinstance(x, (int, float)) for x in v):
        return Vector((float(v[0]), float(v[1]), float(v[2])))
    return Vector(fallback)


def _ensure_dir(path):
    d = os.path.dirname(os.path.abspath(path))
    if d and not os.path.isdir(d):
        os.makedirs(d, exist_ok=True)


def _reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    return scene


def _set_render_defaults(scene):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 20
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False

    # Color management defaults (AgX if available, else Filmic).
    try:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        try:
            scene.view_settings.view_transform = "Filmic"
            scene.view_settings.look = "Medium High Contrast"
        except Exception:
            pass


def _world_setup(scene, hdri_path, strength):
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True

    nt = world.node_tree
    nodes = nt.nodes
    links = nt.links

    nodes.clear()
    out = nodes.new(type="ShaderNodeOutputWorld")
    bg = nodes.new(type="ShaderNodeBackground")
    bg.inputs["Strength"].default_value = float(max(0.0, strength))
    links.new(bg.outputs["Background"], out.inputs["Surface"])

    hdri_ok = False
    if hdri_path and isinstance(hdri_path, str):
        p = os.path.abspath(hdri_path)
        if os.path.isfile(p):
            try:
                env = nodes.new(type="ShaderNodeTexEnvironment")
                env.image = bpy.data.images.load(p, check_existing=True)
                links.new(env.outputs["Color"], bg.inputs["Color"])
                hdri_ok = True
            except Exception as e:
                print(f"[warn] Failed to load HDRI: {p}: {e}")

    if not hdri_ok:
        bg.inputs["Color"].default_value = (0.85, 0.85, 0.85, 1.0)
        bg.inputs["Strength"].default_value = min(bg.inputs["Strength"].default_value, 0.25)


def _ensure_material_cache():
    return {}


def _get_bsdf_input(bsdf, key_options):
    for k in key_options:
        if k in bsdf.inputs:
            return bsdf.inputs[k]
    return None


def _material_from_spec(cache, spec, tags):
    base = spec.get("baseColor") if isinstance(spec, dict) else None
    roughness = spec.get("roughness") if isinstance(spec, dict) else None
    metallic = spec.get("metallic") if isinstance(spec, dict) else None
    transmission = spec.get("transmission") if isinstance(spec, dict) else None
    ior = spec.get("ior") if isinstance(spec, dict) else None
    emissive = spec.get("emissive") if isinstance(spec, dict) else None
    emissive_strength = spec.get("emissiveStrength") if isinstance(spec, dict) else None

    def _num(v, fb):
        return float(v) if isinstance(v, (int, float)) and math.isfinite(v) else fb

    def _rgb(v, fb):
        if isinstance(v, list) and len(v) == 3 and all(isinstance(x, (int, float)) for x in v):
            return (max(0.0, min(1.0, float(v[0]))), max(0.0, min(1.0, float(v[1]))), max(0.0, min(1.0, float(v[2]))))
        return fb

    base_rgb = _rgb(base, (0.8, 0.8, 0.8))
    rough = max(0.0, min(1.0, _num(roughness, 0.6)))
    metal = max(0.0, min(1.0, _num(metallic, 0.0)))
    trans = max(0.0, min(1.0, _num(transmission, 0.0)))
    ior_v = max(1.0, min(3.0, _num(ior, 1.45)))
    em_rgb = _rgb(emissive, (0.0, 0.0, 0.0))
    em_s = max(0.0, _num(emissive_strength, 1.0))

    # Tag-based fallback tweaks (only if spec is missing the property).
    if roughness is None:
        if "wall" in tags:
            rough = 0.85
        if "floor" in tags:
            rough = 0.6
        if "wood" in tags:
            rough = 0.5
        if "metal" in tags:
            rough = 0.25
    if metallic is None and "metal" in tags:
        metal = 1.0
    if transmission is None and "glass" in tags:
        trans = 1.0
        rough = min(rough, 0.06)
        ior_v = 1.45
        metal = 0.0

    key = (base_rgb, rough, metal, trans, ior_v, em_rgb, em_s)
    if key in cache:
        return cache[key]

    mat = bpy.data.materials.new(name="PBR")
    mat.use_nodes = True

    nt = mat.node_tree
    nodes = nt.nodes
    links = nt.links
    nodes.clear()

    out = nodes.new(type="ShaderNodeOutputMaterial")
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    _get_bsdf_input(bsdf, ["Base Color"]).default_value = (base_rgb[0], base_rgb[1], base_rgb[2], 1.0)
    _get_bsdf_input(bsdf, ["Roughness"]).default_value = rough
    _get_bsdf_input(bsdf, ["Metallic"]).default_value = metal

    t_in = _get_bsdf_input(bsdf, ["Transmission", "Transmission Weight"])
    if t_in is not None:
        t_in.default_value = trans

    ior_in = _get_bsdf_input(bsdf, ["IOR"])
    if ior_in is not None:
        ior_in.default_value = ior_v

    if (em_rgb[0] + em_rgb[1] + em_rgb[2]) > 1e-6 and em_s > 0:
        ec_in = _get_bsdf_input(bsdf, ["Emission", "Emission Color"])
        if ec_in is not None:
            ec_in.default_value = (em_rgb[0], em_rgb[1], em_rgb[2], 1.0)
        es_in = _get_bsdf_input(bsdf, ["Emission Strength"])
        if es_in is not None:
            es_in.default_value = em_s

    cache[key] = mat
    return mat


def _set_shadow_flags(obj, cast, receive):
    try:
        obj.cycles_visibility.shadow = bool(cast)
    except Exception:
        pass
    try:
        obj.visible_shadow = bool(receive)
    except Exception:
        pass


def _mesh_from_spec(name, geo_spec):
    if not isinstance(geo_spec, dict):
        raise ValueError("Missing geometry object")

    verts = geo_spec.get("vertices")
    indices = geo_spec.get("indices")
    uvs = geo_spec.get("uvs")
    normals = geo_spec.get("normals")

    if not (isinstance(verts, list) and len(verts) >= 9 and len(verts) % 3 == 0):
        raise ValueError("Invalid geometry.vertices")
    if not (isinstance(indices, list) and len(indices) >= 3):
        raise ValueError("Invalid geometry.indices")

    vcount = len(verts) // 3
    v = [(float(verts[i * 3 + 0]), float(verts[i * 3 + 1]), float(verts[i * 3 + 2])) for i in range(vcount)]

    faces = []
    tri_count = len(indices) // 3
    for t in range(tri_count):
        i0 = int(indices[t * 3 + 0])
        i1 = int(indices[t * 3 + 1])
        i2 = int(indices[t * 3 + 2])
        if 0 <= i0 < vcount and 0 <= i1 < vcount and 0 <= i2 < vcount:
            faces.append((i0, i1, i2))

    mesh = bpy.data.meshes.new(name=name)
    mesh.from_pydata(v, [], faces)
    mesh.update(calc_edges=True)

    if isinstance(uvs, list) and len(uvs) == vcount * 2:
        uv_layer = mesh.uv_layers.new(name="UVMap")
        for loop in mesh.loops:
            vi = loop.vertex_index
            uv_layer.data[loop.index].uv = (float(uvs[vi * 2 + 0]), float(uvs[vi * 2 + 1]))

    if isinstance(normals, list) and len(normals) == vcount * 3:
        try:
            mesh.use_auto_smooth = True
            mesh.calc_normals_split()
            n = [Vector((float(normals[i * 3 + 0]), float(normals[i * 3 + 1]), float(normals[i * 3 + 2]))) for i in range(vcount)]
            mesh.normals_split_custom_set_from_vertices(n)
        except Exception as e:
            print(f"[warn] Failed to set custom normals on {name}: {e}")
            mesh.calc_normals()
    else:
        mesh.calc_normals()

    return mesh


def _add_object(scene, obj_spec, mat_cache):
    name = str(obj_spec.get("name") or "Object")
    geo_spec = obj_spec.get("geometry") if isinstance(obj_spec, dict) else None
    mesh = _mesh_from_spec(name, geo_spec)

    obj = bpy.data.objects.new(name=name, object_data=mesh)
    scene.collection.objects.link(obj)

    t = obj_spec.get("transform") if isinstance(obj_spec, dict) else None
    if isinstance(t, dict):
        pos = _as_vec3(t.get("position"), (0, 0, 0))
        rot = _as_vec3(t.get("rotation"), (0, 0, 0))
        sca = _as_vec3(t.get("scale"), (1, 1, 1))
        obj.location = pos
        obj.rotation_euler = (rot.x, rot.y, rot.z)
        obj.scale = sca

    tags = obj_spec.get("tags") if isinstance(obj_spec, dict) else []
    if not isinstance(tags, list):
        tags = []
    tags = [t for t in tags if isinstance(t, str)]

    mat_spec = obj_spec.get("material") if isinstance(obj_spec, dict) else None
    mat = _material_from_spec(mat_cache, mat_spec if isinstance(mat_spec, dict) else {}, tags)
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

    shadow = obj_spec.get("shadow") if isinstance(obj_spec, dict) else None
    cast = True
    receive = True
    if isinstance(shadow, dict):
        cast = bool(shadow.get("cast", True))
        receive = bool(shadow.get("receive", True))
    _set_shadow_flags(obj, cast, receive)

    return obj


def _setup_camera(scene, camera_spec):
    cam_data = bpy.data.cameras.new("Camera")
    cam_obj = bpy.data.objects.new("Camera", cam_data)
    scene.collection.objects.link(cam_obj)

    pos = _as_vec3(camera_spec.get("position") if isinstance(camera_spec, dict) else None, (2.0, -2.0, 1.4))
    rot = _as_vec3(camera_spec.get("rotation") if isinstance(camera_spec, dict) else None, (0.9, 0.0, 0.0))
    fov_deg = float(camera_spec.get("fov")) if isinstance(camera_spec, dict) and isinstance(camera_spec.get("fov"), (int, float)) else 35.0

    cam_obj.location = pos
    cam_obj.rotation_euler = (rot.x, rot.y, rot.z)
    try:
        cam_data.angle_y = math.radians(max(1.0, min(179.0, fov_deg)))
    except Exception:
        pass

    scene.camera = cam_obj


def _setup_sun(scene, light_spec):
    sun_data = bpy.data.lights.new(name="Sun", type="SUN")
    sun_obj = bpy.data.objects.new(name="Sun", object_data=sun_data)
    scene.collection.objects.link(sun_obj)

    strength = 3.0
    angle_deg = 0.8
    direction = Vector((-0.3, -0.9, -0.2))
    if isinstance(light_spec, dict):
        if isinstance(light_spec.get("sunStrength"), (int, float)):
            strength = float(max(0.0, light_spec.get("sunStrength")))
        if isinstance(light_spec.get("sunAngle"), (int, float)):
            angle_deg = float(max(0.001, light_spec.get("sunAngle")))
        direction = _as_vec3(light_spec.get("sunDirection"), (-0.3, -0.9, -0.2))

    if direction.length < 1e-6:
        direction = Vector((-0.3, -0.9, -0.2))
    direction.normalize()

    sun_data.energy = strength
    try:
        sun_data.angle = math.radians(angle_deg)
    except Exception:
        pass

    # Sun lights shine along -Z axis in object space.
    sun_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def main():
    argv = _argv_after_double_dash(sys.argv)
    if len(argv) < 2:
        print("Usage: blender --background --python scripts/blender/import_scene.py -- <scene.json> <out.blend> [preview.png|-]")
        return 2

    json_path = argv[0]
    blend_out = argv[1]
    preview_out = argv[2] if len(argv) >= 3 and argv[2] != "-" else None

    payload = _read_json(json_path)

    scene = _reset_scene()
    _set_render_defaults(scene)

    env = payload.get("environment") if isinstance(payload, dict) else None
    hdri_path = env.get("hdriPath") if isinstance(env, dict) else None
    hdri_strength = env.get("hdriStrength") if isinstance(env, dict) else 0.35
    _world_setup(scene, hdri_path, float(hdri_strength) if isinstance(hdri_strength, (int, float)) else 0.35)

    _setup_camera(scene, payload.get("camera") if isinstance(payload, dict) else {})
    _setup_sun(scene, payload.get("lighting") if isinstance(payload, dict) else {})

    mat_cache = _ensure_material_cache()
    objs = payload.get("objects") if isinstance(payload, dict) else []
    if not isinstance(objs, list):
        objs = []

    for o in objs:
        if not isinstance(o, dict):
            continue
        try:
            _add_object(scene, o, mat_cache)
        except Exception as e:
            n = o.get("name") if isinstance(o, dict) else "Object"
            print(f"[warn] Skipping object {n}: {e}")

    _ensure_dir(blend_out)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(blend_out))

    if preview_out:
        _ensure_dir(preview_out)
        scene.render.filepath = os.path.abspath(preview_out)
        scene.render.image_settings.file_format = "PNG"
        bpy.ops.render.render(write_still=True)

    print(f"[ok] Wrote blend: {os.path.abspath(blend_out)}")
    if preview_out:
        print(f"[ok] Wrote preview: {os.path.abspath(preview_out)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

