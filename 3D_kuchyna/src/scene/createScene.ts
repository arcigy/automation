import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { LightProbeGenerator } from "three/examples/jsm/lights/LightProbeGenerator.js";
import { getPbrMaterial } from "../materials/pbrMaterials";

export function createScene(container: HTMLElement) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c10);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.physicallyCorrectLights = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.78;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;
  container.appendChild(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  RectAreaLightUniformsLib.init();

  const camera3d = new THREE.PerspectiveCamera(50, 1, 0.01, 200);
  camera3d.position.set(1.4, 1.0, 1.6);

  // Orthographic top-down for 2D layout
  const camera2d = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 200);
  camera2d.position.set(0, 10, 0);
  camera2d.up.set(0, 0, -1);
  camera2d.lookAt(0, 0, 0);

  let activeCamera: THREE.Camera = camera3d;
  let controls = new OrbitControls(activeCamera, renderer.domElement);
  const configureControls = (mode: "3d" | "2d") => {
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;

    if (mode === "2d") {
      controls.enableRotate = false;
      controls.target.set(0, 0, 0);
    } else {
      controls.enableRotate = true;
      controls.target.set(0, 0.6, 0);
    }

    controls.update();
  };
  configureControls("3d");

  // White room (simple studio box)
  const room = new THREE.Group();
  room.name = "studioRoom";

  const roomW = 6;
  const roomD = 6;
  const roomH = 3;
  const plasterTileM = 0.3;

  const floorMat = getPbrMaterial({
    fallbackColor: "#f7f7f7",
    ref: { id: "wood_floor_ash_4186_1k" },
    uvRepeat: { x: roomW / 2.5, y: roomD / 2.5 },
    normalScale: 0.6
  });
  const wallBackMat = getPbrMaterial({
    fallbackColor: "#ffffff",
    ref: { id: "plaster_painted_7664_1k" },
    uvRepeat: { x: roomW / plasterTileM, y: roomH / plasterTileM },
    normalScale: 0.35
  });
  const wallSideMat = getPbrMaterial({
    fallbackColor: "#ffffff",
    ref: { id: "plaster_painted_7664_1k" },
    uvRepeat: { x: roomD / plasterTileM, y: roomH / plasterTileM },
    normalScale: 0.35
  });
  const ceilingMat = getPbrMaterial({
    fallbackColor: "#ffffff",
    ref: { id: "plaster_painted_7664_1k" },
    uvRepeat: { x: roomW / plasterTileM, y: roomD / plasterTileM },
    normalScale: 0.25
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
  floor.name = "roomFloor";
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.castShadow = false;
  floor.receiveShadow = true;
  room.add(floor);

  const back = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), wallBackMat);
  back.name = "roomBack";
  back.position.set(0, roomH / 2, -roomD / 2);
  back.castShadow = true;
  back.receiveShadow = true;
  room.add(back);

  const front = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), wallBackMat);
  front.name = "roomFront";
  front.rotation.y = Math.PI;
  front.position.set(0, roomH / 2, roomD / 2);
  front.castShadow = true;
  front.receiveShadow = true;
  room.add(front);

  const left = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallSideMat);
  left.name = "roomLeft";
  left.rotation.y = Math.PI / 2;
  left.position.set(-roomW / 2, roomH / 2, 0);
  left.castShadow = true;
  left.receiveShadow = true;
  room.add(left);

  const right = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallSideMat);
  right.name = "roomRight";
  right.rotation.y = -Math.PI / 2;
  right.position.set(roomW / 2, roomH / 2, 0);
  right.castShadow = true;
  right.receiveShadow = true;
  room.add(right);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), ceilingMat);
  ceiling.name = "roomCeiling";
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = roomH;
  ceiling.castShadow = true;
  ceiling.receiveShadow = true;
  room.add(ceiling);

  scene.add(room);

  type WindowCutout = { wall: "back" | "left" | "right"; centerAxisM: number; sillM: number; widthM: number; heightM: number } | null;
  let cutout: WindowCutout = null;

  const buildWallGeometry = (width: number, height: number, hole: { cx: number; cy: number; w: number; h: number } | null) => {
    if (!hole) return new THREE.PlaneGeometry(width, height);

    const shape = new THREE.Shape();
    const hw = width / 2;
    const hh = height / 2;
    shape.moveTo(-hw, -hh);
    shape.lineTo(hw, -hh);
    shape.lineTo(hw, hh);
    shape.lineTo(-hw, hh);
    shape.lineTo(-hw, -hh);

    const holePath = new THREE.Path();
    const hx0 = hole.cx - hole.w / 2;
    const hx1 = hole.cx + hole.w / 2;
    const hy0 = hole.cy - hole.h / 2;
    const hy1 = hole.cy + hole.h / 2;
    // Clockwise for subtraction
    holePath.moveTo(hx0, hy0);
    holePath.lineTo(hx0, hy1);
    holePath.lineTo(hx1, hy1);
    holePath.lineTo(hx1, hy0);
    holePath.lineTo(hx0, hy0);
    shape.holes.push(holePath);

    const g = new THREE.ShapeGeometry(shape);
    g.computeVertexNormals();
    return g;
  };

  const applyCutout = () => {
    // Restore solid walls if no cutout.
    const solidBack = !cutout || cutout.wall !== "back";
    const solidLeft = !cutout || cutout.wall !== "left";
    const solidRight = !cutout || cutout.wall !== "right";

    const makeHole = () => {
      if (!cutout) return null;
      const cy = cutout.sillM + cutout.heightM / 2 - roomH / 2; // local wall coords
      const cx = cutout.centerAxisM;
      return { cx, cy, w: cutout.widthM, h: cutout.heightM };
    };

    const replace = (mesh: THREE.Mesh, width: number, height: number, hole: { cx: number; cy: number; w: number; h: number } | null) => {
      const prev = mesh.geometry;
      mesh.geometry = buildWallGeometry(width, height, hole);
      prev.dispose();
    };

    if (solidBack) replace(back, roomW, roomH, null);
    else replace(back, roomW, roomH, makeHole());

    if (solidLeft) replace(left, roomD, roomH, null);
    else replace(left, roomD, roomH, makeHole());

    if (solidRight) replace(right, roomD, roomH, null);
    else replace(right, roomD, roomH, makeHole());
  };

  // Interior lighting model:
  // - HDRI used only for reflections + tiny fill (never main daylight)
  // - Main daylight comes only through windows (RectAreaLight + soft falloff)
  // - No global studio lights; sealed room stays dark
  let windowOpening: { center: THREE.Vector3; inwardNormal: THREE.Vector3; width: number; height: number } | null = null;
  let daylightIntensity = 9; // tweak via UI in app

  // Gentle sky directional bias from above (north daylight feel); no shadows.
  const skyBias = new THREE.DirectionalLight(0xdbe6ff, 0);
  skyBias.name = "skyBias";
  skyBias.position.set(0.8, 3.5, -0.6);
  scene.add(skyBias);

  const lightProbe = new THREE.LightProbe();
  lightProbe.name = "hdriLightProbe";
  lightProbe.intensity = 0;
  scene.add(lightProbe);

  const windowRect = new THREE.RectAreaLight(0xdbe6ff, 0, 1, 1);
  windowRect.name = "windowRect";
  scene.add(windowRect);

  // Soft falloff into the room (RectAreaLight has no distance decay in three.js).
  // Keep very wide + low so it doesn't create hotspot patches.
  const windowFill = new THREE.SpotLight(0xdbe6ff, 0, 18, Math.PI / 2.15, 1, 2);
  windowFill.name = "windowFill";
  windowFill.penumbra = 1;
  windowFill.castShadow = false;
  scene.add(windowFill);
  scene.add(windowFill.target);

  // Shadows from window direction (RectAreaLight can't cast shadows).
  // Keep intensity very low so it doesn't create visible "spots".
  const windowShadow = new THREE.SpotLight(0xdbe6ff, 0, 18, Math.PI / 3.2, 1, 2);
  windowShadow.name = "windowShadow";
  windowShadow.penumbra = 1;
  windowShadow.castShadow = true;
  windowShadow.shadow.mapSize.set(2048, 2048);
  windowShadow.shadow.bias = -0.00008;
  windowShadow.shadow.normalBias = 0.015;
  windowShadow.shadow.radius = 6;
  windowShadow.shadow.focus = 0.92;
  (windowShadow.shadow.camera as THREE.PerspectiveCamera).near = 0.2;
  (windowShadow.shadow.camera as THREE.PerspectiveCamera).far = 22;
  scene.add(windowShadow);
  scene.add(windowShadow.target);

  type ShadowAlgorithm = "pcfsoft" | "vsm";
  let shadowAlgorithm: ShadowAlgorithm = "pcfsoft";

  const applyShadowAlgorithm = (algo: ShadowAlgorithm) => {
    shadowAlgorithm = algo;
    renderer.shadowMap.type = algo === "vsm" ? THREE.VSMShadowMap : THREE.PCFSoftShadowMap;

    // Bias tuning differs per algorithm.
    if (algo === "vsm") {
      windowShadow.shadow.bias = 0;
      windowShadow.shadow.normalBias = 0.01;
      windowShadow.shadow.radius = 0;
    } else {
      windowShadow.shadow.bias = -0.00008;
      windowShadow.shadow.normalBias = 0.015;
      windowShadow.shadow.radius = 6;
    }
  };
  applyShadowAlgorithm("pcfsoft");

  // Very subtle fake bounce (RectAreaLights). Keep them localized so they create a gradient,
  // not uniform "studio" lighting.
  const bounceCeilingNear = new THREE.RectAreaLight(0xffffff, 0, roomW * 0.9, roomD * 0.55);
  bounceCeilingNear.name = "bounceCeilingNear";
  bounceCeilingNear.position.set(0, roomH - 0.03, 0);
  bounceCeilingNear.lookAt(0, roomH - 1, 0);
  scene.add(bounceCeilingNear);

  const bounceCeilingFar = new THREE.RectAreaLight(0xffffff, 0, roomW * 0.75, roomD * 0.65);
  bounceCeilingFar.name = "bounceCeilingFar";
  bounceCeilingFar.position.set(0, roomH - 0.03, 0);
  bounceCeilingFar.lookAt(0, roomH - 1, 0);
  scene.add(bounceCeilingFar);

  const bounceFloorNear = new THREE.RectAreaLight(0xffffff, 0, roomW * 0.9, roomD * 0.55);
  bounceFloorNear.name = "bounceFloorNear";
  bounceFloorNear.position.set(0, 0.03, 0);
  bounceFloorNear.lookAt(0, 1, 0);
  scene.add(bounceFloorNear);

  const bounceOppositeWall = new THREE.RectAreaLight(0xffffff, 0, roomW * 0.9, roomH * 0.9);
  bounceOppositeWall.name = "bounceOppositeWall";
  scene.add(bounceOppositeWall);

  const exrLoader = new EXRLoader();
  exrLoader.setDataType(THREE.FloatType);

  let hdriEnv: THREE.Texture | null = null;
  let hdriBg: THREE.Texture | null = null;
  let hdriSrc: THREE.Texture | null = null;
  let hdriProbeRt: THREE.WebGLCubeRenderTarget | null = null;
  let hdriId: string | null = null;
  let hdriUseBackground = false;
  let hdriEnvIntensity = 0.15;
  let hdriBgIntensity = 1;
  let lastEnvIntensityApplied = -1;

  const setHdri = async (args: { id: string | null; background: boolean; envIntensity?: number; backgroundIntensity?: number }) => {
    hdriUseBackground = args.background;
    if (typeof args.envIntensity === "number") hdriEnvIntensity = Math.max(0, args.envIntensity);
    if (typeof args.backgroundIntensity === "number") hdriBgIntensity = Math.max(0, args.backgroundIntensity);
    if (!args.id) {
      hdriId = null;
      if (hdriEnv) {
        hdriEnv.dispose();
        hdriEnv = null;
      }
      if (hdriBg) {
        hdriBg.dispose();
        hdriBg = null;
      }
      if (hdriSrc) {
        hdriSrc.dispose();
        hdriSrc = null;
      }
      if (hdriProbeRt) {
        hdriProbeRt.dispose();
        hdriProbeRt = null;
      }
      scene.environment = null;
      scene.background = new THREE.Color(0x0a0c10);
      lightProbe.intensity = 0;
      lastEnvIntensityApplied = -1;
      updateLighting();
      return;
    }

    if (args.id === hdriId && hdriSrc) {
      scene.environment = hdriEnv;
      scene.background = hdriUseBackground ? hdriBg : new THREE.Color(0x0a0c10);
      updateLighting();
      return;
    }

    hdriId = args.id;
    if (hdriEnv) {
      hdriEnv.dispose();
      hdriEnv = null;
    }
    if (hdriBg) {
      hdriBg.dispose();
      hdriBg = null;
    }
    if (hdriSrc) {
      hdriSrc.dispose();
      hdriSrc = null;
    }
    if (hdriProbeRt) {
      hdriProbeRt.dispose();
      hdriProbeRt = null;
    }

    const src = await exrLoader.loadAsync(args.id);
    src.mapping = THREE.EquirectangularReflectionMapping;
    hdriSrc = src;

    const rt = pmrem.fromEquirectangular(src);
    hdriEnv = rt.texture;
    hdriBg = src;

    scene.environment = hdriEnv;
    scene.background = hdriUseBackground ? hdriBg : new THREE.Color(0x0a0c10);

    // LightProbe for extremely weak diffuse environment (gated in updateLighting).
    hdriProbeRt = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
    hdriProbeRt.fromEquirectangularTexture(renderer, src);
    const probe = LightProbeGenerator.fromCubeRenderTarget(renderer, hdriProbeRt);
    lightProbe.sh.copy(probe.sh);

    updateLighting();
  };

  const setSceneEnvIntensity = (intensity: number) => {
    const next = Math.max(0, intensity);
    if (Math.abs(next - lastEnvIntensityApplied) < 1e-4) return;
    lastEnvIntensityApplied = next;
    // three.js supports these at runtime; TS defs may lag.
    (scene as any).environmentIntensity = next;
    (scene as any).backgroundIntensity = hdriBgIntensity;
  };

  let lightingRevision = 0;
  const updateLighting = () => {
    lightingRevision++;
    const envStrength = hdriEnv ? Math.max(0, Math.min(0.3, hdriEnvIntensity)) : 0;

    if (!windowOpening) {
      // Sealed room: dark, but not pure black.
      skyBias.intensity = 0;
      lightProbe.intensity = envStrength * 0.03;
      windowRect.intensity = 0;
      windowFill.intensity = 0;
      windowShadow.intensity = 0;
      bounceCeilingNear.intensity = 0.00012;
      bounceCeilingFar.intensity = 0.00006;
      bounceFloorNear.intensity = 0.00007;
      bounceOppositeWall.intensity = 0.00018;
      setSceneEnvIntensity(envStrength * 0.05); // reflections only
      return;
    }

    const n = windowOpening.inwardNormal.clone().normalize();
    const center = windowOpening.center.clone();
    const emit = center.clone().addScaledVector(n, 0.07);
    const inside = center.clone().addScaledVector(n, 3.0);

    // Window area drives bounce strength.
    const w = Math.max(0.2, windowOpening.width);
    const h = Math.max(0.2, windowOpening.height);
    const windowArea = Math.max(0.02, w * h);
    const portal = Math.min(1, windowArea / 2.2);

    // HDRI is mostly reflections. Diffuse fill is via LightProbe (very weak, gated by portal).
    setSceneEnvIntensity(envStrength * (0.06 + 0.06 * portal));
    lightProbe.intensity = envStrength * 0.10 * portal;

    // Main soft daylight at the opening.
    windowRect.position.copy(emit);
    windowRect.width = w;
    windowRect.height = h;
    windowRect.lookAt(inside);
    // Keep intensity stable across window sizes.
    const base = Math.max(0, Math.min(25, daylightIntensity));
    windowRect.intensity = 28 * base;

    // Gradient / falloff into room (very wide, penumbra=1, decay=2).
    windowFill.position.copy(emit);
    windowFill.target.position.copy(inside);
    windowFill.distance = 18;
    windowFill.decay = 2;
    windowFill.angle = Math.min(1.1, Math.max(0.55, Math.atan2(Math.max(w, h) * 1.2, 2.6)));
    windowFill.intensity = windowRect.intensity * 0.075;

    // Shadow-only light: low intensity, wide + soft.
    windowShadow.position.copy(emit);
    windowShadow.target.position.copy(inside);
    windowShadow.distance = 18;
    windowShadow.decay = 2;
    windowShadow.angle = Math.min(1.05, Math.max(0.45, Math.atan2(Math.max(w, h) * 1.25, 3.1)));
    windowShadow.intensity = windowRect.intensity * 0.026;

    // Gentle sky bias from above, no hard shadows.
    skyBias.intensity = windowRect.intensity * 0.0032;

    // Bounce: large soft sources to avoid hotspot patches.
    const nearBoost = 0.55 + 0.45 * portal;
    bounceCeilingNear.intensity = windowRect.intensity * 0.006 * portal * nearBoost;
    bounceFloorNear.intensity = windowRect.intensity * 0.0035 * portal * nearBoost;
    bounceCeilingFar.intensity = windowRect.intensity * 0.0026 * portal;
    bounceOppositeWall.intensity = windowRect.intensity * 0.0039 * portal;

    // Shift "near" bounces toward the window side so the room keeps a natural gradient.
    const shift = n.clone().multiplyScalar(1.35);
    bounceCeilingNear.position.set(shift.x, roomH - 0.03, shift.z);
    bounceFloorNear.position.set(shift.x, 0.03, shift.z);
    bounceCeilingFar.position.set(shift.x * 0.35, roomH - 0.03, shift.z * 0.35);

    // Place opposite-wall bounce on the far wall relative to the window normal.
    if (Math.abs(n.z) >= Math.abs(n.x)) {
      const z = n.z > 0 ? roomD / 2 - 0.02 : -roomD / 2 + 0.02;
      bounceOppositeWall.width = roomW;
      bounceOppositeWall.height = roomH;
      bounceOppositeWall.position.set(0, roomH / 2, z);
      bounceOppositeWall.lookAt(0, roomH / 2, 0);
    } else {
      const x = n.x > 0 ? roomW / 2 - 0.02 : -roomW / 2 + 0.02;
      bounceOppositeWall.width = roomD;
      bounceOppositeWall.height = roomH;
      bounceOppositeWall.position.set(x, roomH / 2, 0);
      bounceOppositeWall.lookAt(0, roomH / 2, 0);
    }
  };

  const setDaylightIntensity = (v: number) => {
    daylightIntensity = Math.max(0, Math.min(25, v));
    updateLighting();
  };

  const setShadowAlgorithmPublic = (algo: ShadowAlgorithm) => {
    applyShadowAlgorithm(algo);
    updateLighting();
  };

  const setWindowOpening = (opening: { center: THREE.Vector3; inwardNormal: THREE.Vector3; width: number; height: number } | null) => {
    windowOpening = opening;
    if (!opening) {
      cutout = null;
      applyCutout();
    }
    updateLighting();
  };

  const setWindowCutout = (next: WindowCutout) => {
    cutout = next;
    applyCutout();
  };

  const setSize = (width: number, height: number) => {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    renderer.setSize(w, h, false);

    camera3d.aspect = w / h;
    camera3d.updateProjectionMatrix();

    // Keep a stable 2D "meter-per-screen" scale via zoom.
    // 1 unit = 1m, target ~8m visible on the shortest axis.
    const worldHeightM = 8;
    const worldWidthM = worldHeightM * (w / h);
    camera2d.left = -worldWidthM / 2;
    camera2d.right = worldWidthM / 2;
    camera2d.top = worldHeightM / 2;
    camera2d.bottom = -worldHeightM / 2;
    camera2d.updateProjectionMatrix();
  };

  // Initial size
  setSize(container.clientWidth, container.clientHeight);

  const setViewMode = (mode: "3d" | "2d") => {
    controls.dispose();

    activeCamera = mode === "2d" ? camera2d : camera3d;
    controls = new OrbitControls(activeCamera, renderer.domElement);
    configureControls(mode);
  };

  return {
    scene,
    renderer,
    setSize,
    setViewMode,
    setHdri,
    getHdriSettings: () => ({
      id: hdriId,
      envIntensity: hdriEnvIntensity,
      background: hdriUseBackground,
      backgroundIntensity: hdriBgIntensity
    }),
    setDaylightIntensity,
    getDaylightIntensity: () => daylightIntensity,
    setShadowAlgorithm: setShadowAlgorithmPublic,
    getShadowAlgorithm: () => shadowAlgorithm,
    setWindowOpening,
    getWindowOpening: () =>
      windowOpening
        ? {
            center: windowOpening.center.clone(),
            inwardNormal: windowOpening.inwardNormal.clone(),
            width: windowOpening.width,
            height: windowOpening.height
          }
        : null,
    setWindowCutout,
    updateLighting,
    getLightingRevision: () => lightingRevision,
    getCamera: () => activeCamera,
    getControls: () => controls
  };
}

