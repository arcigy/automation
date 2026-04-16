import * as THREE from "three";
import type { ShelvesParams } from "../model/cabinetTypes";
import { computeShelfHeightsFromGaps } from "../model/cabinetTypes";
import { getPbrMaterialWorldSizeM, getPbrWoodMaterial } from "../materials/pbrMaterials";
import { applyBoxGrainUv } from "../materials/uvGrain";

const MM_TO_M = 0.001;

export function buildShelves(p: ShelvesParams): THREE.Group {
  const g = new THREE.Group();
  g.name = "shelvesModule";

  const width = p.width * MM_TO_M;
  const height = p.height * MM_TO_M;
  const depth = p.depth * MM_TO_M;
  const boardT = p.boardThickness * MM_TO_M;
  const backT = p.backThickness * MM_TO_M;
  const plinthH = p.plinthHeight * MM_TO_M;
  const shelfT = p.shelfThickness * MM_TO_M;

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

  const openingH = height - plinthH;
  const sideH = openingH;

  // Sides
  const sideGeo = new THREE.BoxGeometry(boardT, sideH, depth);
  const leftSide = new THREE.Mesh(sideGeo, bodyMat);
  leftSide.name = "leftSide";
  leftSide.position.set(-(width / 2 - boardT / 2), plinthH + sideH / 2, 0);
  setPartMeta(leftSide, { width: boardT, height: sideH, depth }, "height");
  g.add(leftSide);

  const rightSide = new THREE.Mesh(sideGeo, bodyMat);
  rightSide.name = "rightSide";
  rightSide.position.set(width / 2 - boardT / 2, plinthH + sideH / 2, 0);
  setPartMeta(rightSide, { width: boardT, height: sideH, depth }, "height");
  g.add(rightSide);

  // Interior dims
  // Back panel is mounted OUTSIDE the carcass, so it does not eat into internal depth.
  const internalW = width - 2 * boardT;
  const internalD = depth;
  const interiorCenterZ = 0;

  // Bottom panel
  const bottomGeo = new THREE.BoxGeometry(internalW, boardT, internalD);
  const bottom = new THREE.Mesh(bottomGeo, bodyMat);
  bottom.name = "bottom";
  bottom.position.set(0, plinthH + boardT / 2, interiorCenterZ);
  setPartMeta(bottom, { width: internalW, height: boardT, depth: internalD }, "width");
  g.add(bottom);

  // Top panel
  const topGeo = new THREE.BoxGeometry(internalW, boardT, internalD);
  const top = new THREE.Mesh(topGeo, bodyMat);
  top.name = "top";
  top.position.set(0, height - boardT / 2, interiorCenterZ);
  setPartMeta(top, { width: internalW, height: boardT, depth: internalD }, "width");
  g.add(top);

  // Back panel
  const backGeo = new THREE.BoxGeometry(width, sideH, backT);
  const back = new THREE.Mesh(backGeo, bodyMat);
  back.name = "back";
  back.position.set(0, plinthH + sideH / 2, -depth / 2 - backT / 2);
  setPartMeta(back, { width, height: sideH, depth: backT }, "width");
  g.add(back);

  // Legs (cylinders)
  if (plinthH > 0) {
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6, metalness: 0.1 });
    const legRadius = 0.02; // 20mm
    const legH = plinthH;
    const legGeo = new THREE.CylinderGeometry(legRadius, legRadius, legH, 18);
    const insetX = 0.03;
    const insetZ = 0.06;
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

  // Kickboard (front)
  const kickDepth = Math.min(boardT, depth * 0.2);
  const kickGeo = new THREE.BoxGeometry(width, plinthH, kickDepth);
  const kick = new THREE.Mesh(kickGeo, bodyMat);
  kick.name = "kick";
  kick.position.set(0, plinthH / 2, depth / 2 - kickDepth / 2);
  setPartMeta(kick, { width, height: plinthH, depth: kickDepth }, "width");
  g.add(kick);

  // Front doors (simple overlay) + hidden hinges
  {
    const reveal = 0.002; // 2mm
    const centerGap = 0.002; // 2mm between doors
    const doorT = boardT;
    const doorPlaneZ = depth / 2 + doorT / 2;

    const openingH = height - plinthH;
    const doorH = Math.max(0.1, openingH - 2 * reveal);
    const doorCenterY = plinthH + openingH / 2;

    const openAngle = p.doorOpen ? Math.PI / 2 : 0;
    const hingeCount = p.hingeCountPerDoor === 2 ? 2 : 3;

    if (p.doorDouble) {
      const doorW = Math.max(0.05, (width - 2 * reveal - centerGap) / 2);
      addDoorWithHinges("door_L", "hinge_L", "left");
      addDoorWithHinges("door_R", "hinge_R", "right");

      function addDoorWithHinges(doorName: string, hingePrefix: string, hingeSide: "left" | "right") {
        // IMPORTANT: pivot must be on the hinge side (outer edge), not the meeting edge.
        const pivotX = hingeSide === "left" ? -width / 2 + reveal : width / 2 - reveal;
        const group = new THREE.Group();
        group.name = `${doorName}_pivot`;
        group.position.set(pivotX, doorCenterY, doorPlaneZ);
        group.rotation.y = hingeSide === "left" ? -openAngle : openAngle;

        const doorGeo = new THREE.BoxGeometry(doorW, doorH, doorT);
        const door = new THREE.Mesh(doorGeo, frontMat);
        door.name = doorName;
        // Door extends inward from hinge pivot toward the center.
        door.position.set(hingeSide === "left" ? doorW / 2 : -doorW / 2, 0, 0);
        setPartMeta(door, { width: doorW, height: doorH, depth: doorT }, "height");
        group.add(door);

        // Hidden hinges (boxes) slightly inset + fully on the inside of the door so they're not visible from outside.
        const hingeW = 0.008;
        const hingeH = 0.05;
        const hingeD = 0.018;
        const hingeGeo = new THREE.BoxGeometry(hingeW, hingeH, hingeD);
        const hingeInsetX = 0.006;
        const hingeX = hingeSide === "left" ? hingeW / 2 + hingeInsetX : -hingeW / 2 - hingeInsetX;
        const hingeZ = -doorT / 2 - hingeD / 2 - 0.001; // fully behind door (inside)

        const marginY = Math.min(0.12, Math.max(0.03, doorH / 2 - hingeH / 2 - 0.02));
        const ys = Array.from({ length: hingeCount }, (_, idx) => {
          const t = hingeCount === 1 ? 0.5 : idx / (hingeCount - 1);
          return -doorH / 2 + marginY + t * (doorH - 2 * marginY);
        });

        ys.forEach((y, idx) => {
          const hinge = new THREE.Mesh(hingeGeo, hingeMat);
          hinge.name = `${hingePrefix}_${idx + 1}`;
          hinge.position.set(hingeX, y, hingeZ);
          setPartMeta(hinge, { width: hingeW, height: hingeH, depth: hingeD }, "none");
          group.add(hinge);
        });

        g.add(group);
      }
    } else {
      const doorW = Math.max(0.05, width - 2 * reveal);

      const pivotX = -width / 2 + reveal; // left edge
      const group = new THREE.Group();
      group.name = "door_pivot";
      group.position.set(pivotX, doorCenterY, doorPlaneZ);
      group.rotation.y = -openAngle;

      const doorGeo = new THREE.BoxGeometry(doorW, doorH, doorT);
      const door = new THREE.Mesh(doorGeo, frontMat);
      door.name = "door";
      door.position.set(doorW / 2, 0, 0);
      setPartMeta(door, { width: doorW, height: doorH, depth: doorT }, "height");
      group.add(door);

      const hingeW = 0.008;
      const hingeH = 0.05;
      const hingeD = 0.018;
      const hingeGeo = new THREE.BoxGeometry(hingeW, hingeH, hingeD);
      const hingeX = hingeW / 2 + 0.006;
      const hingeZ = -doorT / 2 - hingeD / 2 - 0.001;

      const marginY = Math.min(0.12, Math.max(0.03, doorH / 2 - hingeH / 2 - 0.02));
      const ys = Array.from({ length: hingeCount }, (_, idx) => {
        const t = hingeCount === 1 ? 0.5 : idx / (hingeCount - 1);
        return -doorH / 2 + marginY + t * (doorH - 2 * marginY);
      });

      ys.forEach((y, idx) => {
        const hinge = new THREE.Mesh(hingeGeo, hingeMat);
        hinge.name = `hinge_${idx + 1}`;
        hinge.position.set(hingeX, y, hingeZ);
        setPartMeta(hinge, { width: hingeW, height: hingeH, depth: hingeD }, "none");
        group.add(hinge);
      });

      g.add(group);
    }
  }

  // Internal shelves (auto-fit or manual gaps)
  // NOTE: p.shelfCount is number of compartments; internal shelves = shelfCount - 1.
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
    setPartMeta(shelf, { width: internalW, height: shelfT, depth: internalD }, "width");
    g.add(shelf);
  }

  return g;
}

function parseHexColor(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 0xffffff;
  return Number.parseInt(hex.slice(1), 16);
}
