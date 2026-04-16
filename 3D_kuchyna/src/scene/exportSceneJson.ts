import * as THREE from "three";

export type SceneExportV1 = {
  meta: {
    unit: "meters";
    version: 1;
    coordinateSystem: "blender_z_up";
    warnings?: string[];
  };
  camera: {
    position: [number, number, number];
    rotation: [number, number, number];
    fov: number;
  };
  environment: {
    hdriPath: string | null;
    hdriStrength: number;
  };
  lighting: {
    sunDirection: [number, number, number];
    sunStrength: number;
    sunAngle: number;
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

const inferTags = (name: string, userTags: unknown): string[] => {
  const tags: string[] = [];
  if (Array.isArray(userTags)) {
    for (const t of userTags) if (typeof t === "string" && t.trim()) tags.push(t.trim());
  }
  const n = name.toLowerCase();
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

  return {
    type: "pbr" as const,
    baseColor: color ? ([clamp01(color.r), clamp01(color.g), clamp01(color.b)] as [number, number, number]) : fallback.baseColor,
    roughness: Math.max(0, Math.min(1, roughness)),
    metallic: Math.max(0, Math.min(1, metallic)),
    transmission: Math.max(0, Math.min(1, transmission)),
    ior: Math.max(1.0, Math.min(3.0, ior)),
    emissive: emissive ? ([clamp01(emissive.r), clamp01(emissive.g), clamp01(emissive.b)] as [number, number, number]) : fallback.emissive,
    emissiveStrength: toFiniteNumber(m.emissiveIntensity, 1)
  };
};

export type ExportSceneArgs = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  environment?: { hdriPath: string | null; hdriStrength?: number };
  lighting?: { sunDirection?: THREE.Vector3; sunStrength?: number; sunAngle?: number };
  includeInvisible?: boolean;
};

export function exportSceneToJson(args: ExportSceneArgs): SceneExportV1 {
  const warnings: string[] = [];

  const cameraWorld = args.camera.matrixWorld.clone();
  const camTRS = decomposeBlenderTRS(cameraWorld);
  const fov =
    (args.camera as any).isPerspectiveCamera && typeof (args.camera as any).fov === "number"
      ? toFiniteNumber((args.camera as any).fov, 35)
      : 35;

  const env = args.environment ?? { hdriPath: null, hdriStrength: 0.35 };
  const hdriStrength = Math.max(0, toFiniteNumber(env.hdriStrength, 0.35));

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
    camera: { position: camTRS.position, rotation: camTRS.rotation, fov },
    environment: { hdriPath: env.hdriPath ?? null, hdriStrength },
    lighting: {
      sunDirection,
      sunStrength: Math.max(0, toFiniteNumber(args.lighting?.sunStrength, 3.0)),
      sunAngle: Math.max(0.001, toFiniteNumber(args.lighting?.sunAngle, 0.8))
    },
    objects
  };
}

