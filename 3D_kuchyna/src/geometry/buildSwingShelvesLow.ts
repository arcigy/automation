import * as THREE from "three";
import type { SwingShelvesLowParams } from "../model/cabinetTypes";
import { computeShelfHeightsFromGaps } from "../model/cabinetTypes";

const MM_TO_M = 0.001;

export function buildSwingShelvesLow(p: SwingShelvesLowParams): THREE.Group {
  const g = new THREE.Group();
  g.name = "swingShelvesLowModule";

  const width = p.width * MM_TO_M;
  const height = p.height * MM_TO_M;
  const depth = p.depth * MM_TO_M;
  const boardT = p.boardThickness * MM_TO_M;
  const backT = p.backThickness * MM_TO_M;
  const plinthH = p.plinthHeight * MM_TO_M;
  const plinthSetback = Math.max(0, p.plinthSetbackMm) * MM_TO_M;
  const shelfT = p.shelfThickness * MM_TO_M;

  const sideGap = p.sideGap * MM_TO_M;
  const topGap = p.topGap * MM_TO_M;
  const bottomGap = p.bottomGap * MM_TO_M;
  const centerGap = Math.max(0, p.frontGap * MM_TO_M);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: parseHexColor(p.materials.bodyColor),
    roughness: 0.85,
    metalness: 0.0
  });
  const frontMat = new THREE.MeshStandardMaterial({
    color: parseHexColor(p.materials.frontColor),
    roughness: 0.65,
    metalness: 0.0
  });
  const hingeMat = new THREE.MeshStandardMaterial({ color: 0x4a4f5a, roughness: 0.5, metalness: 0.15 });

  const setPartMeta = (mesh: THREE.Mesh, dimsM: { width: number; height: number; depth: number }) => {
    mesh.userData.selectable = true;
    mesh.userData.dimensionsMm = {
      width: dimsM.width / MM_TO_M,
      height: dimsM.height / MM_TO_M,
      depth: dimsM.depth / MM_TO_M
    };
  };

  const setPartMetaMm = (mesh: THREE.Mesh, dimsMm: { width: number; height: number; depth: number }) => {
    mesh.userData.selectable = true;
    mesh.userData.dimensionsMm = { ...dimsMm };
  };

  const setParamKeys = (obj: THREE.Object3D, keys: Array<keyof SwingShelvesLowParams | string>) => {
    (obj as any).userData ??= {};
    (obj as any).userData.paramKeys = [...keys];
  };

  // Kickboard geometry inputs reused by legs + kickboard positioning.
  const kickDepth = Math.min(boardT, depth * 0.2);
  const kickSetback = Math.min(plinthSetback, depth / 2);
  const kickCenterZ = depth / 2 - kickDepth / 2 - kickSetback;
  const kickBackFaceZ = kickCenterZ - kickDepth / 2;

  const openingH = height - plinthH;
  const sideH = openingH;

  // Sides
  const sideGeo = new THREE.BoxGeometry(boardT, sideH, depth);
  const leftSide = new THREE.Mesh(sideGeo, bodyMat);
  leftSide.name = "leftSide";
  leftSide.position.set(-(width / 2 - boardT / 2), plinthH + sideH / 2, 0);
  setPartMeta(leftSide, { width: boardT, height: sideH, depth });
  setParamKeys(leftSide, ["width", "height", "depth", "boardThickness", "plinthHeight", "wallMounted"]);
  g.add(leftSide);

  const rightSide = new THREE.Mesh(sideGeo, bodyMat);
  rightSide.name = "rightSide";
  rightSide.position.set(width / 2 - boardT / 2, plinthH + sideH / 2, 0);
  setPartMeta(rightSide, { width: boardT, height: sideH, depth });
  setParamKeys(rightSide, ["width", "height", "depth", "boardThickness", "plinthHeight", "wallMounted"]);
  g.add(rightSide);

  // Interior dims (back panel mounted outside)
  const internalW = width - 2 * boardT;
  const internalD = depth;
  const interiorCenterZ = 0;

  // Bottom
  const bottomGeo = new THREE.BoxGeometry(internalW, boardT, internalD);
  const bottom = new THREE.Mesh(bottomGeo, bodyMat);
  bottom.name = "bottom";
  bottom.position.set(0, plinthH + boardT / 2, interiorCenterZ);
  setPartMeta(bottom, { width: internalW, height: boardT, depth: internalD });
  setParamKeys(bottom, ["width", "depth", "boardThickness", "plinthHeight", "wallMounted"]);
  g.add(bottom);

  // Top
  const topGeo = new THREE.BoxGeometry(internalW, boardT, internalD);
  const top = new THREE.Mesh(topGeo, bodyMat);
  top.name = "top";
  top.position.set(0, height - boardT / 2, interiorCenterZ);
  setPartMeta(top, { width: internalW, height: boardT, depth: internalD });
  setParamKeys(top, ["width", "depth", "height", "boardThickness"]);
  g.add(top);

  // Back
  const backGeo = new THREE.BoxGeometry(width, sideH, backT);
  const back = new THREE.Mesh(backGeo, bodyMat);
  back.name = "back";
  back.position.set(0, plinthH + sideH / 2, -depth / 2 - backT / 2);
  setPartMeta(back, { width, height: sideH, depth: backT });
  setParamKeys(back, ["width", "height", "depth", "backThickness", "plinthHeight", "wallMounted"]);
  g.add(back);

  // Legs + kickboard only when floor-standing
  if (!p.wallMounted && plinthH > 0) {
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6, metalness: 0.1 });
    const legRadius = 0.02; // 20mm
    const legH = plinthH;
    const legGeo = new THREE.CylinderGeometry(legRadius, legRadius, legH, 18);
    const insetX = 0.03;
    const insetZ = 0.06;
    const xL = -width / 2 + insetX;
    const xR = width / 2 - insetX;
    // Ensure front legs are always behind the kickboard.
    const legMaxFrontCenterZ = kickBackFaceZ - legRadius - 0.01; // keep 10mm behind the kickboard
    const zF = Math.min(depth / 2 - insetZ, legMaxFrontCenterZ);
    const zB = -depth / 2 + insetZ;

    const addLeg = (name: string, x: number, z: number) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.name = name;
      leg.position.set(x, legH / 2, z);
      setPartMetaMm(leg, { width: legRadius * 2 * 1000, height: legH / MM_TO_M, depth: legRadius * 2 * 1000 });
      setParamKeys(leg, ["plinthHeight", "plinthSetbackMm", "depth", "width", "wallMounted"]);
      g.add(leg);
    };

    addLeg("leg_FL", xL, zF);
    addLeg("leg_FR", xR, zF);
    addLeg("leg_BL", xL, zB);
    addLeg("leg_BR", xR, zB);

    const kickGeo = new THREE.BoxGeometry(width, plinthH, kickDepth);
    const kick = new THREE.Mesh(kickGeo, bodyMat);
    kick.name = "kick";
    kick.position.set(0, plinthH / 2, kickCenterZ);
    setPartMeta(kick, { width, height: plinthH, depth: kickDepth });
    setParamKeys(kick, ["width", "plinthHeight", "plinthSetbackMm", "depth", "boardThickness", "wallMounted"]);
    g.add(kick);
  }

  // Internal shelves
  const shelfCount = Math.max(1, Math.round(p.shelfCount));
  const internalShelfCount = Math.max(0, shelfCount - 1);
  const innerMinY = plinthH + boardT;
  const heightsMm = p.shelfAutoFit === true ? computeShelfHeightsFromGaps({ ...p, shelfGaps: [] }) : computeShelfHeightsFromGaps(p);

  for (let i = 0; i < internalShelfCount; i++) {
    const yFromBottomMm = heightsMm[i] ?? 0;
    const y = innerMinY + yFromBottomMm * MM_TO_M;
    const shelfGeo = new THREE.BoxGeometry(internalW, shelfT, internalD);
    const shelf = new THREE.Mesh(shelfGeo, bodyMat);
    shelf.name = `shelf_${i + 1}`;
    shelf.position.set(0, y, interiorCenterZ);
    setPartMeta(shelf, { width: internalW, height: shelfT, depth: internalD });
    setParamKeys(shelf, ["shelfCount", "shelfThickness", "shelfAutoFit", "shelfGaps", "height", "plinthHeight", "boardThickness"]);
    g.add(shelf);
  }

  // Front swing doors + simple hidden hinges
  {
    const doorT = boardT;
    const doorPlaneZ = depth / 2 + doorT / 2;

    const doorH = Math.max(0.1, openingH - topGap - bottomGap);
    const doorCenterY = plinthH + bottomGap + doorH / 2;

    const openAngle = p.doorOpen ? Math.PI / 2 : 0;
    const hingeCount = clampInt(p.hingeCountPerDoor, 1, 6);
    const hingeTopOffset = Math.max(0, p.hingeTopOffsetMm) * MM_TO_M;
    const hingeBottomOffset = Math.max(0, p.hingeBottomOffsetMm) * MM_TO_M;
    const singleHingeSide = p.hingeSide === "right" ? "right" : "left";

    if (p.doorDouble) {
      const doorW = Math.max(0.05, (width - 2 * sideGap - centerGap) / 2);
      addDoorWithHinges("door_L", "hinge_L", "left");
      addDoorWithHinges("door_R", "hinge_R", "right");

      function addDoorWithHinges(doorName: string, hingePrefix: string, hingeSide: "left" | "right") {
        const pivotX = hingeSide === "left" ? -width / 2 + sideGap : width / 2 - sideGap;
        const group = new THREE.Group();
        group.name = `${doorName}_pivot`;
        group.position.set(pivotX, doorCenterY, doorPlaneZ);
        group.rotation.y = hingeSide === "left" ? -openAngle : openAngle;

        const doorGeo = new THREE.BoxGeometry(doorW, doorH, doorT);
        const door = new THREE.Mesh(doorGeo, frontMat);
        door.name = doorName;
        door.position.set(hingeSide === "left" ? doorW / 2 : -doorW / 2, 0, 0);
        setPartMeta(door, { width: doorW, height: doorH, depth: doorT });
        setParamKeys(door, [
          "width",
          "height",
          "depth",
          "plinthHeight",
          "wallMounted",
          "sideGap",
          "topGap",
          "bottomGap",
          "frontGap",
          "doorDouble",
          "doorOpen",
          "hingeCountPerDoor",
          "hingeTopOffsetMm",
          "hingeBottomOffsetMm"
        ]);
        group.add(door);

        const hingeW = 0.008;
        const hingeH = 0.05;
        const hingeD = 0.018;
        const hingeGeo = new THREE.BoxGeometry(hingeW, hingeH, hingeD);
        const hingeInsetX = 0.006;
        const hingeX = hingeSide === "left" ? hingeW / 2 + hingeInsetX : -hingeW / 2 - hingeInsetX;
        const hingeZ = -doorT / 2 - hingeD / 2 - 0.001;

        const ys = computeHingeYs(doorH, hingeCount, hingeTopOffset, hingeBottomOffset);

        ys.forEach((y, idx) => {
          const hinge = new THREE.Mesh(hingeGeo, hingeMat);
          hinge.name = `${hingePrefix}_${idx + 1}`;
          hinge.position.set(hingeX, y, hingeZ);
          setPartMeta(hinge, { width: hingeW, height: hingeH, depth: hingeD });
          setParamKeys(hinge, ["doorDouble", "doorOpen", "hingeCountPerDoor", "hingeTopOffsetMm", "hingeBottomOffsetMm"]);
          group.add(hinge);
        });

        g.add(group);
      }
    } else {
      const doorW = Math.max(0.05, width - 2 * sideGap);
      const pivotX = singleHingeSide === "left" ? -width / 2 + sideGap : width / 2 - sideGap;
      const group = new THREE.Group();
      group.name = "door_pivot";
      group.position.set(pivotX, doorCenterY, doorPlaneZ);
      group.rotation.y = singleHingeSide === "left" ? -openAngle : openAngle;

      const doorGeo = new THREE.BoxGeometry(doorW, doorH, doorT);
      const door = new THREE.Mesh(doorGeo, frontMat);
      door.name = "door";
      door.position.set(singleHingeSide === "left" ? doorW / 2 : -doorW / 2, 0, 0);
      setPartMeta(door, { width: doorW, height: doorH, depth: doorT });
      setParamKeys(door, [
        "width",
        "height",
        "depth",
        "plinthHeight",
        "wallMounted",
        "sideGap",
        "topGap",
        "bottomGap",
        "doorDouble",
        "doorOpen",
        "hingeSide",
        "hingeCountPerDoor",
        "hingeTopOffsetMm",
        "hingeBottomOffsetMm"
      ]);
      group.add(door);

      const hingeW = 0.008;
      const hingeH = 0.05;
      const hingeD = 0.018;
      const hingeGeo = new THREE.BoxGeometry(hingeW, hingeH, hingeD);
      const hingeX = singleHingeSide === "left" ? hingeW / 2 + 0.006 : -hingeW / 2 - 0.006;
      const hingeZ = -doorT / 2 - hingeD / 2 - 0.001;

      const ys = computeHingeYs(doorH, hingeCount, hingeTopOffset, hingeBottomOffset);

      ys.forEach((y, idx) => {
        const hinge = new THREE.Mesh(hingeGeo, hingeMat);
        hinge.name = `hinge_${idx + 1}`;
        hinge.position.set(hingeX, y, hingeZ);
        setPartMeta(hinge, { width: hingeW, height: hingeH, depth: hingeD });
        setParamKeys(hinge, ["doorDouble", "doorOpen", "hingeSide", "hingeCountPerDoor", "hingeTopOffsetMm", "hingeBottomOffsetMm"]);
        group.add(hinge);
      });

      g.add(group);
    }
  }

  return g;
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

function computeHingeYs(doorH: number, count: number, topOffset: number, bottomOffset: number) {
  const c = Math.max(1, Math.round(count));
  if (c === 1) return [0];

  const yTop = doorH / 2 - Math.max(0, topOffset);
  const yBottom = -doorH / 2 + Math.max(0, bottomOffset);

  const safeMargin = Math.min(0.12, Math.max(0.03, doorH / 2 - 0.025 - 0.02));
  const a = yTop > yBottom ? yTop : doorH / 2 - safeMargin;
  const b = yTop > yBottom ? yBottom : -doorH / 2 + safeMargin;

  return Array.from({ length: c }, (_, idx) => {
    const t = c === 1 ? 0.5 : idx / (c - 1);
    return b + t * (a - b);
  });
}

