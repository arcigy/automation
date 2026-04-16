import * as THREE from "three";
import type { DrawerLowParams } from "../model/cabinetTypes";
import { getPbrMaterialWorldSizeM, getPbrWoodMaterial } from "../materials/pbrMaterials";
import { applyBoxGrainUv } from "../materials/uvGrain";

const MM_TO_M = 0.001;

export function buildDrawerLow(p: DrawerLowParams): THREE.Group {
  const g = new THREE.Group();
  g.name = "drawerLowModule";

  // Convert mm -> meters once.
  const width = p.width * MM_TO_M;
  const height = p.height * MM_TO_M;
  const depth = p.depth * MM_TO_M;
  const boardT = p.boardThickness * MM_TO_M;
  const backT = p.backThickness * MM_TO_M;
  const plinthH = p.plinthHeight * MM_TO_M;
  const frontGap = p.frontGap * MM_TO_M;
  const sideGap = p.sideGap * MM_TO_M;
  const bottomGap = p.bottomGap * MM_TO_M;
  const drawerBoxT = p.drawerBoxThickness * MM_TO_M;

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
  const drawerMat = new THREE.MeshStandardMaterial({
    color: parseHexColor(p.materials.drawerColor),
    roughness: 0.8,
    metalness: 0.0
  });
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

  // Coordinate system:
  // - Y up, ground at y=0
  // - Cabinet centered on X, Z (front is +Z, back is -Z)
  // - Cabinet body starts at y=plinthH
  const openingH = height - plinthH;
  const sideH = openingH;

  // Sides (from plinth top to top)
  const sideGeo = new THREE.BoxGeometry(boardT, sideH, depth);

  const leftSide = new THREE.Mesh(sideGeo, bodyMat);
  leftSide.position.set(-(width / 2 - boardT / 2), plinthH + sideH / 2, 0);
  leftSide.name = "leftSide";
  setPartMeta(leftSide, { width: boardT, height: sideH, depth }, "height");
  g.add(leftSide);

  const rightSide = new THREE.Mesh(sideGeo, bodyMat);
  rightSide.position.set(width / 2 - boardT / 2, plinthH + sideH / 2, 0);
  rightSide.name = "rightSide";
  setPartMeta(rightSide, { width: boardT, height: sideH, depth }, "height");
  g.add(rightSide);

  // Interior dimensions (simplified):
  // Back panel is mounted OUTSIDE the carcass, so it does not eat into internal depth.
  const internalW = width - 2 * boardT;
  const internalD = depth;
  const interiorCenterZ = 0;

  // Bottom panel (sits above plinth)
  const bottomGeo = new THREE.BoxGeometry(internalW, boardT, internalD);
  const bottom = new THREE.Mesh(bottomGeo, bodyMat);
  bottom.position.set(0, plinthH + boardT / 2, interiorCenterZ);
  bottom.name = "bottom";
  setPartMeta(bottom, { width: internalW, height: boardT, depth: internalD }, "width");
  g.add(bottom);

  // Top panel (full, simplified)
  const topGeo = new THREE.BoxGeometry(internalW, boardT, internalD);
  const top = new THREE.Mesh(topGeo, bodyMat);
  top.position.set(0, height - boardT / 2, interiorCenterZ);
  top.name = "top";
  setPartMeta(top, { width: internalW, height: boardT, depth: internalD }, "width");
  g.add(top);

  // Back panel (full width), mounted outside so it doesn't overlap the interior volume.
  const backGeo = new THREE.BoxGeometry(width, sideH, backT);
  const back = new THREE.Mesh(backGeo, bodyMat);
  back.position.set(0, plinthH + sideH / 2, -depth / 2 - backT / 2);
  back.name = "back";
  setPartMeta(back, { width, height: sideH, depth: backT }, "width");
  g.add(back);

  // Legs (cylinders) - 4x, under the carcass, height = plinthHeight
  if (plinthH > 0) {
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6, metalness: 0.1 });
    const legRadius = 0.02; // 20mm
    const legH = plinthH;
    const legGeo = new THREE.CylinderGeometry(legRadius, legRadius, legH, 18);
    const insetX = 0.03; // 30mm from outer edges
    const insetZ = 0.06; // 60mm (avoid front kickboard area a bit)
    const xL = -width / 2 + insetX;
    const xR = width / 2 - insetX;
    const zF = depth / 2 - insetZ;
    const zB = -depth / 2 + insetZ;

    const addLeg = (name: string, x: number, z: number) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.name = name;
      leg.position.set(x, legH / 2, z);
      setPartMetaMm(leg, { width: legRadius * 2 * 1000, height: legH / MM_TO_M, depth: legRadius * 2 * 1000 }, "none");
      g.add(leg);
    };

    addLeg("leg_FL", xL, zF);
    addLeg("leg_FR", xR, zF);
    addLeg("leg_BL", xL, zB);
    addLeg("leg_BR", xR, zB);
  }

  // Plinth / kickboard (simple front plate)
  const kickDepth = Math.min(boardT, depth * 0.2);
  const kickGeo = new THREE.BoxGeometry(width, plinthH, kickDepth);
  const kick = new THREE.Mesh(kickGeo, bodyMat);
  kick.position.set(0, plinthH / 2, depth / 2 - kickDepth / 2);
  kick.name = "kick";
  setPartMeta(kick, { width, height: plinthH, depth: kickDepth }, "width");
  g.add(kick);

  // Drawer fronts (overlay across side panels)
  const frontThickness = boardT;
  const frontW = width - 2 * sideGap;
  const frontPlaneZ = depth / 2 + frontThickness / 2;

  const openingBottomY = plinthH;
  let cursorY = openingBottomY + bottomGap;

  for (let i = 0; i < p.drawerCount; i++) {
    const h = p.drawerFrontHeights[i] * MM_TO_M;

    const frontGeo = new THREE.BoxGeometry(frontW, h, frontThickness);
    const front = new THREE.Mesh(frontGeo, frontMat);
    front.position.set(0, cursorY + h / 2, frontPlaneZ);
    front.name = `front_${i + 1}`;
    setPartMeta(front, { width: frontW, height: h, depth: frontThickness }, "height");
    g.add(front);

    // Drawer box (panels)
    // Rails (carcass-mounted) define the required side clearance.
    const railT = 0.012;
    const railH = 0.045;
    const slideAllowanceX = railT + 0.003; // slide thickness + a bit of running clearance

    const drawerClearSide = Math.max(0.005, sideGap * 2);
    const drawerClearTopBottom = Math.max(0.006, frontGap * 2);
    // IMPORTANT: drawer box must not overlap the slides/rails.
    const drawerOuterW = Math.max(0.05, internalW - 2 * (drawerClearSide + slideAllowanceX));
    const drawerOuterH = Math.max(0.05, h - drawerClearTopBottom);
    const drawerOuterD = Math.max(0.1, internalD - 0.05); // 50mm back clearance

    const innerW = Math.max(0.02, drawerOuterW - 2 * drawerBoxT);
    const innerD = Math.max(0.05, drawerOuterD - drawerBoxT);
    const sideH = Math.min(drawerOuterH, p.drawerBoxSideHeight * MM_TO_M);

    const carcassFrontZ = depth / 2;
    const drawerFrontClear = 0.001; // 1mm behind carcass front plane (keeps it visually "touching")
    const desiredCenterY = cursorY + h / 2;
    const innerMinY = plinthH + boardT + 0.002;
    const innerMaxY = height - boardT - 0.002;
    const minCenterY = innerMinY + drawerOuterH / 2;
    const maxCenterY = innerMaxY - drawerOuterH / 2;
    const centerY = maxCenterY >= minCenterY ? clamp(desiredCenterY, minCenterY, maxCenterY) : desiredCenterY;

    const drawerCenter = new THREE.Vector3(0, centerY, carcassFrontZ - drawerFrontClear - drawerOuterD / 2);
    const sideCenterY = drawerCenter.y - drawerOuterH / 2 + sideH / 2;

    // Left side
    const leftSideGeo2 = new THREE.BoxGeometry(drawerBoxT, sideH, drawerOuterD);
    const leftSide2 = new THREE.Mesh(leftSideGeo2, drawerMat);
    leftSide2.name = `drawer_${i + 1}_sideL`;
    leftSide2.position.set(drawerCenter.x - drawerOuterW / 2 + drawerBoxT / 2, sideCenterY, drawerCenter.z);
    setPartMeta(leftSide2, { width: drawerBoxT, height: sideH, depth: drawerOuterD }, "depth");
    g.add(leftSide2);

    // Right side
    const rightSideGeo2 = new THREE.BoxGeometry(drawerBoxT, sideH, drawerOuterD);
    const rightSide2 = new THREE.Mesh(rightSideGeo2, drawerMat);
    rightSide2.name = `drawer_${i + 1}_sideR`;
    rightSide2.position.set(drawerCenter.x + drawerOuterW / 2 - drawerBoxT / 2, sideCenterY, drawerCenter.z);
    setPartMeta(rightSide2, { width: drawerBoxT, height: sideH, depth: drawerOuterD }, "depth");
    g.add(rightSide2);

    // Bottom
    const bottomGeo2 = new THREE.BoxGeometry(innerW, drawerBoxT, innerD);
    const bottom2 = new THREE.Mesh(bottomGeo2, drawerMat);
    bottom2.name = `drawer_${i + 1}_bottom`;
    bottom2.position.set(drawerCenter.x, drawerCenter.y - drawerOuterH / 2 + drawerBoxT / 2, drawerCenter.z + drawerBoxT / 2);
    setPartMeta(bottom2, { width: innerW, height: drawerBoxT, depth: innerD }, "depth");
    g.add(bottom2);

    // Back
    const backGeo2 = new THREE.BoxGeometry(innerW, sideH, drawerBoxT);
    const back2 = new THREE.Mesh(backGeo2, drawerMat);
    back2.name = `drawer_${i + 1}_back`;
    back2.position.set(drawerCenter.x, sideCenterY, drawerCenter.z - drawerOuterD / 2 + drawerBoxT / 2);
    setPartMeta(back2, { width: innerW, height: sideH, depth: drawerBoxT }, "width");
    g.add(back2);

    // Rails (carcass-mounted)
    const railLen = Math.max(0.2, drawerOuterD - 0.005);
    const railCenterY = drawerCenter.y - drawerOuterH / 2 + railH / 2 + drawerBoxT + 0.002;
    const railCenterZ = carcassFrontZ - drawerFrontClear - railLen / 2;

    const railGeo = new THREE.BoxGeometry(railT, railH, railLen);
    const railInsetX = 0.002;

    const railL = new THREE.Mesh(railGeo, railMat);
    railL.name = `drawer_${i + 1}_railL`;
    railL.position.set(-internalW / 2 + railT / 2 + railInsetX, railCenterY, railCenterZ);
    setPartMeta(railL, { width: railT, height: railH, depth: railLen }, "none");
    g.add(railL);

    const railR = new THREE.Mesh(railGeo, railMat);
    railR.name = `drawer_${i + 1}_railR`;
    railR.position.set(internalW / 2 - railT / 2 - railInsetX, railCenterY, railCenterZ);
    setPartMeta(railR, { width: railT, height: railH, depth: railLen }, "none");
    g.add(railR);

    cursorY += h + frontGap;
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
