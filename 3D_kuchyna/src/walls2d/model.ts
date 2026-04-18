import { add, mul, norm, perpLeft, sub, type Line, type Point } from "./geom";

export type WallJustification = "center" | "interior" | "exterior";

export type Wall = {
  id: string;
  a: Point;
  b: Point;
  thicknessM: number;
  justification: WallJustification;
  // +1 => exterior is left of A->B, -1 => exterior is right of A->B
  exteriorSign: 1 | -1;
};

export function baseDir(w: Wall): Point {
  return norm(sub(w.b, w.a)); // a -> b
}

// Direction pointing outward from the given node along the wall.
export function spineDir(w: Wall, at: "a" | "b"): Point {
  const d = baseDir(w);
  return at === "a" ? d : mul(d, -1);
}

// Physical left normal of the wall when traveling from a -> b.
// Important: must be consistent for both ends (prevents twisted polygons).
export function leftNormal(w: Wall): Point {
  return norm(perpLeft(baseDir(w)));
}

export function offsetsM(w: Wall): { left: number; right: number } {
  const t = Math.max(1e-6, w.thicknessM);
  const half = t / 2;
  const extIsLeft = w.exteriorSign === 1;

  if (w.justification === "center") return { left: half, right: -half };

  if (w.justification === "exterior") {
    // exterior face stays on spine
    return extIsLeft ? { left: 0, right: -t } : { left: t, right: 0 };
  }

  // interior face stays on spine
  return extIsLeft ? { left: t, right: 0 } : { left: 0, right: -t };
}

export function sideLineAtNode(w: Wall, at: "a" | "b", side: "left" | "right"): Line {
  const dir = spineDir(w, at);
  const nL = leftNormal(w);
  const offs = offsetsM(w);
  const off = side === "left" ? offs.left : offs.right;
  const node = at === "a" ? w.a : w.b;
  return { p: add(node, mul(nL, off)), d: dir };
}

export function rawEndCorners(w: Wall, at: "a" | "b"): { left: Point; right: Point } {
  const node = at === "a" ? w.a : w.b;
  const nL = leftNormal(w);
  const offs = offsetsM(w);
  return { left: add(node, mul(nL, offs.left)), right: add(node, mul(nL, offs.right)) };
}

export function sideToFace(w: Wall, side: "left" | "right"): "exterior" | "interior" {
  const extIsLeft = w.exteriorSign === 1;
  if (side === "left") return extIsLeft ? "exterior" : "interior";
  return extIsLeft ? "interior" : "exterior";
}
