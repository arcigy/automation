export type Point = { x: number; z: number };
export type Line = { p: Point; d: Point }; // infinite line: p + d*t

export const EPS = 1e-8;

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, z: a.z + b.z };
}

export function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, z: a.z - b.z };
}

export function mul(a: Point, s: number): Point {
  return { x: a.x * s, z: a.z * s };
}

export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.z * b.z;
}

export function cross(a: Point, b: Point): number {
  return a.x * b.z - a.z * b.x;
}

export function len(a: Point): number {
  return Math.hypot(a.x, a.z);
}

export function len2(a: Point): number {
  return a.x * a.x + a.z * a.z;
}

export function norm(a: Point): Point {
  const l = len(a);
  if (l < EPS) return { x: 1, z: 0 };
  return { x: a.x / l, z: a.z / l };
}

export function perpLeft(d: Point): Point {
  return { x: -d.z, z: d.x };
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function line(p: Point, d: Point): Line {
  return { p, d };
}

export function intersectLines(a: Line, b: Line): { p: Point; ta: number; tb: number } | null {
  const rxs = cross(a.d, b.d);
  if (Math.abs(rxs) < EPS) return null;
  const qp = sub(b.p, a.p);
  const ta = cross(qp, b.d) / rxs;
  const tb = cross(qp, a.d) / rxs;
  return { p: add(a.p, mul(a.d, ta)), ta, tb };
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function almostEq(a: number, b: number, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

export function almostPoint(a: Point, b: Point, eps = 1e-6) {
  return dist(a, b) <= eps;
}

