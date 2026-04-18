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


def _set_render_defaults(scene, preview, color_mgmt_spec=None):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 32 if preview else 256
    try:
        scene.cycles.use_adaptive_sampling = True
        scene.cycles.adaptive_threshold = 0.01 if preview else 0.005
    except Exception:
        pass
    try:
        scene.cycles.use_denoising = True
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    try:
        scene.cycles.max_bounces = 12
        scene.cycles.diffuse_bounces = 4
        scene.cycles.glossy_bounces = 4
        scene.cycles.transmission_bounces = 8
        scene.cycles.transparent_max_bounces = 8
    except Exception:
        pass
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

    if isinstance(color_mgmt_spec, dict):
        vt = color_mgmt_spec.get("viewTransform")
        look = color_mgmt_spec.get("look")
        exposure = color_mgmt_spec.get("exposure")

        if isinstance(vt, str) and vt.strip():
            vt_norm = vt.strip().lower()
            if vt_norm in ["agx", "ag_x"]:
                vt = "AgX"
            try:
                scene.view_settings.view_transform = vt
            except Exception:
                pass

        if isinstance(look, str) and look.strip():
            look = look.strip()
            vt_now = None
            try:
                vt_now = str(scene.view_settings.view_transform or "")
            except Exception:
                vt_now = ""

            look_candidates = [look]
            if vt_now.lower() == "agx" and not look.lower().startswith("agx"):
                look_candidates.insert(0, f"AgX - {look}")

            for cand in look_candidates:
                try:
                    scene.view_settings.look = cand
                    break
                except Exception:
                    continue

        if isinstance(exposure, (int, float)) and math.isfinite(exposure):
            try:
                scene.view_settings.exposure = float(exposure)
            except Exception:
                pass


