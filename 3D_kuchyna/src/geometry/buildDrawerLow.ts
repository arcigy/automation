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
  const plinthSetback = p.plinthSetbackMm * MM_TO_M;
  const frontGap = p.frontGap * MM_TO_M;
  const sideGap = p.sideGap * MM_TO_M;
  const bottomGap = p.bottomGap * MM_TO_M;
  const sideClearance = p.sideClearanceMm * MM_TO_M;
  const drawerBoxT = p.drawerBoxThickness * MM_TO_M;

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

  const setParamKeys = (obj: THREE.Object3D, keys: Array<keyof DrawerLowParams | string>) => {
    (obj as any).userData ??= {};
    (obj as any).userData.paramKeys = [...keys];
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
  setParamKeys(leftSide, ["width", "height", "depth", "boardThickness", "plinthHeight"]);
  g.add(leftSide);

  const rightSide = new THREE.Mesh(sideGeo, bodyMat);
  rightSide.position.set(width / 2 - boardT / 2, plinthH + sideH / 2, 0);
  rightSide.name = "rightSide";
  setPartMeta(rightSide, { width: boardT, height: sideH, depth }, "height");
  setParamKeys(rightSide, ["width", "height", "depth", "boardThickness", "plinthHeight"]);
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
  setParamKeys(bottom, ["width", "depth", "boardThickness", "plinthHeight"]);
  g.add(bottom);

  // Top stretchers (kitchen-style): front + back rails instead of a full top panel.
  // This saves material but still keeps the carcass rigid.
  const railD = Math.min(depth * 0.25, Math.max(0.06, boardT * 3)); // ~60-140mm
  const railGeo = new THREE.BoxGeometry(internalW, boardT, railD);

  const topRailFront = new THREE.Mesh(railGeo, bodyMat);
  topRailFront.position.set(0, height - boardT / 2, depth / 2 - railD / 2);
  topRailFront.name = "topRailFront";
  setPartMeta(topRailFront, { width: internalW, height: boardT, depth: railD }, "width");
  setParamKeys(topRailFront, ["width", "depth", "height", "boardThickness"]);
  g.add(topRailFront);

  const topRailBack = new THREE.Mesh(railGeo, bodyMat);
  topRailBack.position.set(0, height - boardT / 2, -depth / 2 + railD / 2);
  topRailBack.name = "topRailBack";
  setPartMeta(topRailBack, { width: internalW, height: boardT, depth: railD }, "width");
  setParamKeys(topRailBack, ["width", "depth", "height", "boardThickness"]);
  g.add(topRailBack);

  // Back panel (full width), mounted outside so it doesn't overlap the interior volume.
  const backGeo = new THREE.BoxGeometry(width, sideH, backT);
  const back = new THREE.Mesh(backGeo, bodyMat);
  back.position.set(0, plinthH + sideH / 2, -depth / 2 - backT / 2);
  back.name = "back";
  setPartMeta(back, { width, height: sideH, depth: backT }, "width");
  setParamKeys(back, ["width", "height", "depth", "backThickness", "plinthHeight"]);
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

    // Ensure front legs are always behind the kickboard.
    // Compare using the leg front surface (center + radius), not just its center.
    const legMaxFrontCenterZ = kickBackFaceZ - legRadius - 0.01; // keep 10mm behind the kickboard
    const zF = Math.min(depth / 2 - insetZ, legMaxFrontCenterZ);
    const zB = -depth / 2 + insetZ;

    const addLeg = (name: string, x: number, z: number) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.name = name;
      leg.position.set(x, legH / 2, z);
      setPartMetaMm(leg, { width: legRadius * 2 * 1000, height: legH / MM_TO_M, depth: legRadius * 2 * 1000 }, "none");
      setParamKeys(leg, ["plinthHeight", "plinthSetbackMm", "depth", "width"]);
      g.add(leg);
    };

    addLeg("leg_FL", xL, zF);
    addLeg("leg_FR", xR, zF);
    addLeg("leg_BL", xL, zB);
    addLeg("leg_BR", xR, zB);

    // Kickboard clips (realistic): a snap-on collar on the leg + an arm screwed into the kickboard.
    const clipMat = new THREE.MeshStandardMaterial({ color: 0x606772, roughness: 0.7, metalness: 0.05 }); // plastic-ish
    const screwMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.45, metalness: 0.35 });

    const collarOuterR = legRadius + 0.004;
    const collarH = 0.016;
    const collarGap = Math.PI * 0.35; // opening
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

    // In real kitchens, plinth clips tend to sit relatively low (reachable from below).
    const clipY = Math.max(
      collarH / 2,
      Math.min(legH - collarH / 2 - 0.004, Math.max(0.04, legH * 0.35))
    );

    const addKickClip = (namePrefix: string, x: number) => {
      const group = new THREE.Group();
      group.name = `${namePrefix}_group`;
      group.position.set(x, clipY, zF);

      // Collar (snaps onto leg). Opening faces backwards (-Z).
      const collar = new THREE.Mesh(collarGeo, clipMat);
      collar.name = `${namePrefix}_collar`;
      collar.rotation.y = Math.PI;
      setPartMeta(collar, { width: collarOuterR * 2, height: collarH, depth: collarOuterR * 2 }, "none");
      setParamKeys(collar, ["plinthHeight", "plinthSetbackMm", "depth", "width", "boardThickness"]);
      group.add(collar);

      // Pad sits just behind the inner face of the kickboard.
      const padCenterZWorld = kickBackFaceZ - 0.001 - padD / 2;
      const padRelZ = padCenterZWorld - zF;

      const pad = new THREE.Mesh(padGeo, clipMat);
      pad.name = `${namePrefix}_pad`;
      pad.position.set(0, 0, padRelZ);
      setPartMeta(pad, { width: padW, height: padH, depth: padD }, "none");
      setParamKeys(pad, ["plinthHeight", "plinthSetbackMm", "depth", "boardThickness"]);
      group.add(pad);

      // Arm connects collar to pad (thin strap).
      const armStartZ = legRadius + 0.003;
      const armEndZ = padRelZ - padD / 2;
      const armLen = Math.max(0.005, armEndZ - armStartZ);
      const armGeo = new THREE.BoxGeometry(armW, armH, armLen);
      const arm = new THREE.Mesh(armGeo, clipMat);
      arm.name = `${namePrefix}_arm`;
      arm.position.set(0, -padH / 2 + armH / 2, armStartZ + armLen / 2);
      setPartMeta(arm, { width: armW, height: armH, depth: armLen }, "none");
      setParamKeys(arm, ["plinthHeight", "plinthSetbackMm", "depth"]);
      group.add(arm);

      // Screws on the pad (into kickboard).
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
        setParamKeys(s, ["plinthHeight", "plinthSetbackMm", "depth", "boardThickness"]);
        group.add(s);
      };
      addScrew(`${namePrefix}_screw_1`, -screwOffsetY);
      addScrew(`${namePrefix}_screw_2`, screwOffsetY);

      g.add(group);
    };

    addKickClip("kickClip_FL", xL);
    addKickClip("kickClip_FR", xR);
  }

  // Plinth / kickboard (simple front plate)
  const kickGeo = new THREE.BoxGeometry(width, plinthH, kickDepth);
  const kick = new THREE.Mesh(kickGeo, bodyMat);
  kick.position.set(0, plinthH / 2, kickCenterZ);
  kick.name = "kick";
  setPartMeta(kick, { width, height: plinthH, depth: kickDepth }, "width");
  setParamKeys(kick, ["width", "plinthHeight", "plinthSetbackMm", "depth", "boardThickness"]);
  g.add(kick);

  // Drawer fronts (overlay across side panels)
  const frontThickness = p.frontThicknessMm * MM_TO_M;
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
    setParamKeys(front, [
      "width",
      "height",
      "depth",
      "frontThicknessMm",
      "sideGap",
      "topGap",
      "bottomGap",
      "frontGap",
      "drawerCount",
      "drawerFrontHeights",
      "frontStackPreset",
      "topFrontHeightMm",
      "handleType",
      "handlePositionMm",
      "handleLengthMm",
      "handleSizeMm",
      "handleProjectionMm"
    ]);
    g.add(front);

    // Handle preview (for collisions / realism)
    if (p.handleType !== "none") {
      const screwMat2 = new THREE.MeshStandardMaterial({ color: 0x8a93a3, roughness: 0.35, metalness: 0.75 });

      const handleLen = Math.max(0, p.handleLengthMm) * MM_TO_M;
      const handleSize = Math.max(0, p.handleSizeMm) * MM_TO_M;
      const handleProj = Math.max(0, p.handleProjectionMm) * MM_TO_M;

      const addScrews2 = (prefix: string, count: 1 | 2, spreadW: number, y: number, handleDepth: number) => {
        const headR = 0.004;
        const headLen = 0.0025;
        const shaftR = 0.0016;
        const shaftLen = Math.max(0.01, frontThickness + handleDepth + 0.004);
        const headGeo = new THREE.CylinderGeometry(headR, headR, headLen, 16);
        const shaftGeo = new THREE.CylinderGeometry(shaftR, shaftR, shaftLen, 12);

        const insideFaceZ = frontPlaneZ - frontThickness / 2;
        const headZ = insideFaceZ - headLen / 2 - 0.0005;
        const shaftZ = insideFaceZ + shaftLen / 2 - 0.0005;

        const xs = count === 2 ? [-spreadW / 2, spreadW / 2] : [0];

        for (let si = 0; si < xs.length; si++) {
          const x = xs[si] ?? 0;
          const base = `${prefix}_screw_${si + 1}`;

          const head = new THREE.Mesh(headGeo, screwMat2);
          head.name = `${base}_head`;
          head.rotation.x = Math.PI / 2;
          head.position.set(x, y, headZ);
          setPartMeta(head, { width: headR * 2, height: headR * 2, depth: headLen }, "none");
          setParamKeys(head, [
            "handleType",
            "handlePositionMm",
            "frontThicknessMm",
            "handleLengthMm",
            "handleSizeMm",
            "handleProjectionMm"
          ]);
          g.add(head);

          const shaft = new THREE.Mesh(shaftGeo, screwMat2);
          shaft.name = `${base}_shaft`;
          shaft.rotation.x = Math.PI / 2;
          shaft.position.set(x, y, shaftZ);
          setPartMeta(shaft, { width: shaftR * 2, height: shaftR * 2, depth: shaftLen }, "none");
          setParamKeys(shaft, [
            "handleType",
            "handlePositionMm",
            "frontThicknessMm",
            "handleLengthMm",
            "handleSizeMm",
            "handleProjectionMm"
          ]);
          g.add(shaft);
        }
      };

      if (p.handleType === "gola") {
        // Gola profile: an integrated rail near the top edge of the front.
        const golaH = clamp(handleSize, 0.006, 0.05);
        const golaD = clamp(handleProj, 0.006, 0.04);
        const golaW = clamp(handleLen > 0 ? handleLen : frontW, 0.06, frontW);
        const geo = new THREE.BoxGeometry(golaW, golaH, golaD);
        const m = new THREE.Mesh(geo, railMat);
        m.name = `gola_${i + 1}`;

        const y = front.position.y + h / 2 - golaH / 2 - 0.002;
        const z = frontPlaneZ - frontThickness / 2 - golaD / 2 + 0.002;
        m.position.set(0, y, z);

        setPartMeta(m, { width: golaW, height: golaH, depth: golaD }, "none");
        setParamKeys(m, ["handleType", "handleLengthMm", "handleSizeMm", "handleProjectionMm", "frontThicknessMm"]);
        g.add(m);
      } else {
        const handleOffsetFromTop = Math.max(0, p.handlePositionMm) * MM_TO_M;
        const handleY = front.position.y + h / 2 - handleOffsetFromTop;

        if (p.handleType === "bar") {
          const hw = clamp(handleLen > 0 ? handleLen : Math.min(frontW * 0.6, 0.35), 0.06, frontW * 0.95);
          const hh = clamp(handleSize > 0 ? handleSize : 0.012, 0.006, 0.05);
          const hd = clamp(handleProj > 0 ? handleProj : 0.012, 0.006, 0.06);
          const geo = new THREE.BoxGeometry(hw, hh, hd);
          const m = new THREE.Mesh(geo, railMat);
          m.name = `handle_${i + 1}`;
          m.position.set(0, handleY, frontPlaneZ + frontThickness / 2 + hd / 2);
          setPartMeta(m, { width: hw, height: hh, depth: hd }, "none");
          setParamKeys(m, [
            "handleType",
            "handlePositionMm",
            "handleLengthMm",
            "handleSizeMm",
            "handleProjectionMm",
            "frontThicknessMm"
          ]);
          g.add(m);

          const screwSpread = Math.min(hw * 0.75, Math.max(0.06, hw - 0.08));
          addScrews2(`handle_${i + 1}`, 2, screwSpread, handleY, hd);
        } else if (p.handleType === "knob") {
          const r = clamp((handleSize > 0 ? handleSize : 0.024) / 2, 0.006, 0.03);
          const d = clamp(handleProj > 0 ? handleProj : 0.018, 0.008, 0.06);
          const geo = new THREE.CylinderGeometry(r, r, d, 18);
          const m = new THREE.Mesh(geo, railMat);
          m.name = `handle_${i + 1}`;
          m.rotation.x = Math.PI / 2;
          m.position.set(0, handleY, frontPlaneZ + frontThickness / 2 + d / 2);
          setPartMeta(m, { width: r * 2, height: r * 2, depth: d }, "none");
          setParamKeys(m, ["handleType", "handlePositionMm", "handleSizeMm", "handleProjectionMm", "frontThicknessMm"]);
          g.add(m);

          addScrews2(`handle_${i + 1}`, 1, 0, handleY, d);
        } else if (p.handleType === "cup") {
          // Cup pull: approximated by a half-cylinder shell.
          const hw = clamp(handleLen > 0 ? handleLen : Math.min(frontW * 0.45, 0.22), 0.06, frontW * 0.9);
          const hd = clamp(handleProj > 0 ? handleProj : 0.02, 0.01, 0.05);
          const r = Math.max(0.006, hd / 2);
          const geo = new THREE.CylinderGeometry(r, r, hw, 24, 1, true, 0, Math.PI);
          const m = new THREE.Mesh(geo, railMat);
          m.name = `handle_${i + 1}`;
          m.rotation.z = Math.PI / 2; // axis along X
          m.rotation.y = Math.PI; // face outward
          const scaleY = handleSize > 0 ? clamp(handleSize / (2 * r), 0.35, 2.5) : 1.0;
          m.scale.set(1, scaleY, 1);
          m.position.set(0, handleY, frontPlaneZ + frontThickness / 2 + r);
          setPartMeta(m, { width: hw, height: 2 * r * scaleY, depth: 2 * r }, "none");
          setParamKeys(m, [
            "handleType",
            "handlePositionMm",
            "handleLengthMm",
            "handleSizeMm",
            "handleProjectionMm",
            "frontThicknessMm"
          ]);
          g.add(m);

          const screwSpread = Math.min(hw * 0.7, Math.max(0.06, hw - 0.08));
          addScrews2(`handle_${i + 1}`, 2, screwSpread, handleY, hd);
        }
      }
    }

    // Drawer box (panels)
    // Rails (carcass-mounted) define the required side clearance.
    const railT = 0.012;
    const railH = 0.045;
    const slideAllowanceX = railT + 0.003; // slide thickness + a bit of running clearance

    const drawerClearSide = Math.max(0.005, sideClearance);
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

    // Left side (hardware)
    const leftSideGeo2 = new THREE.BoxGeometry(drawerBoxT, sideH, drawerOuterD);
    const leftSide2 = new THREE.Mesh(leftSideGeo2, drawerHardwareMat);
    leftSide2.name = `drawer_${i + 1}_sideL`;
    leftSide2.position.set(drawerCenter.x - drawerOuterW / 2 + drawerBoxT / 2, sideCenterY, drawerCenter.z);
    setPartMeta(leftSide2, { width: drawerBoxT, height: sideH, depth: drawerOuterD }, "depth");
    setParamKeys(leftSide2, ["drawerBoxThickness", "drawerBoxSideHeight", "sideClearanceMm", "width", "depth", "drawerCount"]);
    g.add(leftSide2);

    // Right side (hardware)
    const rightSideGeo2 = new THREE.BoxGeometry(drawerBoxT, sideH, drawerOuterD);
    const rightSide2 = new THREE.Mesh(rightSideGeo2, drawerHardwareMat);
    rightSide2.name = `drawer_${i + 1}_sideR`;
    rightSide2.position.set(drawerCenter.x + drawerOuterW / 2 - drawerBoxT / 2, sideCenterY, drawerCenter.z);
    setPartMeta(rightSide2, { width: drawerBoxT, height: sideH, depth: drawerOuterD }, "depth");
    setParamKeys(rightSide2, ["drawerBoxThickness", "drawerBoxSideHeight", "sideClearanceMm", "width", "depth", "drawerCount"]);
    g.add(rightSide2);

    // Bottom (board)
    const bottomGeo2 = new THREE.BoxGeometry(innerW, drawerBoxT, innerD);
    const bottom2 = new THREE.Mesh(bottomGeo2, drawerMat);
    bottom2.name = `drawer_${i + 1}_bottom`;
    bottom2.position.set(drawerCenter.x, drawerCenter.y - drawerOuterH / 2 + drawerBoxT / 2, drawerCenter.z + drawerBoxT / 2);
    setPartMeta(bottom2, { width: innerW, height: drawerBoxT, depth: innerD }, "depth");
    setParamKeys(bottom2, ["drawerBoxThickness", "sideClearanceMm", "width", "depth", "drawerCount"]);
    g.add(bottom2);

    // Back (hardware)
    const backGeo2 = new THREE.BoxGeometry(innerW, sideH, drawerBoxT);
    const back2 = new THREE.Mesh(backGeo2, drawerHardwareMat);
    back2.name = `drawer_${i + 1}_back`;
    back2.position.set(drawerCenter.x, sideCenterY, drawerCenter.z - drawerOuterD / 2 + drawerBoxT / 2);
    setPartMeta(back2, { width: innerW, height: sideH, depth: drawerBoxT }, "width");
    setParamKeys(back2, ["drawerBoxThickness", "drawerBoxSideHeight", "sideClearanceMm", "width", "depth", "drawerCount"]);
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
    setParamKeys(railL, ["sideClearanceMm", "width", "depth", "drawerCount"]);
    g.add(railL);

    const railR = new THREE.Mesh(railGeo, railMat);
    railR.name = `drawer_${i + 1}_railR`;
    railR.position.set(internalW / 2 - railT / 2 - railInsetX, railCenterY, railCenterZ);
    setPartMeta(railR, { width: railT, height: railH, depth: railLen }, "none");
    setParamKeys(railR, ["sideClearanceMm", "width", "depth", "drawerCount"]);
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

