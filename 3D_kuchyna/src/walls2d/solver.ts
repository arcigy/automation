import { add, clamp, dist, intersectLines, mul, sub, type Point } from "./geom";
import { rawEndCorners, sideLineAtNode, spineDir, type Wall } from "./model";

export type WallEnd = "a" | "b";

export type WallSolvedEnd = {
  left: Point;
  right: Point;
  join: "butt" | "miter" | "bevel";
  // when bevel happens we also return a join quad (exterior->exterior->interior->interior)
  bevelJoinPoly?: Point[];
};

export type WallSolved = {
  id: string;
  a: WallSolvedEnd;
  b: WallSolvedEnd;
  outline: Point[]; // polygon in XZ
};

type Node = { id: string; p: Point; incident: Array<{ wall: Wall; end: WallEnd }> };

function key(p: Point, tol = 1e-3) {
  // tol in meters -> quantize
  const qx = Math.round(p.x / tol);
  const qz = Math.round(p.z / tol);
  return `${qx},${qz}`;
}

function collinear(u: Point, v: Point) {
  const d = Math.abs(u.x * v.z - u.z * v.x);
  return d <= 1e-6;
}

function solveMiterAtNode(
  a: Wall,
  endA: WallEnd,
  b: Wall,
  endB: WallEnd,
  opts: { miterLimit: number }
): { aEnd: WallSolvedEnd; bEnd: WallSolvedEnd } {
  const rawA = rawEndCorners(a, endA);
  const rawB = rawEndCorners(b, endB);

  const limA = Math.max(0.001, a.thicknessM * opts.miterLimit);
  const limB = Math.max(0.001, b.thicknessM * opts.miterLimit);

  const sides: Array<"left" | "right"> = ["left", "right"];
  type Candidate = {
    aSideOuter: "left" | "right";
    bSideOuter: "left" | "right";
    iOuter: Point;
    iInner: Point;
    cost: number;
    tooLong: boolean;
  };

  const candidates: Candidate[] = [];
  for (const aOuter of sides) {
    for (const bOuter of sides) {
      const aInner = aOuter === "left" ? "right" : "left";
      const bInner = bOuter === "left" ? "right" : "left";
      const aOut = sideLineAtNode(a, endA, aOuter);
      const aIn = sideLineAtNode(a, endA, aInner);
      const bOut = sideLineAtNode(b, endB, bOuter);
      const bIn = sideLineAtNode(b, endB, bInner);
      const iOut = intersectLines(aOut, bOut);
      const iIn = intersectLines(aIn, bIn);
      if (!iOut || !iIn) continue;

      const aOutLen = dist(aOut.p, iOut.p);
      const aInLen = dist(aIn.p, iIn.p);
      const bOutLen = dist(bOut.p, iOut.p);
      const bInLen = dist(bIn.p, iIn.p);
      const tooLong = aOutLen > limA || aInLen > limA || bOutLen > limB || bInLen > limB;
      const cost = aOutLen + aInLen + bOutLen + bInLen;
      if (!isFinite(cost)) continue;
      candidates.push({ aSideOuter: aOuter, bSideOuter: bOuter, iOuter: iOut.p, iInner: iIn.p, cost, tooLong });
    }
  }

  if (candidates.length === 0) {
    return { aEnd: { ...rawA, join: "butt" }, bEnd: { ...rawB, join: "butt" } };
  }

  candidates.sort((x, y) => {
    if (x.tooLong !== y.tooLong) return x.tooLong ? 1 : -1;
    return x.cost - y.cost;
  });
  const best = candidates[0];

  const aInner = best.aSideOuter === "left" ? "right" : "left";
  const bInner = best.bSideOuter === "left" ? "right" : "left";
  const aOutL = sideLineAtNode(a, endA, best.aSideOuter);
  const aInL = sideLineAtNode(a, endA, aInner);
  const bOutL = sideLineAtNode(b, endB, best.bSideOuter);
  const bInL = sideLineAtNode(b, endB, bInner);

  if (!best.tooLong) {
    const aEnd: WallSolvedEnd =
      best.aSideOuter === "left"
        ? { left: best.iOuter, right: best.iInner, join: "miter" }
        : { left: best.iInner, right: best.iOuter, join: "miter" };
    const bEnd: WallSolvedEnd =
      best.bSideOuter === "left"
        ? { left: best.iOuter, right: best.iInner, join: "miter" }
        : { left: best.iInner, right: best.iOuter, join: "miter" };
    return { aEnd, bEnd };
  }

  const clampOn = (p0: Point, dir: Point, target: Point, maxLen: number) => {
    const v = sub(target, p0);
    const along = v.x * dir.x + v.z * dir.z;
    const t = clamp(along, 0, maxLen);
    return add(p0, mul(dir, t));
  };

  const da = spineDir(a, endA);
  const db = spineDir(b, endB);

  const aOutP = clampOn(aOutL.p, da, best.iOuter, limA);
  const aInP = clampOn(aInL.p, da, best.iInner, limA);
  const bOutP = clampOn(bOutL.p, db, best.iOuter, limB);
  const bInP = clampOn(bInL.p, db, best.iInner, limB);

  const joinPoly: Point[] = [aOutP, bOutP, bInP, aInP];

  const aEnd: WallSolvedEnd =
    best.aSideOuter === "left"
      ? { left: aOutP, right: aInP, join: "bevel", bevelJoinPoly: joinPoly }
      : { left: aInP, right: aOutP, join: "bevel", bevelJoinPoly: joinPoly };
  const bEnd: WallSolvedEnd =
    best.bSideOuter === "left"
      ? { left: bOutP, right: bInP, join: "bevel", bevelJoinPoly: joinPoly }
      : { left: bInP, right: bOutP, join: "bevel", bevelJoinPoly: joinPoly };

  return { aEnd, bEnd };
}