def _world_setup(scene, hdri_path, strength, rotation_deg=0.0):
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True

    nt = world.node_tree
    nodes = nt.nodes
    links = nt.links

    nodes.clear()
    out = nodes.new(type="ShaderNodeOutputWorld")
    bg_env = nodes.new(type="ShaderNodeBackground")
    bg_env.name = "WorldBG_Env"
    bg_cam = nodes.new(type="ShaderNodeBackground")
    bg_cam.name = "WorldBG_Cam"
    mix = nodes.new(type="ShaderNodeMixShader")
    lp = nodes.new(type="ShaderNodeLightPath")

    bg_env.inputs["Strength"].default_value = float(max(0.0, strength))
    bg_cam.inputs["Strength"].default_value = float(max(0.0, strength))

    links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
    links.new(bg_env.outputs["Background"], mix.inputs[1])
    links.new(bg_cam.outputs["Background"], mix.inputs[2])
    links.new(mix.outputs["Shader"], out.inputs["Surface"])

    hdri_ok = False
    if hdri_path and isinstance(hdri_path, str):
        p = os.path.abspath(hdri_path)
        if os.path.isfile(p):
            try:
                texcoord = nodes.new(type="ShaderNodeTexCoord")
                mapping = nodes.new(type="ShaderNodeMapping")
                env = nodes.new(type="ShaderNodeTexEnvironment")
                env.image = bpy.data.images.load(p, check_existing=True)

                mapping.vector_type = "POINT"
                try:
                    rz = math.radians(float(rotation_deg))
                except Exception:
                    rz = 0.0
                mapping.inputs["Rotation"].default_value[2] = rz

                links.new(texcoord.outputs["Generated"], mapping.inputs["Vector"])
                links.new(mapping.outputs["Vector"], env.inputs["Vector"])
                links.new(env.outputs["Color"], bg_env.inputs["Color"])
                links.new(env.outputs["Color"], bg_cam.inputs["Color"])
                hdri_ok = True
            except Exception as e:
                print(f"[warn] Failed to load HDRI: {p}: {e}")

    if not hdri_ok:
        bg_env.inputs["Color"].default_value = (0.85, 0.85, 0.85, 1.0)
        bg_cam.inputs["Color"].default_value = (0.85, 0.85, 0.85, 1.0)
        # Keep a readable baseline even without HDRI, but don't overpower the SUN.
        s = float(bg_env.inputs["Strength"].default_value)
        bg_env.inputs["Strength"].default_value = max(0.25, min(0.6, s))
        bg_cam.inputs["Strength"].default_value = max(0.25, min(0.6, float(bg_cam.inputs["Strength"].default_value)))


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
    textures = spec.get("textures") if isinstance(spec, dict) else None

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

    tex_key = None
    if isinstance(textures, dict):
        tex_key = (
            textures.get("baseColor", {}).get("uri") if isinstance(textures.get("baseColor"), dict) else None,
            textures.get("normal", {}).get("uri") if isinstance(textures.get("normal"), dict) else None,
            textures.get("roughness", {}).get("uri") if isinstance(textures.get("roughness"), dict) else None,
            textures.get("metallic", {}).get("uri") if isinstance(textures.get("metallic"), dict) else None,
            textures.get("emissive", {}).get("uri") if isinstance(textures.get("emissive"), dict) else None,
        )

    key = (base_rgb, rough, metal, trans, ior_v, em_rgb, em_s, tex_key)
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

    def _tex(spec_obj):
        if not isinstance(spec_obj, dict):
            return None
        uri = spec_obj.get("uri")
        if not isinstance(uri, str) or not uri.strip():
            return None
        return spec_obj

    def _load_image(uri):
        p = os.path.abspath(uri)
        if not os.path.isfile(p):
            return None
        try:
            return bpy.data.images.load(p, check_existing=True)
        except Exception as e:
            print(f"[warn] Failed to load texture: {p}: {e}")
            return None

    any_tex = isinstance(textures, dict) and any(isinstance(v, dict) and isinstance(v.get("uri"), str) and v.get("uri") for v in textures.values())
    if any_tex:
        # Shared UV transform: rotate around center + repeat/offset.
        uv = nodes.new(type="ShaderNodeTexCoord")
        sub = nodes.new(type="ShaderNodeVectorMath")
        sub.operation = "SUBTRACT"
        sub.inputs[1].default_value = (0.5, 0.5, 0.0)
        add = nodes.new(type="ShaderNodeVectorMath")
        add.operation = "ADD"
        add.inputs[1].default_value = (0.5, 0.5, 0.0)
        mapping = nodes.new(type="ShaderNodeMapping")
        mapping.vector_type = "POINT"

        links.new(uv.outputs["UV"], sub.inputs[0])
        links.new(sub.outputs["Vector"], mapping.inputs["Vector"])
        links.new(mapping.outputs["Vector"], add.inputs[0])

        uv_applied = False

        def _apply_uv(x):
            nonlocal uv_applied
            if uv_applied:
                return
            if not isinstance(x, dict):
                return
            rep = x.get("repeat")
            off = x.get("offset")
            rot = x.get("rotationDeg")

            if isinstance(rep, list) and len(rep) == 2 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in rep):
                mapping.inputs["Scale"].default_value[0] = float(rep[0])
                mapping.inputs["Scale"].default_value[1] = float(rep[1])
            if isinstance(off, list) and len(off) == 2 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in off):
                mapping.inputs["Location"].default_value[0] = float(off[0])
                mapping.inputs["Location"].default_value[1] = float(off[1])
            if isinstance(rot, (int, float)) and math.isfinite(rot):
                mapping.inputs["Rotation"].default_value[2] = math.radians(float(rot))
            uv_applied = True

        # Base color (supports texture * tint color).
        bc_spec = _tex(textures.get("baseColor")) if isinstance(textures, dict) else None
        if bc_spec:
            img = _load_image(bc_spec.get("uri"))
            if img:
                _apply_uv(bc_spec)
                tex = nodes.new(type="ShaderNodeTexImage")
                tex.image = img
                try:
                    tex.image.colorspace_settings.name = "sRGB"
                except Exception:
                    pass
                links.new(add.outputs["Vector"], tex.inputs["Vector"])

                if base_rgb != (1.0, 1.0, 1.0):
                    mul = nodes.new(type="ShaderNodeMixRGB")
                    mul.blend_type = "MULTIPLY"
                    mul.inputs["Fac"].default_value = 1.0
                    mul.inputs["Color2"].default_value = (base_rgb[0], base_rgb[1], base_rgb[2], 1.0)
                    links.new(tex.outputs["Color"], mul.inputs["Color1"])
                    links.new(mul.outputs["Color"], _get_bsdf_input(bsdf, ["Base Color"]))
                else:
                    links.new(tex.outputs["Color"], _get_bsdf_input(bsdf, ["Base Color"]))

        # Roughness texture.
        r_spec = _tex(textures.get("roughness")) if isinstance(textures, dict) else None
        if r_spec:
            img = _load_image(r_spec.get("uri"))
            if img:
                _apply_uv(r_spec)
                tex = nodes.new(type="ShaderNodeTexImage")
                tex.image = img
                try:
                    tex.image.colorspace_settings.name = "Non-Color"
                except Exception:
                    pass
                links.new(add.outputs["Vector"], tex.inputs["Vector"])
                rgb2bw = nodes.new(type="ShaderNodeRGBToBW")
                links.new(tex.outputs["Color"], rgb2bw.inputs["Color"])
                if rough != 1.0:
                    mul = nodes.new(type="ShaderNodeMath")
                    mul.operation = "MULTIPLY"
                    mul.inputs[1].default_value = float(rough)
                    links.new(rgb2bw.outputs["Val"], mul.inputs[0])
                    links.new(mul.outputs["Value"], _get_bsdf_input(bsdf, ["Roughness"]))
                else:
                    links.new(rgb2bw.outputs["Val"], _get_bsdf_input(bsdf, ["Roughness"]))

        # Metallic texture.
        m_spec = _tex(textures.get("metallic")) if isinstance(textures, dict) else None
        if m_spec:
            img = _load_image(m_spec.get("uri"))
            if img:
                _apply_uv(m_spec)
                tex = nodes.new(type="ShaderNodeTexImage")
                tex.image = img
                try:
                    tex.image.colorspace_settings.name = "Non-Color"
                except Exception:
                    pass
                links.new(add.outputs["Vector"], tex.inputs["Vector"])
                rgb2bw = nodes.new(type="ShaderNodeRGBToBW")
                links.new(tex.outputs["Color"], rgb2bw.inputs["Color"])
                if metal != 1.0:
                    mul = nodes.new(type="ShaderNodeMath")
                    mul.operation = "MULTIPLY"
                    mul.inputs[1].default_value = float(metal)
                    links.new(rgb2bw.outputs["Val"], mul.inputs[0])
                    links.new(mul.outputs["Value"], _get_bsdf_input(bsdf, ["Metallic"]))
                else:
                    links.new(rgb2bw.outputs["Val"], _get_bsdf_input(bsdf, ["Metallic"]))

        # Normal map.
        n_spec = _tex(textures.get("normal")) if isinstance(textures, dict) else None
        if n_spec:
            img = _load_image(n_spec.get("uri"))
            if img:
                _apply_uv(n_spec)
                tex = nodes.new(type="ShaderNodeTexImage")
                tex.image = img
                try:
                    tex.image.colorspace_settings.name = "Non-Color"
                except Exception:
                    pass
                links.new(add.outputs["Vector"], tex.inputs["Vector"])
                nm = nodes.new(type="ShaderNodeNormalMap")
                scale = n_spec.get("scale")
                if isinstance(scale, (int, float)) and math.isfinite(scale):
                    nm.inputs["Strength"].default_value = float(max(0.0, scale))
                links.new(tex.outputs["Color"], nm.inputs["Color"])
                links.new(nm.outputs["Normal"], _get_bsdf_input(bsdf, ["Normal"]))

        # Emissive texture (optional).
        e_spec = _tex(textures.get("emissive")) if isinstance(textures, dict) else None
        if e_spec:
            img = _load_image(e_spec.get("uri"))
            if img:
                _apply_uv(e_spec)
                tex = nodes.new(type="ShaderNodeTexImage")
                tex.image = img
                try:
                    tex.image.colorspace_settings.name = "sRGB"
                except Exception:
                    pass
                links.new(add.outputs["Vector"], tex.inputs["Vector"])
                ec_in = _get_bsdf_input(bsdf, ["Emission", "Emission Color"])
                if ec_in is not None:
                    links.new(tex.outputs["Color"], ec_in)

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
    mesh.validate(clean_customdata=False)
    mesh.update(calc_edges=True)

    if isinstance(uvs, list) and len(uvs) == vcount * 2:
        uv_layer = mesh.uv_layers.new(name="UVMap")
        for loop in mesh.loops:
            vi = loop.vertex_index
            uv_layer.data[loop.index].uv = (float(uvs[vi * 2 + 0]), float(uvs[vi * 2 + 1]))

    if isinstance(normals, list) and len(normals) == vcount * 3:
        try:
            n = [Vector((float(normals[i * 3 + 0]), float(normals[i * 3 + 1]), float(normals[i * 3 + 2]))) for i in range(vcount)]
            mesh.normals_split_custom_set_from_vertices(n)
            mesh.update()
        except Exception as e:
            print(f"[warn] Failed to set custom normals on {name} (ignored): {e}")

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

    # Give the studio room physical thickness so it renders properly (and window cutouts become real openings).
    if "room" in tags:
        thickness = None
        if "floor" in tags:
            thickness = 0.2
        elif name.lower().startswith("roomceiling"):
            thickness = 0.15
        elif "wall" in tags:
            thickness = 0.15

        if thickness and thickness > 0:
            try:
                mod = obj.modifiers.new(name="Solidify", type="SOLIDIFY")
                mod.thickness = float(thickness)
                mod.offset = 0.0  # centered thickness (robust to normal direction)
                mod.use_even_offset = True
                mod.use_rim = True
            except Exception:
                pass

    shadow = obj_spec.get("shadow") if isinstance(obj_spec, dict) else None
    cast = True
    receive = True
    if isinstance(shadow, dict):
        cast = bool(shadow.get("cast", True))
        receive = bool(shadow.get("receive", True))
    _set_shadow_flags(obj, cast, receive)

    return obj


