import * as THREE from "three";
import type { NestedDrawerLowParams, DrawerLowParams } from "../model/cabinetTypes";
import { buildDrawerLow } from "./buildDrawerLow";

const MM_TO_M = 0.001;

export function buildNestedDrawerLow(p: NestedDrawerLowParams): THREE.Group {
  // Reuse the existing floor-standing carcass + a drawer stack (fronts + rails + outer boxes)
  // and then add an inner tray drawer into the TOP drawer.
  const base: DrawerLowParams = {
    type: "drawer_low",
    width: p.width,
    height: p.height,
    depth: p.depth,
    boardThickness: p.boardThickness,
    backThickness: p.backThickness,
    plinthHeight: p.plinthHeight,
    plinthSetbackMm: p.plinthSetbackMm,
    frontGap: p.frontGap,
    sideGap: p.sideGap,
    topGap: p.topGap,
    bottomGap: p.bottomGap,
    sideClearanceMm: p.sideClearanceMm,
    frontThicknessMm: p.frontThicknessMm,
    frontStackPreset: p.frontStackPreset,
    topFrontHeightMm: p.topFrontHeightMm,
    handleType: p.handleType,
    handlePositionMm: p.handlePositionMm,
    handleLengthMm: p.handleLengthMm,
    handleSizeMm: p.handleSizeMm,
    handleProjectionMm: p.handleProjectionMm,
    drawerBoxThickness: p.drawerBoxThickness,
    drawerBoxSideHeight: p.drawerBoxSideHeight,
    drawerCount: p.drawerCount,
    drawerFrontHeights: p.drawerFrontHeights,
    materials: p.materials
  };

  const g = buildDrawerLow(base);
  g.name = "nestedDrawerLowModule";

  // Compute the outer drawer geometry (mirrors buildDrawerLow math) to place inner drawer.
  const width = p.width * MM_TO_M;
  const height = p.height * MM_TO_M;
  const depth = p.depth * MM_TO_M;
  const boardT = p.boardThickness * MM_TO_M;
  const plinthH = p.plinthHeight * MM_TO_M;
  const frontGap = p.frontGap * MM_TO_M;
  const sideGap = p.sideGap * MM_TO_M;
  const bottomGap = p.bottomGap * MM_TO_M;
  const sideClearance = p.sideClearanceMm * MM_TO_M;
  const drawerBoxT = p.drawerBoxThickness * MM_TO_M;

  const drawerMat = new THREE.MeshStandardMaterial({
    color: parseHexColor(p.materials.drawerColor),
    roughness: 0.8,
    metalness: 0.0
  });
  // Modern inner trays often use metal sides/back (hardware) with a thin bottom panel.
  const innerHardwareMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.55, metalness: 0.25 });
  const latchMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.55, metalness: 0.1 });

  const setPartMeta = (mesh: THREE.Mesh, dimsM: { width: number; height: number; depth: number }) => {
    mesh.userData.selectable = true;
    mesh.userData.dimensionsMm = {
      width: dimsM.width / MM_TO_M,
      height: dimsM.height / MM_TO_M,
      depth: dimsM.depth / MM_TO_M
    };
  };

  const setParamKeys = (mesh: THREE.Object3D, keys: Array<keyof NestedDrawerLowParams | string>) => {
    (mesh as any).userData ??= {};
    (mesh as any).userData.paramKeys = [...keys];
  };

  const internalW = width - 2 * boardT;
  const internalD = depth;

  // Inner tray lives in the TOP drawer (common kitchen pattern).
  const drawerCount = Math.max(2, Math.round(p.drawerCount));
  const topIndex = drawerCount - 1;
  const topFrontH = (p.drawerFrontHeights[topIndex] ?? 200) * MM_TO_M;

  // Rails (carcass-mounted) define the required side clearance.
  const railT = 0.012;
  const slideAllowanceX = railT + 0.003;

  // Outer drawer clearance is defined by the drawer slide/hardware, not by the front reveal (sideGap).
  const drawerClearSide = Math.max(0.005, sideClearance);
  const drawerClearTopBottom = Math.max(0.006, frontGap * 2);
  const drawerOuterW = Math.max(0.05, internalW - 2 * (drawerClearSide + slideAllowanceX));
  const drawerOuterH = Math.max(0.05, topFrontH - drawerClearTopBottom);
  const drawerOuterD = Math.max(0.1, internalD - 0.05);

  const carcassFrontZ = depth / 2;
  const drawerFrontClear = 0.001;

  const openingBottomY = plinthH;
  let cursorY = openingBottomY + bottomGap;
  for (let i = 0; i < topIndex; i++) {
    const h = (p.drawerFrontHeights[i] ?? 200) * MM_TO_M;
    cursorY += h + frontGap;
  }
  const desiredCenterY = cursorY + topFrontH / 2;
  const innerMinY = plinthH + boardT + 0.002;
  const innerMaxY = height - boardT - 0.002;
  const minCenterY = innerMinY + drawerOuterH / 2;
  const maxCenterY = innerMaxY - drawerOuterH / 2;
  const centerY = maxCenterY >= minCenterY ? clamp(desiredCenterY, minCenterY, maxCenterY) : desiredCenterY;

  const outerCenter = new THREE.Vector3(0, centerY, carcassFrontZ - drawerFrontClear - drawerOuterD / 2);

  // Inner tray drawer sizing (kept simple + conservative)
  const innerDepth = Math.min(p.innerDrawerDepth * MM_TO_M, Math.max(0.1, drawerOuterD - 0.02));
  const innerSideH = Math.min(p.innerDrawerSideHeight * MM_TO_M, Math.max(0.02, drawerOuterH - 0.02));
  const innerOuterW = Math.max(0.05, drawerOuterW - 2 * (drawerBoxT + 0.004));

  // Place inner drawer near the top of the outer drawer so it's clearly "in-drawer".
  const clearanceY = 0.003;
  const topInsideY = outerCenter.y + drawerOuterH / 2 - clearanceY;
  const innerCenterY = topInsideY - innerSideH / 2;

  // Keep inner drawer aligned to the outer drawer front inside.
  const outerFrontZ = carcassFrontZ - drawerFrontClear;
  const innerCenterZ = outerFrontZ - innerDepth / 2;

  const leftGeo = new THREE.BoxGeometry(drawerBoxT, innerSideH, innerDepth);
  const rightGeo = new THREE.BoxGeometry(drawerBoxT, innerSideH, innerDepth);
  const bottomGeo = new THREE.BoxGeometry(Math.max(0.02, innerOuterW - 2 * drawerBoxT), drawerBoxT, Math.max(0.05, innerDepth - drawerBoxT));
  const backGeo = new THREE.BoxGeometry(Math.max(0.02, innerOuterW - 2 * drawerBoxT), innerSideH, drawerBoxT);

  const xL = -innerOuterW / 2 + drawerBoxT / 2;
  const xR = innerOuterW / 2 - drawerBoxT / 2;

  const sideL = new THREE.Mesh(leftGeo, innerHardwareMat);
  sideL.name = "innerDrawer_sideL";
  sideL.position.set(xL, innerCenterY, innerCenterZ);
  setPartMeta(sideL, { width: drawerBoxT, height: innerSideH, depth: innerDepth });
  setParamKeys(sideL, ["innerDrawerDepth", "innerDrawerSideHeight", "drawerBoxThickness", "width", "depth", "drawerCount"]);
  g.add(sideL);

  const sideR = new THREE.Mesh(rightGeo, innerHardwareMat);
  sideR.name = "innerDrawer_sideR";
  sideR.position.set(xR, innerCenterY, innerCenterZ);
  setPartMeta(sideR, { width: drawerBoxT, height: innerSideH, depth: innerDepth });
  setParamKeys(sideR, ["innerDrawerDepth", "innerDrawerSideHeight", "drawerBoxThickness", "width", "depth", "drawerCount"]);
  g.add(sideR);

  const bottom = new THREE.Mesh(bottomGeo, drawerMat);
  bottom.name = "innerDrawer_bottom";
  bottom.position.set(0, innerCenterY - innerSideH / 2 + drawerBoxT / 2, innerCenterZ + drawerBoxT / 2);
  setPartMeta(bottom, {
    width: Math.max(0.02, innerOuterW - 2 * drawerBoxT),
    height: drawerBoxT,
    depth: Math.max(0.05, innerDepth - drawerBoxT)
  });
  setParamKeys(bottom, ["innerDrawerDepth", "drawerBoxThickness", "width", "depth", "drawerCount"]);
  g.add(bottom);

  const back = new THREE.Mesh(backGeo, innerHardwareMat);
  back.name = "innerDrawer_back";
  back.position.set(0, innerCenterY, innerCenterZ - innerDepth / 2 + drawerBoxT / 2);
  setPartMeta(back, {
    width: Math.max(0.02, innerOuterW - 2 * drawerBoxT),
    height: innerSideH,
    depth: drawerBoxT
  });
  setParamKeys(back, ["innerDrawerDepth", "innerDrawerSideHeight", "drawerBoxThickness", "width", "depth", "drawerCount"]);
  g.add(back);

  // Inner drawer: no visible front (tray without a facade). Add a small push-to-open latch marker.
  {
    const latchW = 0.035;
    const latchH = 0.012;
    const latchD = 0.02;
    const latchGeo = new THREE.BoxGeometry(latchW, latchH, latchD);
    const latch = new THREE.Mesh(latchGeo, latchMat);
    latch.name = "innerDrawer_pushLatch";
    // Slightly behind the carcass front, centered.
    latch.position.set(0, innerCenterY, outerFrontZ - 0.01);
    setPartMeta(latch, { width: latchW, height: latchH, depth: latchD });
    setParamKeys(latch, ["innerDrawerDepth", "innerDrawerSideHeight", "drawerCount"]);
    latch.userData.openMethod = "push";
    g.add(latch);
  }

  return g;
}

function parseHexColor(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 0xffffff;
  return Number.parseInt(hex.slice(1), 16);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
