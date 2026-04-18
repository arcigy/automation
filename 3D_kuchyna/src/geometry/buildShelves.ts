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
  const plinthH = (p.wallMounted ? 0 : p.plinthHeight) * MM_TO_M;
  const plinthSetback = Math.max(0, p.plinthSetbackMm) * MM_TO_M;
  const frontThickness = Math.max(0, p.frontThicknessMm) * MM_TO_M;
  const frontGap = Math.max(0, p.frontGap) * MM_TO_M;
  const sideGap = Math.max(0, p.sideGap) * MM_TO_M;
  const topGap = Math.max(0, p.topGap) * MM_TO_M;
  const bottomGap = Math.max(0, p.bottomGap) * MM_TO_M;
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

  const setParamKeys = (obj: THREE.Object3D, keys: Array<keyof ShelvesParams | string>) => {
    (obj as any).userData ??= {};
    (obj as any).userData.paramKeys = [...keys];
  };

  // Handle preview (for collisions / realism). Attached to the door pivot group so it rotates with the door.
  const addDoorHandle = (doorGroup: THREE.Group, hingeSide: "left" | "right", doorW: number, doorH: number, doorT: number) => {
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
      m.name = `gola_${hingeSide}`;
      const y = doorH / 2 - golaH / 2 - 0.002;
      const z = doorT / 2 - golaD / 2 + 0.002;
      // Place centered on the door leaf (not at the opening edge for simplicity).
      m.position.set(hingeSide === "left" ? doorW / 2 : -doorW / 2, y, z);
      setPartMeta(m, { width: golaW, height: golaH, depth: golaD }, "none");
      setParamKeys(m, ["handleType", "handleLengthMm", "handleSizeMm", "handleProjectionMm", "frontThicknessMm"]);
      doorGroup.add(m);
      return;
    }

    const handleOffsetFromTop = Math.max(0, p.handlePositionMm) * MM_TO_M;
    const handleY = doorH / 2 - handleOffsetFromTop;

    if (p.handleType === "bar") {
      const hw = clamp(handleLen > 0 ? handleLen : Math.min(doorW * 0.6, 0.35), 0.06, doorW * 0.95);
      const hh = clamp(handleSize > 0 ? handleSize : 0.012, 0.006, 0.05);
      const hd = clamp(handleProj > 0 ? handleProj : 0.012, 0.006, 0.06);
      const geo = new THREE.BoxGeometry(hw, hh, hd);
      const m = new THREE.Mesh(geo, railMat);
      m.name = `handle_${hingeSide}`;
      m.position.set(handleX, handleY, doorT / 2 + hd / 2);
      setPartMeta(m, { width: hw, height: hh, depth: hd }, "none");
      setParamKeys(m, ["handleType", "handlePositionMm", "handleLengthMm", "handleSizeMm", "handleProjectionMm", "frontThicknessMm"]);
      doorGroup.add(m);
      return;
    }

    if (p.handleType === "knob") {
      const r = clamp((handleSize > 0 ? handleSize : 0.024) / 2, 0.006, 0.03);
      const d = clamp(handleProj > 0 ? handleProj : 0.018, 0.008, 0.06);
      const geo = new THREE.CylinderGeometry(r, r, d, 18);
      const m = new THREE.Mesh(geo, railMat);
      m.name = `handle_${hingeSide}`;
      m.rotation.x = Math.PI / 2;
      m.position.set(handleX, handleY, doorT / 2 + d / 2);
      setPartMeta(m, { width: r * 2, height: r * 2, depth: d }, "none");
      setParamKeys(m, ["handleType", "handlePositionMm", "handleSizeMm", "handleProjectionMm", "frontThicknessMm"]);
      doorGroup.add(m);
      return;
    }

    if (p.handleType === "cup") {
      const hw = clamp(handleLen > 0 ? handleLen : Math.min(doorW * 0.45, 0.22), 0.06, doorW * 0.9);
      const hd = clamp(handleProj > 0 ? handleProj : 0.02, 0.01, 0.05);
      const r = Math.max(0.006, hd / 2);
      const geo = new THREE.CylinderGeometry(r, r, hw, 24, 1, true, 0, Math.PI);
      const m = new THREE.Mesh(geo, railMat);
      m.name = `handle_${hingeSide}`;
      m.rotation.z = Math.PI / 2; // axis along X
      m.rotation.y = Math.PI; // face outward
      const scaleY = handleSize > 0 ? clamp(handleSize / (2 * r), 0.35, 2.5) : 1.0;
      m.scale.set(1, scaleY, 1);
      m.position.set(handleX, handleY, doorT / 2 + r);
      setPartMeta(m, { width: hw, height: 2 * r * scaleY, depth: 2 * r }, "none");
      setParamKeys(m, ["handleType", "handlePositionMm", "handleLengthMm", "handleSizeMm", "handleProjectionMm", "frontThicknessMm"]);
      doorGroup.add(m);
    }
  };

  const openingH = height - plinthH;
  const sideH = openingH;

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
  setParamKeys(bottom, ["width", "depth", "boardThickness", "plinthHeight", "wallMounted"]);
  g.add(bottom);

  // Top stretchers (kitchen-style): front + back rails instead of a full top panel.
  // This saves material but still keeps the carcass rigid.
  const railD = Math.min(depth * 0.25, Math.max(0.06, boardT * 3)); // ~60-140mm
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

    // Ensure front legs are always behind the kickboard.
    const legMaxFrontCenterZ = kickBackFaceZ - legRadius - 0.01; // keep 10mm behind the kickboard
    const zF = Math.min(depth / 2 - insetZ, legMaxFrontCenterZ);
    const zB = -depth / 2 + insetZ;

    const addLeg = (name: string, x: number, z: number) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.name = name;
      leg.position.set(x, legH / 2, z);
      setPartMetaMm(leg, { width: legRadius * 2 * 1000, height: legH / MM_TO_M, depth: legRadius * 2 * 1000 }, "none");
      setParamKeys(leg, ["plinthHeight", "plinthSetbackMm", "depth", "width", "wallMounted"]);
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
    const clipY = Math.max(collarH / 2, Math.min(legH - collarH / 2 - 0.004, Math.max(0.04, legH * 0.35)));

    const addKickClip = (namePrefix: string, x: number) => {
      const group = new THREE.Group();
      group.name = `${namePrefix}_group`;
      group.position.set(x, clipY, zF);

      // Collar (snaps onto leg). Opening faces backwards (-Z).
      const collar = new THREE.Mesh(collarGeo, clipMat);
      collar.name = `${namePrefix}_collar`;
      collar.rotation.y = Math.PI;
      setPartMeta(collar, { width: collarOuterR * 2, height: collarH, depth: collarOuterR * 2 }, "none");
      setParamKeys(collar, ["plinthHeight", "plinthSetbackMm", "depth", "width", "boardThickness", "wallMounted"]);
      group.add(collar);

      // Pad sits just behind the inner face of the kickboard.
      const padCenterZWorld = kickBackFaceZ - 0.001 - padD / 2;
      const padRelZ = padCenterZWorld - zF;

      const pad = new THREE.Mesh(padGeo, clipMat);
      pad.name = `${namePrefix}_pad`;
      pad.position.set(0, 0, padRelZ);
      setPartMeta(pad, { width: padW, height: padH, depth: padD }, "none");
      setParamKeys(pad, ["plinthHeight", "plinthSetbackMm", "depth", "boardThickness", "wallMounted"]);
      group.add(pad);

      // Arm connects collar to pad (thin strap).
      const armStartZ = legRadius + 0.003;
      const armEndZ = padRelZ - padD / 2;
      const armLen = Math.max(0.005, armEndZ - armStartZ);
      const armGeo = new THREE.BoxGeometry(armW, armH, armLen);
      const arm = new THREE.Mesh(armGeo, clipMat);
      arm.name = `${namePrefix}_arm`;
      arm.position.set(0, 0, armStartZ + armLen / 2);
      setPartMeta(arm, { width: armW, height: armH, depth: armLen }, "none");
      setParamKeys(arm, ["plinthHeight", "plinthSetbackMm", "depth", "boardThickness", "wallMounted"]);
      group.add(arm);

      // Screws (approx)
      const screwLen = Math.max(0.008, padD + 0.016);
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

  // Front doors (simple overlay) + hidden hinges
  {
    const reveal = Math.max(0, sideGap);
    const centerGap = Math.max(0, frontGap);
    const doorT = Math.max(0.005, frontThickness > 0 ? frontThickness : boardT);
    const doorPlaneZ = depth / 2 + doorT / 2;

    const openingH2 = height - plinthH;
    const doorH = Math.max(0.1, openingH2 - topGap - bottomGap);
    const doorCenterY = plinthH + bottomGap + doorH / 2;

    const openAngle = p.doorOpen ? Math.PI / 2 : 0;
    const hingeCount = clampInt(p.hingeCountPerDoor, 1, 6);
    const hingeTopOffset = Math.max(0, p.hingeTopOffsetMm) * MM_TO_M;
    const hingeBottomOffset = Math.max(0, p.hingeBottomOffsetMm) * MM_TO_M;
    const singleHingeSide = p.hingeSide === "right" ? "right" : "left";

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
        setParamKeys(door, [
          "width",
          "height",
          "depth",
          "plinthHeight",
          "wallMounted",
          "frontThicknessMm",
          "frontGap",
          "sideGap",
          "topGap",
          "bottomGap",
          "doorDouble",
          "doorOpen",
          "handleType",
          "handlePositionMm",
          "handleLengthMm",
          "handleSizeMm",
          "handleProjectionMm"
        ]);
        group.add(door);

        // Hidden hinges (boxes) slightly inset + fully on the inside of the door so they're not visible from outside.
        const hingeW = 0.008;
        const hingeH = 0.05;
        const hingeD = 0.018;
        const hingeGeo = new THREE.BoxGeometry(hingeW, hingeH, hingeD);
        const hingeInsetX = 0.006;
        const hingeX = hingeSide === "left" ? hingeW / 2 + hingeInsetX : -hingeW / 2 - hingeInsetX;
        const hingeZ = -doorT / 2 - hingeD / 2 - 0.001; // fully behind door (inside)

        const ys = computeHingeYs(doorH, hingeCount, hingeTopOffset, hingeBottomOffset);

        ys.forEach((y, idx) => {
          const hinge = new THREE.Mesh(hingeGeo, hingeMat);
          hinge.name = `${hingePrefix}_${idx + 1}`;
          hinge.position.set(hingeX, y, hingeZ);
          setPartMeta(hinge, { width: hingeW, height: hingeH, depth: hingeD }, "none");
          setParamKeys(hinge, [
            "doorDouble",
            "doorOpen",
            "hingeCountPerDoor",
            "hingeTopOffsetMm",
            "hingeBottomOffsetMm",
            "frontThicknessMm"
          ]);
          group.add(hinge);
        });

        // Handle preview (rotates with the door)
        addDoorHandle(group, hingeSide, doorW, doorH, doorT);

        g.add(group);
      }
    } else {
      const doorW = Math.max(0.05, width - 2 * reveal);

      const pivotX = singleHingeSide === "left" ? -width / 2 + reveal : width / 2 - reveal;
      const group = new THREE.Group();
      group.name = "door_pivot";
      group.position.set(pivotX, doorCenterY, doorPlaneZ);
      group.rotation.y = singleHingeSide === "left" ? -openAngle : openAngle;

      const doorGeo = new THREE.BoxGeometry(doorW, doorH, doorT);
      const door = new THREE.Mesh(doorGeo, frontMat);
      door.name = "door";
      door.position.set(singleHingeSide === "left" ? doorW / 2 : -doorW / 2, 0, 0);
      setPartMeta(door, { width: doorW, height: doorH, depth: doorT }, "height");
      setParamKeys(door, [
        "width",
        "height",
        "depth",
        "plinthHeight",
        "wallMounted",
        "frontThicknessMm",
        "sideGap",
        "topGap",
        "bottomGap",
        "doorDouble",
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
        setPartMeta(hinge, { width: hingeW, height: hingeH, depth: hingeD }, "none");
        setParamKeys(hinge, [
          "doorDouble",
          "doorOpen",
          "hingeSide",
          "hingeCountPerDoor",
          "hingeTopOffsetMm",
          "hingeBottomOffsetMm",
          "frontThicknessMm"
        ]);
        group.add(hinge);
      });

      addDoorHandle(group, singleHingeSide, doorW, doorH, doorT);
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
    setParamKeys(shelf, ["shelfCount", "shelfThickness", "shelfAutoFit", "shelfGaps", "height", "plinthHeight", "boardThickness"]);
    g.add(shelf);
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

  // If offsets overlap (or door is tiny), fall back to a safe margin.
  const safeMargin = Math.min(0.12, Math.max(0.03, doorH / 2 - 0.025 - 0.02));
  const a = yTop > yBottom ? yTop : doorH / 2 - safeMargin;
  const b = yTop > yBottom ? yBottom : -doorH / 2 + safeMargin;

  return Array.from({ length: c }, (_, idx) => {
    const t = c === 1 ? 0.5 : idx / (c - 1);
    return b + t * (a - b);
  });
}

