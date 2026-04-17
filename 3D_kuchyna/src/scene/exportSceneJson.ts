import * as THREE from "three";

export type SceneExportV1 = {
  meta: {
    unit: "meters";
    version: 1;
    coordinateSystem: "blender_z_up";
    warnings?: string[];
  };
  camera: {
    type: "perspective" | "orthographic";
    position: [number, number, number];
    rotation: [number, number, number];
    fov?: number;
    orthoScale?: number;
    near?: number;
    far?: number;
    target?: [number, number, number];
  };
  environment: {
    hdriPath: string | null;
    hdriStrength: number;
    hdriBackground?: boolean;
    hdriBackgroundStrength?: number;
  };
  lighting: {
    sunDirection: [number, number, number];
    sunStrength: number;
    sunAngle: number;
  };
  window?: {
    opening?: {
      center: [number, number, number];
      inwardNormal: [number, number, number];
      width: number;
      height: number;
    };
    daylightIntensity?: number;
  };
  objects: Array<{
    name: string;
    type: "mesh";
    geometry: {
      kind: "box" | "plane" | "bufferGeometry";
      vertices: number[];
      indices: number[];
      normals?: number[];
      uvs?: number[];
    };
    transform: {
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
    };
    material: {
      type: "pbr";
      baseColor: [number, number, number];
      roughness: number;
      metallic: number;
      transmission: number;
      ior: number;
      emissive: [number, number, number];
      emissiveStrength?: number;
      textures?: {
        baseColor?: { uri: string; repeat?: [number, number]; rotationDeg?: number; offset?: [number, number] };
        normal?: { uri: string; repeat?: [number, number]; rotationDeg?: number; offset?: [number, number]; scale?: number };
        roughness?: { uri: string; repeat?: [number, number]; rotationDeg?: number; offset?: [number, number] };
        metallic?: { uri: string; repeat?: [number, number]; rotationDeg?: number; offset?: [number, number] };
        emissive?: { uri: string; repeat?: [number, number]; rotationDeg?: number; offset?: [number, number] };
      };
      envMapIntensity?: number;
    };
    shadow: {
      cast: boolean;
      receive: boolean;
    };
    tags: string[];
  }>;
};

const toFiniteNumber = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const BASIS_THREE_TO_BLENDER = new THREE.Matrix4().set(
  1, 0, 0, 0,
  0, 0, -1, 0,
  0, 1, 0, 0,
  0, 0, 0, 1
);
const BASIS_BLENDER_TO_THREE = BASIS_THREE_TO_BLENDER.clone().invert();

const threeToBlenderMatrix = (m: THREE.Matrix4) => BASIS_THREE_TO_BLENDER.clone().multiply(m).multiply(BASIS_BLENDER_TO_THREE);

const decomposeBlenderTRS = (worldMatrixThree: THREE.Matrix4) => {
  const m = threeToBlenderMatrix(worldMatrixThree);
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  m.decompose(position, quaternion, scale);
  const rotation = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
  return {
    position: [position.x, position.y, position.z] as [number, number, number],
    rotation: [rotation.x, rotation.y, rotation.z] as [number, number, number],
    scale: [scale.x, scale.y, scale.z] as [number, number, number]
  };
};

const threeToBlenderVec3 = (x: number, y: number, z: number) => [x, -z, y] as [number, number, number];

const texToSpec = (tex: THREE.Texture | null | undefined) => {
  if (!tex) return null;

  const img: any = (tex as any).image;
  const uri =
    typeof img?.currentSrc === "string" && img.currentSrc.trim().length > 0
      ? img.currentSrc
      : typeof img?.src === "string" && img.src.trim().length > 0
        ? img.src
        : null;
  if (!uri) return null;

  const repeat =
    tex.repeat && Number.isFinite(tex.repeat.x) && Number.isFinite(tex.repeat.y)
      ? ([tex.repeat.x, tex.repeat.y] as [number, number])
      : undefined;
  const offset =
    tex.offset && Number.isFinite(tex.offset.x) && Number.isFinite(tex.offset.y)
      ? ([tex.offset.x, tex.offset.y] as [number, number])
      : undefined;
  const rotationDeg = Number.isFinite(tex.rotation) ? (tex.rotation * 180) / Math.PI : undefined;

  return {
    uri,
    ...(repeat ? { repeat } : {}),
    ...(offset ? { offset } : {}),
    ...(rotationDeg !== undefined && Math.abs(rotationDeg) > 1e-6 ? { rotationDeg } : {})
  };
};

