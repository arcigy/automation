import * as THREE from "three";
import type { GrainAlong } from "../ui/createPartPanel";

const DEFAULT_TEX_SCALE_M = 0.4; // 400mm per repeat (visual only)

function axisSize(size: { x: number; y: number; z: number }, axis: "x" | "y" | "z") {
  if (axis === "x") return size.x;
  if (axis === "y") return size.y;
  return size.z;
}

function selectFaceAxes(
  normal: THREE.Vector3,
  grainAlong: GrainAlong
): { uAxis: "x" | "y" | "z"; vAxis: "x" | "y" | "z" } {
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);

  // Face plane is the 2 axes orthogonal to the dominant normal axis.
  let a1: "x" | "y" | "z";
  let a2: "x" | "y" | "z";

  if (ax >= ay && ax >= az) {
    a1 = "y";
    a2 = "z";
  } else if (ay >= ax && ay >= az) {
    a1 = "x";
    a2 = "z";
  } else {
    a1 = "x";
    a2 = "y";
  }

  const desired =
    grainAlong === "width" ? "x" : grainAlong === "height" ? "y" : grainAlong === "depth" ? "z" : null;

  const vAxis = desired === a1 || desired === a2 ? desired : a1;
  const uAxis = vAxis === a1 ? a2 : a1;
  return { uAxis, vAxis };
}

export function applyBoxGrainUv(
  geometry: THREE.BufferGeometry,
  sizeM: { x: number; y: number; z: number },
  grainAlong: GrainAlong,
  opts?: { texScaleM?: number }
) {
  if (grainAlong === "none") return;

  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  const nor = geometry.getAttribute("normal") as THREE.BufferAttribute | undefined;
  if (!uv || !pos || !nor) return;

  const texScale = opts?.texScaleM ?? DEFAULT_TEX_SCALE_M;
  if (texScale <= 0) return;

  const tmpN = new THREE.Vector3();
  const tmpP = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    tmpP.fromBufferAttribute(pos, i);
    tmpN.fromBufferAttribute(nor, i);

    const axes = selectFaceAxes(tmpN, grainAlong);
    const uAxis = axes.uAxis;
    const vAxis = axes.vAxis;

    const uCoord = uAxis === "x" ? tmpP.x : uAxis === "y" ? tmpP.y : tmpP.z;
    const vCoord = vAxis === "x" ? tmpP.x : vAxis === "y" ? tmpP.y : tmpP.z;

    const uSize = axisSize(sizeM, uAxis);
    const vSize = axisSize(sizeM, vAxis);

    // World-scaled UVs so grain density is consistent across parts.
    const u = uCoord / texScale + (uSize / (2 * texScale));
    const v = vCoord / texScale + (vSize / (2 * texScale));

    uv.setXY(i, u, v);
  }

  uv.needsUpdate = true;
}