function solveTAtNode(main0: Wall, end0: WallEnd, main1: Wall, end1: WallEnd, branch: Wall, endB: WallEnd) {
  // Keep main continuous; cut branch end to main boundaries (butt).
  const rawB = rawEndCorners(branch, endB);
  const sides: Array<"left" | "right"> = ["left", "right"];

  let best: { bOuter: "left" | "right"; mOuter: "left" | "right"; out: Point; inn: Point; cost: number } | null =
    null;
  for (const bOuter of sides) {
    for (const mOuter of sides) {
      const bInner = bOuter === "left" ? "right" : "left";
      const mInner = mOuter === "left" ? "right" : "left";
      const bOut = sideLineAtNode(branch, endB, bOuter);
      const bIn = sideLineAtNode(branch, endB, bInner);
      const mOut = sideLineAtNode(main0, end0, mOuter);
      const mIn = sideLineAtNode(main0, end0, mInner);
      const iOut = intersectLines(bOut, mOut);
      const iIn = intersectLines(bIn, mIn);
      if (!iOut || !iIn) continue;
      const cost = dist(bOut.p, iOut.p) + dist(bIn.p, iIn.p);
      if (!best || cost < best.cost) best = { bOuter, mOuter, out: iOut.p, inn: iIn.p, cost };
    }
  }

  if (!best) return { branchEnd: { ...rawB, join: "butt" as const } };
  const branchEnd: WallSolvedEnd =
    best.bOuter === "left" ? { left: best.out, right: best.inn, join: "butt" } : { left: best.inn, right: best.out, join: "butt" };
  return { branchEnd };
}

export function solveWallNetwork(
  walls: Wall[],
  opts: { nodeTolM?: number; miterLimit?: number } = {}
): { walls: WallSolved[]; joinPolys: Point[][]; debug: { nodes: Node[] } } {
  const nodeTolM = opts.nodeTolM ?? 0.02;
  const miterLimit = opts.miterLimit ?? 8;

  const nodesMap = new Map<string, Node>();
  const pushNode = (p: Point, wall: Wall, end: WallEnd) => {
    const k = key(p, nodeTolM);
    let n = nodesMap.get(k);
    if (!n) {
      n = { id: k, p, incident: [] };
      nodesMap.set(k, n);
    }
    n.incident.push({ wall, end });
  };

  for (const w of walls) {
    pushNode(w.a, w, "a");
    pushNode(w.b, w, "b");
  }

  // seed solved ends with raw offsets
  const solvedEnds = new Map<string, { a: WallSolvedEnd; b: WallSolvedEnd }>();
  for (const w of walls) {
    solvedEnds.set(w.id, {
      a: { ...rawEndCorners(w, "a"), join: "butt" },
      b: { ...rawEndCorners(w, "b"), join: "butt" }
    });
  }

  const joinPolys: Point[][] = [];

  const nodes = Array.from(nodesMap.values());
  for (const node of nodes) {
    const inc = node.incident;
    if (inc.length < 2) continue;

    // Try to resolve 2-wall corner join
    if (inc.length === 2) {
      const A = inc[0];
      const B = inc[1];
      const res = solveMiterAtNode(A.wall, A.end, B.wall, B.end, { miterLimit });
      const sa = solvedEnds.get(A.wall.id)!;
      const sb = solvedEnds.get(B.wall.id)!;
      sa[A.end] = res.aEnd;
      sb[B.end] = res.bEnd;
      if (res.aEnd.bevelJoinPoly) joinPolys.push(res.aEnd.bevelJoinPoly);
      continue;
    }

    // T join: 3 incident, with 2 collinear
    if (inc.length === 3) {
      const dirs = inc.map((it) => spineDir(it.wall, it.end));
      let pair: [number, number] | null = null;
      for (let i = 0; i < 3 && !pair; i++) {
        for (let j = i + 1; j < 3 && !pair; j++) {
          if (collinear(dirs[i], dirs[j])) pair = [i, j];
        }
      }
      if (pair) {
        const k = [0, 1, 2].find((x) => x !== pair![0] && x !== pair![1])!;
        const m0 = inc[pair[0]];
        const m1 = inc[pair[1]];
        const br = inc[k];
        const res = solveTAtNode(m0.wall, m0.end, m1.wall, m1.end, br.wall, br.end);
        const sbr = solvedEnds.get(br.wall.id)!;
        sbr[br.end] = res.branchEnd;
      }
    }
  }

  const solved: WallSolved[] = [];
  for (const w of walls) {
    const se = solvedEnds.get(w.id)!;
    const a = se.a;
    const b = se.b;
    // Build polygon with consistent winding: [a.left, a.right, b.right, b.left]
    const outline = [a.left, a.right, b.right, b.left];
    solved.push({ id: w.id, a, b, outline });
  }

  return { walls: solved, joinPolys, debug: { nodes } };
}
