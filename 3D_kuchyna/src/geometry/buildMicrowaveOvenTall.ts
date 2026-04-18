import * as THREE from "three";
import type { MicrowaveOvenTallParams } from "../model/cabinetTypes";
import { getPbrMaterialWorldSizeM, getPbrWoodMaterial } from "../materials/pbrMaterials";
import { applyBoxGrainUv } from "../materials/uvGrain";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const MM_TO_M = 0.001;

export function buildMicrowaveOvenTall(p: MicrowaveOvenTallParams): THREE.Group {
  const g = new THREE.Group();
  g.name = "microwaveOvenTallModule";

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
  const hingeMat = new THREE.MeshStandardMaterial({ color: 0x4a4f5a, roughness: 0.5, metalness: 0.15 });

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

  const setParamKeys = (obj: THREE.Object3D, keys: Array<keyof MicrowaveOvenTallParams | string>) => {
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

  // Full top panel (requested): cover the whole top instead of only rails.
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

  // Bottom drawers (fronts only; enough for layout/visual)
  const drawerCount = Math.max(0, Math.min(6, Math.round(p.drawerCount)));
  const drawerHeights = (Array.isArray(p.drawerFrontHeights) ? p.drawerFrontHeights : []).slice(0, drawerCount);
  while (drawerHeights.length < drawerCount) drawerHeights.push(drawerHeights[drawerHeights.length - 1] ?? 200);

  const frontPlaneZ = depth / 2 + frontT / 2;
  const frontW = Math.max(0.05, width - 2 * sideGap);
  let cursorY = plinthH + boardT + bottomGap;
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

  const drawersTopY = cursorY + Math.max(0, p.gapAboveDrawersMm) * MM_TO_M;

  // Divider above drawers
  const div1Y = drawersTopY + boardT / 2;
  addDivider("divider_drawers", div1Y, ["gapAboveDrawersMm", "drawerFrontHeights", "boardThickness"]);

  // Oven niche zone
  const ovenZoneStartY = drawersTopY + boardT;
  const ovenZoneH =
    (Math.max(0, p.ovenHeightMm) + Math.max(0, p.ovenTopClearanceMm) + Math.max(0, p.ovenBottomClearanceMm)) * MM_TO_M;
  const ovenZoneTopY = ovenZoneStartY + ovenZoneH;

  const div2Y = ovenZoneTopY + boardT / 2;
  addDivider("divider_oven", div2Y, ["ovenHeightMm", "ovenTopClearanceMm", "ovenBottomClearanceMm", "boardThickness"]);

  // Microwave niche zone
  const between = Math.max(0, p.gapBetweenAppliancesMm) * MM_TO_M;
  const mwZoneStartY = ovenZoneTopY + boardT + between;
  const mwZoneH =
    (Math.max(0, p.microwaveHeightMm) +
      Math.max(0, p.microwaveTopClearanceMm) +
      Math.max(0, p.microwaveBottomClearanceMm)) *
    MM_TO_M;
  const mwZoneTopY = mwZoneStartY + mwZoneH;

  const div3Y = mwZoneTopY + boardT / 2;
  if (div3Y + boardT / 2 < height - boardT - 0.001) {
    addDivider("divider_microwave", div3Y, ["microwaveHeightMm", "microwaveTopClearanceMm", "microwaveBottomClearanceMm", "boardThickness"]);
  }

  // Top cabinet section (fills the rest so there is no empty void)
  {
    const topMinY = mwZoneTopY + boardT;
    const topMaxY = height - boardT;
    const topH = Math.max(0.001, topMaxY - topMinY);
    if (topH > 0.08) {
      const shelfCount = Math.max(1, Math.min(8, Math.round(p.topShelfCount)));
      const internalShelfCount = Math.max(0, shelfCount - 1);
      const shelfT = Math.max(0.005, p.topShelfThickness * MM_TO_M);
      const free = Math.max(0.001, topH - internalShelfCount * shelfT);
      const gap = free / shelfCount;

      for (let i = 0; i < internalShelfCount; i++) {
        const y = topMinY + gap * (i + 1) + shelfT * (i + 0.5);
        const geo = new THREE.BoxGeometry(internalW, shelfT, internalD);
        const shelf = new THREE.Mesh(geo, bodyMat);
        shelf.name = `topShelf_${i + 1}`;
        shelf.position.set(0, y, interiorCenterZ);
        setPartMeta(shelf, { width: internalW, height: shelfT, depth: internalD }, "width");
        setParamKeys(shelf, ["topShelfCount", "topShelfThickness", "height", "boardThickness"]);
        g.add(shelf);
      }

      // Upward-opening flap door (hinged at the top edge).
      const doorW = Math.max(0.05, width - 2 * sideGap);
      const doorH = Math.max(0.05, topH - topGap);
      const doorTopY = topMinY + topGap + doorH;
      const doorPlaneZ = depth / 2 + frontT / 2;
      const openAngle = p.topFlapOpen ? -Math.PI / 2 : 0;

      const pivot = new THREE.Group();
      pivot.name = "topFlap_pivot";
      pivot.position.set(0, doorTopY, doorPlaneZ);
      pivot.rotation.x = openAngle;

      const doorGeo = new THREE.BoxGeometry(doorW, doorH, frontT);
      const door = new THREE.Mesh(doorGeo, frontMat);
      door.name = "topFlap";
      // Pivot at top edge: door center is below the hinge line.
      door.position.set(0, -doorH / 2, 0);
      setPartMeta(door, { width: doorW, height: doorH, depth: frontT }, "height");
      setParamKeys(door, ["topFlapOpen", "topHingeCount", "topHingeInsetFromSideMm", "topShelfCount", "sideGap", "topGap", "frontThicknessMm"]);
      pivot.add(door);

      // Simple top hinges along X
      const hingeCount = clampInt(p.topHingeCount, 1, 6);
      const inset = Math.max(0, p.topHingeInsetFromSideMm) * MM_TO_M;
      const hingeW = 0.03;
      const hingeH = 0.008;
      const hingeD = 0.014;
      const hingeGeo = new THREE.BoxGeometry(hingeW, hingeH, hingeD);
      const hingeZ = -frontT / 2 - hingeD / 2 - 0.001;
      const xs = computeHingeXs(doorW, hingeCount, inset);
      xs.forEach((x, idx) => {
        const h = new THREE.Mesh(hingeGeo, hingeMat);
        h.name = `topFlap_hinge_${idx + 1}`;
        h.position.set(x, -hingeH / 2, hingeZ);
        h.userData.selectable = false;
        pivot.add(h);
      });

      addCenteredHandle(door, "topFlap_handle", doorW, doorH, frontT);
      g.add(pivot);
    }
  }

  // Appliances dummies
  addApplianceDummy({
    name: "oven",
    nicheW: Math.max(0.05, (Math.max(0, p.ovenWidthMm) * MM_TO_M)),
    nicheH: Math.max(0.05, Math.max(0, p.ovenHeightMm) * MM_TO_M),
    nicheD: Math.max(0.05, Math.max(0, p.ovenDepthMm) * MM_TO_M),
    sideClear: Math.max(0, p.ovenSideClearanceMm) * MM_TO_M,
    topClear: Math.max(0, p.ovenTopClearanceMm) * MM_TO_M,
    bottomClear: Math.max(0, p.ovenBottomClearanceMm) * MM_TO_M,
    zoneMinY: ovenZoneStartY,
    frontZ: depth / 2 - 0.002,
    host: g
  });

  addApplianceDummy({
    name: "microwave",
    nicheW: Math.max(0.05, (Math.max(0, p.microwaveWidthMm) * MM_TO_M)),
    nicheH: Math.max(0.05, Math.max(0, p.microwaveHeightMm) * MM_TO_M),
    nicheD: Math.max(0.05, Math.max(0, p.microwaveDepthMm) * MM_TO_M),
    sideClear: Math.max(0, p.microwaveSideClearanceMm) * MM_TO_M,
    topClear: Math.max(0, p.microwaveTopClearanceMm) * MM_TO_M,
    bottomClear: Math.max(0, p.microwaveBottomClearanceMm) * MM_TO_M,
    zoneMinY: mwZoneStartY,
    frontZ: depth / 2 - 0.002,
    host: g
  });

  return g;

  function addDivider(name: string, y: number, keys: Array<keyof MicrowaveOvenTallParams | string>) {
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
      const geo = new THREE.CylinderGeometry(r, r, d, 20);
      const m = new THREE.Mesh(geo, railMat);
      m.name = name;
      m.rotation.x = Math.PI / 2;
      m.position.set(0, y, t / 2 + d / 2);
      front.add(m);
      return;
    }

    // cup
    const hw = clamp(handleLen > 0 ? handleLen : Math.min(w * 0.45, 0.22), 0.06, w * 0.9);
    const r = clamp(handleSize > 0 ? handleSize / 2 : 0.008, 0.006, 0.03);
    const d = clamp(handleProj > 0 ? handleProj : 0.02, 0.006, 0.06);
    const geo = new THREE.CapsuleGeometry(r, Math.max(0.001, hw - 2 * r), 8, 20);
    const m = new THREE.Mesh(geo, railMat);
    m.name = name;
    m.rotation.z = Math.PI / 2;
    m.position.set(0, y, t / 2 + d / 2);
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

    const ovenBodyMat = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.75, metalness: 0.08 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d12,
      roughness: 0.08,
      metalness: 0.0,
      transparent: true,
      opacity: 0.55
    });

    const r = Math.min(0.016, Math.max(0.004, Math.min(w, h) * 0.04));
    const bezelT = Math.min(0.03, Math.max(0.016, d * 0.06));
    const backD = Math.max(0.05, d - bezelT);

    // Appliance face trim:
    // - oven: larger trim to cover carcass front edges (typical 595/600 style)
    // - microwave: visibly smaller face (still with side overlap), height should stay close to appliance height
    const isMicrowave = args.name === "microwave";
    const trimOverlapX = isMicrowave ? 0.0175 : Math.min(0.04, Math.max(0.022, boardT + 0.004)); // ~35mm total for MW => ~595mm face on 560 niche
    const trimOverlapY = isMicrowave ? 0.005 : Math.min(0.04, Math.max(0.022, boardT + 0.004));
    const trimW = Math.min(width - 0.004, w + 2 * trimOverlapX);
    const trimH = isMicrowave ? Math.min(h + 2 * trimOverlapY, h + 0.01) : Math.min(h + 2 * trimOverlapY, h + 0.08);
    const trimT = 0.012;
    const trimR = Math.min(r * 1.2, 0.018);
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x0b0e14, roughness: 0.35, metalness: 0.18 });
    const trimGeo = new RoundedBoxGeometry(trimW, trimH, trimT, 6, trimR);
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.name = `${args.name}_dummy_trim`;
    trim.position.set(0, baseY + h / 2, zFront + trimT / 2 + 0.0005);
    args.host.add(trim);

    const bodyBackGeo = new THREE.BoxGeometry(w, h, backD);
    const bodyBack = new THREE.Mesh(bodyBackGeo, ovenBodyMat);
    bodyBack.name = `${args.name}_dummy_body`;
    bodyBack.position.set(0, baseY + h / 2, zFront - bezelT - backD / 2);
    args.host.add(bodyBack);

    const bezelGeo = new RoundedBoxGeometry(w, h, bezelT, 6, r);
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x10141b, roughness: 0.45, metalness: 0.18 });
    const bezel = new THREE.Mesh(bezelGeo, bezelMat);
    bezel.name = `${args.name}_dummy_bezel`;
    bezel.position.set(0, baseY + h / 2, zFront - bezelT / 2);
    args.host.add(bezel);

    const glassT = Math.min(0.01, bezelT * 0.45);
    const glassGeo = new RoundedBoxGeometry(w * 0.92, h * 0.78, glassT, 6, r * 0.65);
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.name = `${args.name}_dummy_glass`;
    glass.position.set(0, baseY + h * 0.46, zFront - glassT / 2);
    args.host.add(glass);

    const handleW = Math.min(w * 0.6, 0.36);
    const handleH = 0.012;
    const handleD = 0.02;
    const handleGeo = new RoundedBoxGeometry(handleW, handleH, handleD, 4, handleH * 0.4);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.35, metalness: 0.55 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.name = `${args.name}_dummy_handle`;
    handle.position.set(0, baseY + h * 0.78, zFront + handleD / 2);
    args.host.add(handle);
  }
}

function parseHexColor(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 0xffffff;
  return Number.parseInt(hex.slice(1), 16);
}

function clampInt(value: unknown, min: number, max: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function computeHingeXs(doorW: number, count: number, inset: number) {
  const c = Math.max(1, Math.round(count));
  if (c === 1) return [0];
  const minX = -doorW / 2 + inset;
  const maxX = doorW / 2 - inset;
  const span = Math.max(0.001, maxX - minX);
  const step = span / (c - 1);
  const xs: number[] = [];
  for (let i = 0; i < c; i++) xs.push(minX + step * i);
  return xs;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
