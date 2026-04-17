import * as THREE from "three";

export type PbrMaterialId = "wood_veneer_oak_7760_1k" | "plaster_painted_7664_1k" | "wood_floor_ash_4186_1k";

export type PbrMaterialRef = {
  id: PbrMaterialId;
  rotationDeg?: 0 | 90 | 180 | 270;
  tintColor?: string; // "#RRGGBB"
  tintStrength?: number; // 0..1
};

type LoadedSet = {
  baseColor: THREE.Texture;
  normal: THREE.Texture;
  roughness: THREE.Texture;
};

const loader = new THREE.TextureLoader();
const textureCache = new Map<string, Promise<LoadedSet>>();
const materialCache = new Map<string, THREE.MeshStandardMaterial>();

const MATERIAL_META: Record<PbrMaterialId, { worldSizeM: number }> = {
  // Source: Poliigon "Wood Veneer Oak 7760" (user-provided): 2.5m x 2.5m
  wood_veneer_oak_7760_1k: { worldSizeM: 2.5 },
  // Source: Poliigon "Plaster Painted 7664" (user-provided). Tile size set to 30cm x 30cm.
  plaster_painted_7664_1k: { worldSizeM: 0.3 },
  // Source: Poliigon "Wood Floor Ash 4186" (user-provided): 2.5m x 2.5m
  wood_floor_ash_4186_1k: { worldSizeM: 2.5 }
};

export function getPbrMaterialWorldSizeM(id: PbrMaterialId) {
  return MATERIAL_META[id].worldSizeM;
}

function keyOf(ref: PbrMaterialRef) {
  const tint = (ref.tintColor ?? "").toLowerCase();
  const strength = Math.round(((ref.tintStrength ?? 0) * 1000)) / 1000;
  return `${ref.id}:${ref.rotationDeg ?? 0}:${tint}:${strength}`;
}

function applyTransform(tex: THREE.Texture, rotationDeg: number, repeat?: { x: number; y: number }) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (repeat) tex.repeat.set(Math.max(0.0001, repeat.x), Math.max(0.0001, repeat.y));
  tex.center.set(0.5, 0.5);
  tex.rotation = (rotationDeg * Math.PI) / 180;
  tex.needsUpdate = true;
}

function cloneForUse(tex: THREE.Texture) {
  const c = tex.clone();
  c.image = tex.image;
  c.needsUpdate = true;
  return c;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function computeTintColor(fallbackColor: string, ref: PbrMaterialRef) {
  const strength = clamp01(ref.tintStrength ?? 0);
  if (strength <= 0) return new THREE.Color(1, 1, 1);

  const tint = new THREE.Color(ref.tintColor ?? fallbackColor);
  return new THREE.Color(1, 1, 1).lerp(tint, strength);
}

function urlFor(id: PbrMaterialId, file: "BaseColor.jpg" | "Normal.png" | "Roughness.jpg") {
  return `/materials/${id}/${file}`;
}

function loadSet(id: PbrMaterialId): Promise<LoadedSet> {
  const load = (url: string) =>
    new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });

  return Promise.all([load(urlFor(id, "BaseColor.jpg")), load(urlFor(id, "Normal.png")), load(urlFor(id, "Roughness.jpg"))]).then(
    ([baseColor, normal, roughness]) => ({ baseColor, normal, roughness })
  );
}

export function getPbrWoodMaterial(params: { fallbackColor: string; ref: PbrMaterialRef }): THREE.MeshStandardMaterial {
  return getPbrMaterial(params);
}

export function getPbrMaterial(params: {
  fallbackColor: string;
  ref: PbrMaterialRef;
  uvRepeat?: { x: number; y: number };
  normalScale?: number;
  envMapIntensity?: number;
}): THREE.MeshStandardMaterial {
  const repeat = params.uvRepeat ? { x: params.uvRepeat.x, y: params.uvRepeat.y } : null;
  const ns = typeof params.normalScale === "number" ? Math.round(params.normalScale * 1000) / 1000 : 1;
  const ei = typeof params.envMapIntensity === "number" ? Math.round(params.envMapIntensity * 1000) / 1000 : 1;
  const k = `${keyOf(params.ref)}:${repeat ? `${Math.round(repeat.x * 1000) / 1000},${Math.round(repeat.y * 1000) / 1000}` : "1,1"}:${ns}:${ei}`;
  const existing = materialCache.get(k);
  if (existing) return existing;

  const mat = new THREE.MeshStandardMaterial({
    color: computeTintColor(params.fallbackColor, params.ref),
    metalness: 0,
    roughness: 1
  });

  if (Number.isFinite(ns)) mat.normalScale.setScalar(Math.max(0, ns));
  if (Number.isFinite(ei)) (mat as any).envMapIntensity = Math.max(0, ei);

  materialCache.set(k, mat);

  const setPromise =
    textureCache.get(params.ref.id) ??
    (() => {
      const p = loadSet(params.ref.id);
      textureCache.set(params.ref.id, p);
      return p;
    })();

  void setPromise.then((set) => {
    const rot = params.ref.rotationDeg ?? 0;

    const baseColor = cloneForUse(set.baseColor);
    const normal = cloneForUse(set.normal);
    const roughness = cloneForUse(set.roughness);

    baseColor.colorSpace = THREE.SRGBColorSpace;
    applyTransform(baseColor, rot, repeat ?? undefined);
    applyTransform(normal, rot, repeat ?? undefined);
    applyTransform(roughness, rot, repeat ?? undefined);

    mat.map = baseColor;
    mat.normalMap = normal;
    mat.roughnessMap = roughness;
    mat.metalness = 0;
    mat.needsUpdate = true;
  });

  return mat;
}
