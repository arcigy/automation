import * as THREE from "three";
import type { TopDrawersDoorsLowParams } from "../model/cabinetTypes";
import { computeShelfHeightsFromGaps } from "../model/cabinetTypes";
import { getPbrMaterialWorldSizeM, getPbrWoodMaterial } from "../materials/pbrMaterials";
import { applyBoxGrainUv } from "../materials/uvGrain";

const MM_TO_M = 0.001;

export function buildTopDrawersDoorsLow(p: TopDrawersDoorsLowParams): THREE.Group {
  const g = new THREE.Group();
  g.name = "topDrawersDoorsLowModule";

  const width = Math.max(200, p.width) * MM_TO_M;
  const height = Math.max(200, p.height) * MM_TO_M;
  const depth = Math.max(200, p.depth) * MM_TO_M;
  const boardT = Math.max(0.005, p.boardThickness * MM_TO_M);
  const backT = Math.max(0.003, p.backThickness * MM_TO_M);
  const plinthH = (p.wallMounted ? 0 : Math.max(0, p.plinthHeight)) * MM_TO_M;
  const plinthSetback = Math.max(0, p.plinthSetbackMm) * MM_TO_M;

  const topCount = Math.max(1, Math.round(p.topDrawerCount));
  const bottomCount = Math.max(1, Math.round(p.bottomDoorCount));
  const colGap = Math.max(0, p.columnGapMm) * MM_TO_M;
  const rowGap = Math.max(0, p.rowGapMm) * MM_TO_M;
  const topDrawerFrontH = Math.max(0.02, p.topDrawerFrontHeightMm * MM_TO_M);

  const sideGap = Math.max(0, p.sideGap) * MM_TO_M;
  const topGap = Math.max(0, p.topGap) * MM_TO_M;
  const bottomGap = Math.max(0, p.bottomGap) * MM_TO_M;
  const frontT = Math.max(0.005, (p.frontThicknessMm > 0 ? p.frontThicknessMm : p.boardThickness) * MM_TO_M);

  const shelfT = Math.max(0.005, p.shelfThickness * MM_TO_M);
  const sideClearance = Math.max(0, p.sideClearanceMm) * MM_TO_M;
  const drawerBoxT = Math.max(0.003, p.drawerBoxThickness * MM_TO_M);

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
  const drawerHardwareMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.55, metalness: 0.25 });
  const hingeMat = new THREE.MeshStandardMaterial({ color: 0x4a4f5a, roughness: 0.5, metalness: 0.15 });
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

  const setParamKeys = (obj: THREE.Object3D, keys: Array<keyof TopDrawersDoorsLowParams | string>) => {
    (obj as any).userData ??= {};
    (obj as any).userData.paramKeys = [...keys];
  };

  // Interior dims
  // Back panel is mounted OUTSIDE the carcass, so it does not eat into internal depth.
  const openingH = height - plinthH;
  const sideH = Math.max(0.05, openingH);
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

  // Bottom
  const bottomGeo = new THREE.BoxGeometry(internalW, boardT, internalD);
  const bottom = new THREE.Mesh(bottomGeo, bodyMat);
  bottom.name = "bottom";
  bottom.position.set(0, plinthH + boardT / 2, interiorCenterZ);
  setPartMeta(bottom, { width: internalW, height: boardT, depth: internalD }, "width");
  setParamKeys(bottom, ["width", "depth", "boardThickness", "plinthHeight", "wallMounted"]);
  g.add(bottom);

  // Top stretchers (kitchen-style): front + back rails instead of a full top panel.
  const railD = Math.min(depth * 0.25, Math.max(0.06, boardT * 3));
  const railGeo = new THREE.BoxGeometry(internalW, boardT, railD);

  const topRailFront = new THREE.Mesh(railGeo, bodyMat);
  topRailFront.name = "topRailFront";
  topRailFront.position.set(0, height - boardT / 2, depth / 2 - railD / 2);
  setPartMeta(topRailFront, { width: internalW, height: boardT, depth: railD }, "width");
  setParamKeys(topRailFront, ["width", "depth", "height", "boardThickness"]);
  g.add(topRailFront);

  const topRailBack = new THREE.Mesh(railGeo, bodyMat);
  topRailBack.name = "topRailBack";
  topRailBack.position.set(0, height - boardT / 2, -depth / 2 + railD / 2);
  setPartMeta(topRailBack, { width: internalW, height: boardT, depth: railD }, "width");
  setParamKeys(topRailBack, ["width", "depth", "height", "boardThickness"]);
  g.add(topRailBack);

  // Back panel
  const backGeo = new THREE.BoxGeometry(width, sideH, backT);
  const back = new THREE.Mesh(backGeo, bodyMat);
  back.name = "back";
  back.position.set(0, plinthH + sideH / 2, -depth / 2 - backT / 2);
  setPartMeta(back, { width, height: sideH, depth: backT }, "width");
  setParamKeys(back, ["width", "height", "depth", "backThickness", "plinthHeight", "wallMounted"]);
  g.add(back);

  // Kickboard geometry inputs reused by legs + kickboard positioning.
  const kickDepth = Math.min(boardT, depth * 0.2);
  const kickSetback = Math.min(plinthSetback, depth / 2);
  const kickCenterZ = depth / 2 - kickDepth / 2 - kickSetback;
  const kickBackFaceZ = kickCenterZ - kickDepth / 2;

  // Legs + kickboard clips
  if (plinthH > 0) {
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
      setPartMeta(leg, { width: legRadius * 2, height: plinthH, depth: legRadius * 2 }, "none");
      setParamKeys(leg, ["plinthHeight", "plinthSetbackMm", "depth", "width", "wallMounted"]);
      g.add(leg);
    };

    addLeg("leg_FL", xL, zF);
    addLeg("leg_FR", xR, zF);
    addLeg("leg_BL", xL, zB);
    addLeg("leg_BR", xR, zB);

    // Kickboard clips (snap-on collar + pad screwed into the kickboard).
    const clipMat = new THREE.MeshStandardMaterial({ color: 0x606772, roughness: 0.7, metalness: 0.05 });
    const screwMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.45, metalness: 0.35 });

    const collarOuterR = legRadius + 0.004;
    const collarH = 0.016;
    const collarGap = Math.PI * 0.35;
    const collarGeo = new THREE.CylinderGeometry(
      collarOuterR,
      collarOuterR,
      collarH,
      24,
      1,
      true,
      collarGap / 2,
      Math.PI * 2 - collarGap
    );

    const padW = 0.03;
    const padH = 0.012;
    const padD = 0.012;
    const padGeo = new THREE.BoxGeometry(padW, padH, padD);

    const armH = 0.01;
    const armW = 0.016;
    const screwR = 0.0018;

    const clipY = Math.max(collarH / 2, Math.min(plinthH - collarH / 2 - 0.004, Math.max(0.04, plinthH * 0.35)));

    const addKickClip = (namePrefix: string, x: number) => {
      const group = new THREE.Group();
      group.name = `${namePrefix}_group`;
      group.position.set(x, clipY, zF);

      const collar = new THREE.Mesh(collarGeo, clipMat);
      collar.name = `${namePrefix}_collar`;
      collar.rotation.y = Math.PI; // opening faces backwards
      setPartMeta(collar, { width: collarOuterR * 2, height: collarH, depth: collarOuterR * 2 }, "none");
      setParamKeys(collar, ["plinthHeight", "plinthSetbackMm", "depth", "width", "boardThickness", "wallMounted"]);
      group.add(collar);

      const padCenterZWorld = kickBackFaceZ - 0.001 - padD / 2;
      const padRelZ = padCenterZWorld - zF;

      const pad = new THREE.Mesh(padGeo, clipMat);
      pad.name = `${namePrefix}_pad`;
      pad.position.set(0, 0, padRelZ);
      setPartMeta(pad, { width: padW, height: padH, depth: padD }, "none");
      setParamKeys(pad, ["plinthHeight", "plinthSetbackMm", "depth", "boardThickness", "wallMounted"]);
      group.add(pad);

      const armStartZ = legRadius + 0.003;
      const armEndZ = padRelZ - padD / 2;
      const armLen = Math.max(0.005, armEndZ - armStartZ);
      const armGeo = new THREE.BoxGeometry(armW, armH, armLen);
      const arm = new THREE.Mesh(armGeo, clipMat);
      arm.name = `${namePrefix}_arm`;
      arm.position.set(0, -padH / 2 + armH / 2, armStartZ + armLen / 2);
      setPartMeta(arm, { width: armW, height: armH, depth: armLen }, "none");
      setParamKeys(arm, ["plinthHeight", "plinthSetbackMm", "depth", "wallMounted"]);
      group.add(arm);

      const screwLen = padD + Math.min(kickDepth * 0.85, 0.016);
      const screwGeo = new THREE.CylinderGeometry(screwR, screwR, screwLen, 12);
      const padBackFaceZ = padRelZ - padD / 2;
      const screwZ = padBackFaceZ + screwLen / 2;
      const screwOffsetY = 0.003;

      const addScrew = (name: string, y: number) => {
        const s = new THREE.Mesh(screwGeo, screwMat);
        s.name = name;
        s.rotation.x = Math.PI / 2;
        s.position.set(0, y, screwZ);
        setPartMeta(s, { width: screwR * 2, height: screwR * 2, depth: screwLen }, "none");
        setParamKeys(s, ["plinthHeight", "plinthSetbackMm", "depth", "boardThickness", "wallMounted"]);
        group.add(s);
      };

      addScrew(`${namePrefix}_screw_1`, -screwOffsetY);
      addScrew(`${namePrefix}_screw_2`, screwOffsetY);

      g.add(group);
    };

    addKickClip("kickClip_FL", xL);
    addKickClip("kickClip_FR", xR);
  }

  // Kickboard (front)
  if (plinthH > 0) {
    const kickGeo = new THREE.BoxGeometry(width, plinthH, kickDepth);
    const kick = new THREE.Mesh(kickGeo, bodyMat);
    kick.name = "kick";
    kick.position.set(0, plinthH / 2, kickCenterZ);
    setPartMeta(kick, { width, height: plinthH, depth: kickDepth }, "width");
    setParamKeys(kick, ["width", "plinthHeight", "plinthSetbackMm", "depth", "boardThickness", "wallMounted"]);
    g.add(kick);
  }

  // NOTE: partitions are added per-section (bottom doors vs top drawers) so they can have independent counts.

  // Compute front row sizes
  const frontW = Math.max(0.05, width - 2 * sideGap);
  const frontColWTop = Math.max(0.05, (frontW - (topCount - 1) * colGap) / topCount);
  const frontColWBottom = Math.max(0.05, (frontW - (bottomCount - 1) * colGap) / bottomCount);
  const frontPlaneZ = depth / 2 + frontT / 2;

  // Door + drawer front heights derived from the final opening height.
  const openingH2 = height - plinthH;
  const doorH = Math.max(0.1, openingH2 - topGap - bottomGap - rowGap - topDrawerFrontH);
  const doorBottomY = plinthH + bottomGap;
  const doorCenterY = doorBottomY + doorH / 2;

  const drawerBottomY = doorBottomY + doorH + rowGap;
  const drawerCenterY = drawerBottomY + topDrawerFrontH / 2;
  const topOfDoorsY = doorBottomY + doorH;

  // Mid divider (separates top drawers from bottom doors)
  {
    const midGeo = new THREE.BoxGeometry(internalW, boardT, internalD);
    const mid = new THREE.Mesh(midGeo, bodyMat);
    mid.name = "midDivider";
    mid.position.set(0, topOfDoorsY - boardT / 2, interiorCenterZ);
    setPartMeta(mid, { width: internalW, height: boardT, depth: internalD }, "width");
    setParamKeys(mid, [
      "height",
      "plinthHeight",
      "wallMounted",
      "boardThickness",
      "topDrawerFrontHeightMm",
      "rowGapMm",
      "topGap",
      "bottomGap"
    ]);
    g.add(mid);
  }

  // Section partitions so top drawers and bottom doors can have independent counts.
  {
    const bottomInnerMinY = plinthH + boardT;
    const bottomInnerMaxY = topOfDoorsY - boardT; // stop under the mid divider
    const bottomInnerH = Math.max(0.001, bottomInnerMaxY - bottomInnerMinY);

    const topInnerMinY = topOfDoorsY + 0.001; // above the mid divider
    const topInnerMaxY = height - boardT;
    const topInnerH = Math.max(0.001, topInnerMaxY - topInnerMinY);

    const addPartitions = (
      count: number,
      yMin: number,
      h: number,
      namePrefix: string,
      paramKey: "topDrawerCount" | "bottomDoorCount"
    ) => {
      const partitionCount = Math.max(0, count - 1);
      if (partitionCount <= 0 || h <= 0.002) return;

      const partitionGeo = new THREE.BoxGeometry(boardT, h, internalD);
      const colClearW = Math.max(0.05, internalW - partitionCount * boardT);
      const colW = colClearW / count;
      const baseY = yMin + h / 2;

      for (let i = 0; i < partitionCount; i++) {
        const x = -internalW / 2 + (i + 1) * colW + i * boardT + boardT / 2;
        const part = new THREE.Mesh(partitionGeo, bodyMat);
        part.name = `${namePrefix}_${i + 1}`;
        part.position.set(x, baseY, interiorCenterZ);
        setPartMeta(part, { width: boardT, height: h, depth: internalD }, "height");
        setParamKeys(part, [paramKey, "width", "height", "depth", "boardThickness", "plinthHeight", "wallMounted"]);
        g.add(part);
      }
    };

    addPartitions(bottomCount, bottomInnerMinY, bottomInnerH, "partitionBottom", "bottomDoorCount");
    addPartitions(topCount, topInnerMinY, topInnerH, "partitionTop", "topDrawerCount");
  }

  // For drawers: handle is centered horizontally on the front.
  const addCenteredHandle = (parent: THREE.Object3D, name: string, frontW2: number, frontH2: number, frontT2: number) => {
    if (p.handleType === "none") return;

    const handleLen = Math.max(0, p.handleLengthMm) * MM_TO_M;
    const handleSize = Math.max(0, p.handleSizeMm) * MM_TO_M;
    const handleProj = Math.max(0, p.handleProjectionMm) * MM_TO_M;

    if (p.handleType === "gola") {
      const golaH = clamp(handleSize, 0.006, 0.05);
      const golaD = clamp(handleProj, 0.006, 0.04);
      const golaW = clamp(handleLen > 0 ? handleLen : frontW2, 0.06, frontW2);
      const geo = new THREE.BoxGeometry(golaW, golaH, golaD);
      const m = new THREE.Mesh(geo, railMat);
      m.name = name;
      const y = frontH2 / 2 - golaH / 2 - 0.002;
      const z = frontT2 / 2 - golaD / 2 + 0.002;
      m.position.set(frontW2 / 2, y, z);
      setPartMeta(m, { width: golaW, height: golaH, depth: golaD }, "none");
      setParamKeys(m, ["handleType", "handleLengthMm", "handleSizeMm", "handleProjectionMm", "frontThicknessMm"]);
      parent.add(m);
      return;
    }

    const handleOffsetFromTop = Math.max(0, p.handlePositionMm) * MM_TO_M;
    const y = frontH2 / 2 - handleOffsetFromTop;

    if (p.handleType === "bar") {
      const hw = clamp(handleLen > 0 ? handleLen : Math.min(frontW2 * 0.6, 0.35), 0.06, frontW2 * 0.95);
      const hh = clamp(handleSize > 0 ? handleSize : 0.012, 0.006, 0.05);
      const hd = clamp(handleProj > 0 ? handleProj : 0.012, 0.006, 0.06);
      const geo = new THREE.BoxGeometry(hw, hh, hd);
      const m = new THREE.Mesh(geo, railMat);
      m.name = name;
      m.position.set(frontW2 / 2, y, frontT2 / 2 + hd / 2);
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
      m.position.set(frontW2 / 2, y, frontT2 / 2 + d / 2);
      setPartMeta(m, { width: r * 2, height: r * 2, depth: d }, "none");
      setParamKeys(m, ["handleType", "handlePositionMm", "handleSizeMm", "handleProjectionMm"]);
      parent.add(m);
      return;
    }

    // cup (simplified as a rounded bar)
    const hw = clamp(handleLen > 0 ? handleLen : Math.min(frontW2 * 0.45, 0.22), 0.06, frontW2 * 0.9);
    const r = clamp(handleSize > 0 ? handleSize / 2 : 0.008, 0.006, 0.03);
    const d = clamp(handleProj > 0 ? handleProj : 0.02, 0.006, 0.06);
    const geo = new THREE.CapsuleGeometry(r, Math.max(0.001, hw - 2 * r), 8, 20);
    const m = new THREE.Mesh(geo, railMat);
    m.name = name;
    m.rotation.z = Math.PI / 2;
    m.position.set(frontW2 / 2, y, frontT2 / 2 + d / 2);
    setPartMeta(m, { width: hw, height: r * 2, depth: r * 2 }, "none");
    setParamKeys(m, ["handleType", "handlePositionMm", "handleLengthMm", "handleSizeMm", "handleProjectionMm"]);
    parent.add(m);
  };

  // For doors: handle must be on the opening side (opposite hinges), otherwise it can appear "inside" once opened.
  const addDoorHandle = (
    doorPivot: THREE.Group,
    name: string,
    hingeSide: "left" | "right",
    doorW: number,
    doorH: number,
    doorT: number
  ) => {
    if (p.handleType === "none") return;

    const handleLen = Math.max(0, p.handleLengthMm) * MM_TO_M;
    const handleSize = Math.max(0, p.handleSizeMm) * MM_TO_M;
    const handleProj = Math.max(0, p.handleProjectionMm) * MM_TO_M;

    const edgeInset = Math.min(0.10, Math.max(0.04, doorW * 0.18));
    const handleX = hingeSide === "left" ? doorW - edgeInset : -doorW + edgeInset;

    if (p.handleType === "gola") {
      const golaH = clamp(handleSize, 0.006, 0.05);
      const golaD = clamp(handleProj, 0.006, 0.04);
      const golaW = clamp(handleLen > 0 ? handleLen : doorW, 0.06, doorW);
      const geo = new THREE.BoxGeometry(golaW, golaH, golaD);
      const m = new THREE.Mesh(geo, railMat);
      m.name = name;
      const y = doorH / 2 - golaH / 2 - 0.002;
      const z = doorT / 2 - golaD / 2 + 0.002;
      // Keep centered on the door leaf for this simplified gola representation.
      m.position.set(hingeSide === "left" ? doorW / 2 : -doorW / 2, y, z);
      setPartMeta(m, { width: golaW, height: golaH, depth: golaD }, "none");
      setParamKeys(m, ["handleType", "handleLengthMm", "handleSizeMm", "handleProjectionMm", "frontThicknessMm"]);
      doorPivot.add(m);
      return;
    }

    const handleOffsetFromTop = Math.max(0, p.handlePositionMm) * MM_TO_M;
    const y = doorH / 2 - handleOffsetFromTop;

    if (p.handleType === "bar") {
      const hw = clamp(handleLen > 0 ? handleLen : Math.min(doorW * 0.6, 0.35), 0.06, doorW * 0.95);
      const hh = clamp(handleSize > 0 ? handleSize : 0.012, 0.006, 0.05);
      const hd = clamp(handleProj > 0 ? handleProj : 0.012, 0.006, 0.06);
      const geo = new THREE.BoxGeometry(hw, hh, hd);
      const m = new THREE.Mesh(geo, railMat);
      m.name = name;
      m.position.set(handleX, y, doorT / 2 + hd / 2);
      setPartMeta(m, { width: hw, height: hh, depth: hd }, "none");
      setParamKeys(m, ["handleType", "handlePositionMm", "handleLengthMm", "handleSizeMm", "handleProjectionMm", "frontThicknessMm"]);
      doorPivot.add(m);
      return;
    }

    if (p.handleType === "knob") {
      const r = clamp(handleSize > 0 ? handleSize / 2 : 0.01, 0.006, 0.03);
      const d = clamp(handleProj > 0 ? handleProj : 0.02, 0.006, 0.06);
      const geo = new THREE.CylinderGeometry(r, r, d, 20);
      const m = new THREE.Mesh(geo, railMat);
      m.name = name;
      m.rotation.x = Math.PI / 2;
      m.position.set(handleX, y, doorT / 2 + d / 2);
      setPartMeta(m, { width: r * 2, height: r * 2, depth: d }, "none");
      setParamKeys(m, ["handleType", "handlePositionMm", "handleSizeMm", "handleProjectionMm", "frontThicknessMm"]);
      doorPivot.add(m);
      return;
    }

    // cup (simplified as a rounded bar)
    const hw = clamp(handleLen > 0 ? handleLen : Math.min(doorW * 0.45, 0.22), 0.06, doorW * 0.9);
    const r = clamp(handleSize > 0 ? handleSize / 2 : 0.008, 0.006, 0.03);
    const d = clamp(handleProj > 0 ? handleProj : 0.02, 0.006, 0.06);
    const geo = new THREE.CapsuleGeometry(r, Math.max(0.001, hw - 2 * r), 8, 20);
    const m = new THREE.Mesh(geo, railMat);
    m.name = name;
    m.rotation.z = Math.PI / 2;
    m.position.set(handleX, y, doorT / 2 + d / 2);
    setPartMeta(m, { width: hw, height: r * 2, depth: r * 2 }, "none");
    setParamKeys(m, ["handleType", "handlePositionMm", "handleLengthMm", "handleSizeMm", "handleProjectionMm", "frontThicknessMm"]);
    doorPivot.add(m);
  };

  // Fronts: top drawers (one per column)
  for (let i = 0; i < topCount; i++) {
    const x = -frontW / 2 + frontColWTop / 2 + i * (frontColWTop + colGap);
    const geo = new THREE.BoxGeometry(frontColWTop, topDrawerFrontH, frontT);
    const front = new THREE.Mesh(geo, frontMat);
    front.name = `drawerFront_${i + 1}`;
    front.position.set(x, drawerCenterY, frontPlaneZ);
    setPartMeta(front, { width: frontColWTop, height: topDrawerFrontH, depth: frontT }, "height");
    setParamKeys(front, [
      "width",
      "height",
      "depth",
      "topDrawerCount",
      "columnGapMm",
      "rowGapMm",
      "topDrawerFrontHeightMm",
      "sideGap",
      "topGap",
      "bottomGap",
      "frontThicknessMm",
      "handleType",
      "handlePositionMm",
      "handleLengthMm",
      "handleSizeMm",
      "handleProjectionMm"
    ]);
    g.add(front);

    const group = new THREE.Group();
    group.name = `drawerFront_${i + 1}_handleGroup`;
    group.position.set(x - frontColWTop / 2, drawerCenterY, frontPlaneZ);
    addCenteredHandle(group, `drawerHandle_${i + 1}`, frontColWTop, topDrawerFrontH, frontT);
    g.add(group);
  }

  // Fronts: bottom doors (one per column)
  {
    const openAngle = p.doorOpen ? Math.PI / 2 : 0;
    const doorPlaneZ = depth / 2 + frontT / 2;
    const hingeW = 0.008;
    const hingeH = 0.05;
    const hingeD = 0.018;
    const hingeGeo = new THREE.BoxGeometry(hingeW, hingeH, hingeD);
    const hingeInsetX = 0.006;
    const hingeSide = p.hingeSide === "right" ? "right" : "left";
    const hingeCount = clampInt(p.hingeCountPerDoor, 1, 6);
    const hingeTopOffset = Math.max(0, p.hingeTopOffsetMm) * MM_TO_M;
    const hingeBottomOffset = Math.max(0, p.hingeBottomOffsetMm) * MM_TO_M;

    for (let i = 0; i < bottomCount; i++) {
      const xCenter = -frontW / 2 + frontColWBottom / 2 + i * (frontColWBottom + colGap);
      const leftEdgeX = xCenter - frontColWBottom / 2;
      const rightEdgeX = xCenter + frontColWBottom / 2;

      const pivot = new THREE.Group();
      pivot.name = `door_${i + 1}_pivot`;
      pivot.position.set(hingeSide === "left" ? leftEdgeX : rightEdgeX, doorCenterY, doorPlaneZ);
      pivot.rotation.y = hingeSide === "left" ? -openAngle : openAngle;

      const doorGeo = new THREE.BoxGeometry(frontColWBottom, doorH, frontT);
      const door = new THREE.Mesh(doorGeo, frontMat);
      door.name = `door_${i + 1}`;
      door.position.set(hingeSide === "left" ? frontColWBottom / 2 : -frontColWBottom / 2, 0, 0);
      setPartMeta(door, { width: frontColWBottom, height: doorH, depth: frontT }, "height");
      setParamKeys(door, [
        "width",
        "height",
        "depth",
        "bottomDoorCount",
        "columnGapMm",
        "topDrawerFrontHeightMm",
        "rowGapMm",
        "sideGap",
        "topGap",
        "bottomGap",
        "frontThicknessMm",
        "doorOpen",
        "hingeSide",
        "hingeCountPerDoor",
        "hingeTopOffsetMm",
        "hingeBottomOffsetMm",
        "handleType",
        "handlePositionMm",
        "handleLengthMm",
        "handleSizeMm",
        "handleProjectionMm"
      ]);
      pivot.add(door);

      const hingeX = hingeSide === "left" ? hingeW / 2 + hingeInsetX : -hingeW / 2 - hingeInsetX;
      const hingeZ = -frontT / 2 - hingeD / 2 - 0.001;
      const ys = computeHingeYs(doorH, hingeCount, hingeTopOffset, hingeBottomOffset);

      ys.forEach((y, idx) => {
        const hinge = new THREE.Mesh(hingeGeo, hingeMat);
        hinge.name = `door_${i + 1}_hinge_${idx + 1}`;
        hinge.position.set(hingeX, y, hingeZ);
        setPartMeta(hinge, { width: hingeW, height: hingeH, depth: hingeD }, "none");
        setParamKeys(hinge, ["doorOpen", "hingeSide", "hingeCountPerDoor", "hingeTopOffsetMm", "hingeBottomOffsetMm", "frontThicknessMm"]);
        pivot.add(hinge);
      });

      addDoorHandle(pivot, `doorHandle_${i + 1}`, hingeSide, frontColWBottom, doorH, frontT);
      g.add(pivot);
    }
  }

  // Internal shelves behind doors (per column)
  {
    const shelfCount = Math.max(1, Math.round(p.shelfCount));
    const internalShelfCount = Math.max(0, shelfCount - 1);
    if (internalShelfCount > 0) {
      const shelfLayoutHeightMm = Math.max(50, topOfDoorsY / MM_TO_M);
      const layout = {
        height: shelfLayoutHeightMm,
        plinthHeight: p.wallMounted ? 0 : p.plinthHeight,
        boardThickness: p.boardThickness,
        shelfCount: p.shelfCount,
        shelfThickness: p.shelfThickness,
        shelfAutoFit: p.shelfAutoFit,
        shelfGaps: p.shelfGaps
      };
      const heightsMm =
        p.shelfAutoFit === true ? computeShelfHeightsFromGaps({ ...layout, shelfGaps: [] }) : computeShelfHeightsFromGaps(layout);

      const partitionCount = Math.max(0, bottomCount - 1);
      const colClearW = Math.max(0.05, internalW - partitionCount * boardT);
      const colW = colClearW / bottomCount;
      const innerMinY = plinthH + boardT;

      for (let col = 0; col < bottomCount; col++) {
        const xCenter = -internalW / 2 + colW / 2 + col * (colW + boardT);
        for (let i = 0; i < internalShelfCount; i++) {
          const yFromBottomMm = heightsMm[i] ?? 0;
          const y = innerMinY + yFromBottomMm * MM_TO_M;
          const geo = new THREE.BoxGeometry(colW, shelfT, internalD);
          const shelf = new THREE.Mesh(geo, bodyMat);
          shelf.name = `shelf_${col + 1}_${i + 1}`;
          shelf.position.set(xCenter, y, interiorCenterZ);
          setPartMeta(shelf, { width: colW, height: shelfT, depth: internalD }, "width");
          setParamKeys(shelf, ["shelfCount", "shelfThickness", "shelfAutoFit", "shelfGaps", "height", "boardThickness"]);
          g.add(shelf);
        }
      }
    }
  }

  // Top drawers: interior boxes + rails (one per column)
  {
    const partitionCount = Math.max(0, topCount - 1);
    const colClearW = Math.max(0.05, internalW - partitionCount * boardT);
    const colW = colClearW / topCount;
    const drawerClearTopBottom = 0.012;
    const slideAllowanceX = 0.012;

    const railT = 0.012;
    const railH = 0.035;
    const drawerFrontClear = 0.001;
    const carcassFrontZ = depth / 2;

    const outerH = Math.max(0.05, topDrawerFrontH - drawerClearTopBottom);
    const sideH = Math.min(outerH, Math.max(0.03, p.drawerBoxSideHeight * MM_TO_M));
    const outerD = Math.max(0.1, internalD - 0.05);

    const innerW = Math.max(0.02, colW - 2 * (Math.max(0.005, sideClearance) + slideAllowanceX) - 2 * drawerBoxT);
    const outerW = innerW + 2 * drawerBoxT;
    const innerD = Math.max(0.05, outerD - drawerBoxT);

    const innerMinY = topOfDoorsY + 0.002;
    const innerMaxY = height - boardT - 0.002;
    const desiredCenterY = drawerCenterY;
    const minCenterY = innerMinY + outerH / 2;
    const maxCenterY = innerMaxY - outerH / 2;
    const centerY = maxCenterY >= minCenterY ? clamp(desiredCenterY, minCenterY, maxCenterY) : desiredCenterY;

    for (let col = 0; col < topCount; col++) {
      const colCenterX = -internalW / 2 + colW / 2 + col * (colW + boardT);
      const drawerCenter = new THREE.Vector3(colCenterX, centerY, carcassFrontZ - drawerFrontClear - outerD / 2);
      const sideCenterY = drawerCenter.y - outerH / 2 + sideH / 2;

      const leftSideGeo2 = new THREE.BoxGeometry(drawerBoxT, sideH, outerD);
      const leftSide2 = new THREE.Mesh(leftSideGeo2, drawerHardwareMat);
      leftSide2.name = `drawer_${col + 1}_sideL`;
      leftSide2.position.set(drawerCenter.x - outerW / 2 + drawerBoxT / 2, sideCenterY, drawerCenter.z);
      setPartMeta(leftSide2, { width: drawerBoxT, height: sideH, depth: outerD }, "depth");
      setParamKeys(leftSide2, ["drawerBoxThickness", "drawerBoxSideHeight", "sideClearanceMm", "topDrawerCount", "width", "depth"]);
      g.add(leftSide2);

      const rightSideGeo2 = new THREE.BoxGeometry(drawerBoxT, sideH, outerD);
      const rightSide2 = new THREE.Mesh(rightSideGeo2, drawerHardwareMat);
      rightSide2.name = `drawer_${col + 1}_sideR`;
      rightSide2.position.set(drawerCenter.x + outerW / 2 - drawerBoxT / 2, sideCenterY, drawerCenter.z);
      setPartMeta(rightSide2, { width: drawerBoxT, height: sideH, depth: outerD }, "depth");
      setParamKeys(rightSide2, ["drawerBoxThickness", "drawerBoxSideHeight", "sideClearanceMm", "topDrawerCount", "width", "depth"]);
      g.add(rightSide2);

      const bottomGeo2 = new THREE.BoxGeometry(innerW, drawerBoxT, innerD);
      const bottom2 = new THREE.Mesh(bottomGeo2, drawerMat);
      bottom2.name = `drawer_${col + 1}_bottom`;
      bottom2.position.set(drawerCenter.x, drawerCenter.y - outerH / 2 + drawerBoxT / 2, drawerCenter.z + drawerBoxT / 2);
      setPartMeta(bottom2, { width: innerW, height: drawerBoxT, depth: innerD }, "depth");
      setParamKeys(bottom2, ["drawerBoxThickness", "sideClearanceMm", "topDrawerCount", "width", "depth"]);
      g.add(bottom2);

      const backGeo2 = new THREE.BoxGeometry(innerW, sideH, drawerBoxT);
      const back2 = new THREE.Mesh(backGeo2, drawerHardwareMat);
      back2.name = `drawer_${col + 1}_back`;
      back2.position.set(drawerCenter.x, sideCenterY, drawerCenter.z - outerD / 2 + drawerBoxT / 2);
      setPartMeta(back2, { width: innerW, height: sideH, depth: drawerBoxT }, "width");
      setParamKeys(back2, ["drawerBoxThickness", "drawerBoxSideHeight", "sideClearanceMm", "topDrawerCount", "width", "depth"]);
      g.add(back2);

      const railLen = Math.max(0.2, outerD - 0.005);
      const railCenterY = drawerCenter.y - outerH / 2 + railH / 2 + drawerBoxT + 0.002;
      const railCenterZ = carcassFrontZ - drawerFrontClear - railLen / 2;
      const railGeo = new THREE.BoxGeometry(railT, railH, railLen);
      const railInsetX = 0.002;

      const railL = new THREE.Mesh(railGeo, railMat);
      railL.name = `drawer_${col + 1}_railL`;
      railL.position.set(colCenterX - colW / 2 + railT / 2 + railInsetX, railCenterY, railCenterZ);
      setPartMeta(railL, { width: railT, height: railH, depth: railLen }, "none");
      setParamKeys(railL, ["sideClearanceMm", "topDrawerCount", "width", "depth"]);
      g.add(railL);

      const railR = new THREE.Mesh(railGeo, railMat);
      railR.name = `drawer_${col + 1}_railR`;
      railR.position.set(colCenterX + colW / 2 - railT / 2 - railInsetX, railCenterY, railCenterZ);
      setPartMeta(railR, { width: railT, height: railH, depth: railLen }, "none");
      setParamKeys(railR, ["sideClearanceMm", "topDrawerCount", "width", "depth"]);
      g.add(railR);
    }
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