const inferTags = (name: string, userTags: unknown): string[] => {
  const tags: string[] = [];
  if (Array.isArray(userTags)) {
    for (const t of userTags) if (typeof t === "string" && t.trim()) tags.push(t.trim());
  }
  const n = name.toLowerCase();
  if (n.startsWith("room")) tags.push("room");
  if (n.includes("floor")) tags.push("floor");
  if (n.includes("wall") || n.includes("back") || n.includes("left") || n.includes("right") || n.includes("ceiling")) tags.push("wall");
  if (n.includes("wood")) tags.push("wood");
  if (n.includes("glass")) tags.push("glass");
  if (n.includes("metal")) tags.push("metal");
  return Array.from(new Set(tags));
};

const extractPbr = (material: THREE.Material | null | undefined, tags: string[]) => {
  const fallback = {
    type: "pbr" as const,
    baseColor: [0.8, 0.8, 0.8] as [number, number, number],
    roughness: 0.6,
    metallic: 0,
    transmission: 0,
    ior: 1.45,
    emissive: [0, 0, 0] as [number, number, number],
    emissiveStrength: 0
  };

  if (!material) return fallback;

  const m = material as any;
  const color = m.color instanceof THREE.Color ? m.color : null;
  const emissive = m.emissive instanceof THREE.Color ? m.emissive : null;

  const baseColorTex = texToSpec(m.map as THREE.Texture | undefined);
  const normalTex = texToSpec(m.normalMap as THREE.Texture | undefined);
  const roughnessTex = texToSpec(m.roughnessMap as THREE.Texture | undefined);
  const metallicTex = texToSpec(m.metalnessMap as THREE.Texture | undefined);
  const emissiveTex = texToSpec(m.emissiveMap as THREE.Texture | undefined);
  const normalScale =
    m.normalScale instanceof THREE.Vector2 && Number.isFinite(m.normalScale.x) && Number.isFinite(m.normalScale.y)
      ? (Math.abs(m.normalScale.x) + Math.abs(m.normalScale.y)) / 2
      : undefined;

  let roughness = toFiniteNumber(m.roughness, fallback.roughness);
  let metallic = toFiniteNumber(m.metalness, fallback.metallic);
  let transmission = toFiniteNumber(m.transmission, fallback.transmission);
  let ior = toFiniteNumber(m.ior, fallback.ior);

  if (!Number.isFinite(roughness)) roughness = fallback.roughness;
  if (!Number.isFinite(metallic)) metallic = fallback.metallic;
  if (!Number.isFinite(transmission)) transmission = fallback.transmission;
  if (!Number.isFinite(ior)) ior = fallback.ior;

  const hasExplicitTransmission = typeof m.transmission === "number";

  // Tag-based fallback tweaks (only when values are missing/obviously default).
  if (!Number.isFinite(m.roughness)) {
    if (tags.includes("wall")) roughness = 0.85;
    if (tags.includes("floor")) roughness = 0.6;
    if (tags.includes("wood")) roughness = 0.5;
    if (tags.includes("metal")) roughness = 0.25;
  }
  if (!Number.isFinite(m.metalness) && tags.includes("metal")) metallic = 1.0;
  if (!hasExplicitTransmission && tags.includes("glass")) {
    transmission = 1.0;
    roughness = Math.min(roughness, 0.06);
    ior = 1.45;
    metallic = 0;
  }

  const textures =
    baseColorTex || normalTex || roughnessTex || metallicTex || emissiveTex
      ? {
          ...(baseColorTex ? { baseColor: baseColorTex } : {}),
          ...(normalTex ? { normal: { ...normalTex, ...(Number.isFinite(normalScale) ? { scale: normalScale } : {}) } } : {}),
          ...(roughnessTex ? { roughness: roughnessTex } : {}),
          ...(metallicTex ? { metallic: metallicTex } : {}),
          ...(emissiveTex ? { emissive: emissiveTex } : {})
        }
      : undefined;
  const envMapIntensity = typeof m.envMapIntensity === "number" && Number.isFinite(m.envMapIntensity) ? Math.max(0, m.envMapIntensity) : undefined;

  return {
    type: "pbr" as const,
    baseColor: color ? ([clamp01(color.r), clamp01(color.g), clamp01(color.b)] as [number, number, number]) : fallback.baseColor,
    roughness: Math.max(0, Math.min(1, roughness)),
    metallic: Math.max(0, Math.min(1, metallic)),
    transmission: Math.max(0, Math.min(1, transmission)),
    ior: Math.max(1.0, Math.min(3.0, ior)),
    emissive: emissive ? ([clamp01(emissive.r), clamp01(emissive.g), clamp01(emissive.b)] as [number, number, number]) : fallback.emissive,
    emissiveStrength: toFiniteNumber(m.emissiveIntensity, 1),
    ...(textures ? { textures } : {}),
    ...(envMapIntensity !== undefined ? { envMapIntensity } : {})
  };
};

