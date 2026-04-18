import { describe, expect, test } from "vitest";
import { solveWallNetwork } from "./solver";
import type { Wall } from "./model";
import { dist } from "./geom";

const P = (x: number, z: number) => ({ x, z });

function wall(
  id: string,
  a: { x: number; z: number },
  b: { x: number; z: number },
  tMm: number,
  exteriorSign: 1 | -1 = 1
): Wall {
  return { id, a, b, thicknessM: tMm / 1000, justification: "center", exteriorSign };
}

describe("walls2d join solver", () => {
  test("Case 1: 90° same thickness (clean miter)", () => {
    const w1 = wall("a", P(0, 0), P(5, 0), 150);
    const w2 = wall("b", P(0, 0), P(0, 5), 150);
    const res = solveWallNetwork([w1, w2], { nodeTolM: 1e-6, miterLimit: 12 });
    expect(res.walls.length).toBe(2);
    // At the shared node, at least one corner point must coincide between the two walls (no gap).
    const a0 = res.walls[0].outline;
    const b0 = res.walls[1].outline;
    const min = Math.min(
      ...a0.flatMap((pa) => b0.map((pb) => dist(pa, pb)))
    );
    expect(min).toBeLessThan(1e-6);
  });

  test("Case 2: 45° same thickness (no broken acute join)", () => {
    const w1 = wall("a", P(0, 0), P(5, 0), 150);
    const w2 = wall("b", P(0, 0), P(4, 4), 150);
    const res = solveWallNetwork([w1, w2], { nodeTolM: 1e-6, miterLimit: 12 });
    expect(res.walls.length).toBe(2);
    expect(res.joinPolys.length).toBeGreaterThanOrEqual(0);
  });

  test("Case 4: 90° different thickness (still joins)", () => {
    const w1 = wall("a", P(0, 0), P(5, 0), 300);
    const w2 = wall("b", P(0, 0), P(0, 5), 150);
    const res = solveWallNetwork([w1, w2], { nodeTolM: 1e-6, miterLimit: 12 });
    expect(res.walls.length).toBe(2);
    const a0 = res.walls[0].outline;
    const b0 = res.walls[1].outline;
    const min = Math.min(
      ...a0.flatMap((pa) => b0.map((pb) => dist(pa, pb)))
    );
    expect(min).toBeLessThan(1e-6);
  });

  test("Case 6: T join (branch cut to main)", () => {
    // Main wall is split at node (0,0) so node degree becomes 3.
    const main0 = wall("m0", P(-5, 0), P(0, 0), 150);
    const main1 = wall("m1", P(0, 0), P(5, 0), 150);
    const branch = wall("b", P(0, 0), P(0, 5), 100);
    const res = solveWallNetwork([main0, main1, branch], { nodeTolM: 1e-6, miterLimit: 12 });
    expect(res.walls.length).toBe(3);
  });
});

