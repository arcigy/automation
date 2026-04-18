import * as THREE from "three";
import type { FridgeTallParams } from "../model/cabinetTypes";
import { getPbrMaterialWorldSizeM, getPbrWoodMaterial } from "../materials/pbrMaterials";
import { applyBoxGrainUv } from "../materials/uvGrain";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const MM_TO_M = 0.001;

export function buildFridgeTall(p: FridgeTallParams): THREE.Group {
  const g = new THREE.Group();
  g.name = "fridgeTallModule";

  const width = Math.max(200, p.width) * MM_TO_M;
  const height = Math.max(400, p.height) * MM_TO_M;
  const depth = Math.max(200, p.depth) * MM_TO_M;
  const boardT = Math.max(0.005, p.boardThickness * MM_TO_M);
  const backT = Math.max(0.003, p.backThickness * MM_TO_M);
  const plinthH = Math.max(0, p.plinthHeight) * MM_TO_M;
  const plinthSetback = Math.max(0, p.plinthSetbackMm) * MM_TO_M;

  const frontGap = Math.max(0, p.frontGap) * MM_TO_M;
  const sideGap = Math.max(0, p.sideGap) * MM_TO_M;
  const topGap = Math.max(0, p.topGap) * MM_TO_M;
  const bottomGap = Math.max(0, p.bottomGap) * MM_TO_M;
  const frontT = Math.max(0.005, (p.frontThicknessMm > 0 ? p.frontThicknessMm : p.boardThickness) * MM_TO_M);

  const bodyMat = p.materials.bodyPbr
    ? getPbrWoodMaterial({ fallbackColor: p.materials.bodyColor, ref: p.materials.bodyPbr })
    : new THREE.MeshStandardMaterial({
        color: parseHexColor(p.materials.bodyColor),
        roughness: 0.85,
        metalness: 0.0
      });
  const frontMat = new THREE.MeshStandardMaterial({
    color: parseHexColor(p.materials.frontColor),
    roughness: 0.65,
    metalness: 0.0
  });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.55, metalness: 0.1 });
  // (no hinges in this module; fridge_tall ends at the fridge top)

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

  const setParamKeys = (obj: THREE.Object3D, keys: Array<keyof FridgeTallParams | string>) => {
    (obj as any).userData ??= {};
    (obj as any).userData.paramKeys = [...keys];
  };

  // Carcass
  const openingH = Math.max(0.2, height - plinthH);
  const sideH = openingH;
  const internalW = Math.max(0.05, width - 2 * boardT);
  const internalD = depth;
  const interiorCenterZ = 0;

  const sideGeo = new THREE.BoxGeometry(boardT, sideH, depth);
  const leftSide = new THREE.Mesh(sideGeo, bodyMat);
  leftSide.name = "leftSide";
  leftSide.position.set(-(width / 2 - boardT / 2), plinthH + sideH / 2, 0);
  setPartMeta(leftSide, { width: boardT, height: sideH, depth }, "height");
  setParamKeys(leftSide, ["width", "height", "depth", "boardThickness", "plinthHeight"]);
  g.add(leftSide);

  const rightSide = new THREE.Mesh(sideGeo, bodyMat);
  rightSide.name = "rightSide";
  rightSide.position.set(width / 2 - boardT / 2, plinthH + sideH / 2, 0);
  setPartMeta(rightSide, { width: boardT, height: sideH, depth }, "height");
  setParamKeys(rightSide, ["width", "height", "depth", "boardThickness", "plinthHeight"]);
  g.add(rightSide);

  const bottomGeo = new THREE.BoxGeometry(internalW, boardT, internalD);
  const bottom = new THREE.Mesh(bottomGeo, bodyMat);
  bottom.name = "bottom";
  bottom.position.set(0, plinthH + boardT / 2, interiorCenterZ);
  setPartMeta(bottom, { width: internalW, height: boardT, depth: internalD }, "width");
  setParamKeys(bottom, ["width", "depth", "boardThickness", "plinthHeight"]);
  g.add(bottom);

  // Full top panel
  const topGeo = new THREE.BoxGeometry(internalW, boardT, internalD);
  const top = new THREE.Mesh(topGeo, bodyMat);
  top.name = "top";
  top.position.set(0, height - boardT / 2, interiorCenterZ);
  setPartMeta(top, { width: internalW, height: boardT, depth: internalD }, "width");
  setParamKeys(top, ["width", "depth", "height", "boardThickness"]);
  g.add(top);

  const backGeo = new THREE.BoxGeometry(width, sideH, backT);
  const back = new THREE.Mesh(backGeo, bodyMat);
  back.name = "back";
  back.position.set(0, plinthH + sideH / 2, -depth / 2 - backT / 2);
  setPartMeta(back, { width, height: sideH, depth: backT }, "width");
  setParamKeys(back, ["width", "height", "depth", "backThickness", "plinthHeight"]);
  g.add(back);

  // Legs + kickboard (optional)
  if (plinthH > 0) {
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6, metalness: 0.1 });
    const legRadius = 0.02;
    const legGeo = new THREE.CylinderGeometry(legRadius, legRadius, plinthH, 18);
    const insetX = 0.03;
    const insetZ = 0.06;
    const xL = -width / 2 + insetX;
    const xR = width / 2 - insetX;

    const kickDepth = Math.min(boardT, depth * 0.2);
    const kickSetback = Math.min(plinthSetback, depth / 2);
    const kickCenterZ = depth / 2 - kickDepth / 2 - kickSetback;
    const kickBackFaceZ = kickCenterZ - kickDepth / 2;
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
    setParamKeys(kick, ["plinthHeight", "plinthSetbackMm", "width", "depth"]);
    g.add(kick);
  }

  // Optional bottom drawers
  const drawerCount = Math.max(0, Math.min(6, Math.round(p.drawerCount)));
  const drawerHeights = (Array.isArray(p.drawerFrontHeights) ? p.drawerFrontHeights : []).slice(0, drawerCount);
  while (drawerHeights.length < drawerCount) drawerHeights.push(drawerHeights[drawerHeights.length - 1] ?? 200);

  const frontPlaneZ = depth / 2 + frontT / 2;
  const frontW = Math.max(0.05, width - 2 * sideGap);
  const hasDrawers = drawerCount > 0;
  let cursorY = plinthH + boardT + (hasDrawers ? bottomGap : 0);
  for (let i = 0; i < drawerCount; i++) {
    const h = Math.max(0.02, (drawerHeights[i] ?? 200) * MM_TO_M);
    const geo = new THREE.BoxGeometry(frontW, h, frontT);
    const front = new THREE.Mesh(geo, frontMat);
    front.name = `drawerFront_${i + 1}`;
    front.position.set(0, cursorY + h / 2, frontPlaneZ);
    setPartMeta(front, { width: frontW, height: h, depth: frontT }, "height");
    setParamKeys(front, [
      "drawerCount",
      "drawerFrontHeights",
      "frontGap",
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

    addCenteredHandle(front, `drawerHandle_${i + 1}`, frontW, h, frontT);
    cursorY += h + (i === drawerCount - 1 ? 0 : frontGap);
  }

  const drawersTopY = cursorY + (hasDrawers ? Math.max(0, p.gapAboveDrawersMm) * MM_TO_M : 0);
  if (hasDrawers) {
    const div1Y = drawersTopY + boardT / 2;
    addDivider("divider_drawers", div1Y, ["gapAboveDrawersMm", "drawerFrontHeights", "boardThickness"]);
  }

  // Fridge niche zone
  const fridgeZoneStartY = hasDrawers ? drawersTopY + boardT : plinthH + boardT;
  const fridgeZoneH =
    (Math.max(0, p.fridgeHeightMm) + Math.max(0, p.fridgeTopClearanceMm) + Math.max(0, p.fridgeBottomClearanceMm)) * MM_TO_M;
  const fridgeZoneTopY = fridgeZoneStartY + fridgeZoneH;

  // Two-piece door fronts (freezer bottom + fridge top).
  {
    const doorW = Math.max(0.05, width - 2 * sideGap);
    const gap = Math.max(0, p.fridgeDoorGapMm) * MM_TO_M;
    const zoneH = Math.max(0.12, fridgeZoneH);
    const freezerH = clamp(Math.max(0.05, p.freezerDoorHeightMm * MM_TO_M), 0.08, Math.max(0.08, zoneH - gap - 0.08));
    const fridgeH = Math.max(0.08, zoneH - freezerH - gap);

    const doorPlaneZ = depth / 2 + frontT / 2;

    const freezerGeo = new THREE.BoxGeometry(doorW, freezerH, frontT);
    const freezerDoor = new THREE.Mesh(freezerGeo, frontMat);
    freezerDoor.name = "freezerDoorFront";
    freezerDoor.position.set(0, fridgeZoneStartY + freezerH / 2, doorPlaneZ);
    setPartMeta(freezerDoor, { width: doorW, height: freezerH, depth: frontT }, "height");
    setParamKeys(freezerDoor, [
      "freezerDoorHeightMm",
      "fridgeDoorGapMm",
      "fridgeHeightMm",
      "fridgeTopClearanceMm",
      "fridgeBottomClearanceMm",
      "sideGap",
      "frontThicknessMm",
      "handleType",
      "handlePositionMm",
      "handleLengthMm",
      "handleSizeMm",
      "handleProjectionMm"
    ]);
    g.add(freezerDoor);
    addSplitSideHandle(freezerDoor, "freezerDoor_handle", doorW, freezerH, frontT, "nearTop");

    const fridgeGeo = new THREE.BoxGeometry(doorW, fridgeH, frontT);
    const fridgeDoor = new THREE.Mesh(fridgeGeo, frontMat);
    fridgeDoor.name = "fridgeDoorFront";
    fridgeDoor.position.set(0, fridgeZoneStartY + freezerH + gap + fridgeH / 2, doorPlaneZ);
    setPartMeta(fridgeDoor, { width: doorW, height: fridgeH, depth: frontT }, "height");
    setParamKeys(fridgeDoor, [
      "freezerDoorHeightMm",
      "fridgeDoorGapMm",
      "fridgeHeightMm",
      "fridgeTopClearanceMm",
      "fridgeBottomClearanceMm",
      "sideGap",
      "frontThicknessMm",
      "handleType",
      "handlePositionMm",
      "handleLengthMm",
      "handleSizeMm",
      "handleProjectionMm"
    ]);
    g.add(fridgeDoor);
    addSplitSideHandle(fridgeDoor, "fridgeDoor_handle", doorW, fridgeH, frontT, "nearBottom");
  }

  // Fridge dummy (visual only)
  addApplianceDummy({
    name: "fridge",
    nicheW: Math.max(0.05, Math.max(0, p.fridgeWidthMm) * MM_TO_M),
    nicheH: Math.max(0.05, Math.max(0, p.fridgeHeightMm) * MM_TO_M),
    nicheD: Math.max(0.05, Math.max(0, p.fridgeDepthMm) * MM_TO_M),
    sideClear: Math.max(0, p.fridgeSideClearanceMm) * MM_TO_M,
    topClear: Math.max(0, p.fridgeTopClearanceMm) * MM_TO_M,
    bottomClear: Math.max(0, p.fridgeBottomClearanceMm) * MM_TO_M,
    zoneMinY: fridgeZoneStartY,
    frontZ: depth / 2 - 0.002,
    host: g
  });

  return g;

  function addDivider(name: string, y: number, keys: Array<keyof FridgeTallParams | string>) {
    if (y + boardT / 2 >= height - boardT - 0.001) return;
    const geo = new THREE.BoxGeometry(internalW, boardT, internalD);
    const d = new THREE.Mesh(geo, bodyMat);
    d.name = name;
    d.position.set(0, y, interiorCenterZ);
    setPartMeta(d, { width: internalW, height: boardT, depth: internalD }, "width");
    setParamKeys(d, ["width", "depth", "height", "boardThickness", ...keys]);
    g.add(d);
  }

  function addCenteredHandle(front: THREE.Mesh, name: string, w: number, h: number, t: number) {
    if (p.handleType === "none") return;
    const handleLen = Math.max(0, p.handleLengthMm) * MM_TO_M;
    const handleSize = Math.max(0, p.handleSizeMm) * MM_TO_M;
    const handleProj = Math.max(0, p.handleProjectionMm) * MM_TO_M;

    const y = h / 2 - Math.max(0, p.handlePositionMm) * MM_TO_M;

    if (p.handleType === "gola") {
      const golaH = clamp(handleSize, 0.006, 0.05);
      const golaD = clamp(handleProj, 0.006, 0.04);
      const golaW = clamp(handleLen > 0 ? handleLen : w, 0.06, w);
      const geo = new THREE.BoxGeometry(golaW, golaH, golaD);
      const m = new THREE.Mesh(geo, railMat);
      m.name = name;
      m.position.set(0, y, t / 2 - golaD / 2 + 0.002);
      front.add(m);
      return;
    }

    if (p.handleType === "bar") {
      const hw = clamp(handleLen > 0 ? handleLen : Math.min(w * 0.6, 0.35), 0.06, w * 0.95);
      const hh = clamp(handleSize > 0 ? handleSize : 0.012, 0.006, 0.05);
      const hd = clamp(handleProj > 0 ? handleProj : 0.012, 0.006, 0.06);
      const geo = new THREE.BoxGeometry(hw, hh, hd);
      const m = new THREE.Mesh(geo, railMat);
      m.name = name;
      m.position.set(0, y, t / 2 + hd / 2);
      front.add(m);
      return;
    }

    if (p.handleType === "knob") {
      const r = clamp(handleSize > 0 ? handleSize / 2 : 0.01, 0.006, 0.03);
      const d = clamp(handleProj > 0 ? handleProj : 0.02, 0.006, 0.06);
      const geo = new THREE.SphereGeometry(r, 18, 12);
      const m = new THREE.Mesh(geo, railMat);
      m.name = name;
      m.position.set(0, y, t / 2 + d / 2);
      front.add(m);
      return;
    }

    // cup
    const hw = clamp(handleLen > 0 ? handleLen : Math.min(w * 0.6, 0.35), 0.06, w * 0.95);
    const r = clamp(handleSize > 0 ? handleSize / 2 : 0.01, 0.006, 0.03);
    const d = clamp(handleProj > 0 ? handleProj : 0.02, 0.006, 0.06);
    const geo = new THREE.CapsuleGeometry(r, Math.max(0.001, hw - 2 * r), 8, 20);
    const m = new THREE.Mesh(geo, railMat);
    m.name = name;
    m.rotation.z = Math.PI / 2;
    m.position.set(0, y, t / 2 + d / 2);
    front.add(m);
  }

  // For fridge doors we want "two handles above each other" near the split line and near the side edge.
  // Bottom (freezer) handle: near top edge. Top (fridge) handle: near bottom edge.
  function addSplitSideHandle(
    front: THREE.Mesh,
    name: string,
    w: number,
    h: number,
    t: number,
    where: "nearTop" | "nearBottom"
  ) {
    if (p.handleType === "none") return;

    const handleLen = Math.max(0, p.handleLengthMm) * MM_TO_M;
    const handleSizeMm = Math.max(0, p.handleSizeMm);
    const handleSize = handleSizeMm * MM_TO_M;
    const handleProj = Math.max(0, p.handleProjectionMm) * MM_TO_M;

    // X near edge (right side by default, matches common fridge layout).
    const edgeInsetMm = 50;
    const xEdge = w / 2 - Math.max(8, edgeInsetMm) * MM_TO_M;

    // Y near the split line (as close as reasonable given handle size).
    const userOffsetMm = Number((p as any).doorHandleOffsetFromSplitMm);
    const splitInsetMm = Number.isFinite(userOffsetMm)
      ? clamp(userOffsetMm, 0, 120)
      : clamp(handleSizeMm > 0 ? handleSizeMm / 2 + 8 : 14, 8, 30);
    const y = where === "nearTop" ? h / 2 - splitInsetMm * MM_TO_M : -h / 2 + splitInsetMm * MM_TO_M;

    if (p.handleType === "gola") {
      const golaH = clamp(handleSize, 0.006, 0.05);
      const golaD = clamp(handleProj, 0.006, 0.04);
      const golaW = clamp(handleLen > 0 ? handleLen : Math.min(w * 0.45, 0.28), 0.06, w);
      const geo = new THREE.BoxGeometry(golaW, golaH, golaD);
      const m = new THREE.Mesh(geo, railMat);
      m.name = name;
      // Rotate so the "length" runs vertically.
      m.rotation.z = Math.PI / 2;
      // After rotation, X extent becomes golaH.
      const cx = clamp(xEdge - golaH / 2, -w / 2 + golaH / 2, w / 2 - golaH / 2);
      m.position.set(cx, y, t / 2 - golaD / 2 + 0.002);
      front.add(m);
      return;
    }

    if (p.handleType === "bar") {
      const hw = clamp(handleLen > 0 ? handleLen : Math.min(w * 0.5, 0.28), 0.06, w * 0.95);
      const hh = clamp(handleSize > 0 ? handleSize : 0.012, 0.006, 0.05);
      const hd = clamp(handleProj > 0 ? handleProj : 0.012, 0.006, 0.06);
      const geo = new THREE.BoxGeometry(hw, hh, hd);
      const m = new THREE.Mesh(geo, railMat);
      m.name = name;
      // Rotate so the "length" runs vertically.
      m.rotation.z = Math.PI / 2;
      // After rotation, X extent becomes hh.
      const cx = clamp(xEdge - hh / 2, -w / 2 + hh / 2, w / 2 - hh / 2);
      m.position.set(cx, y, t / 2 + hd / 2);
      front.add(m);
      return;
    }

    if (p.handleType === "knob") {
      const r = clamp(handleSize > 0 ? handleSize / 2 : 0.01, 0.006, 0.03);
      const d = clamp(handleProj > 0 ? handleProj : 0.02, 0.006, 0.06);
      const geo = new THREE.SphereGeometry(r, 18, 12);
      const m = new THREE.Mesh(geo, railMat);
      m.name = name;
      const cx = clamp(xEdge, -w / 2 + r, w / 2 - r);
      m.position.set(cx, y, t / 2 + d / 2);
      front.add(m);
      return;
    }

    // cup
    const hw = clamp(handleLen > 0 ? handleLen : Math.min(w * 0.5, 0.28), 0.06, w * 0.95);
    const r = clamp(handleSize > 0 ? handleSize / 2 : 0.01, 0.006, 0.03);
    const d = clamp(handleProj > 0 ? handleProj : 0.02, 0.006, 0.06);
    const geo = new THREE.CapsuleGeometry(r, Math.max(0.001, hw - 2 * r), 8, 20);
    const m = new THREE.Mesh(geo, railMat);
    m.name = name;
    // Capsule is vertical by default (axis along Y).
    const cx = clamp(xEdge, -w / 2 + r, w / 2 - r);
    m.position.set(cx, y, t / 2 + d / 2);
    front.add(m);
  }

  function addApplianceDummy(args: {
    name: string;
    nicheW: number;
    nicheH: number;
    nicheD: number;
    sideClear: number;
    topClear: number;
    bottomClear: number;
    zoneMinY: number;
    frontZ: number;
    host: THREE.Object3D;
  }) {
    const wAvail = Math.max(0.05, internalW - 2 * args.sideClear);
    const w = Math.max(0.05, Math.min(wAvail, args.nicheW));
    const h = Math.max(0.05, args.nicheH);
    const dAvail = Math.max(0.05, internalD);
    const d = Math.max(0.05, Math.min(dAvail, args.nicheD));
    const baseY = args.zoneMinY + args.bottomClear;
    const zFront = args.frontZ;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x141821, roughness: 0.85, metalness: 0.06 });
    const r = Math.min(0.016, Math.max(0.004, Math.min(w, h) * 0.04));
    const bezelT = Math.min(0.03, Math.max(0.016, d * 0.06));
    const backD = Math.max(0.05, d - bezelT);

    // Small face trim so the niche is visually readable.
    const trimOverlapX = 0.01;
    const trimOverlapY = 0.01;
    const trimW = Math.min(width - 0.004, w + 2 * trimOverlapX);
    const trimH = Math.min(h + 2 * trimOverlapY, h + 0.04);
    const trimT = 0.01;
    const trimGeo = new RoundedBoxGeometry(trimW, trimH, trimT, 6, Math.min(r * 1.2, 0.018));
    const trim = new THREE.Mesh(trimGeo, bodyMat);
    trim.name = `${args.name}_dummy_trim`;
    trim.position.set(0, baseY + h / 2, zFront + trimT / 2 + 0.0005);
    trim.userData.selectable = false;
    args.host.add(trim);

    const bodyBackGeo = new THREE.BoxGeometry(w, h, backD);
    const bodyBack = new THREE.Mesh(bodyBackGeo, bodyMat);
    bodyBack.name = `${args.name}_dummy_body`;
    bodyBack.position.set(0, baseY + h / 2, zFront - bezelT - backD / 2);
    bodyBack.userData.selectable = false;
    args.host.add(bodyBack);

    const bezelGeo = new RoundedBoxGeometry(w, h, bezelT, 6, r);
    const bezel = new THREE.Mesh(bezelGeo, bodyMat);
    bezel.name = `${args.name}_dummy_bezel`;
    bezel.position.set(0, baseY + h / 2, zFront - bezelT / 2);
    bezel.userData.selectable = false;
    args.host.add(bezel);
  }
}

function parseHexColor(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 0xffffff;
  return Number.parseInt(hex.slice(1), 16);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