export type ExportSceneArgs = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  cameraTarget?: THREE.Vector3;
  environment?: { hdriPath: string | null; hdriStrength?: number; hdriBackground?: boolean; hdriBackgroundStrength?: number };
  lighting?: { sunDirection?: THREE.Vector3; sunStrength?: number; sunAngle?: number };
  window?: { opening?: { center: THREE.Vector3; inwardNormal: THREE.Vector3; width: number; height: number } | null; daylightIntensity?: number };
  includeInvisible?: boolean;
};

export function exportSceneToJson(args: ExportSceneArgs): SceneExportV1 {
  const warnings: string[] = [];

  args.camera.updateMatrixWorld(true);
  const cameraWorld = args.camera.matrixWorld.clone();
  const camTRS = decomposeBlenderTRS(cameraWorld);
  const isPerspective = (args.camera as any).isPerspectiveCamera === true;
  const isOrtho = (args.camera as any).isOrthographicCamera === true;
  const cameraType: SceneExportV1["camera"]["type"] = isOrtho ? "orthographic" : "perspective";
  const fov = isPerspective && typeof (args.camera as any).fov === "number" ? toFiniteNumber((args.camera as any).fov, 35) : undefined;
  const orthoScale =
    isOrtho &&
    typeof (args.camera as any).left === "number" &&
    typeof (args.camera as any).right === "number" &&
    Number.isFinite((args.camera as any).left) &&
    Number.isFinite((args.camera as any).right)
      ? Math.max(0.0001, Math.abs((args.camera as any).right - (args.camera as any).left))
      : undefined;
  const near = typeof (args.camera as any).near === "number" && Number.isFinite((args.camera as any).near) ? (args.camera as any).near : undefined;
  const far = typeof (args.camera as any).far === "number" && Number.isFinite((args.camera as any).far) ? (args.camera as any).far : undefined;

  const env = args.environment ?? { hdriPath: null, hdriStrength: 0.35 };
  const hdriStrength = Math.max(0, toFiniteNumber(env.hdriStrength, 0.35));
  const hdriBackground = typeof env.hdriBackground === "boolean" ? env.hdriBackground : true;
  const hdriBackgroundStrength = Math.max(0, toFiniteNumber(env.hdriBackgroundStrength, hdriStrength));

  const sunDirectionThree = args.lighting?.sunDirection?.clone().normalize() ?? new THREE.Vector3(-0.35, -1, -0.2).normalize();
  const sunDirB = threeToBlenderVec3(sunDirectionThree.x, sunDirectionThree.y, sunDirectionThree.z);
  const sunDirLen = Math.hypot(sunDirB[0], sunDirB[1], sunDirB[2]) || 1;
  const sunDirection = [sunDirB[0] / sunDirLen, sunDirB[1] / sunDirLen, sunDirB[2] / sunDirLen] as [number, number, number];

  const objects: SceneExportV1["objects"] = [];

  args.scene.updateMatrixWorld(true);

  args.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!(mesh as any).isMesh) return;
    if (!args.includeInvisible && !mesh.visible) return;

    const geo = mesh.geometry as THREE.BufferGeometry | undefined;
    if (!geo || !(geo as any).isBufferGeometry) {
      warnings.push(`Skipping non-buffer geometry mesh: ${mesh.name || mesh.uuid}`);
      return;
    }

    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!posAttr || posAttr.itemSize !== 3) {
      warnings.push(`Skipping mesh without position attribute: ${mesh.name || mesh.uuid}`);
      return;
    }

    const idx = geo.getIndex();
    const indices = idx ? Array.from(idx.array as any as ArrayLike<number>) : Array.from({ length: posAttr.count }, (_, i) => i);

    const vertices: number[] = new Array(posAttr.count * 3);
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      const [bx, by, bz] = threeToBlenderVec3(x, y, z);
      const o = i * 3;
      vertices[o + 0] = bx;
      vertices[o + 1] = by;
      vertices[o + 2] = bz;
    }

    const normalAttr = geo.getAttribute("normal") as THREE.BufferAttribute | undefined;
    let normals: number[] | undefined;
    if (normalAttr && normalAttr.itemSize === 3 && normalAttr.count === posAttr.count) {
      normals = new Array(normalAttr.count * 3);
      for (let i = 0; i < normalAttr.count; i++) {
        const x = normalAttr.getX(i);
        const y = normalAttr.getY(i);
        const z = normalAttr.getZ(i);
        const [bx, by, bz] = threeToBlenderVec3(x, y, z);
        const o = i * 3;
        normals[o + 0] = bx;
        normals[o + 1] = by;
        normals[o + 2] = bz;
      }
    } else if (!normalAttr) {
      warnings.push(`Mesh has no normals (will recalc in Blender): ${mesh.name || mesh.uuid}`);
    }

    const uvAttr = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
    let uvs: number[] | undefined;
    if (uvAttr && uvAttr.itemSize === 2 && uvAttr.count === posAttr.count) {
      uvs = new Array(uvAttr.count * 2);
      for (let i = 0; i < uvAttr.count; i++) {
        uvs[i * 2 + 0] = uvAttr.getX(i);
        uvs[i * 2 + 1] = uvAttr.getY(i);
      }
    }

    const kind: SceneExportV1["objects"][number]["geometry"]["kind"] =
      geo.type === "BoxGeometry" ? "box" : geo.type === "PlaneGeometry" ? "plane" : "bufferGeometry";

    const tags = inferTags(mesh.name || "Mesh", (mesh.userData as any)?.tags);
    const mat = Array.isArray(mesh.material) ? (mesh.material[0] ?? null) : mesh.material;
    const material = extractPbr(mat, tags);

    const transform = decomposeBlenderTRS(mesh.matrixWorld);

    objects.push({
      name: mesh.name || mesh.uuid,
      type: "mesh",
      geometry: {
        kind,
        vertices,
        indices,
        ...(normals ? { normals } : {}),
        ...(uvs ? { uvs } : {})
      },
      transform,
      material,
      shadow: { cast: !!mesh.castShadow, receive: !!mesh.receiveShadow },
      tags
    });
  });

  objects.sort((a, b) => a.name.localeCompare(b.name));

  return {
    meta: { unit: "meters", version: 1, coordinateSystem: "blender_z_up", ...(warnings.length ? { warnings } : {}) },
    camera: {
      type: cameraType,
      position: camTRS.position,
      rotation: camTRS.rotation,
      ...(fov !== undefined ? { fov } : {}),
      ...(orthoScale !== undefined ? { orthoScale } : {}),
      ...(near !== undefined ? { near } : {}),
      ...(far !== undefined ? { far } : {}),
      ...(args.cameraTarget
        ? { target: threeToBlenderVec3(args.cameraTarget.x, args.cameraTarget.y, args.cameraTarget.z) }
        : {})
    },
    environment: {
      hdriPath: env.hdriPath ?? null,
      hdriStrength,
      hdriBackground,
      hdriBackgroundStrength
    },
    lighting: {
      sunDirection,
      sunStrength: Math.max(0, toFiniteNumber(args.lighting?.sunStrength, 3.0)),
      sunAngle: Math.max(0.001, toFiniteNumber(args.lighting?.sunAngle, 0.8))
    },
    ...(args.window?.opening
      ? (() => {
          const opening = args.window!.opening!;
          const c = opening.center;
          const n = opening.inwardNormal.clone();
          if (n.lengthSq() > 1e-12) n.normalize();
          const centerB = threeToBlenderVec3(c.x, c.y, c.z);
          const normalB = threeToBlenderVec3(n.x, n.y, n.z);
          const len = Math.hypot(normalB[0], normalB[1], normalB[2]) || 1;
          const inwardNormal = [normalB[0] / len, normalB[1] / len, normalB[2] / len] as [number, number, number];

          return {
            window: {
              opening: {
                center: centerB,
                inwardNormal,
                width: Math.max(0.01, toFiniteNumber(opening.width, 1)),
                height: Math.max(0.01, toFiniteNumber(opening.height, 1))
              },
              ...(typeof args.window!.daylightIntensity === "number" && Number.isFinite(args.window!.daylightIntensity)
                ? { daylightIntensity: Math.max(0, args.window!.daylightIntensity) }
                : {})
            }
          } as const;
        })()
      : {}),
    objects
  };
}
