import * as THREE from "three";
import type { CornerShelfLowerParams } from "../model/cabinetTypes";
import { computeShelfHeightsFromGaps } from "../model/cabinetTypes";

const MM_TO_M = 0.001;

export function buildCornerShelfLower(p: CornerShelfLowerParams): THREE.Group {
  const g = new THREE.Group();
  g.name = "cornerShelfLowerModule";

  const lenX = p.lengthX * MM_TO_M;
  const lenZ = p.lengthZ * MM_TO_M;
  const depth = p.depth * MM_TO_M;
  const height = p.height * MM_TO_M;
  const boardT = p.boardThickness * MM_TO_M;
  const backT = p.backThickness * MM_TO_M;
  const plinthH = p.plinthHeight * MM_TO_M;
  const shelfT = p.shelfThickness * MM_TO_M;

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

  // Layout:
  // - Inner corner (where walls meet) is at (-lenX/2, -lenZ/2).
  // - X run extends to +lenX/2
  // - Z run extends to +lenZ/2
  // - Both runs share a common depth measured from the inner corner edges.
  const innerX = -lenX / 2;
  const innerZ = -lenZ / 2;
  const openingH = height - plinthH;

  // Side panels at outer ends
  {
    const sideGeoX = new THREE.BoxGeometry(boardT, openingH, depth);
    const sideX = new THREE.Mesh(sideGeoX, bodyMat);
    sideX.name = "side_end_x";
    sideX.position.set(lenX / 2 - boardT / 2, plinthH + openingH / 2, innerZ + depth / 2);
    setPartMeta(sideX, { width: boardT, height: openingH, depth });
    g.add(sideX);

    const sideGeoZ = new THREE.BoxGeometry(depth, openingH, boardT);
    const sideZ = new THREE.Mesh(sideGeoZ, bodyMat);
    sideZ.name = "side_end_z";
    sideZ.position.set(innerX + depth / 2, plinthH + openingH / 2, lenZ / 2 - boardT / 2);
    setPartMeta(sideZ, { width: depth, height: openingH, depth: boardT });
    g.add(sideZ);
  }

  // Back panels on inner edges
  {
    const backGeoX = new THREE.BoxGeometry(lenX, openingH, backT);
    const backX = new THREE.Mesh(backGeoX, bodyMat);
    backX.name = "back_x";
    backX.position.set(0, plinthH + openingH / 2, innerZ + backT / 2);
    setPartMeta(backX, { width: lenX, height: openingH, depth: backT });
    g.add(backX);

    const backGeoZ = new THREE.BoxGeometry(backT, openingH, lenZ);
    const backZ = new THREE.Mesh(backGeoZ, bodyMat);
    backZ.name = "back_z";
    backZ.position.set(innerX + backT / 2, plinthH + openingH / 2, 0);
    setPartMeta(backZ, { width: backT, height: openingH, depth: lenZ });
    g.add(backZ);
  }

  // Bottom/top panels (L-shape from 2 boxes, second box excludes overlap)
  const lPartZLen = Math.max(0, lenZ - depth);
  const lPartXLen = Math.max(0, lenX - depth);

  addLPanel("bottom", plinthH + boardT / 2, boardT, bodyMat);
  addLPanel("top", height - boardT / 2, boardT, bodyMat);

  function addLPanel(name: string, y: number, t: number, mat: THREE.Material) {
    // IMPORTANT: top/bottom must stop at the inner face of the back panels (no overlap with back_x/back_z).
    const insideDepth = safeDim(depth - backT);
    const geoX = new THREE.BoxGeometry(lenX, t, insideDepth);
    const partX = new THREE.Mesh(geoX, mat);
    partX.name = `${name}_x`;
    partX.position.set(0, y, innerZ + backT + insideDepth / 2);
    setPartMeta(partX, { width: lenX, height: t, depth: insideDepth });
    g.add(partX);

    if (lPartZLen <= 0.0001) return;
    const insideWidth = safeDim(depth - backT);
    const geoZ = new THREE.BoxGeometry(insideWidth, t, lPartZLen);
    const partZ = new THREE.Mesh(geoZ, mat);
    partZ.name = `${name}_z`;
    partZ.position.set(innerX + backT + insideWidth / 2, y, innerZ + depth + lPartZLen / 2);
    setPartMeta(partZ, { width: insideWidth, height: t, depth: lPartZLen });
    g.add(partZ);
  }

  // Legs (cylinders) - 4x (inner corner, elbow, endX, endZ)
  if (plinthH > 0) {
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6, metalness: 0.1 });
    const legRadius = 0.02; // 20mm
    const legGeo = new THREE.CylinderGeometry(legRadius, legRadius, plinthH, 18);
    const inset = 0.03;

    const pts: Array<[string, number, number]> = [
      ["leg_inner", innerX + inset, innerZ + inset],
      ["leg_end_x", lenX / 2 - inset, innerZ + inset],
      ["leg_end_z", innerX + inset, lenZ / 2 - inset],
      ["leg_elbow", innerX + depth - inset, innerZ + depth - inset]
    ];

    for (const [name, x, z] of pts) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.name = name;
      leg.position.set(x, plinthH / 2, z);
      setPartMetaMm(leg, { width: legRadius * 2 * 1000, height: p.plinthHeight, depth: legRadius * 2 * 1000 });
      g.add(leg);
    }
  }

  // Kickboards on both faces
  {
    const kickDepth = Math.min(boardT, depth * 0.2);
    const cornerW = boardT + 0.002;

    // IMPORTANT: front parts must NOT run through the inner elbow area (depth x depth overlap).
    const outerXLen = Math.max(0, lenX - depth);
    const outerZLen = Math.max(0, lenZ - depth);

    // Corner filler at inner elbow (prevents gaps).
    // Two thin pieces so the toe-kick stays "thin" in the forward direction.
    {
      const kickCornerXGeo = new THREE.BoxGeometry(cornerW, plinthH, kickDepth);
      const kickCornerX = new THREE.Mesh(kickCornerXGeo, bodyMat);
      kickCornerX.name = "kick_corner_x";
      kickCornerX.position.set(innerX + depth + cornerW / 2, plinthH / 2, innerZ + depth - kickDepth / 2);
      setPartMeta(kickCornerX, { width: cornerW, height: plinthH, depth: kickDepth });
      g.add(kickCornerX);

      const kickCornerZGeo = new THREE.BoxGeometry(kickDepth, plinthH, cornerW);
      const kickCornerZ = new THREE.Mesh(kickCornerZGeo, bodyMat);
      kickCornerZ.name = "kick_corner_z";
      kickCornerZ.position.set(innerX + depth - kickDepth / 2, plinthH / 2, innerZ + depth + cornerW / 2);
      setPartMeta(kickCornerZ, { width: kickDepth, height: plinthH, depth: cornerW });
      g.add(kickCornerZ);
    }

    if (outerXLen > 0.0001) {
      const kickGeoX = new THREE.BoxGeometry(outerXLen, plinthH, kickDepth);
      const kickX = new THREE.Mesh(kickGeoX, bodyMat);
      kickX.name = "kick_x";
      kickX.position.set(innerX + depth + outerXLen / 2, plinthH / 2, innerZ + depth - kickDepth / 2);
      setPartMeta(kickX, { width: outerXLen, height: plinthH, depth: kickDepth });
      g.add(kickX);
    }

    if (outerZLen > 0.0001) {
      const kickGeoZ = new THREE.BoxGeometry(kickDepth, plinthH, outerZLen);
      const kickZ = new THREE.Mesh(kickGeoZ, bodyMat);
      kickZ.name = "kick_z";
      kickZ.position.set(innerX + depth - kickDepth / 2, plinthH / 2, innerZ + depth + outerZLen / 2);
      setPartMeta(kickZ, { width: kickDepth, height: plinthH, depth: outerZLen });
      g.add(kickZ);
    }
  }

  // Internal shelves (two L parts at each shelf height)
  {
    const shelfCount = Math.max(1, Math.round(p.shelfCount));
    const internalShelfCount = Math.max(0, shelfCount - 1);
    const innerMinY = plinthH + boardT;

    const heightsMm =
      p.shelfAutoFit === true
        ? computeShelfHeightsFromGaps({ ...p, shelfGaps: [] })
        : computeShelfHeightsFromGaps(p);

    for (let i = 0; i < internalShelfCount; i++) {
      const yFromBottomMm = heightsMm[i] ?? 0;
      const y = innerMinY + yFromBottomMm * MM_TO_M;

      // Two-piece L shelf (same idea as the top/bottom L panels), with X-side owning the overlap:
      // - X piece covers the corner overlap + X-run
      // - Z piece starts after the elbow and butts to the X piece

      // Exact fit: shelves start exactly at the inner face of the back panels (no overlap).
      // Note: to avoid z-fighting lines where faces touch, we use polygonOffset on shelf material (render-only).
      const shelfDepth = safeDim(depth - backT); // clear depth inside (from back panel)
      const shelfMat = (bodyMat as THREE.MeshStandardMaterial).clone();
      shelfMat.polygonOffset = true;
      shelfMat.polygonOffsetFactor = 1;
      shelfMat.polygonOffsetUnits = 1;

      // X-side "full" piece: spans along X (from inner back to end) and in Z only the depth area.
      const shelfXLenFull = safeDim(lenX - boardT - backT);
      if (shelfXLenFull > 0.0001) {
        const geoX = new THREE.BoxGeometry(shelfXLenFull, shelfT, shelfDepth);
        const shelfX = new THREE.Mesh(geoX, shelfMat);
        shelfX.name = `shelf_${i + 1}_x`;
        shelfX.position.set(innerX + backT + shelfXLenFull / 2, y, innerZ + backT + shelfDepth / 2);
        setPartMeta(shelfX, { width: shelfXLenFull, height: shelfT, depth: shelfDepth });
        g.add(shelfX);
      }

      // Z-side "butt" piece: only the Z-run outside the overlap (starts at elbowZ), limited in X to the depth area.
      const elbowZ = innerZ + depth;
      const shelfZLenButt = Math.max(0, lenZ - boardT - depth);
      if (shelfZLenButt > 0.0001) {
        const geoZ = new THREE.BoxGeometry(shelfDepth, shelfT, shelfZLenButt);
        const shelfZ = new THREE.Mesh(geoZ, shelfMat);
        shelfZ.name = `shelf_${i + 1}_z`;
        shelfZ.position.set(innerX + backT + shelfDepth / 2, y, elbowZ + shelfZLenButt / 2);
        setPartMeta(shelfZ, { width: shelfDepth, height: shelfT, depth: shelfZLenButt });
        g.add(shelfZ);
      }
    }
  }

  // Doors + hinges on both faces (simple overlay)
  {
    const doorT = boardT;
    const doorH = Math.max(0.1, openingH);
    const doorCenterY = plinthH + openingH / 2;
    const openAngle = p.doorOpen ? Math.PI / 2 : 0;
    const hingeCount = p.hingeCountPerDoor === 2 ? 2 : 3;

    // IMPORTANT: match the toe-kick logic:
    // Front faces must NOT run through the inner elbow overlap area (depth x depth).
    // Use only TWO door panels (no third filler):
    // - Door on Z face covers the X-run from elbow -> outer end
    // - Optional door on X face covers the Z-run from elbow -> outer end
    const eps = 0.0002; // 0.2mm, avoids z-fighting without introducing a visible gap
    const elbowX = innerX + depth;
    const elbowZ = innerZ + depth;
    const outerXLen = Math.max(0, lenX - depth);
    const outerZLen = Math.max(0, lenZ - depth);

    if (outerXLen > 0.0001) {
      // Face Z (front of X-run): spans along X from elbow -> outer end, hinge at outer end.
      const doorZ = addDoorOnZFace(
        "door_front_z",
        "hinge_front_z",
        elbowX,
        elbowX + outerXLen,
        elbowZ + doorT / 2 + eps,
        "right",
        openAngle
      );

      if (p.doorDouble && outerZLen > 0.0001) {
        // X-face is a "butt" panel (doesn't cover the elbow). No carcass hinges on this panel.
        const buttOffset = Math.min(doorT, Math.max(0, outerZLen - 0.06));
        addDoorOnXFace(
          "door_front_x",
          "hinge_front_x",
          elbowZ + buttOffset,
          elbowZ + outerZLen,
          elbowX + doorT / 2 + eps,
          "top",
          openAngle,
          false
        );

        // Fold hinges live on the Z door edge (so hardware belongs to Z door).
        addBifoldHingesOnZDoor(doorZ.pivot, doorZ.doorW);
      }
    }

    function addDoorOnZFace(
      doorName: string,
      hingePrefix: string,
      startX: number,
      endX: number,
      planeZ: number,
      hingeSide: "left" | "right",
      angle: number
    ): { pivot: THREE.Group; doorW: number } {
      const doorW = Math.max(0.05, endX - startX);
      const pivotX = hingeSide === "left" ? startX : endX;
      const pivot = new THREE.Group();
      pivot.name = `${doorName}_pivot`;
      pivot.position.set(pivotX, doorCenterY, planeZ);
      pivot.rotation.y = hingeSide === "left" ? -angle : angle;

      const doorGeo = new THREE.BoxGeometry(doorW, doorH, doorT);
      const door = new THREE.Mesh(doorGeo, frontMat);
      door.name = doorName;
      door.position.set(hingeSide === "left" ? doorW / 2 : -doorW / 2, 0, 0);
      setPartMeta(door, { width: doorW, height: doorH, depth: doorT });
      pivot.add(door);

      addHiddenHinges(pivot, hingePrefix, hingeSide === "left" ? +1 : -1);
      g.add(pivot);

      return { pivot, doorW };
    }

    function addBifoldPanelOnXFace(doorZPivot: THREE.Group, doorZW: number, outerZLenM: number) {
      // Butt logic (same intent as before): the Z-face door "covers" the elbow, the folding panel starts after door thickness.
      const buttOffset = Math.min(doorT, Math.max(0, outerZLenM - 0.06));
      const panelW = Math.max(0.05, outerZLenM - buttOffset);

      // Hinge line between the two panels, expressed in doorZPivot-local space.
      // - X: at the inner edge of the Z door (startX) => local x = -doorZW (since hinge is on the right)
      // - Z: move to the panel start (buttOffset) relative to the Z-door plane at +doorT/2
      const bifoldPivot = new THREE.Group();
      bifoldPivot.name = "door_bifold_pivot";
      bifoldPivot.position.set(-doorZW, 0, buttOffset - doorT / 2);
      bifoldPivot.rotation.y = p.doorOpen ? -Math.PI / 2 : 0;
      doorZPivot.add(bifoldPivot);

      const panelGroup = new THREE.Group();
      panelGroup.name = "door_front_x_group";
      // Closed: panel is perpendicular; Open: bifoldPivot rotates it flat with the Z-door.
      panelGroup.rotation.y = Math.PI / 2;
      bifoldPivot.add(panelGroup);

      const panelGeo = new THREE.BoxGeometry(panelW, doorH, doorT);
      const panel = new THREE.Mesh(panelGeo, frontMat);
      panel.name = "door_front_x";
      // Hinge at local x=0, extend toward +x.
      panel.position.set(panelW / 2, 0, doorT / 2 + eps);
      setPartMeta(panel, { width: panelW, height: doorH, depth: doorT });
      panelGroup.add(panel);

      // Bi-fold hinges (on the Z-door inner edge, not on the carcass) — keep them inside so they're not visible outside.
      const hingeW = 0.006;
      const hingeH = 0.045;
      const hingeD = 0.014;
      const hingeGeo = new THREE.BoxGeometry(hingeW, hingeH, hingeD);
      const hingeX = 0.004; // slightly inside the Z-door thickness
      const hingeZ = -doorT / 2 - hingeD / 2 - 0.001;

      const marginY = Math.min(0.12, Math.max(0.03, doorH / 2 - hingeH / 2 - 0.02));
      const ys = Array.from({ length: hingeCount }, (_, idx) => {
        const t = hingeCount === 1 ? 0.5 : idx / (hingeCount - 1);
        return -doorH / 2 + marginY + t * (doorH - 2 * marginY);
      });
      ys.forEach((y, idx) => {
        const hinge = new THREE.Mesh(hingeGeo, hingeMat);
        hinge.name = `bifold_hinge_${idx + 1}`;
        hinge.position.set(hingeX, y, hingeZ);
        setPartMeta(hinge, { width: hingeW, height: hingeH, depth: hingeD });
        bifoldPivot.add(hinge);
      });
    }

    function addDoorOnXFace(
      doorName: string,
      hingePrefix: string,
      startZ: number,
      endZ: number,
      planeX: number,
      hingeSide: "bottom" | "top",
      angle: number,
      withHinges: boolean
    ) {
      const doorW = Math.max(0.05, endZ - startZ);
      const pivotZ = hingeSide === "bottom" ? startZ : endZ;
      const pivot = new THREE.Group();
      pivot.name = `${doorName}_pivot`;
      pivot.position.set(planeX, doorCenterY, pivotZ);
      // Rotate around Y, because the door plane is perpendicular.
      pivot.rotation.y = hingeSide === "bottom" ? angle : -angle;

      const doorGeo = new THREE.BoxGeometry(doorT, doorH, doorW);
      const door = new THREE.Mesh(doorGeo, frontMat);
      door.name = doorName;
      door.position.set(0, 0, hingeSide === "bottom" ? doorW / 2 : -doorW / 2);
      setPartMeta(door, { width: doorT, height: doorH, depth: doorW });
      pivot.add(door);

      if (withHinges) {
        const hingeW = 0.008;
        const hingeH = 0.05;
        const hingeD = 0.018;
        const hingeGeo = new THREE.BoxGeometry(hingeD, hingeH, hingeW);
        const hingeInset = 0.006;
        const hingeZLocal = hingeSide === "bottom" ? hingeW / 2 + hingeInset : -hingeW / 2 - hingeInset;
        const hingeXLocal = -doorT / 2 - hingeD / 2 - 0.001;
        const marginY = Math.min(0.12, Math.max(0.03, doorH / 2 - hingeH / 2 - 0.02));
        const ys = Array.from({ length: hingeCount }, (_, idx) => {
          const t = hingeCount === 1 ? 0.5 : idx / (hingeCount - 1);
          return -doorH / 2 + marginY + t * (doorH - 2 * marginY);
        });
        ys.forEach((y, idx) => {
          const hinge = new THREE.Mesh(hingeGeo, hingeMat);
          hinge.name = `${hingePrefix}_${idx + 1}`;
          hinge.position.set(hingeXLocal, y, hingeZLocal);
          setPartMeta(hinge, { width: hingeD, height: hingeH, depth: hingeW });
          pivot.add(hinge);
        });
      }

      g.add(pivot);
    }

    function addBifoldHingesOnZDoor(doorZPivot: THREE.Group, doorZW: number) {
      const hingeW = 0.006;
      const hingeH = 0.045;
      const hingeD = 0.014;
      const hingeGeo = new THREE.BoxGeometry(hingeW, hingeH, hingeD);

      // Inner edge of the Z door (the edge that meets the folding panel).
      // Keep the hinge boxes fully on the inside so they're not visible from outside.
      const hingeX = -doorZW + hingeW / 2 + 0.004;
      const hingeZ = -doorT / 2 - hingeD / 2 - 0.001;

      const marginY = Math.min(0.12, Math.max(0.03, doorH / 2 - hingeH / 2 - 0.02));
      const ys = Array.from({ length: hingeCount }, (_, idx) => {
        const t = hingeCount === 1 ? 0.5 : idx / (hingeCount - 1);
        return -doorH / 2 + marginY + t * (doorH - 2 * marginY);
      });

      ys.forEach((y, idx) => {
        const hinge = new THREE.Mesh(hingeGeo, hingeMat);
        hinge.name = `bifold_hinge_${idx + 1}`;
        hinge.position.set(hingeX, y, hingeZ);
        setPartMeta(hinge, { width: hingeW, height: hingeH, depth: hingeD });
        doorZPivot.add(hinge);
      });
    }

    function addHiddenHinges(parent: THREE.Object3D, hingePrefix: string, hingeDir: 1 | -1) {
      const hingeW = 0.008;
      const hingeH = 0.05;
      const hingeD = 0.018;
      const hingeGeo = new THREE.BoxGeometry(hingeW, hingeH, hingeD);

      const hingeInsetX = 0.006;
      const hingeX = hingeDir * (hingeW / 2 + hingeInsetX);
      const hingeZ = -doorT / 2 - hingeD / 2 - 0.001; // behind door

      const marginY = Math.min(0.12, Math.max(0.03, doorH / 2 - hingeH / 2 - 0.02));
      const ys = Array.from({ length: hingeCount }, (_, idx) => {
        const t = hingeCount === 1 ? 0.5 : idx / (hingeCount - 1);
        return -doorH / 2 + marginY + t * (doorH - 2 * marginY);
      });
      ys.forEach((y, idx) => {
        const hinge = new THREE.Mesh(hingeGeo, hingeMat);
        hinge.name = `${hingePrefix}_${idx + 1}`;
        hinge.position.set(hingeX, y, hingeZ);
        setPartMeta(hinge, { width: hingeW, height: hingeH, depth: hingeD });
        parent.add(hinge);
      });
    }
  }

  return g;
}

function parseHexColor(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 0xffffff;
  return Number.parseInt(hex.slice(1), 16);
}

function safeDim(n: number) {
  return Math.max(0.01, n);
}