def _hide_preview_helpers(scene):
    hide_prefixes = ("pick_", "outline_", "measure_", "debug_", "helper_")
    hide_names = {"windowPick"}
    for obj in list(scene.objects):
        n = obj.name or ""
        if n in hide_names or any(n.startswith(p) for p in hide_prefixes):
            obj.hide_render = True


def _open_studio_room(scene):
    # Keep the room sealed so light enters only through actual window openings.
    return


def _setup_camera(scene, camera_spec):
    cam_data = bpy.data.cameras.new("Camera")
    cam_obj = bpy.data.objects.new("Camera", cam_data)
    scene.collection.objects.link(cam_obj)

    pos = _as_vec3(camera_spec.get("position") if isinstance(camera_spec, dict) else None, (2.0, -2.0, 1.4))
    rot = _as_vec3(camera_spec.get("rotation") if isinstance(camera_spec, dict) else None, (0.9, 0.0, 0.0))
    target = _as_vec3(camera_spec.get("target") if isinstance(camera_spec, dict) else None, (0.0, 0.0, 0.0))
    cam_type = camera_spec.get("type") if isinstance(camera_spec, dict) else "perspective"
    fov_deg = float(camera_spec.get("fov")) if isinstance(camera_spec, dict) and isinstance(camera_spec.get("fov"), (int, float)) else 35.0
    ortho_scale = float(camera_spec.get("orthoScale")) if isinstance(camera_spec, dict) and isinstance(camera_spec.get("orthoScale"), (int, float)) else None
    near_v = float(camera_spec.get("near")) if isinstance(camera_spec, dict) and isinstance(camera_spec.get("near"), (int, float)) else None
    far_v = float(camera_spec.get("far")) if isinstance(camera_spec, dict) and isinstance(camera_spec.get("far"), (int, float)) else None

    cam_obj.location = pos
    if isinstance(camera_spec, dict) and camera_spec.get("target") is not None:
        d = (target - pos)
        if d.length < 1e-6:
            cam_obj.rotation_euler = (rot.x, rot.y, rot.z)
        else:
            cam_obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    else:
        cam_obj.rotation_euler = (rot.x, rot.y, rot.z)
    try:
        if cam_type == "orthographic":
            cam_data.type = "ORTHO"
            if ortho_scale and math.isfinite(ortho_scale):
                cam_data.ortho_scale = max(0.001, float(ortho_scale))
        else:
            cam_data.type = "PERSP"
            cam_data.angle_y = math.radians(max(1.0, min(179.0, fov_deg)))
    except Exception:
        pass
    try:
        if near_v and math.isfinite(near_v):
            cam_data.clip_start = max(0.0001, float(near_v))
        if far_v and math.isfinite(far_v):
            cam_data.clip_end = max(cam_data.clip_start + 0.001, float(far_v))
    except Exception:
        pass

    scene.camera = cam_obj


