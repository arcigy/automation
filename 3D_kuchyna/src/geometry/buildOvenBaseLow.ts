import * as THREE from "three";
import type { OvenBaseLowParams } from "../model/cabinetTypes";
import { getPbrMaterialWorldSizeM, getPbrWoodMaterial } from "../materials/pbrMaterials";
import { applyBoxGrainUv } from "../materials/uvGrain";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const MM_TO_M = 0.001;

export function buildOvenBaseLow(p: OvenBaseLowParams): THREE.Group {
  const g = new THREE.Group();
  g.name = "ovenBaseLowModule";

  const width = Math.max(200, p.width) * MM_TO_M;
  const height = Math.max(200, p.height) * MM_TO_M;
  const depth = Math.max(200, p.depth) * MM_TO_M;
  const boardT = Math.max(0.005, p.boardThickness * MM_TO_M);
  const backT = Math.max(0.003, p.backThickness * MM_TO_M);
  const plinthH = (p.wallMounted ? 0 : Math.max(0, p.plinthHeight)) * MM_TO_M;
  const plinthSetback = Math.max(0, p.plinthSetbackMm) * MM_TO_M;

  const sideGap = Math.max(0, p.sideGap) * MM_TO_M;
  const bottomGap = Math.max(0, p.bottomGap) * MM_TO_M;
  const frontT = Math.max(0.005, (p.frontThicknessMm > 0 ? p.frontThicknessMm : p.boardThickness) * MM_TO_M);

  const drawerEnabled = p.drawerEnabled === true;
  const drawerFrontH = Math.max(0, p.drawerFrontHeightMm) * MM_TO_M;
  const drawerGapAbove = Math.max(0, p.drawerGapAboveMm) * MM_TO_M;
  const sideClearance = Math.max(0, p.sideClearanceMm) * MM_TO_M;
  const drawerBoxT = Math.max(0.003, p.drawerBoxThickness * MM_TO_M);
  const drawerSideH = Math.max(0.03, p.drawerBoxSideHeight * MM_TO_M);
  const drawerBoxDepth = Math.max(0.05, p.drawerBoxDepthMm) * MM_TO_M;

  // Kickboard geometry inputs reused by legs + kickboard positioning.
  const kickDepth = Math.min(boardT, depth * 0.2);
  const kickSetback = Math.min(plinthSetback, depth / 2);
  const kickCenterZ = depth / 2 - kickDepth / 2 - kickSetback;
  const kickBackFaceZ = kickCenterZ - kickDepth / 2;

  const bodyMat = p.materials.bodyPbr
    ? getPbrWoodMaterial({ fallbackColor: p.materials.bodyColor, ref: p.materials.bodyPbr })
    : new THREE.MeshStandardMaterial({
        color: parseHexColor(p.materials.bodyColor),
        roughness: 0.85,
        metalness: 0.0
      });
  // Slightly different material for front edge banding so the front edges read as "finished".
  const edgeMat = new THREE.MeshStandardMaterial({
    color: lightenHex(parseHexColor(p.materials.bodyColor), 0.08),
    roughness: 0.65,
    metalness: 0.0
  });
  const frontMat = new THREE.MeshStandardMaterial({
    color: parseHexColor(p.materials.frontColor),
    roughness: 0.65,
    metalness: 0.0
  });
  const drawerMat = new THREE.MeshStandardMaterial({
    color: parseHexColor(p.materials.drawerColor),
    roughness: 0.8,
    metalness: 0.0
  });
  // Modern kitchen drawers: metal sides + metal back, only the bottom panel is board (DTD/ply).
  const drawerHardwareMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.55, metalness: 0.25 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.55, metalness: 0.1 });

  const setPartMeta = (
    mesh: THREE.Mesh,
    dimsM: { width: number; height: number; depth: number },
    grainAlong: "width" | "height" | "depth" | "none" = "none"
  ) => {
    mesh.userData.selectable = true;
    mesh.userData.dimensionsMm = {
      width: dimsM.width / MM_TO_M,
      height: dimsM.height / MM_TO_M,
      depth: dimsM.depth / MM_TO_M
    };
    mesh.userData.grainAlong = grainAlong;
    if (p.materials.bodyPbr) {
      applyBoxGrainUv(
        mesh.geometry as THREE.BufferGeometry,
        { x: dimsM.width, y: dimsM.height, z: dimsM.depth },
        grainAlong,
        { texScaleM: getPbrMaterialWorldSizeM(p.materials.bodyPbr.id) }
      );
    }
  };

  const setPartMetaMm = (
    mesh: THREE.Mesh,
    dimsMm: { width: number; height: number; depth: number },
    grainAlong: "width" | "height" | "depth" | "none" = "none"
  ) => {
    mesh.userData.selectable = true;
    mesh.userData.dimensionsMm = { ...dimsMm };
    mesh.userData.grainAlong = grainAlong;
  };

  const setParamKeys = (obj: THREE.Object3D, keys: Array<keyof OvenBaseLowParams | string>) => {
    (obj as any).userData ??= {};
    (obj as any).userData.paramKeys = [...keys];
  };

  const addFrontEdgeBand = (
    name: string,
    dims: { width: number; height: number; depth: number },
    pos: THREE.Vector3,
    keys: Array<keyof OvenBaseLowParams | string> = ["width", "height", "depth", "boardThickness"]
  ) => {
    // Very thin cap on the front face (+Z). This mimics edge banding without heavy bevel geometry.
    const geo = new THREE.BoxGeometry(dims.width, dims.height, dims.depth);
    const m = new THREE.Mesh(geo, edgeMat);
    m.name = name;
    m.position.copy(pos);
    // Keep bands non-selectable to avoid noisy clicking.
    m.userData.selectable = false;
    setParamKeys(m, keys);
    g.add(m);
  };

  // Coordinate system:
  // - Y up, ground at y=0
  // - Cabinet centered on X, Z (front is +Z, back is -Z)
  // - Cabinet body starts at y=plinthH
  const openingH = height - plinthH;
  const sideH = Math.max(0.05, openingH);

  // Interior dimensions:
  // Back panel is mounted OUTSIDE the carcass, so it does not eat into internal depth.
  const internalW = Math.max(0.05, width - 2 * boardT);
  const internalD = depth;
  const interiorCenterZ = 0;

  // Sides
  const sideGeo = new THREE.BoxGeometry(boardT, sideH, depth);
  const leftSide = new THREE.Mesh(sideGeo, bodyMat);
  leftSide.name = "leftSide";
  leftSide.position.set(-(width / 2 - boardT / 2), plinthH + sideH / 2, 0);
  setPartMeta(leftSide, { width: boardT, height: sideH, depth }, "height");
  setParamKeys(leftSide, ["width", "height", "depth", "boardThickness", "plinthHeight", "wallMounted"]);
  g.add(leftSide);

  const rightSide = new THREE.Mesh(sideGeo, bodyMat);
  rightSide.name = "rightSide";
  rightSide.position.set(width / 2 - boardT / 2, plinthH + sideH / 2, 0);
  setPartMeta(rightSide, { width: boardT, height: sideH, depth }, "height");
  setParamKeys(rightSide, ["width", "height", "depth", "boardThickness", "plinthHeight", "wallMounted"]);
  g.add(rightSide);

  // Front edge bands on sides (finished front edges)
  {
    const bandD = 0.002;
    const eps = 0.00015;
    const z = depth / 2 - bandD / 2 - eps;
    addFrontEdgeBand(
      "edge_leftSide_front",
      { width: boardT, height: sideH, depth: bandD },
      new THREE.Vector3(leftSide.position.x, leftSide.position.y, z),
      ["boardThickness", "depth", "height", "plinthHeight", "wallMounted"]
    );
    addFrontEdgeBand(
      "edge_rightSide_front",
      { width: boardT, height: sideH, depth: bandD },
      new THREE.Vector3(rightSide.position.x, rightSide.position.y, z),
      ["boardThickness", "depth", "height", "plinthHeight", "wallMounted"]
    );
  }

  // Bottom panel (sits above plinth)
  const bottomGeo = new THREE.BoxGeometry(internalW, boardT, internalD);
  const bottom = new THREE.Mesh(bottomGeo, bodyMat);
  bottom.name = "bottom";
  bottom.position.set(0, plinthH + boardT / 2, interiorCenterZ);
  setPartMeta(bottom, { width: internalW, height: boardT, depth: internalD }, "width");
  setParamKeys(bottom, ["width", "depth", "boardThickness", "plinthHeight", "wallMounted"]);
  g.add(bottom);

  // Front edge band on bottom
  {
    const bandD = 0.002;
    const eps = 0.00015;
    const z = depth / 2 - bandD / 2 - eps;
    addFrontEdgeBand(
      "edge_bottom_front",
      { width: internalW, height: boardT, depth: bandD },
      new THREE.Vector3(0, bottom.position.y, z),
      ["width", "depth", "boardThickness", "plinthHeight", "wallMounted"]
    );
  }

  // Top stretchers (kitchen-style): front + back rails instead of a full top panel.
  const railD = Math.min(depth * 0.25, Math.max(0.06, boardT * 3)); // ~60-140mm
  const railGeo = new THREE.BoxGeometry(internalW, boardT, railD);

  const topRailFront = new THREE.Mesh(railGeo, bodyMat);
  topRailFront.name = "topRailFront";
  topRailFront.position.set(0, height - boardT / 2, depth / 2 - railD / 2);
  setPartMeta(topRailFront, { width: internalW, height: boardT, depth: railD }, "width");
  setParamKeys(topRailFront, ["width", "depth", "height", "boardThickness", "wallMounted"]);
  g.add(topRailFront);

  // Front edge band on top front rail
  {
    const bandD = 0.002;
    const eps = 0.00015;
    const z = depth / 2 - bandD / 2 - eps;
    addFrontEdgeBand(
      "edge_topRailFront_front",
      { width: internalW, height: boardT, depth: bandD },
      new THREE.Vector3(0, topRailFront.position.y, z),
      ["width", "depth", "height", "boardThickness", "wallMounted"]
    );
  }

  const topRailBack = new THREE.Mesh(railGeo, bodyMat);
  topRailBack.name = "topRailBack";
  topRailBack.position.set(0, height - boardT / 2, -depth / 2 + railD / 2);
  setPartMeta(topRailBack, { width: internalW, height: boardT, depth: railD }, "width");
  setParamKeys(topRailBack, ["width", "depth", "height", "boardThickness", "wallMounted"]);
  g.add(topRailBack);

  // Back panel (full width), mounted outside so it doesn't overlap the interior volume.
  const backGeo = new THREE.BoxGeometry(width, sideH, backT);
  const back = new THREE.Mesh(backGeo, bodyMat);
  back.name = "back";
  back.position.set(0, plinthH + sideH / 2, -depth / 2 - backT / 2);
  setPartMeta(back, { width, height: sideH, depth: backT }, "width");
  setParamKeys(back, ["width", "height", "depth", "backThickness", "plinthHeight", "wallMounted"]);
  g.add(back);

  // Legs + kickboard (only when not wall mounted)
  if (!p.wallMounted && plinthH > 0) {
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6, metalness: 0.1 });
    const legRadius = 0.02;
    const legGeo = new THREE.CylinderGeometry(legRadius, legRadius, plinthH, 18);
    const insetX = 0.03;
    const insetZ = 0.06;
    const xL = -width / 2 + insetX;
    const xR = width / 2 - insetX;

    // Ensure front legs are always behind the kickboard.
    const legMaxFrontCenterZ = kickBackFaceZ - legRadius - 0.01;
    const zF = Math.min(depth / 2 - insetZ, legMaxFrontCenterZ);
    const zB = -depth / 2 + insetZ;

    const addLeg = (name: string, x: number, z: number) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.name = name;
      leg.position.set(x, plinthH / 2, z);
      setPartMetaMm(leg, { width: legRadius * 2 * 1000, height: p.plinthHeight, depth: legRadius * 2 * 1000 }, "none");
      setParamKeys(leg, ["plinthHeight", "plinthSetbackMm", "depth", "width"]);
      g.add(leg);
    };

    addLeg("leg_FL", xL, zF);
    addLeg("leg_FR", xR, zF);
    addLeg("leg_BL", xL, zB);
    addLeg("leg_BR", xR, zB);

    const kickGeo = new THREE.BoxGeometry(width, plinthH, kickDepth);
    const kick = new THREE.Mesh(kickGeo, bodyMat);
    kick.name = "kickboard";
    kick.position.set(0, plinthH / 2, kickCenterZ);
    setPartMeta(kick, { width, height: plinthH, depth: kickDepth }, "width");
    setParamKeys(kick, ["plinthHeight", "plinthSetbackMm", "width", "depth", "wallMounted"]);
    g.add(kick);
  }

  // Divider above the drawer (common in oven cabinets).
  const innerMinY = plinthH + boardT;
  const drawerBottomGap = bottomGap;
  const drawerFrontY0 = innerMinY + drawerBottomGap;
  const drawerFrontY1 = drawerFrontY0 + (drawerEnabled ? drawerFrontH : 0);
  const dividerY = drawerEnabled ? drawerFrontY1 + drawerGapAbove + boardT / 2 : innerMinY + boardT / 2;

  if (dividerY + boardT / 2 < height - boardT - 0.001) {
    const dividerGeo = new THREE.BoxGeometry(internalW, boardT, internalD);
    const divider = new THREE.Mesh(dividerGeo, bodyMat);
    divider.name = "divider";
    divider.position.set(0, dividerY, interiorCenterZ);
    setPartMeta(divider, { width: internalW, height: boardT, depth: internalD }, "width");
    setParamKeys(divider, ["drawerFrontHeightMm", "drawerGapAboveMm", "height", "boardThickness", "wallMounted"]);
    g.add(divider);

    // Front edge band on divider (very visible on oven cabinets)
    const bandD = 0.002;
    const eps = 0.00015;
    const z = depth / 2 - bandD / 2 - eps;
    addFrontEdgeBand(
      "edge_divider_front",
      { width: internalW, height: boardT, depth: bandD },
      new THREE.Vector3(0, divider.position.y, z),
      ["drawerFrontHeightMm", "drawerGapAboveMm", "height", "boardThickness", "wallMounted"]
    );
  }

  // Drawer front + simplified drawer box (optional)
  if (drawerEnabled && drawerFrontH > 0.001) {
    const frontW = Math.max(0.05, width - 2 * sideGap);
    const frontGeo = new THREE.BoxGeometry(frontW, drawerFrontH, frontT);
    const front = new THREE.Mesh(frontGeo, frontMat);
    front.name = "drawerFront";
    const frontZ = depth / 2 + frontT / 2;
    const frontY = drawerFrontY0 + drawerFrontH / 2;
    front.position.set(0, frontY, frontZ);
    setPartMeta(front, { width: frontW, height: drawerFrontH, depth: frontT }, "height");
    setParamKeys(front, [
      "drawerEnabled",
      "drawerFrontHeightMm",
      "drawerGapAboveMm",
      "sideGap",
      "bottomGap",
      "frontThicknessMm",
      "handleType",
      "handlePositionMm",
      "handleLengthMm",
      "handleSizeMm",
      "handleProjectionMm"
    ]);
    g.add(front);

    addCenteredHandle(g, "drawerHandle", frontW, drawerFrontH, frontT, new THREE.Vector3(0, frontY, frontZ));

    // Drawer box (very similar to drawer_low but single drawer, and constrained by the divider).
    const drawerClearSide = Math.max(0.005, sideClearance);
    const railT = 0.012;
    const railH = 0.045;
    const slideAllowanceX = railT + 0.003;
    const drawerOuterW = Math.max(0.05, internalW - 2 * (drawerClearSide + slideAllowanceX));
    const drawerOuterH = Math.max(0.05, Math.min(drawerFrontH * 0.95, drawerSideH));
    const drawerOuterD = Math.max(0.1, Math.min(internalD - 0.05, drawerBoxDepth));

    const innerW = Math.max(0.02, drawerOuterW - 2 * drawerBoxT);
    const innerD = Math.max(0.05, drawerOuterD - drawerBoxT);

    const carcassFrontZ = depth / 2;
    const drawerFrontClear = 0.001;
    const drawerCenterY = innerMinY + drawerBottomGap + drawerFrontH / 2;
    const drawerCenter = new THREE.Vector3(0, drawerCenterY, carcassFrontZ - drawerFrontClear - drawerOuterD / 2);
    const sideCenterY = drawerCenter.y - drawerOuterH / 2 + Math.min(drawerOuterH, drawerSideH) / 2;
    const sideH2 = Math.min(drawerOuterH, drawerSideH);

    const leftSideGeo2 = new THREE.BoxGeometry(drawerBoxT, sideH2, drawerOuterD);
    const leftSide2 = new THREE.Mesh(leftSideGeo2, drawerHardwareMat);
    leftSide2.name = "drawer_sideL";
    leftSide2.position.set(drawerCenter.x - drawerOuterW / 2 + drawerBoxT / 2, sideCenterY, drawerCenter.z);
    setPartMeta(leftSide2, { width: drawerBoxT, height: sideH2, depth: drawerOuterD }, "depth");
    setParamKeys(leftSide2, ["drawerBoxThickness", "drawerBoxSideHeight", "drawerBoxDepthMm", "sideClearanceMm", "width", "depth"]);
    g.add(leftSide2);

    const rightSideGeo2 = new THREE.BoxGeometry(drawerBoxT, sideH2, drawerOuterD);
    const rightSide2 = new THREE.Mesh(rightSideGeo2, drawerHardwareMat);
    rightSide2.name = "drawer_sideR";
    rightSide2.position.set(drawerCenter.x + drawerOuterW / 2 - drawerBoxT / 2, sideCenterY, drawerCenter.z);
    setPartMeta(rightSide2, { width: drawerBoxT, height: sideH2, depth: drawerOuterD }, "depth");
    setParamKeys(rightSide2, ["drawerBoxThickness", "drawerBoxSideHeight", "drawerBoxDepthMm", "sideClearanceMm", "width", "depth"]);
    g.add(rightSide2);

    const bottomGeo2 = new THREE.BoxGeometry(innerW, drawerBoxT, innerD);
    const bottom2 = new THREE.Mesh(bottomGeo2, drawerMat);
    bottom2.name = "drawer_bottom";
    bottom2.position.set(drawerCenter.x, drawerCenter.y - drawerOuterH / 2 + drawerBoxT / 2, drawerCenter.z + drawerBoxT / 2);
    setPartMeta(bottom2, { width: innerW, height: drawerBoxT, depth: innerD }, "depth");
    setParamKeys(bottom2, ["drawerBoxThickness", "drawerBoxDepthMm", "sideClearanceMm", "width", "depth"]);
    g.add(bottom2);

    const backGeo2 = new THREE.BoxGeometry(innerW, sideH2, drawerBoxT);
    const back2 = new THREE.Mesh(backGeo2, drawerHardwareMat);
    back2.name = "drawer_back";
    back2.position.set(drawerCenter.x, sideCenterY, drawerCenter.z - drawerOuterD / 2 + drawerBoxT / 2);
    setPartMeta(back2, { width: innerW, height: sideH2, depth: drawerBoxT }, "width");
    setParamKeys(back2, ["drawerBoxThickness", "drawerBoxSideHeight", "drawerBoxDepthMm", "sideClearanceMm", "width", "depth"]);
    g.add(back2);

    // Rails (carcass-mounted)
    const railLen = Math.max(0.2, drawerOuterD - 0.005);
    const railCenterY = drawerCenter.y - drawerOuterH / 2 + railH / 2 + drawerBoxT + 0.002;
    const railCenterZ = carcassFrontZ - drawerFrontClear - railLen / 2;
    const railGeo2 = new THREE.BoxGeometry(railT, railH, railLen);
    const railInsetX = 0.002;

    const railL = new THREE.Mesh(railGeo2, railMat);
    railL.name = "drawer_railL";
    railL.position.set(-internalW / 2 + railT / 2 + railInsetX, railCenterY, railCenterZ);
    setPartMeta(railL, { width: railT, height: railH, depth: railLen }, "none");
    setParamKeys(railL, ["sideClearanceMm", "width", "depth", "drawerEnabled"]);
    g.add(railL);

    const railR = new THREE.Mesh(railGeo2, railMat);
    railR.name = "drawer_railR";
    railR.position.set(internalW / 2 - railT / 2 - railInsetX, railCenterY, railCenterZ);
    setPartMeta(railR, { width: railT, height: railH, depth: railLen }, "none");
    setParamKeys(railR, ["sideClearanceMm", "width", "depth", "drawerEnabled"]);
    g.add(railR);
  }

  // Appliance visual (no params, just a look-only object).
  {
    const nicheSideClear = Math.max(0, p.ovenSideClearanceMm) * MM_TO_M;
    const nicheTopClear = Math.max(0, p.ovenTopClearanceMm) * MM_TO_M;
    const nicheBottomClear = Math.max(0, p.ovenBottomClearanceMm) * MM_TO_M;

    // Divider exists when it was placed below; dividerY is its center in world space.
    const dividerExists = dividerY + boardT / 2 < height - boardT - 0.001;
    const dividerTopY = dividerExists ? dividerY + boardT / 2 : innerMinY + boardT;
    const nicheMinY = dividerTopY + nicheBottomClear;
    const nicheMaxY = height - boardT - nicheTopClear;
    const nicheH = Math.max(0.05, nicheMaxY - nicheMinY);

    const nicheW = Math.max(0.05, internalW - 2 * nicheSideClear);
    const nicheD = Math.max(0.05, Math.min(internalD, Math.max(0.1, p.ovenDepthMm * MM_TO_M)));

    const host = new THREE.Group();
    host.name = "appliance_oven_host";
    host.position.set(0, nicheMinY, 0);
    g.add(host);

    // Simple typized dummy (cleaner than BIM assets, and doesn't affect camera framing).
    const ovenBodyMat = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.75, metalness: 0.08 });
    const ovenGlassMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d12,
      roughness: 0.08,
      metalness: 0.0,
      transparent: true,
      opacity: 0.55
    });

    // Real ovens read as a straight "box" with a chamfered/rounded FRONT bezel.
    // Make the bezel explicit so it is clearly visible.
    const r = Math.min(0.016, Math.max(0.004, Math.min(nicheW, nicheH) * 0.04));
    const bezelT = Math.min(0.03, Math.max(0.016, nicheD * 0.06)); // ~16-30mm
    const backD = Math.max(0.05, nicheD - bezelT);
    const frontZ = depth / 2 - 0.002;

    // Front trim (faceplate) slightly larger than the niche opening, so it covers carcass front edges.
    // This matches how real built-in ovens have a flange/trim around the front.
    // Needs to cover the carcass front edges around the niche (typically 18mm board + edging),
    // so default to ~22mm.
    const trimOverlap = Math.min(0.04, Math.max(0.022, boardT + 0.004)); // 22-40mm
    const trimW = Math.min(width - 0.004, nicheW + 2 * trimOverlap);
    const trimH = Math.min(nicheH + 2 * trimOverlap, nicheH + 0.08);
    const trimT = 0.012;
    const trimR = Math.min(r * 1.2, 0.018);
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x0b0e14, roughness: 0.35, metalness: 0.18 });
    const trimGeo = new RoundedBoxGeometry(trimW, trimH, trimT, 6, trimR);
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.name = "oven_dummy_trim";
    trim.position.set(0, nicheH / 2, frontZ + trimT / 2 + 0.0005);
    host.add(trim);

    const bodyBackGeo = new THREE.BoxGeometry(nicheW, nicheH, backD);
    const bodyBack = new THREE.Mesh(bodyBackGeo, ovenBodyMat);
    bodyBack.name = "oven_dummy_body";
    bodyBack.position.set(0, nicheH / 2, frontZ - bezelT - backD / 2);
    host.add(bodyBack);

    const bezelGeo = new RoundedBoxGeometry(nicheW, nicheH, bezelT, 6, r);
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x10141b, roughness: 0.45, metalness: 0.18 });
    const bezel = new THREE.Mesh(bezelGeo, bezelMat);
    bezel.name = "oven_dummy_bezel";
    bezel.position.set(0, nicheH / 2, frontZ - bezelT / 2);
    host.add(bezel);

    // Front "glass" panel hint
    const glassT = Math.min(0.01, bezelT * 0.45);
    const glassGeo = new RoundedBoxGeometry(nicheW * 0.92, nicheH * 0.78, glassT, 6, r * 0.65);
    const glass = new THREE.Mesh(glassGeo, ovenGlassMat);
    glass.name = "oven_dummy_glass";
    glass.position.set(0, nicheH * 0.46, frontZ - glassT / 2);
    host.add(glass);

    // Simple handle hint (bar)
    const handleW = Math.min(nicheW * 0.6, 0.36);
    const handleH = 0.012;
    const handleD = 0.02;
    const handleGeo = new RoundedBoxGeometry(handleW, handleH, handleD, 4, handleH * 0.4);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.35, metalness: 0.55 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.name = "oven_dummy_handle";
    handle.position.set(0, nicheH * 0.78, frontZ + handleD / 2);
    host.add(handle);
  }

  return g;

  function addCenteredHandle(
    parent: THREE.Object3D,
    name: string,
    frontW: number,
    frontH: number,
    frontT2: number,
    basePos: THREE.Vector3
  ) {
    if (p.handleType === "none") return;

    const handleLen = Math.max(0, p.handleLengthMm) * MM_TO_M;
    const handleSize = Math.max(0, p.handleSizeMm) * MM_TO_M;
    const handleProj = Math.max(0, p.handleProjectionMm) * MM_TO_M;

    if (p.handleType === "gola") {
      const golaH = clamp(handleSize, 0.006, 0.05);
      const golaD = clamp(handleProj, 0.006, 0.04);
      const golaW = clamp(handleLen > 0 ? handleLen : frontW, 0.06, frontW);
      const geo = new THREE.BoxGeometry(golaW, golaH, golaD);
      const m = new THREE.Mesh(geo, railMat);
      m.name = name;
      const y = frontH / 2 - golaH / 2 - 0.002;
      const z = frontT2 / 2 - golaD / 2 + 0.002;
      m.position.set(basePos.x, basePos.y + y, basePos.z - frontT2 / 2 + z);
      setPartMeta(m, { width: golaW, height: golaH, depth: golaD }, "none");
      setParamKeys(m, ["handleType", "handleLengthMm", "handleSizeMm", "handleProjectionMm", "frontThicknessMm"]);
      parent.add(m);
      return;
    }

    const handleOffsetFromTop = Math.max(0, p.handlePositionMm) * MM_TO_M;
    const y = frontH / 2 - handleOffsetFromTop;

    if (p.handleType === "bar") {
      const hw = clamp(handleLen > 0 ? handleLen : Math.min(frontW * 0.6, 0.35), 0.06, frontW * 0.95);
      const hh = clamp(handleSize > 0 ? handleSize : 0.012, 0.006, 0.05);
      const hd = clamp(handleProj > 0 ? handleProj : 0.012, 0.006, 0.06);
      const geo = new THREE.BoxGeometry(hw, hh, hd);
      const m = new THREE.Mesh(geo, railMat);
      m.name = name;
      m.position.set(basePos.x, basePos.y + y, basePos.z + frontT2 / 2 + hd / 2);
      setPartMeta(m, { width: hw, height: hh, depth: hd }, "none");
      setParamKeys(m, ["handleType", "handlePositionMm", "handleLengthMm", "handleSizeMm", "handleProjectionMm"]);
      parent.add(m);
      return;
    }

    if (p.handleType === "knob") {
      const r = clamp(handleSize > 0 ? handleSize / 2 : 0.01, 0.006, 0.03);
      const d = clamp(handleProj > 0 ? handleProj : 0.02, 0.006, 0.06);
      const geo = new THREE.CylinderGeometry(r, r, d, 20);
      const m = new THREE.Mesh(geo, railMat);
      m.name = name;
      m.rotation.x = Math.PI / 2;
      m.position.set(basePos.x, basePos.y + y, basePos.z + frontT2 / 2 + d / 2);
      setPartMeta(m, { width: r * 2, height: r * 2, depth: d }, "none");
      setParamKeys(m, ["handleType", "handlePositionMm", "handleSizeMm", "handleProjectionMm"]);
      parent.add(m);
      return;
    }

    // cup (simplified)
    const hw = clamp(handleLen > 0 ? handleLen : Math.min(frontW * 0.45, 0.22), 0.06, frontW * 0.9);
    const r = clamp(handleSize > 0 ? handleSize / 2 : 0.008, 0.006, 0.03);
    const d = clamp(handleProj > 0 ? handleProj : 0.02, 0.006, 0.06);
    const geo = new THREE.CapsuleGeometry(r, Math.max(0.001, hw - 2 * r), 8, 20);
    const m = new THREE.Mesh(geo, railMat);
    m.name = name;
    m.rotation.z = Math.PI / 2;
    m.position.set(basePos.x, basePos.y + y, basePos.z + frontT2 / 2 + d / 2);
    setPartMeta(m, { width: hw, height: r * 2, depth: r * 2 }, "none");
    setParamKeys(m, ["handleType", "handlePositionMm", "handleLengthMm", "handleSizeMm", "handleProjectionMm"]);
    parent.add(m);
  }
}

function parseHexColor(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 0xffffff;
  return Number.parseInt(hex.slice(1), 16);
}

function lightenHex(hex: number, amount01: number) {
  const a = Math.max(0, Math.min(1, amount01));
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  const lr = Math.round(r + (255 - r) * a);
  const lg = Math.round(g + (255 - g) * a);
  const lb = Math.round(b + (255 - b) * a);
  return (lr << 16) | (lg << 8) | lb;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