def _setup_sun(scene, light_spec, window_opening=None):
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

    # Place the SUN so it visually comes "from outside" through the window.
    # (SUN position doesn't affect lighting, but it helps debugging and consistency.)
    loc = Vector((0.0, 0.0, 0.0))
    if isinstance(window_opening, dict):
        center = _as_vec3(window_opening.get("center"), (0.0, 0.0, 0.0))
        dist = 25.0
        if isinstance(light_spec, dict) and isinstance(light_spec.get("sunDistance"), (int, float)):
            dist = float(max(0.1, light_spec.get("sunDistance")))
        loc = center - direction * dist
    sun_obj.location = loc


def _setup_window_portal(scene, window_spec):
    if not isinstance(window_spec, dict):
        return
    opening = window_spec.get("opening")
    if not isinstance(opening, dict):
        return

    center = _as_vec3(opening.get("center"), (0.0, 0.0, 0.0))
    inward = _as_vec3(opening.get("inwardNormal"), (0.0, 0.0, -1.0))
    if inward.length < 1e-6:
        inward = Vector((0.0, 0.0, -1.0))
    inward.normalize()

    width = float(opening.get("width")) if isinstance(opening.get("width"), (int, float)) else 1.0
    height = float(opening.get("height")) if isinstance(opening.get("height"), (int, float)) else 1.0
    width = max(0.05, min(20.0, width))
    height = max(0.05, min(20.0, height))

    light_data = bpy.data.lights.new(name="WindowPortal", type="AREA")
    light_obj = bpy.data.objects.new(name="WindowPortal", object_data=light_data)
    scene.collection.objects.link(light_obj)

    light_data.shape = "RECTANGLE"
    light_data.size = width
    light_data.size_y = height
    light_data.energy = 0.0

    # Place slightly outside and face inward.
    light_obj.location = center - inward * 0.02
    light_obj.rotation_euler = inward.to_track_quat("-Z", "Y").to_euler()

    # Cycles portal (if available).
    try:
        light_data.cycles.is_portal = True
    except Exception:
        pass


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

    cm = payload.get("colorManagement") if isinstance(payload, dict) else None
    _set_render_defaults(scene, preview_out is not None, cm)

    env = payload.get("environment") if isinstance(payload, dict) else None
    hdri_path = env.get("hdriPath") if isinstance(env, dict) else None
    hdri_strength = env.get("hdriStrength") if isinstance(env, dict) else 0.35
    hdri_bg = env.get("hdriBackground") if isinstance(env, dict) else True
    hdri_bg_strength = env.get("hdriBackgroundStrength") if isinstance(env, dict) else None
    hdri_rot = 0.0
    if isinstance(env, dict):
        for k in ["hdriRotationDeg", "hdriAngleDeg", "hdriAngle"]:
            v = env.get(k)
            if isinstance(v, (int, float)) and math.isfinite(v):
                hdri_rot = float(v)
                break
    _world_setup(
        scene,
        hdri_path,
        float(hdri_strength) if isinstance(hdri_strength, (int, float)) else 0.35,
        hdri_rot,
    )
    if isinstance(scene.world, bpy.types.World) and scene.world.use_nodes:
        try:
            nodes = scene.world.node_tree.nodes
            bg_cam = nodes.get("WorldBG_Cam")
            if bg_cam is not None:
                if isinstance(hdri_bg_strength, (int, float)) and math.isfinite(hdri_bg_strength):
                    bg_cam.inputs["Strength"].default_value = float(max(0.0, hdri_bg_strength))
                if not bool(hdri_bg):
                    bg_cam.inputs["Strength"].default_value = 0.0
        except Exception:
            pass

    _setup_camera(scene, payload.get("camera") if isinstance(payload, dict) else {})

    window_spec = payload.get("window") if isinstance(payload, dict) else None
    windows_spec = payload.get("windows") if isinstance(payload, dict) else None
    windows = []
    if isinstance(windows_spec, list):
        windows = [w for w in windows_spec if isinstance(w, dict)]
    elif isinstance(window_spec, dict):
        windows = [window_spec]

    lighting_spec = payload.get("lighting") if isinstance(payload, dict) else {}
    if not isinstance(lighting_spec, dict):
        lighting_spec = {}

    needs_dir = True
    if isinstance(lighting_spec.get("sunDirection"), list) and len(lighting_spec.get("sunDirection")) == 3:
        needs_dir = False
    if needs_dir and len(windows) >= 1:
        opening = windows[0].get("opening") if isinstance(windows[0], dict) else None
        inward = _as_vec3(opening.get("inwardNormal") if isinstance(opening, dict) else None, (-0.3, -0.9, -0.2))
        if inward.length > 1e-6:
            inward.normalize()
            lighting_spec = dict(lighting_spec)
            lighting_spec["sunDirection"] = [float(inward.x), float(inward.y), float(inward.z)]

    first_opening = None
    if len(windows) >= 1 and isinstance(windows[0], dict):
        opening = windows[0].get("opening")
        if isinstance(opening, dict):
            first_opening = opening

    _setup_sun(scene, lighting_spec, first_opening)
    for w in windows:
        _setup_window_portal(scene, w)

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

    _hide_preview_helpers(scene)
    _open_studio_room(scene)

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
