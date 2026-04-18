import * as THREE from "three";
import polygonClipping from "polygon-clipping";
import type { ModuleParams } from "./model/cabinetTypes";
import {
  makeDefaultCornerShelfLowerParams,
  makeDefaultDrawerLowParams,
  makeDefaultNestedDrawerLowParams,
  makeDefaultFlapShelvesLowParams,
  makeDefaultFridgeTallParams,
  makeDefaultMicrowaveOvenTallParams,
  makeDefaultOvenBaseLowParams,
  makeDefaultShelvesParams,
  makeDefaultSwingShelvesLowParams,
  makeDefaultTopDrawersDoorsLowParams,
  validateModule
} from "./model/cabinetTypes";
import { buildModule } from "./geometry/buildModule";
import { createScene } from "./scene/createScene";
import { createPartPanel, type GrainAlong, type OverlapRow } from "./ui/createPartPanel";
import { createLayoutPanel } from "./ui/createLayoutPanel";
import { disposeObject3D } from "./scene/disposeObject3D";
import { createDrawerLowControls } from "./ui/createDrawerLowControls";
import { createFridgeTallControls } from "./ui/createFridgeTallControls";
import { createShelvesControls } from "./ui/createShelvesControls";
import { createCornerShelfLowerControls } from "./ui/createCornerShelfLowerControls";
import { createNestedDrawerLowControls } from "./ui/createNestedDrawerLowControls";
import { createFlapShelvesLowControls } from "./ui/createFlapShelvesLowControls";
import { createSwingShelvesLowControls } from "./ui/createSwingShelvesLowControls";
import { createOvenBaseLowControls } from "./ui/createOvenBaseLowControls";
import { createMicrowaveOvenTallControls } from "./ui/createMicrowaveOvenTallControls";
import { createTopDrawersDoorsLowControls } from "./ui/createTopDrawersDoorsLowControls";
import { createSsgiPipeline, type SsgiPipeline } from "./rendering/ssgiPipeline";
import { createPhotoPathTracer, type PhotoPathTracer } from "./rendering/photoPathTracer";
import { exportSceneToJson } from "./scene/exportSceneJson";
import { createTopbar } from "./ui/createTopbar";
import { loadUnderlayToCanvas } from "./ui/loadUnderlay";
import { solveWallNetwork } from "./walls2d/solver";

type AppArgs = {
  viewerEl: HTMLElement;
  ribbonEl: HTMLElement;
  propertiesEl: HTMLElement;
  formEl: HTMLElement;
  errorsEl: HTMLElement;
  partsEl: HTMLElement;
  exportOutEl: HTMLTextAreaElement;
  copyBtn: HTMLButtonElement;
  copyStatusEl: HTMLElement;
  measureBtn: HTMLButtonElement;
  clearMeasuresBtn: HTMLButtonElement;
  axisLockEl: HTMLInputElement;
  measureReadoutEl: HTMLElement;
  resetBtn: HTMLButtonElement;
  exportBtn: HTMLButtonElement;
  exportSceneBtn: HTMLButtonElement;
};

export function startApp(args: AppArgs) {
  let params: ModuleParams = makeDefaultDrawerLowParams();
  const ENABLE_SSGI = import.meta.env.VITE_ENABLE_SSGI === "true";
  const ENABLE_PHOTO = import.meta.env.VITE_ENABLE_PHOTO === "true";

  const {
    scene,
    renderer,
    setSize,
    setViewMode,
    getCamera,
    getControls,
    setHdri,
    getHdriSettings,
    setDaylightIntensity,
    getDaylightIntensity,
    setShadowAlgorithm,
    getShadowAlgorithm,
    setWindowOpening,
    getWindowOpening,
    setWindowCutout,
    updateLighting,
    getLightingRevision
  } = createScene(args.viewerEl);
  const cam = () => getCamera();
  const ctl = () => getControls();

  setDaylightIntensity(9);

  type AppMode = "build" | "layout";
  let mode: AppMode = "build";
  let viewMode: "3d" | "2d" = "3d";

  type LayoutTool = "select" | "wall" | "align" | "trim" | "dimension";
  let layoutTool: LayoutTool = "select";

  type RenderMode = "realtime" | "realtime_ssgi" | "photo_pathtrace";
  let renderMode: RenderMode = "realtime";
  let ssgi: SsgiPipeline | null = null;
  let ssgiCameraUuid: string | null = null;
  let photo: PhotoPathTracer | null = null;
  let photoCameraUuid: string | null = null;
  let photoLastLightingRevision = -1;
  let lastCameraWorld = new Float32Array(16);
  let lastCameraProj = new Float32Array(16);

  const copyM16 = (out: Float32Array, m: THREE.Matrix4) => {
    const e = m.elements;
    for (let i = 0; i < 16; i++) out[i] = e[i];
  };

  const matrixChanged = (a: Float32Array, m: THREE.Matrix4) => {
    const e = m.elements;
    for (let i = 0; i < 16; i++) {
      if (Math.abs(a[i] - e[i]) > 1e-7) return true;
    }
    return false;
  };

  let cabinetGroup: THREE.Group | null = null;
  const hiddenParts = new Set<string>();

  const layoutRoot = new THREE.Group();
  layoutRoot.name = "layoutRoot";
  layoutRoot.visible = false;
  scene.add(layoutRoot);

  const wallPlanGroup = new THREE.Group();
  wallPlanGroup.name = "wallPlanGroup";
  wallPlanGroup.visible = false;
  layoutRoot.add(wallPlanGroup);

  const wallPlanMat = new THREE.MeshBasicMaterial({ color: 0xc6cbd6 });
  const wallPlanMeshes = new Map<string, THREE.Mesh>();
  const wallJoinMeshes: THREE.Mesh[] = [];
  let wallPlanUnionMesh: THREE.Mesh | null = null;
  const wallDebugGroup = new THREE.Group();
  wallDebugGroup.name = "wallDebugGroup";
  wallDebugGroup.visible = false;
  wallPlanGroup.add(wallDebugGroup);
  let wallDebugEnabled = false;
  const wallSolvedOutlines = new Map<string, Array<{ x: number; z: number }>>();

  const wallSnapMarkers = new THREE.Group();
  wallSnapMarkers.name = "wallSnapMarkers";
  wallSnapMarkers.visible = false;
  layoutRoot.add(wallSnapMarkers);

  // Tool HUD overlays (Align/Trim) in 2D
  const toolHud = new THREE.Group();
  toolHud.name = "toolHud";
  layoutRoot.add(toolHud);

  const hudMatHover = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.25, depthTest: false, depthWrite: false });
  const hudMatPick1 = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.75, depthTest: false, depthWrite: false });
  const hudMatPick2 = new THREE.MeshBasicMaterial({ color: 0xff4dff, transparent: true, opacity: 0.75, depthTest: false, depthWrite: false });

  const makeHudLineMesh = (mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.01, 0.01), mat);
    m.visible = false;
    m.position.y = 0.05;
    m.renderOrder = 80;
    toolHud.add(m);
    return m;
  };

  const hudHoverLine = makeHudLineMesh(hudMatHover);
  const hudPickLine1 = makeHudLineMesh(hudMatPick1);
  const hudPickLine2 = makeHudLineMesh(hudMatPick2);

  const clearToolHud = () => {
    hudHoverLine.visible = false;
    hudPickLine1.visible = false;
    hudPickLine2.visible = false;
    dimPreview.root.visible = false;
  };

  const hudLineThicknessM = (rect: DOMRect) => {
    const c = cam();
    if (!(c instanceof THREE.OrthographicCamera)) return 0.01;
    const visibleW = Math.abs(c.right - c.left) / Math.max(1e-6, c.zoom);
    const worldPerPx = visibleW / Math.max(1, rect.width);
    return Math.min(0.06, Math.max(0.004, worldPerPx * 4));
  };

  const updateHudLine = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, thicknessM: number) => {
    const d = b.clone().sub(a);
    const len = d.length();
    if (len < 1e-6) {
      mesh.visible = false;
      return;
    }

    const ang = Math.atan2(d.z, d.x);
    const mid = a.clone().addScaledVector(d, 0.5);
    const g = new THREE.BoxGeometry(len, 0.01, thicknessM);
    mesh.geometry.dispose();
    mesh.geometry = g;
    mesh.position.set(mid.x, 0.05, mid.z);
    mesh.rotation.set(0, ang, 0);
    mesh.visible = true;
  };

  const snapMatCorner = new THREE.MeshBasicMaterial({ color: 0xff4dff, depthWrite: false, transparent: true, opacity: 0.95 });
  const snapMatAxis = new THREE.MeshBasicMaterial({ color: 0x00e5ff, depthWrite: false, transparent: true, opacity: 0.95 });
  const snapMatEdge = new THREE.MeshBasicMaterial({ color: 0xffd166, depthWrite: false, transparent: true, opacity: 0.95 });
  const snapMatEnd = new THREE.MeshBasicMaterial({ color: 0x3ddc97, depthWrite: false, transparent: true, opacity: 0.95 });
  const snapGeom = new THREE.CircleGeometry(0.035, 16);
  const makeSnapDot = (kind: "corner" | "edge" | "axis" | "endpoint") => {
    const mat = kind === "corner" ? snapMatCorner : kind === "edge" ? snapMatEdge : kind === "axis" ? snapMatAxis : snapMatEnd;
    const m = new THREE.Mesh(snapGeom, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.02;
    m.renderOrder = 50;
    m.userData.kind = "snapDot";
    m.userData.snapKind = kind;
    return m;
  };

  const clearWallSnapMarkers = () => {
    for (const ch of [...wallSnapMarkers.children]) wallSnapMarkers.remove(ch);
  };

  const showWallSnapMarkersFor = (wallId: string | null) => {
    clearWallSnapMarkers();
    if (!wallId) {
      wallSnapMarkers.visible = false;
      return;
    }
    const w = walls.find((x) => x.id === wallId) ?? null;
    if (!w) {
      wallSnapMarkers.visible = false;
      return;
    }

    const a = new THREE.Vector3(w.params.aMm.x / 1000, 0, w.params.aMm.z / 1000);
    const b = new THREE.Vector3(w.params.bMm.x / 1000, 0, w.params.bMm.z / 1000);
    const d = b.clone().sub(a);
    const len = d.length();
    if (len < 1e-6) {
      wallSnapMarkers.visible = false;
      return;
    }
    d.multiplyScalar(1 / len);

    const dotA = makeSnapDot("endpoint");
    dotA.position.x = a.x;
    dotA.position.z = a.z;
    wallSnapMarkers.add(dotA);
    const dotB = makeSnapDot("endpoint");
    dotB.position.x = b.x;
    dotB.position.z = b.z;
    wallSnapMarkers.add(dotB);

    const mid = a.clone().addScaledVector(d, len * 0.5);
    const dotM = makeSnapDot("axis");
    dotM.position.x = mid.x;
    dotM.position.z = mid.z;
    wallSnapMarkers.add(dotM);

    const poly = wallSolvedOutlines.get(wallId) ?? null;
    if (poly && poly.length >= 3) {
      for (const p of poly) {
        const dot = makeSnapDot("corner");
        dot.position.x = p.x;
        dot.position.z = p.z;
        wallSnapMarkers.add(dot);
      }
    } else {
      const n = new THREE.Vector3(-d.z, 0, d.x);
      const h = Math.max(1, w.params.thicknessMm / 2) / 1000;
      const c1 = a.clone().addScaledVector(n, h);
      const c2 = a.clone().addScaledVector(n, -h);
      const c3 = b.clone().addScaledVector(n, -h);
      const c4 = b.clone().addScaledVector(n, h);
      for (const p of [c1, c2, c3, c4]) {
        const dot = makeSnapDot("corner");
        dot.position.x = p.x;
        dot.position.z = p.z;
        wallSnapMarkers.add(dot);
      }
    }

    wallSnapMarkers.visible = viewMode === "2d";
  };

  const selectionHighlights = new THREE.Group();
  selectionHighlights.name = "selectionHighlights";
  selectionHighlights.visible = false;
  layoutRoot.add(selectionHighlights);

  const updateSelectionHighlights = () => {
    for (const ch of [...selectionHighlights.children]) {
      selectionHighlights.remove(ch);
      const m = ch as any;
      m.geometry?.dispose?.();
      if (Array.isArray(m.material)) for (const mm of m.material) mm?.dispose?.();
      else m.material?.dispose?.();
    }

    if (mode !== "layout" || viewMode !== "2d") {
      selectionHighlights.visible = false;
      return;
    }

    // Walls: draw outline of each selected wall (trimmed) when available.
    for (const id of selectedWallIds) {
      const poly = wallSolvedOutlines.get(id) ?? null;
      if (!poly || poly.length < 3) continue;
      const pts = poly.map((p) => new THREE.Vector3(p.x, 0.012, p.z));
      pts.push(new THREE.Vector3(poly[0].x, 0.012, poly[0].z));
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0x3ddc97, transparent: true, opacity: 0.98, depthWrite: false }));
      line.renderOrder = 60;
      selectionHighlights.add(line);
    }

    // Modules: box helper per selected instance
    for (const id of selectedInstanceIds) {
      const inst = instances.find((x) => x.id === id) ?? null;
      if (!inst) continue;
      const box = new THREE.Box3().setFromObject(inst.root);
      const min = box.min, max = box.max;
      const y = 0.012;
      const pts = [
        new THREE.Vector3(min.x, y, min.z),
        new THREE.Vector3(max.x, y, min.z),
        new THREE.Vector3(max.x, y, max.z),
        new THREE.Vector3(min.x, y, max.z),
        new THREE.Vector3(min.x, y, min.z)
      ];
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0x5c8cff, transparent: true, opacity: 0.98, depthWrite: false }));
      line.renderOrder = 60;
      selectionHighlights.add(line);
    }

    selectionHighlights.visible = selectionHighlights.children.length > 0;
  };

  const underlayMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const underlayMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), underlayMat);
  underlayMesh.name = "underlay";
  underlayMesh.rotation.x = -Math.PI / 2;
  underlayMesh.position.y = 0.006;
  underlayMesh.visible = false;
  underlayMesh.renderOrder = 1;
  layoutRoot.add(underlayMesh);

  const underlayState = {
    sourceName: null as string | null,
    sourceKind: null as "png" | "jpg" | "pdf" | null,
    baseWidthM: 1,
    baseHeightM: 1,
    scale: 1,
    rotationDeg: 0,
    opacity: 0.65,
    offsetMm: { x: 0, z: 0 },
    pinned: false
  };

  const underlayCal = {
    active: false,
    first: null as THREE.Vector3 | null,
    knownMm: 1000,
    mode: "calibrate" as "calibrate" | "reference"
  };

  const roomBounds = {
    halfW: 3, // meters (must match createScene.ts room w=6)
    halfD: 3, // meters (must match createScene.ts room d=6)
    h: 3 // meters (must match createScene.ts room h=3)
  };

  function updateUnderlayTransform() {
    underlayMesh.scale.set(underlayState.scale, underlayState.scale, 1);
    underlayMesh.rotation.y = (underlayState.rotationDeg * Math.PI) / 180;
    underlayMat.opacity = underlayState.opacity;
    underlayMesh.position.x = underlayState.offsetMm.x / 1000;
    underlayMesh.position.z = underlayState.offsetMm.z / 1000;
  }

  function setUnderlayBaseSize(wM: number, hM: number) {
    underlayState.baseWidthM = Math.max(0.001, wM);
    underlayState.baseHeightM = Math.max(0.001, hM);
    underlayMesh.geometry.dispose();
    underlayMesh.geometry = new THREE.PlaneGeometry(underlayState.baseWidthM, underlayState.baseHeightM);
  }

  function setUnderlayFromCanvas(
    canvas: HTMLCanvasElement,
    name: string,
    kind: "png" | "jpg" | "pdf",
    physicalSizeMm?: { w: number; h: number } | null
  ) {
    const prev = underlayMat.map;
    if (prev) prev.dispose();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.max(1, renderer.capabilities.getMaxAnisotropy());
    tex.needsUpdate = true;
    underlayMat.map = tex;
    underlayMat.needsUpdate = true;

    if (physicalSizeMm && Number.isFinite(physicalSizeMm.w) && Number.isFinite(physicalSizeMm.h) && physicalSizeMm.w > 0 && physicalSizeMm.h > 0) {
      setUnderlayBaseSize(physicalSizeMm.w / 1000, physicalSizeMm.h / 1000);
    } else {
      const roomW = roomBounds.halfW * 2;
      const roomD = roomBounds.halfD * 2;
      const aspect = canvas.height / Math.max(1, canvas.width);

      let w = roomW;
      let h = w * aspect;
      if (h > roomD) {
        h = roomD;
        w = h / aspect;
      }

      setUnderlayBaseSize(w, h);
    }

    underlayState.sourceName = name;
    underlayState.sourceKind = kind;
    underlayState.scale = 1;
    underlayState.rotationDeg = 0;
    underlayState.opacity = 0.65;
    underlayState.offsetMm = { x: 0, z: 0 };
    underlayState.pinned = false;
    underlayMesh.visible = true;
    updateUnderlayTransform();
  }

  function clearUnderlay() {
    underlayState.sourceName = null;
    underlayState.sourceKind = null;
    underlayState.scale = 1;
    underlayState.rotationDeg = 0;
    underlayState.opacity = 0.65;
    underlayState.offsetMm = { x: 0, z: 0 };
    underlayState.pinned = false;
    underlayMesh.visible = false;
    if (underlayMat.map) {
      underlayMat.map.dispose();
      underlayMat.map = null;
    }
    underlayMat.needsUpdate = true;
    updateUnderlayTransform();
  }

  type LayoutInstance = {
    id: string;
    params: ModuleParams;
    root: THREE.Group;
    module: THREE.Group;
    localBox: THREE.Box3;
    pick: THREE.Mesh;
    outline: THREE.Line;
  };
  const instances: LayoutInstance[] = [];
  let instanceCounter = 1;
  let selectedInstanceId: string | null = null;
  let selectedWallId: string | null = null;
  const selectedInstanceIds = new Set<string>();
  const selectedWallIds = new Set<string>();
  const pinnedInstanceIds = new Set<string>();
  const pinnedWallIds = new Set<string>();
  let selectedInstanceBox: THREE.BoxHelper | null = null;
  let selectedWallBox: THREE.BoxHelper | null = null;
  let selectedUnderlayBox: THREE.BoxHelper | null = null;

  type WallId = "back" | "left" | "right";
  type WindowParams = {
    wall: WallId;
    widthMm: number;
    heightMm: number;
    sillHeightMm: number;
    centerMm: number; // along wall axis (x for back, z for sides)
  };

  type WindowInstance = {
    params: WindowParams;
    root: THREE.Group;
    pick: THREE.Mesh;
    outline: THREE.Line;
  };

  let windowInst: WindowInstance | null = null;
  type SelectedKind = "module" | "window" | "wall" | "underlay" | "dimension" | null;
  let selectedKind: SelectedKind = null;
  let selectedDimensionId: string | null = null;

  type WallParams = {
    thicknessMm: number;
    materialId: string;
    justification?: "center" | "interior" | "exterior";
    // +1 => exterior is left of A->B, -1 => exterior is right of A->B (Revit-like).
    exteriorSign?: 1 | -1;
    aMm: { x: number; z: number };
    bMm: { x: number; z: number };
  };

  type WallInstance = {
    id: string;
    params: WallParams;
    root: THREE.Group;
    mesh: THREE.Mesh;
  };

  const walls: WallInstance[] = [];
  let wallCounter = 1;
  const wallJoinTolMm = 25;
  const wallDefault = {
    thicknessMm: 150,
    heightM: 3,
    materialId: "default",
    justification: "center" as "center" | "interior" | "exterior",
    exteriorSign: 1 as 1 | -1
  };

  type DimensionRef = {
    wallId: string;
    wallLine: AlignWallLine;
    t: number; // 0..1 along picked segment
  };

  type DimensionParams = {
    id: string;
    a: DimensionRef;
    b: DimensionRef;
    offsetM: number; // signed along normal from line A to dimension line
  };

  type DimensionInstance = {
    id: string;
    params: DimensionParams;
    root: THREE.Group;
    pick: THREE.Mesh;
    ext1: THREE.Mesh;
    ext2: THREE.Mesh;
    dim: THREE.Mesh;
    tick1: THREE.Mesh;
    tick2: THREE.Mesh;
    text: THREE.Sprite;
  };

  const dimensions: DimensionInstance[] = [];
  let dimensionCounter = 1;

  const dimMat = new THREE.MeshBasicMaterial({ color: 0x0b0f18, transparent: true, opacity: 1, depthTest: false, depthWrite: false });
  const dimMatSelected = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 1, depthTest: false, depthWrite: false });
  const dimPickMat = new THREE.MeshBasicMaterial({ visible: false });

  const makeDimTextSprite = (text: string) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not available");
    const pad = 2;
    const fontPx = 28;
    ctx.font = `${fontPx}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    const metrics = ctx.measureText(text);
    const w = Math.ceil(metrics.width + pad * 2);
    const h = Math.ceil(fontPx + pad * 2);
    canvas.width = w;
    canvas.height = h;

    // redraw
    const ctx2 = canvas.getContext("2d")!;
    ctx2.font = `${fontPx}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx2.textBaseline = "middle";
    ctx2.textAlign = "center";
    ctx2.fillStyle = "rgba(0,0,0,0.92)";
    ctx2.fillText(text, w / 2, h / 2 + 1);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const spr = new THREE.Sprite(mat);
    spr.renderOrder = 90;
    spr.position.y = 0.055;
    (spr.userData as any).wPx = w;
    (spr.userData as any).hPx = h;
    return spr;
  };

  const updateSpriteText = (spr: THREE.Sprite, text: string) => {
    if ((spr.userData as any).text === text) return;
    (spr.userData as any).text = text;
    const mat = spr.material as THREE.SpriteMaterial;
    const old = mat.map as THREE.Texture | null;
    const next = makeDimTextSprite(text);
    const nextMat = next.material as THREE.SpriteMaterial;
    mat.map = nextMat.map;
    mat.needsUpdate = true;
    nextMat.dispose();
    (spr.userData as any).wPx = (next.userData as any).wPx;
    (spr.userData as any).hPx = (next.userData as any).hPx;
    if (old) old.dispose();
  };

  const makeDimBarMesh = (mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.01, 0.01), mat);
    m.renderOrder = 75;
    m.position.y = 0.05;
    return m;
  };

  const updateDimBar = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, thicknessM: number) => {
    const d = b.clone().sub(a);
    const len = d.length();
    if (len < 1e-6) {
      mesh.visible = false;
      return;
    }
    const ang = Math.atan2(d.z, d.x);
    const mid = a.clone().addScaledVector(d, 0.5);
    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(len, 0.01, thicknessM);
    mesh.position.set(mid.x, 0.05, mid.z);
    mesh.rotation.set(0, ang, 0);
    mesh.visible = true;
  };

  const orthoWorldPerPx = (rect: DOMRect) => {
    const c = cam();
    if (!(c instanceof THREE.OrthographicCamera)) return null as number | null;
    const visibleHeight = Math.abs(c.top - c.bottom) / Math.max(1e-6, c.zoom);
    const worldPerPixel = visibleHeight / Math.max(1, rect.height);
    return worldPerPixel;
  };

  const setSpriteScreenFixedScale = (spr: THREE.Sprite, rect: DOMRect) => {
    const wpp = orthoWorldPerPx(rect);
    if (!wpp) return;
    const wPx = Number((spr.userData as any).wPx ?? 60);
    const hPx = Number((spr.userData as any).hPx ?? 28);
    spr.scale.set(wpp * wPx, wpp * hPx, 1);
  };

  const updateDimensionTextScale = (rect: DOMRect) => {
    for (const d of dimensions) setSpriteScreenFixedScale(d.text, rect);
    if (dimPreview.root.visible) setSpriteScreenFixedScale(dimPreview.text, rect);
  };

  const wallLineSegment = (wallId: string, wallLine: AlignWallLine) => {
    const w = walls.find((x) => x.id === wallId) ?? null;
    if (!w) return null as null | { a: THREE.Vector3; b: THREE.Vector3; dir: THREE.Vector3 };
    const refA = new THREE.Vector3(w.params.aMm.x / 1000, 0, w.params.aMm.z / 1000);
    const refB = new THREE.Vector3(w.params.bMm.x / 1000, 0, w.params.bMm.z / 1000);
    const just = w.params.justification ?? "center";
    const s = (w.params.exteriorSign ?? 1) as 1 | -1;
    const center = wallRefLineToCenterLine(refA, refB, w.params.thicknessMm, just, s);
    const d = center.b.clone().sub(center.a);
    if (d.lengthSq() < 1e-10) return null;
    d.normalize();
    const n = new THREE.Vector3(-d.z, 0, d.x);
    const half = Math.max(10, w.params.thicknessMm) / 2000;
    const exteriorA = center.a.clone().addScaledVector(n, s * half);
    const exteriorB = center.b.clone().addScaledVector(n, s * half);
    const interiorA = center.a.clone().addScaledVector(n, -s * half);
    const interiorB = center.b.clone().addScaledVector(n, -s * half);

    if (wallLine === "center") return { a: center.a, b: center.b, dir: d.clone() };
    if (wallLine === "exterior") return { a: exteriorA, b: exteriorB, dir: d.clone() };
    if (wallLine === "interior") return { a: interiorA, b: interiorB, dir: d.clone() };

    const endLen = Math.max(0.5, w.params.thicknessMm / 1000 + 0.25);
    if (wallLine === "endA") return { a: center.a.clone().addScaledVector(n, -endLen / 2), b: center.a.clone().addScaledVector(n, endLen / 2), dir: n.clone().normalize() };
    if (wallLine === "endB") return { a: center.b.clone().addScaledVector(n, -endLen / 2), b: center.b.clone().addScaledVector(n, endLen / 2), dir: n.clone().normalize() };
    return null;
  };

  const dimValueMm = (p: DimensionParams) => {
    const la = wallLineSegment(p.a.wallId, p.a.wallLine);
    const lb = wallLineSegment(p.b.wallId, p.b.wallLine);
    if (!la || !lb) return null as null | { absMm: number; signedM: number; n: THREE.Vector3; aPt: THREE.Vector3; bPt: THREE.Vector3 };
    const aPt = la.a.clone().lerp(la.b, Math.max(0, Math.min(1, p.a.t)));
    const bPt = lb.a.clone().lerp(lb.b, Math.max(0, Math.min(1, p.b.t)));
    const dir = la.dir.clone().normalize();
    const n = new THREE.Vector3(-dir.z, 0, dir.x);
    const signedM = n.dot(bPt.clone().sub(aPt));
    return { absMm: Math.round(Math.abs(signedM) * 1000), signedM, n, aPt, bPt };
  };

  const updateDimensionGeometry = (d: DimensionInstance, rect: DOMRect | null = null) => {
    const la = wallLineSegment(d.params.a.wallId, d.params.a.wallLine);
    const lb = wallLineSegment(d.params.b.wallId, d.params.b.wallLine);
    if (!la || !lb) {
      d.root.visible = false;
      return;
    }

    const aPt = la.a.clone().lerp(la.b, Math.max(0, Math.min(1, d.params.a.t)));
    const bPt = lb.a.clone().lerp(lb.b, Math.max(0, Math.min(1, d.params.b.t)));
    const dir = la.dir.clone().normalize();
    const n = new THREE.Vector3(-dir.z, 0, dir.x);

    const off = d.params.offsetM;
    const aDim = aPt.clone().addScaledVector(n, off);
    const bDim = bPt.clone().addScaledVector(n, off);

    const thick = rect ? hudLineThicknessM(rect) * 1.2 : 0.01;
    updateDimBar(d.ext1, aPt, aDim, thick);
    updateDimBar(d.ext2, bPt, bDim, thick);
    updateDimBar(d.dim, aDim, bDim, thick);

    const dimDir = bDim.clone().sub(aDim);
    const len = dimDir.length();
    const u = len > 1e-6 ? dimDir.clone().multiplyScalar(1 / len) : new THREE.Vector3(1, 0, 0);
    const tickDir = u.clone().add(n.clone().normalize()).normalize(); // diagonal slash like in the reference
    const tickLen = rect ? Math.max(thick * 8, thick * 10) : 0.08;
    const t1a = aDim.clone().addScaledVector(tickDir, tickLen / 2);
    const t1b = aDim.clone().addScaledVector(tickDir, -tickLen / 2);
    const t2a = bDim.clone().addScaledVector(tickDir, tickLen / 2);
    const t2b = bDim.clone().addScaledVector(tickDir, -tickLen / 2);
    updateDimBar(d.tick1, t1a, t1b, thick);
    updateDimBar(d.tick2, t2a, t2b, thick);

    const mid = aDim.clone().add(bDim).multiplyScalar(0.5);
    d.text.position.set(mid.x, 0.06, mid.z);
    const mm = Math.round(Math.abs(n.dot(bPt.clone().sub(aPt))) * 1000);
    updateSpriteText(d.text, `${mm}`);
    if (rect) setSpriteScreenFixedScale(d.text, rect);

    const angle = Math.atan2(bDim.z - aDim.z, bDim.x - aDim.x);
    const pickLen = Math.max(0.01, aDim.distanceTo(bDim));
    const pickThick = Math.max(0.05, rect ? thick * 10 : 0.08);
    d.pick.geometry.dispose();
    d.pick.geometry = new THREE.BoxGeometry(pickLen, 0.04, pickThick);
    d.pick.position.set(mid.x, 0.05, mid.z);
    d.pick.rotation.set(0, angle, 0);

    d.root.visible = viewMode === "2d";
  };

  const updateAllDimensions = (rect: DOMRect | null = null) => {
    for (const d of dimensions) updateDimensionGeometry(d, rect);
    if (rect) updateDimensionTextScale(rect);
    updateDimensionSelectionHighlights();
  };

  const updateDimensionSelectionHighlights = () => {
    for (const d of dimensions) {
      const sel = selectedKind === "dimension" && selectedDimensionId === d.id;
      const mat = sel ? dimMatSelected : dimMat;
      d.ext1.material = mat;
      d.ext2.material = mat;
      d.dim.material = mat;
      d.tick1.material = mat;
      d.tick2.material = mat;
    }
  };

  const createDimension = (a: DimensionRef, b: DimensionRef, offsetM: number, opts?: { id?: string; skipHistory?: boolean }) => {
    const id = opts?.id ?? `d${dimensionCounter++}`;
    const root = new THREE.Group();
    root.name = `dimension_${id}`;

    const ext1 = makeDimBarMesh(dimMat);
    const ext2 = makeDimBarMesh(dimMat);
    const dim = makeDimBarMesh(dimMat);
    const tick1 = makeDimBarMesh(dimMat);
    const tick2 = makeDimBarMesh(dimMat);
    const text = makeDimTextSprite("0");

    const pick = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.08), dimPickMat);
    pick.userData.kind = "dimension";
    pick.userData.dimensionId = id;
    root.add(pick, ext1, ext2, dim, tick1, tick2, text);

    const inst: DimensionInstance = { id, params: { id, a, b, offsetM }, root, pick, ext1, ext2, dim, tick1, tick2, text };
    layoutRoot.add(root);
    dimensions.push(inst);
    updateDimensionGeometry(inst);
    if (!opts?.skipHistory) commitHistory();
    return inst;
  };

  const disposeDimensionInstance = (d: DimensionInstance) => {
    const meshes = [d.pick, d.ext1, d.ext2, d.dim, d.tick1, d.tick2];
    for (const m of meshes) {
      if (m.geometry) m.geometry.dispose();
      // Do NOT dispose materials (shared)
    }
    const sm = d.text.material as THREE.SpriteMaterial;
    const tex = sm.map as THREE.Texture | null;
    if (tex) tex.dispose();
    sm.dispose();
  };

  const deleteDimension = (id: string, opts?: { skipHistory?: boolean }) => {
    const idx = dimensions.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const d = dimensions[idx];
    dimensions.splice(idx, 1);
    layoutRoot.remove(d.root);
    disposeDimensionInstance(d);
    if (selectedDimensionId === id) setSelectedDimension(null);
    if (!opts?.skipHistory) commitHistory();
  };

  type LayoutSnapshot = {
    wallCounter: number;
    walls: Array<{ id: string; params: WallParams }>;
    instanceCounter: number;
    instances: Array<{
      id: string;
      params: ModuleParams;
      positionMm: { x: number; z: number };
      rotationYDeg: number;
    }>;
    dimensionCounter: number;
    dimensions: DimensionParams[];
    pinnedWallIds: string[];
    pinnedInstanceIds: string[];
    underlayPinned: boolean;
    selected: {
      kind: typeof selectedKind;
      wallId: string | null;
      wallIds: string[];
      instId: string | null;
      instIds: string[];
      dimensionId: string | null;
    };
  };

  const history = {
    past: [] as LayoutSnapshot[],
    future: [] as LayoutSnapshot[],
    current: null as LayoutSnapshot | null,
    max: 80
  };

  const snapshotSignature = (s: LayoutSnapshot) => {
    // Compact-ish signature to skip duplicates
    const w = s.walls
      .map((x) => `${x.id}:${x.params.aMm.x},${x.params.aMm.z}-${x.params.bMm.x},${x.params.bMm.z}:${x.params.thicknessMm}:${(x.params as any).justification ?? "center"}:${x.params.exteriorSign ?? 1}`)
      .join("|");
    const mods = (s.instances ?? [])
      .map((m) => `${m.id}:${m.params?.type ?? "?"}:${m.positionMm.x},${m.positionMm.z}:${Math.round((m.rotationYDeg ?? 0) * 10)}`)
      .join("|");
    const dims = (s.dimensions ?? [])
      .map((d) => `${d.id}:${d.a.wallId}:${d.a.wallLine}:${Math.round(d.a.t * 1000)}-${d.b.wallId}:${d.b.wallLine}:${Math.round(d.b.t * 1000)}:${Math.round(d.offsetM * 1000)}`)
      .join("|");
    const pins = `${s.pinnedWallIds.slice().sort().join(",")}#${s.pinnedInstanceIds.slice().sort().join(",")}#${s.underlayPinned ? 1 : 0}`;
    return `${s.wallCounter}:${s.instanceCounter}:${s.dimensionCounter}::${pins}::${w}::${mods}::${dims}`;
  };

  let undoBtnEl: HTMLButtonElement | null = null;
  let redoBtnEl: HTMLButtonElement | null = null;
  const updateUndoRedoUi = () => {
    if (undoBtnEl) undoBtnEl.disabled = history.past.length === 0;
    if (redoBtnEl) redoBtnEl.disabled = history.future.length === 0;
  };

  const captureLayoutSnapshot = (): LayoutSnapshot => {
    const copyParams = (p: WallParams) => JSON.parse(JSON.stringify(p)) as WallParams;
    return {
      wallCounter,
      walls: walls.map((w) => ({ id: w.id, params: copyParams(w.params) })),
      instanceCounter,
      instances: instances.map((i) => ({
        id: i.id,
        params: JSON.parse(JSON.stringify(i.params)) as ModuleParams,
        positionMm: { x: Math.round(i.root.position.x * 1000), z: Math.round(i.root.position.z * 1000) },
        rotationYDeg: (i.root.rotation.y * 180) / Math.PI
      })),
      dimensionCounter,
      dimensions: dimensions.map((d) => JSON.parse(JSON.stringify(d.params)) as DimensionParams),
      pinnedWallIds: Array.from(pinnedWallIds),
      pinnedInstanceIds: Array.from(pinnedInstanceIds),
      underlayPinned: !!underlayState?.pinned,
      selected: {
        kind: selectedKind,
        wallId: selectedWallId,
        wallIds: Array.from(selectedWallIds),
        instId: selectedInstanceId,
        instIds: Array.from(selectedInstanceIds),
        dimensionId: selectedDimensionId
      }
    };
  };

  const restoreLayoutSnapshot = (snap: LayoutSnapshot) => {
    // Clear selection visuals first
    setSelectedWall(null);
    setSelectedModule(null);
    setSelectedDimension(null);
    selectedWallIds.clear();
    selectedInstanceIds.clear();
    updateSelectionHighlights();

    // Clear dimensions
    for (const d of dimensions.splice(0, dimensions.length)) {
      layoutRoot.remove(d.root);
      disposeDimensionInstance(d);
    }

    // Clear wall roots
    for (const w of walls.splice(0, walls.length)) {
      layoutRoot.remove(w.root);
      disposeObject3D(w.root);
    }

    wallCounter = snap.wallCounter;
    instanceCounter = snap.instanceCounter ?? instanceCounter;
    dimensionCounter = snap.dimensionCounter ?? dimensionCounter;

    pinnedWallIds.clear();
    for (const id of snap.pinnedWallIds) pinnedWallIds.add(id);
    pinnedInstanceIds.clear();
    for (const id of snap.pinnedInstanceIds) pinnedInstanceIds.add(id);
    underlayState.pinned = !!snap.underlayPinned;

    // Clear modules
    for (const inst of instances.splice(0, instances.length)) {
      layoutRoot.remove(inst.root);
      disposeObject3D(inst.root);
    }

    // Restore modules
    if (snap.instances && snap.instances.length > 0) {
      for (const m of snap.instances) {
        const inst = createInstance(JSON.parse(JSON.stringify(m.params)) as ModuleParams, { id: m.id });
        inst.root.position.set(m.positionMm.x / 1000, 0, m.positionMm.z / 1000);
        inst.root.rotation.y = ((m.rotationYDeg ?? 0) * Math.PI) / 180;
        layoutRoot.add(inst.root);
        instances.push(inst);
      }
      updateLayoutPanel();
    }

    for (const w of snap.walls) {
      const id = w.id;
      const root = new THREE.Group();
      root.name = `wall_${id}`;
      const refA = new THREE.Vector3(w.params.aMm.x / 1000, 0, w.params.aMm.z / 1000);
      const refB = new THREE.Vector3(w.params.bMm.x / 1000, 0, w.params.bMm.z / 1000);
      const mesh = createWallMesh(refA, refB, w.params.thicknessMm);
      mesh.name = `wallMesh_${id}`;
      mesh.userData.kind = "wall";
      mesh.userData.wallId = id;
      root.add(mesh);
      const inst: WallInstance = { id, params: JSON.parse(JSON.stringify(w.params)) as WallParams, root, mesh };
      layoutRoot.add(root);
      walls.push(inst);
      rebuildWall(inst);
    }

    if (snap.dimensions && snap.dimensions.length > 0) {
      for (const dp of snap.dimensions) {
        createDimension(dp.a, dp.b, dp.offsetM, { id: dp.id, skipHistory: true });
      }
    }

    rebuildWallPlanMesh();
    updateAllDimensions();
    clearToolHud();

    // Restore selection (best-effort)
    for (const id of snap.selected.wallIds) if (walls.some((w) => w.id === id)) selectedWallIds.add(id);
    for (const id of snap.selected.instIds) if (instances.some((i) => i.id === id)) selectedInstanceIds.add(id);
    if (snap.selected.kind === "wall" && snap.selected.wallId && walls.some((w) => w.id === snap.selected.wallId)) {
      setSelectedWall(snap.selected.wallId);
    } else if (snap.selected.kind === "module" && snap.selected.instId && instances.some((i) => i.id === snap.selected.instId)) {
      setSelectedModule(snap.selected.instId);
    } else if (snap.selected.kind === "dimension" && snap.selected.dimensionId) {
      setSelectedDimension(snap.selected.dimensionId);
    } else {
      setSelectedWall(null);
      setSelectedModule(null);
    }
    updateSelectionHighlights();
    updateDimensionSelectionHighlights();
    mountProps();
  };

  const commitHistory = () => {
    if (mode !== "layout") return;
    if (viewMode !== "2d" && viewMode !== "3d") return;
    const next = captureLayoutSnapshot();
    if (!history.current) {
      history.current = next;
      history.past = [];
      history.future = [];
      updateUndoRedoUi();
      return;
    }
    const a = snapshotSignature(history.current);
    const b = snapshotSignature(next);
    if (a === b) return;
    history.past.push(history.current);
    if (history.past.length > history.max) history.past.splice(0, history.past.length - history.max);
    history.current = next;
    history.future = [];
    updateUndoRedoUi();
  };

  const undo = () => {
    if (!history.current) return;
    const prev = history.past.pop() ?? null;
    if (!prev) return;
    history.future.push(history.current);
    history.current = prev;
    restoreLayoutSnapshot(prev);
    updateUndoRedoUi();
  };

  const redo = () => {
    if (!history.current) return;
    const next = history.future.pop() ?? null;
    if (!next) return;
    history.past.push(history.current);
    history.current = next;
    restoreLayoutSnapshot(next);
    updateUndoRedoUi();
  };

  const wallDraw = {
    active: false,
    a: null as THREE.Vector3 | null,
    chainStart: null as THREE.Vector3 | null,
    segments: 0,
    preview: null as THREE.Mesh | null,
    hoverB: null as THREE.Vector3 | null,
    typedMm: "", // numeric buffer while drawing (e.g. "2500")
    lastPointerPx: { x: 0, y: 0 }
  };

  const transformState = {
    kind: null as null | "move" | "rotate",
    step: null as null | "pickBase" | "pickTarget" | "pickPivot" | "rotating",
    base: null as THREE.Vector3 | null,
    pivot: null as THREE.Vector3 | null,
    typed: "",
    lastAngleSign: 1,
    lastPointerPx: { x: 0, y: 0 },
    selectedWallIds: [] as string[],
    selectedInstanceIds: [] as string[],
    startWalls: new Map<string, WallParams>(),
    startInstances: new Map<string, { pos: THREE.Vector3; rotY: number }>(),
    startPointerAngle: 0,
    lastValidDelta: new THREE.Vector3(0, 0, 0),
    lastValidAngle: 0
  };

  const clearTransform = (opts?: { restore?: boolean; status?: string | null }) => {
    if (opts?.restore) {
      for (const w of walls) {
        const p = transformState.startWalls.get(w.id);
        if (p) w.params = JSON.parse(JSON.stringify(p)) as WallParams;
        rebuildWall(w);
      }
      rebuildWallPlanMesh();
      for (const inst of instances) {
        const s = transformState.startInstances.get(inst.id);
        if (s) {
          inst.root.position.copy(s.pos);
          inst.root.rotation.y = s.rotY;
        }
      }
      updateLayoutPanel();
      updateSelectionHighlights();
      updateDimensionSelectionHighlights();
      mountProps();
    }

    transformState.kind = null;
    transformState.step = null;
    transformState.base = null;
    transformState.pivot = null;
    transformState.typed = "";
    transformState.lastAngleSign = 1;
    transformState.selectedWallIds = [];
    transformState.selectedInstanceIds = [];
    transformState.startWalls.clear();
    transformState.startInstances.clear();
    transformState.startPointerAngle = 0;
    transformState.lastValidDelta.set(0, 0, 0);
    transformState.lastValidAngle = 0;
    if (opts?.status) setUnderlayStatus(opts.status);
  };

  const startTransformFromSelection = (kind: "move" | "rotate") => {
    if (mode !== "layout" || viewMode !== "2d" || layoutTool !== "select") return false;
    if (measureState.enabled) return false;
    if (dragState.active || windowDragState.active || wallEditHud.drag || marquee.active) return false;
    if (underlayCal.active) return false;

    const wallIds = selectedWallIds.size > 0 ? Array.from(selectedWallIds) : selectedKind === "wall" && selectedWallId ? [selectedWallId] : [];
    const instIds =
      selectedInstanceIds.size > 0
        ? Array.from(selectedInstanceIds)
        : selectedKind === "module" && selectedInstanceId
          ? [selectedInstanceId]
          : [];
    if (wallIds.length + instIds.length === 0) return false;

    clearTransform();
    transformState.kind = kind;
    transformState.step = kind === "move" ? "pickBase" : "pickPivot";
    transformState.selectedWallIds = wallIds;
    transformState.selectedInstanceIds = instIds;

    // Capture start state (includes non-selected walls/modules so we can restore cleanly during preview).
    for (const w of walls) transformState.startWalls.set(w.id, JSON.parse(JSON.stringify(w.params)) as WallParams);
    for (const inst of instances) transformState.startInstances.set(inst.id, { pos: inst.root.position.clone(), rotY: inst.root.rotation.y });

    setUnderlayStatus(kind === "move" ? "Move (M): click base point..." : "Rotate (R): click pivot point...");
    mountProps();
    return true;
  };

  const restoreTransformStartState = () => {
    for (const w of walls) {
      const p = transformState.startWalls.get(w.id);
      if (p) w.params = JSON.parse(JSON.stringify(p)) as WallParams;
      rebuildWall(w);
    }
    rebuildWallPlanMesh();
    for (const inst of instances) {
      const s = transformState.startInstances.get(inst.id);
      if (s) {
        inst.root.position.copy(s.pos);
        inst.root.rotation.y = s.rotY;
      }
    }
  };

  const translateWallsByAnchors = (dxMm: number, dzMm: number) => {
    const anchors: Array<{ x: number; z: number }> = [];
    for (const id of transformState.selectedWallIds) {
      const p = transformState.startWalls.get(id);
      if (!p) continue;
      anchors.push({ x: p.aMm.x, z: p.aMm.z }, { x: p.bMm.x, z: p.bMm.z });
    }
    if (anchors.length === 0) return;

    const matchAnchor = (p: { x: number; z: number }) => anchors.some((a) => mmDist(a, p) <= wallJoinTolMm);
    const touched = new Set<string>();
    for (const w of walls) {
      if (pinnedWallIds.has(w.id)) continue;
      let changed = false;
      if (matchAnchor(w.params.aMm)) {
        w.params.aMm = { x: w.params.aMm.x + dxMm, z: w.params.aMm.z + dzMm };
        changed = true;
      }
      if (matchAnchor(w.params.bMm)) {
        w.params.bMm = { x: w.params.bMm.x + dxMm, z: w.params.bMm.z + dzMm };
        changed = true;
      }
      if (changed) touched.add(w.id);
    }
    for (const id of touched) {
      const w = walls.find((x) => x.id === id) ?? null;
      if (w) rebuildWall(w);
    }
    if (touched.size > 0) rebuildWallPlanMesh();
  };

  const applyMoveDelta = (delta: THREE.Vector3) => {
    restoreTransformStartState();

    const dxMm = Math.round(delta.x * 1000);
    const dzMm = Math.round(delta.z * 1000);

    if (dxMm !== 0 || dzMm !== 0) {
      translateWallsByAnchors(dxMm, dzMm);
    }

    const ignore = new Set<string>(transformState.selectedInstanceIds);

    // Move modules as a group (no module-to-module snapping here; target snapping comes from cursor snap).
    let ok = true;
    for (const id of transformState.selectedInstanceIds) {
      const inst = findInstance(id);
      const st = transformState.startInstances.get(id);
      if (!inst || !st) continue;
      const desired = st.pos.clone().add(delta);
      const desiredInRoom = applyWallConstraints(inst, desired);
      inst.root.position.copy(desiredInRoom);
      autoOrientModuleToRoomWallIfSnapped(inst, ignore);
    }
    for (const id of transformState.selectedInstanceIds) {
      const inst = findInstance(id);
      if (!inst) continue;
      const inRoom = roomContainsBoxXZ(instanceWorldBox(inst));
      const overlaps = anyOverlapIgnoring(inst, ignore);
      if (!inRoom || overlaps) {
        ok = false;
        break;
      }
    }

    if (ok) {
      transformState.lastValidDelta.copy(delta);
      updateLayoutPanel();
    } else {
      restoreTransformStartState();
      const d = transformState.lastValidDelta;
      const dxMm2 = Math.round(d.x * 1000);
      const dzMm2 = Math.round(d.z * 1000);
      if (dxMm2 !== 0 || dzMm2 !== 0) translateWallsByAnchors(dxMm2, dzMm2);
      for (const id of transformState.selectedInstanceIds) {
        const inst = findInstance(id);
        const st = transformState.startInstances.get(id);
        if (!inst || !st) continue;
        const desired = st.pos.clone().add(d);
        inst.root.position.copy(applyWallConstraints(inst, desired));
        autoOrientModuleToRoomWallIfSnapped(inst, ignore);
      }
      updateLayoutPanel();
    }
  };

  const rotatePointAround = (p: THREE.Vector3, pivot: THREE.Vector3, ang: number) => {
    const dx = p.x - pivot.x;
    const dz = p.z - pivot.z;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    return new THREE.Vector3(pivot.x + dx * c - dz * s, 0, pivot.z + dx * s + dz * c);
  };

  const rotateWallsByAnchors = (pivot: THREE.Vector3, ang: number) => {
    const anchors: Array<{ old: { x: number; z: number }; next: { x: number; z: number } }> = [];
    for (const id of transformState.selectedWallIds) {
      const p = transformState.startWalls.get(id);
      if (!p) continue;
      const a = fromMmPoint(p.aMm);
      const b = fromMmPoint(p.bMm);
      const na = rotatePointAround(a, pivot, ang);
      const nb = rotatePointAround(b, pivot, ang);
      anchors.push(
        { old: { x: p.aMm.x, z: p.aMm.z }, next: toMmPoint(na) },
        { old: { x: p.bMm.x, z: p.bMm.z }, next: toMmPoint(nb) }
      );
    }
    if (anchors.length === 0) return;

    const mapEnd = (p: { x: number; z: number }) => {
      for (const a of anchors) if (mmDist(a.old, p) <= wallJoinTolMm) return a.next;
      return null;
    };

    const touched = new Set<string>();
    for (const w of walls) {
      if (pinnedWallIds.has(w.id)) continue;
      const na = mapEnd(w.params.aMm);
      const nb = mapEnd(w.params.bMm);
      if (na) {
        w.params.aMm = { x: na.x, z: na.z };
        touched.add(w.id);
      }
      if (nb) {
        w.params.bMm = { x: nb.x, z: nb.z };
        touched.add(w.id);
      }
    }
    for (const id of touched) {
      const w = walls.find((x) => x.id === id) ?? null;
      if (w) rebuildWall(w);
    }
    if (touched.size > 0) rebuildWallPlanMesh();
  };

  const applyRotateAngle = (ang: number) => {
    const pivot = transformState.pivot;
    if (!pivot) return;
    restoreTransformStartState();

    rotateWallsByAnchors(pivot, ang);

    const ignore = new Set<string>(transformState.selectedInstanceIds);
    let ok = true;

    for (const id of transformState.selectedInstanceIds) {
      const inst = findInstance(id);
      const st = transformState.startInstances.get(id);
      if (!inst || !st) continue;
      const nextPos = rotatePointAround(st.pos, pivot, ang);
      inst.root.rotation.y = st.rotY + ang;
      inst.root.position.copy(applyWallConstraints(inst, nextPos));
    }

    for (const id of transformState.selectedInstanceIds) {
      const inst = findInstance(id);
      if (!inst) continue;
      const inRoom = roomContainsBoxXZ(instanceWorldBox(inst));
      const overlaps = anyOverlapIgnoring(inst, ignore);
      if (!inRoom || overlaps) {
        ok = false;
        break;
      }
    }

    if (ok) {
      transformState.lastValidAngle = ang;
      updateLayoutPanel();
    } else {
      // Keep last valid
      restoreTransformStartState();
      rotateWallsByAnchors(pivot, transformState.lastValidAngle);
      for (const id of transformState.selectedInstanceIds) {
        const inst = findInstance(id);
        const st = transformState.startInstances.get(id);
        if (!inst || !st) continue;
        const nextPos = rotatePointAround(st.pos, pivot, transformState.lastValidAngle);
        inst.root.rotation.y = st.rotY + transformState.lastValidAngle;
        inst.root.position.copy(applyWallConstraints(inst, nextPos));
      }
      updateLayoutPanel();
    }
  };

  type AlignWallLine = "center" | "exterior" | "interior" | "endA" | "endB";
  type AlignPickedLine = {
    p: THREE.Vector3;
    dir: THREE.Vector3;
    segA: THREE.Vector3;
    segB: THREE.Vector3;
    label: string;
    wallId: string;
    wallLine: AlignWallLine;
  };

  const alignState = {
    ref: null as AlignPickedLine | null,
    hover: null as AlignPickedLine | null,
    lastA: null as AlignPickedLine | null,
    lastB: null as AlignPickedLine | null,
    lastUntilMs: 0
  };

  const trimState = {
    step: "pickTarget" as "pickTarget" | "pickCutter",
    targetWallId: null as string | null,
    targetPick: null as AlignPickedLine | null,
    targetClick: null as THREE.Vector3 | null,
    hover: null as AlignPickedLine | null,
    lastTarget: null as AlignPickedLine | null,
    lastCutter: null as AlignPickedLine | null,
    lastUntilMs: 0
  };

  const dimTool = {
    a: null as AlignPickedLine | null,
    tA: 0.5,
    hover: null as AlignPickedLine | null,
    offsetM: 0.2
  };

  const dimPreviewMat = new THREE.MeshBasicMaterial({ color: 0x0b0f18, transparent: true, opacity: 0.35, depthTest: false, depthWrite: false });
  const dimPreview = {
    root: new THREE.Group(),
    ext1: makeDimBarMesh(dimPreviewMat),
    ext2: makeDimBarMesh(dimPreviewMat),
    dim: makeDimBarMesh(dimPreviewMat),
    tick1: makeDimBarMesh(dimPreviewMat),
    tick2: makeDimBarMesh(dimPreviewMat),
    text: makeDimTextSprite("...")
  };
  dimPreview.root.name = "dimPreview";
  dimPreview.root.visible = false;
  dimPreview.root.add(dimPreview.ext1, dimPreview.ext2, dimPreview.dim, dimPreview.tick1, dimPreview.tick2, dimPreview.text);
  toolHud.add(dimPreview.root);

  const segClosestT = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => {
    const ab = b.clone().sub(a);
    const denom = ab.lengthSq();
    if (denom < 1e-10) return 0.5;
    const t = p.clone().sub(a).dot(ab) / denom;
    return Math.max(0, Math.min(1, t));
  };

  const distPxPointToSeg = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const denom = abx * abx + aby * aby;
    if (denom < 1e-9) return Math.hypot(apx, apy);
    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / denom));
    const cx = ax + abx * t;
    const cy = ay + aby * t;
    return Math.hypot(px - cx, py - cy);
  };

  const pickAlignLineAt = (hitPoint: THREE.Vector3, mousePx: { x: number; y: number }, rect: DOMRect) => {
    if (walls.length === 0) return null as AlignPickedLine | null;

    let best: { line: AlignPickedLine; px: number } | null = null;

    for (const w of walls) {
      const refA = new THREE.Vector3(w.params.aMm.x / 1000, 0, w.params.aMm.z / 1000);
      const refB = new THREE.Vector3(w.params.bMm.x / 1000, 0, w.params.bMm.z / 1000);
      const just = w.params.justification ?? "center";
      const s = (w.params.exteriorSign ?? 1) as 1 | -1;

      const center = wallRefLineToCenterLine(refA, refB, w.params.thicknessMm, just, s);
      const d = center.b.clone().sub(center.a);
      if (d.lengthSq() < 1e-10) continue;
      d.normalize();
      const n = new THREE.Vector3(-d.z, 0, d.x);
      const half = Math.max(10, w.params.thicknessMm) / 2000; // meters
      const exteriorA = center.a.clone().addScaledVector(n, s * half);
      const exteriorB = center.b.clone().addScaledVector(n, s * half);
      const interiorA = center.a.clone().addScaledVector(n, -s * half);
      const interiorB = center.b.clone().addScaledVector(n, -s * half);

      const candidates: Array<{ kind: AlignWallLine; a: THREE.Vector3; b: THREE.Vector3; p: THREE.Vector3; dir: THREE.Vector3; label: string }> = [
        { kind: "center", a: center.a, b: center.b, p: center.a, dir: d, label: `Wall ${w.id}: centerline` },
        { kind: "exterior", a: exteriorA, b: exteriorB, p: exteriorA, dir: d, label: `Wall ${w.id}: exterior face` },
        { kind: "interior", a: interiorA, b: interiorB, p: interiorA, dir: d, label: `Wall ${w.id}: interior face` }
      ];

      const endLen = Math.max(0.5, w.params.thicknessMm / 1000 + 0.25);
      const endA1 = center.a.clone().addScaledVector(n, -endLen / 2);
      const endA2 = center.a.clone().addScaledVector(n, endLen / 2);
      const endB1 = center.b.clone().addScaledVector(n, -endLen / 2);
      const endB2 = center.b.clone().addScaledVector(n, endLen / 2);
      candidates.push({ kind: "endA", a: endA1, b: endA2, p: center.a, dir: n.clone().normalize(), label: `Wall ${w.id}: end A` });
      candidates.push({ kind: "endB", a: endB1, b: endB2, p: center.b, dir: n.clone().normalize(), label: `Wall ${w.id}: end B` });

      for (const c of candidates) {
        const sa = worldToScreen(c.a, cam(), rect);
        const sb = worldToScreen(c.b, cam(), rect);
        const px = distPxPointToSeg(mousePx.x, mousePx.y, sa.x, sa.y, sb.x, sb.y);
        if (!best || px < best.px) {
          best = {
            px,
            line: {
              p: c.p.clone(),
              dir: c.dir.clone().normalize(),
              segA: c.a.clone(),
              segB: c.b.clone(),
              label: c.label,
              wallId: w.id,
              wallLine: c.kind
            }
          };
        }
      }
    }

    if (!best) return null;
    if (best.px > 12) return null;
    return best.line;
  };

  const alignParallel = (a: AlignPickedLine, b: AlignPickedLine) => {
    const dot = Math.abs(a.dir.clone().normalize().dot(b.dir.clone().normalize()));
    return dot >= 0.999;
  };

  const alignShiftVec = (ref: AlignPickedLine, moving: AlignPickedLine) => {
    const dir = ref.dir.clone().normalize();
    const n = new THREE.Vector3(-dir.z, 0, dir.x);
    const off = n.dot(moving.p.clone().sub(ref.p));
    return n.multiplyScalar(-off);
  };

  const lineLineIntersectionXZ = (p1: THREE.Vector3, d1: THREE.Vector3, p2: THREE.Vector3, d2: THREE.Vector3) => {
    const a1x = d1.x;
    const a1z = d1.z;
    const a2x = d2.x;
    const a2z = d2.z;
    const denom = a1x * a2z - a1z * a2x;
    if (Math.abs(denom) < 1e-9) return null as THREE.Vector3 | null;
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const t = (dx * a2z - dz * a2x) / denom;
    return new THREE.Vector3(p1.x + a1x * t, 0, p1.z + a1z * t);
  };

  const translateWallAndConnected = (w: WallInstance, dxMm: number, dzMm: number) => {
    const oldA = { x: w.params.aMm.x, z: w.params.aMm.z };
    const oldB = { x: w.params.bMm.x, z: w.params.bMm.z };

    w.params.aMm = { x: w.params.aMm.x + dxMm, z: w.params.aMm.z + dzMm };
    w.params.bMm = { x: w.params.bMm.x + dxMm, z: w.params.bMm.z + dzMm };

    const touched = new Set<string>();
    touched.add(w.id);

    for (const other of walls) {
      if (other.id === w.id) continue;
      if (pinnedWallIds.has(other.id)) continue;
      const wa = wallEndpointWhich(other, oldA, wallJoinTolMm);
      if (wa) {
        if (wa === "a") other.params.aMm = { x: oldA.x + dxMm, z: oldA.z + dzMm };
        else other.params.bMm = { x: oldA.x + dxMm, z: oldA.z + dzMm };
        touched.add(other.id);
      }
      const wb = wallEndpointWhich(other, oldB, wallJoinTolMm);
      if (wb) {
        if (wb === "a") other.params.aMm = { x: oldB.x + dxMm, z: oldB.z + dzMm };
        else other.params.bMm = { x: oldB.x + dxMm, z: oldB.z + dzMm };
        touched.add(other.id);
      }
    }

    for (const id of touched) {
      const ww = walls.find((x) => x.id === id) ?? null;
      if (ww) rebuildWall(ww);
    }
    rebuildWallPlanMesh();
  };

  const moveWallEndpointAndConnected = (w: WallInstance, which: "a" | "b", dxMm: number, dzMm: number) => {
    const oldP = which === "a" ? { x: w.params.aMm.x, z: w.params.aMm.z } : { x: w.params.bMm.x, z: w.params.bMm.z };
    const nextP = { x: oldP.x + dxMm, z: oldP.z + dzMm };

    const touched = new Set<string>();
    touched.add(w.id);
    if (which === "a") w.params.aMm = nextP;
    else w.params.bMm = nextP;

    for (const other of walls) {
      if (other.id === w.id) continue;
      if (pinnedWallIds.has(other.id)) continue;
      const ww = wallEndpointWhich(other, oldP, wallJoinTolMm);
      if (ww) {
        if (ww === "a") other.params.aMm = nextP;
        else other.params.bMm = nextP;
        touched.add(other.id);
      }
    }

    for (const id of touched) {
      const ww = walls.find((x) => x.id === id) ?? null;
      if (ww) rebuildWall(ww);
    }
    rebuildWallPlanMesh();
  };

  function snapAxisXZ(a: THREE.Vector3, b: THREE.Vector3, enabled: boolean) {
    if (!enabled) return b;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    if (Math.abs(dx) >= Math.abs(dz)) return new THREE.Vector3(b.x, b.y, a.z);
    return new THREE.Vector3(a.x, b.y, b.z);
  }

  function toMmPoint(v: THREE.Vector3) {
    return { x: Math.round(v.x * 1000), z: Math.round(v.z * 1000) };
  }

  function fromMmPoint(p: { x: number; z: number }) {
    return new THREE.Vector3(p.x / 1000, 0, p.z / 1000);
  }

  function mmDist(a: { x: number; z: number }, b: { x: number; z: number }) {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  function wallEndpointWhich(w: WallInstance, p: { x: number; z: number }, tolMm: number): "a" | "b" | null {
    if (mmDist(w.params.aMm, p) <= tolMm) return "a";
    if (mmDist(w.params.bMm, p) <= tolMm) return "b";
    return null;
  }

  function setWallEndpointMm(w: WallInstance, which: "a" | "b", p: { x: number; z: number }) {
    if (which === "a") w.params.aMm = { x: p.x, z: p.z };
    else w.params.bMm = { x: p.x, z: p.z };
    rebuildWall(w);
  }

  function pointOnWallAxisMm(w: WallInstance, p: { x: number; z: number }) {
    const ax = w.params.aMm.x;
    const az = w.params.aMm.z;
    const bx = w.params.bMm.x;
    const bz = w.params.bMm.z;
    const abx = bx - ax;
    const abz = bz - az;
    const apx = p.x - ax;
    const apz = p.z - az;
    const denom = abx * abx + abz * abz;
    if (denom < 1e-6) return { t: 0, closest: { x: ax, z: az }, distMm: Infinity };
    const t = (apx * abx + apz * abz) / denom;
    const tt = Math.max(0, Math.min(1, t));
    const cx = ax + abx * tt;
    const cz = az + abz * tt;
    const distMm = Math.hypot(p.x - cx, p.z - cz);
    return { t: tt, closest: { x: Math.round(cx), z: Math.round(cz) }, distMm };
  }

  function wallDirOutFromNode(w: WallInstance, node: { x: number; z: number }) {
    const a = w.params.aMm;
    const b = w.params.bMm;
    const isA = mmDist(a, node) <= wallJoinTolMm;
    const isB = mmDist(b, node) <= wallJoinTolMm;
    if (isA && !isB) return new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
    if (isB && !isA) return new THREE.Vector3(a.x - b.x, 0, a.z - b.z);
    // fallback: assume node is closer to A
    return new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
  }

  function wallExteriorSign(w: WallInstance) {
    return (w.params.exteriorSign ?? 1) as 1 | -1;
  }

  function joinExtensionM(w: WallInstance, node: { x: number; z: number }) {
    // Find best neighbor at node and compute a miter-like extension so faces overlap cleanly.
    const neighbors = walls.filter((x) => x.id !== w.id && (mmDist(x.params.aMm, node) <= wallJoinTolMm || mmDist(x.params.bMm, node) <= wallJoinTolMm));
    if (neighbors.length === 0) return 0;

    const v0 = wallDirOutFromNode(w, node);
    if (v0.lengthSq() < 1e-6) return 0;
    v0.normalize();

    let bestTheta = Infinity;
    for (const n of neighbors) {
      const v1 = wallDirOutFromNode(n, node);
      if (v1.lengthSq() < 1e-6) continue;
      v1.normalize();
      const dot = Math.max(-1, Math.min(1, v0.dot(v1)));
      const theta = Math.acos(dot); // 0..pi
      // ignore nearly straight continuation
      if (theta < 0.2 || Math.abs(Math.PI - theta) < 0.2) continue;
      if (theta < bestTheta) bestTheta = theta;
    }

    if (!isFinite(bestTheta) || bestTheta === Infinity) return 0;

    const thickM = Math.max(0.01, w.params.thicknessMm / 1000);
    const tanHalf = Math.tan(bestTheta / 2);
    if (tanHalf < 1e-4) return 0;
    const ext = (thickM / 2) / tanHalf;
    return Math.min(1.2, Math.max(0, ext));
  }

  function removeWall(w: WallInstance) {
    // Remove dependent dimensions
    const dimIds = dimensions.filter((d) => d.params.a.wallId === w.id || d.params.b.wallId === w.id).map((d) => d.id);
    for (const id of dimIds) deleteDimension(id, { skipHistory: true });
    layoutRoot.remove(w.root);
    w.mesh.geometry.dispose();
    (w.mesh.material as THREE.Material).dispose();
    const idx = walls.indexOf(w);
    if (idx >= 0) walls.splice(idx, 1);
    if (selectedWallId === w.id) selectedWallId = null;
    rebuildWallPlanMesh();
  }

  function splitWallAtMm(w: WallInstance, p: { x: number; z: number }) {
    const which = wallEndpointWhich(w, p, wallJoinTolMm);
    if (which) {
      setWallEndpointMm(w, which, p);
      return;
    }

    const { t, distMm } = pointOnWallAxisMm(w, p);
    if (distMm > wallJoinTolMm) return;
    if (t <= 0.001 || t >= 0.999) return;

    const a = fromMmPoint(w.params.aMm);
    const b = fromMmPoint(w.params.bMm);
    const mid = fromMmPoint(p);
    const thickness = w.params.thicknessMm;
    const materialId = w.params.materialId;

    removeWall(w);
    const w1 = addWall(a, mid, thickness);
    w1.params.materialId = materialId;
    const w2 = addWall(mid, b, thickness);
    w2.params.materialId = materialId;
    rebuildWallPlanMesh();
  }

  function autoJoinAtMmPoint(p: { x: number; z: number }) {
    // Snap endpoints and split any wall that crosses the point (T-joins).
    for (const w of [...walls]) {
      const which = wallEndpointWhich(w, p, wallJoinTolMm);
      if (which) setWallEndpointMm(w, which, p);
      else splitWallAtMm(w, p);
    }
    // Rebuild after edits so joins update.
    for (const w of walls) rebuildWall(w);
    rebuildWallPlanMesh();
  }

  function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  function distPointToSegment2(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = p.x - a.x;
    const apy = p.y - a.y;
    const denom = abx * abx + aby * aby;
    const t = denom > 1e-9 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / denom)) : 0;
    const cx = a.x + abx * t;
    const cy = a.y + aby * t;
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { d2: dx * dx + dy * dy, t };
  }

  type PickedLine2D = {
    wallId: string;
    kind: "center" | "face" | "end";
    a: THREE.Vector3;
    b: THREE.Vector3;
    p: THREE.Vector3; // closest point (for distance between parallels)
    dir: THREE.Vector3;
    label: string;
  };

  function pickWallLine2D(raw: THREE.Vector3, rect: DOMRect, camera: THREE.Camera, maxPx = 14): PickedLine2D | null {
    const rawS = worldToScreen(raw, camera, rect);
    let best: { pick: PickedLine2D; d2: number } | null = null;

    const consider = (p: PickedLine2D) => {
      const aS = worldToScreen(p.a, camera, rect);
      const bS = worldToScreen(p.b, camera, rect);
      const { d2, t } = distPointToSegment2(rawS, aS, bS);
      if (d2 > maxPx * maxPx) return;
      if (!best || d2 < best.d2) {
        const dir = p.b.clone().sub(p.a);
        if (dir.lengthSq() < 1e-10) return;
        dir.normalize();
        // closest point on the actual world segment (linear in XZ)
        const closest = p.a.clone().lerp(p.b, t);
        best = { pick: { ...p, p: closest, dir }, d2 };
      }
    };

    for (const w of walls) {
      // centerline (derived)
      const refA = new THREE.Vector3(w.params.aMm.x / 1000, 0, w.params.aMm.z / 1000);
      const refB = new THREE.Vector3(w.params.bMm.x / 1000, 0, w.params.bMm.z / 1000);
      const just = w.params.justification ?? "center";
      const s = (w.params.exteriorSign ?? 1) as 1 | -1;
      const c = wallRefLineToCenterLine(refA, refB, w.params.thicknessMm, just, s);
      consider({
        wallId: w.id,
        kind: "center",
        a: c.a,
        b: c.b,
        p: c.a,
        dir: new THREE.Vector3(1, 0, 0),
        label: "Centerline"
      });

      // solved outline edges (faces + ends)
      const poly = wallSolvedOutlines.get(w.id) ?? null;
      if (!poly || poly.length < 4) continue;
      const pts = poly.map((p) => new THREE.Vector3(p.x, 0, p.z));
      const edges: Array<{ a: THREE.Vector3; b: THREE.Vector3; kind: "face" | "end"; label: string }> = [
        { a: pts[0], b: pts[1], kind: "end", label: "End" },
        { a: pts[1], b: pts[2], kind: "face", label: "Face" },
        { a: pts[2], b: pts[3], kind: "end", label: "End" },
        { a: pts[3], b: pts[0], kind: "face", label: "Face" }
      ];
      for (const e of edges) {
        consider({
          wallId: w.id,
          kind: e.kind,
          a: e.a,
          b: e.b,
          p: e.a,
          dir: new THREE.Vector3(1, 0, 0),
          label: e.label
        });
      }
    }

    return best?.pick ?? null;
  }

  function cross2XZ(a: THREE.Vector3, b: THREE.Vector3) {
    return a.x * b.z - a.z * b.x;
  }

  function intersectLinesXZ(
    p: THREE.Vector3,
    r: THREE.Vector3,
    q: THREE.Vector3,
    s: THREE.Vector3
  ): THREE.Vector3 | null {
    const rxs = cross2XZ(r, s);
    if (Math.abs(rxs) < 1e-8) return null;
    const qp = q.clone().sub(p);
    const t = cross2XZ(qp, s) / rxs;
    return new THREE.Vector3(p.x + r.x * t, 0, p.z + r.z * t);
  }

  function bestNeighborAtNode(w: WallInstance, node: { x: number; z: number }) {
    let best: { n: WallInstance; u: THREE.Vector3; theta: number } | null = null;
    const v0 = wallDirOutFromNode(w, node);
    if (v0.lengthSq() < 1e-8) return null;
    v0.normalize();

    for (const other of walls) {
      if (other.id === w.id) continue;
      const isAt =
        mmDist(other.params.aMm, node) <= wallJoinTolMm || mmDist(other.params.bMm, node) <= wallJoinTolMm;
      if (!isAt) continue;
      const u = wallDirOutFromNode(other, node);
      if (u.lengthSq() < 1e-8) continue;
      u.normalize();
      const dot = Math.max(-1, Math.min(1, v0.dot(u)));
      const theta = Math.acos(dot);
      if (theta < 0.2 || Math.abs(Math.PI - theta) < 0.2) continue;
      if (!best || theta < best.theta) best = { n: other, u, theta };
    }

    return best;
  }

  function miterEndCorners(
    w: WallInstance,
    which: "a" | "b"
  ): { outer: THREE.Vector3; inner: THREE.Vector3 } {
    const nodeMm = which === "a" ? w.params.aMm : w.params.bMm;
    const otherMm = which === "a" ? w.params.bMm : w.params.aMm;
    const p = fromMmPoint(nodeMm);
    const q = fromMmPoint(otherMm);

    const v = q.clone().sub(p);
    if (v.lengthSq() < 1e-8) {
      const n0 = new THREE.Vector3(0, 0, 1);
      const h0 = Math.max(1, w.params.thicknessMm / 2) / 1000;
      const s0 = wallExteriorSign(w);
      return {
        outer: p.clone().addScaledVector(n0, s0 * h0),
        inner: p.clone().addScaledVector(n0, -s0 * h0)
      };
    }
    v.normalize();
    const n0 = new THREE.Vector3(-v.z, 0, v.x).normalize();
    const h0 = Math.max(1, w.params.thicknessMm / 2) / 1000;
    const s0 = wallExteriorSign(w);

    const nb = bestNeighborAtNode(w, nodeMm);
    if (!nb) {
      return {
        outer: p.clone().addScaledVector(n0, s0 * h0),
        inner: p.clone().addScaledVector(n0, -s0 * h0)
      };
    }

    const u = nb.u.clone().normalize();
    const n1 = new THREE.Vector3(-u.z, 0, u.x).normalize();
    const h1 = Math.max(1, nb.n.params.thicknessMm / 2) / 1000;
    const s1 = wallExteriorSign(nb.n);

    // Miter corners are intersections of corresponding faces (outer-outer, inner-inner).
    const outer0 = p.clone().addScaledVector(n0, s0 * h0);
    const inner0 = p.clone().addScaledVector(n0, -s0 * h0);
    const outer1 = p.clone().addScaledVector(n1, s1 * h1);
    const inner1 = p.clone().addScaledVector(n1, -s1 * h1);

    const out = intersectLinesXZ(outer0, v, outer1, u) ?? outer0;
    const inn = intersectLinesXZ(inner0, v, inner1, u) ?? inner0;
    return { outer: out, inner: inn };
  }

  function snapPoint2D(
    raw: THREE.Vector3,
    rect: DOMRect,
    camera: THREE.Camera,
    maxPx = 14
  ): { point: THREE.Vector3; kind: "none" | "corner" | "edge" | "endpoint" | "axis" } {
    const candidates: Array<{ p: THREE.Vector3; kind: "corner" | "edge" | "endpoint" | "axis" }> = [];

    // Wall endpoints
    for (const w of walls) {
      const a = new THREE.Vector3(w.params.aMm.x / 1000, 0, w.params.aMm.z / 1000);
      const b = new THREE.Vector3(w.params.bMm.x / 1000, 0, w.params.bMm.z / 1000);
      candidates.push({ p: a, kind: "endpoint" });
      candidates.push({ p: b, kind: "endpoint" });

      // Closest point on wall axis segment
      const ab = b.clone().sub(a);
      const t = ab.lengthSq() > 1e-12 ? raw.clone().sub(a).dot(ab) / ab.lengthSq() : 0;
      const tt = Math.max(0, Math.min(1, t));
      const closest = a.clone().add(ab.multiplyScalar(tt));
      candidates.push({ p: closest, kind: "axis" });
    }

    // Wall outline corners + edges (trimmed)
    for (const poly of wallSolvedOutlines.values()) {
      if (poly.length < 2) continue;
      for (const p of poly) candidates.push({ p: new THREE.Vector3(p.x, 0, p.z), kind: "corner" });
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const ax = a.x, az = a.z;
        const bx = b.x, bz = b.z;
        const vx = bx - ax;
        const vz = bz - az;
        const l2 = vx * vx + vz * vz;
        if (l2 < 1e-12) continue;
        const rx = raw.x - ax;
        const rz = raw.z - az;
        const t = Math.max(0, Math.min(1, (rx * vx + rz * vz) / l2));
        candidates.push({ p: new THREE.Vector3(ax + vx * t, 0, az + vz * t), kind: "edge" });
      }
    }

    // Module box corners
    for (const inst of instances) {
      const box = instanceWorldBox(inst);
      const y = 0;
      candidates.push({ p: new THREE.Vector3(box.min.x, y, box.min.z), kind: "corner" });
      candidates.push({ p: new THREE.Vector3(box.min.x, y, box.max.z), kind: "corner" });
      candidates.push({ p: new THREE.Vector3(box.max.x, y, box.min.z), kind: "corner" });
      candidates.push({ p: new THREE.Vector3(box.max.x, y, box.max.z), kind: "corner" });
    }

    // Chain start (to close loop)
    if (layoutTool === "wall" && wallDraw.chainStart) {
      candidates.push({ p: wallDraw.chainStart.clone(), kind: "endpoint" });
    }

    const rawS = worldToScreen(raw, camera, rect);
    let best: { p: THREE.Vector3; kind: "corner" | "edge" | "endpoint" | "axis"; d2: number } | null = null;
    for (const c of candidates) {
      const s = worldToScreen(c.p, camera, rect);
      const d = dist2(rawS, s);
      if (!best || d < best.d2) best = { p: c.p, kind: c.kind, d2: d };
    }

    if (!best) return { point: raw, kind: "none" };
    if (best.d2 > maxPx * maxPx) return { point: raw, kind: "none" };
    return { point: best.p.clone(), kind: best.kind as any };
  }

  function updateWallMesh(mesh: THREE.Mesh, a: THREE.Vector3 | null, b: THREE.Vector3 | null, thicknessMm: number) {
    const aa = a ?? new THREE.Vector3(0, 0, 0);
    const bb = b ?? aa.clone();
    const dx = bb.x - aa.x;
    const dz = bb.z - aa.z;
    const len = Math.max(0.001, Math.hypot(dx, dz));
    const midX = (aa.x + bb.x) / 2;
    const midZ = (aa.z + bb.z) / 2;
    const rotY = -Math.atan2(dz, dx);

    const thickM = Math.max(0.01, thicknessMm / 1000);
    const h = wallDefault.heightM;

    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(len, h, thickM);
    mesh.position.set(midX, h / 2, midZ);
    mesh.rotation.set(0, rotY, 0);
  }

  function rebuildWallPlanMesh() {
    const ids = new Set(walls.map((w) => w.id));
    for (const [id, mesh] of wallPlanMeshes) {
      if (ids.has(id)) continue;
      wallPlanGroup.remove(mesh);
      mesh.geometry.dispose();
      wallPlanMeshes.delete(id);
    }
    for (const m of wallJoinMeshes.splice(0, wallJoinMeshes.length)) {
      wallPlanGroup.remove(m);
      m.geometry.dispose();
    }
    if (wallPlanUnionMesh) {
      wallPlanGroup.remove(wallPlanUnionMesh);
      wallPlanUnionMesh.geometry.dispose();
      wallPlanUnionMesh = null;
    }

    if (walls.length === 0) return;

    const modelWalls = walls.map((w) => ({
      id: w.id,
      a: { x: w.params.aMm.x / 1000, z: w.params.aMm.z / 1000 },
      b: { x: w.params.bMm.x / 1000, z: w.params.bMm.z / 1000 },
      thicknessM: Math.max(0.001, w.params.thicknessMm / 1000),
      justification: ((w.params as any).justification ?? "center") as any,
      exteriorSign: ((w.params.exteriorSign ?? 1) as 1 | -1) ?? 1
    }));

    const solved = solveWallNetwork(modelWalls, { nodeTolM: wallJoinTolMm / 1000, miterLimit: 8 });
    wallSolvedOutlines.clear();

    const makePolyMesh = (poly: Array<{ x: number; z: number }>, y: number, name: string) => {
      if (poly.length < 3) return null;
      const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, p.z)));
      const geom = new THREE.ShapeGeometry(shape);
      geom.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(geom, wallPlanMat);
      mesh.name = name;
      mesh.position.y = y;
      return mesh;
    };

    // Always keep per-wall solved outlines for hit-testing/export/debug.
    for (const w of solved.walls) wallSolvedOutlines.set(w.id, w.outline);
    if (selectedKind === "wall" && selectedWallId) showWallSnapMarkersFor(selectedWallId);

    // Render as a single union polygon to automatically trim overlaps/spikes at joins (CAD-like).
    const toRing = (poly: Array<{ x: number; z: number }>) => {
      const ring: Array<[number, number]> = poly.map((p) => [p.x, p.z]);
      if (ring.length > 0) ring.push(ring[0]);
      // Ensure CCW winding
      let area = 0;
      for (let i = 0; i < ring.length - 1; i++) {
        const [x0, y0] = ring[i];
        const [x1, y1] = ring[i + 1];
        area += x0 * y1 - x1 * y0;
      }
      if (area < 0) ring.reverse();
      return ring;
    };

    const polys: any[] = [];
    for (const w of solved.walls) {
      if (w.outline.length < 3) continue;
      polys.push([[[toRing(w.outline)]]]);
    }
    for (const p of solved.joinPolys) {
      if (p.length < 3) continue;
      polys.push([[[toRing(p)]]]);
    }

    let merged: any = null;
    try {
      merged = (polygonClipping as any).union(...polys);
    } catch {
      merged = null;
    }

    if (merged && merged.length > 0) {
      const shapes: THREE.Shape[] = [];
      for (const poly of merged as any[]) {
        const rings = poly as any[];
        if (!rings || rings.length === 0) continue;
        const outer = rings[0] as Array<[number, number]>;
        if (!outer || outer.length < 3) continue;
        const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
        for (let i = 1; i < rings.length; i++) {
          const hole = rings[i] as Array<[number, number]>;
          if (!hole || hole.length < 3) continue;
          const path = new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y)));
          shape.holes.push(path);
        }
        shapes.push(shape);
      }

      if (shapes.length > 0) {
        const geom = new THREE.ShapeGeometry(shapes);
        geom.rotateX(Math.PI / 2);
        const mesh = new THREE.Mesh(geom, wallPlanMat);
        mesh.name = "wallPlanUnion";
        mesh.position.y = 0.02;
        wallPlanUnionMesh = mesh;
        wallPlanGroup.add(mesh);
      }
    }

    // Debug overlays
    wallDebugGroup.visible = wallDebugEnabled;
    if (wallDebugEnabled) {
      while (wallDebugGroup.children.length > 0) {
        const c = wallDebugGroup.children.pop()!;
        wallDebugGroup.remove(c);
        const any = c as any;
        if (any.geometry?.dispose) any.geometry.dispose();
        if (any.material?.dispose) any.material.dispose();
      }

      const mkLine = (pts: Array<{ x: number; z: number }>, color: number, y = 0.031) => {
        const g = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, y, p.z)));
        const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
        const l = new THREE.Line(g, m);
        wallDebugGroup.add(l);
      };

      // centerlines + outlines
      for (const w of modelWalls) {
        mkLine([w.a, w.b], 0xffd166, 0.031);
        const poly = wallSolvedOutlines.get(w.id);
        if (poly && poly.length >= 3) {
          mkLine([...poly, poly[0]], 0x5c8cff, 0.032);
        }
      }

      // node markers
      for (const n of solved.debug.nodes) {
        const g = new THREE.PlaneGeometry(0.04, 0.04);
        const m = new THREE.MeshBasicMaterial({ color: 0xff4dff, depthWrite: false });
        const p = new THREE.Mesh(g, m);
        p.rotation.x = -Math.PI / 2;
        p.position.set(n.p.x, 0.033, n.p.z);
        wallDebugGroup.add(p);
      }
    }

    updateAllDimensions();
  }

  function createWallMesh(a: THREE.Vector3, b: THREE.Vector3, thicknessMm: number) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xc6cbd6
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, wallDefault.heightM, thicknessMm / 1000), mat);
    updateWallMeshWithJustification(mesh, a, b, thicknessMm, wallDefault.justification, wallDefault.exteriorSign);
    return mesh;
  }

  function wallRefLineToCenterLine(
    refA: THREE.Vector3,
    refB: THREE.Vector3,
    thicknessMm: number,
    justification: "center" | "interior" | "exterior",
    exteriorSign: 1 | -1
  ) {
    if (justification === "center") return { a: refA.clone(), b: refB.clone() };
    const d = refB.clone().sub(refA);
    const len = d.length();
    if (len < 1e-8) return { a: refA.clone(), b: refB.clone() };
    d.multiplyScalar(1 / len);
    const n = new THREE.Vector3(-d.z, 0, d.x);
    const half = Math.max(10, thicknessMm) / 2000; // meters
    const s = exteriorSign;
    const offset =
      justification === "exterior"
        ? n.clone().multiplyScalar(-s * half)
        : n.clone().multiplyScalar(s * half); // interior
    return { a: refA.clone().add(offset), b: refB.clone().add(offset) };
  }

  function updateWallMeshWithJustification(
    mesh: THREE.Mesh,
    refA: THREE.Vector3 | null,
    refB: THREE.Vector3 | null,
    thicknessMm: number,
    justification: "center" | "interior" | "exterior",
    exteriorSign: 1 | -1
  ) {
    const a = refA ?? new THREE.Vector3(0, 0, 0);
    const b = refB ?? a.clone();
    const center = wallRefLineToCenterLine(a, b, thicknessMm, justification, exteriorSign);
    updateWallMesh(mesh, center.a, center.b, thicknessMm);
  }

  function makeWallPreviewMesh(a: THREE.Vector3, b: THREE.Vector3, thicknessMm: number) {
    const mesh = createWallMesh(a, b, thicknessMm);
    const m = mesh.material as THREE.MeshBasicMaterial;
    m.transparent = true;
    m.opacity = 0.5;
    return mesh;
  }

  function rebuildWall(w: WallInstance) {
    const refA = new THREE.Vector3(w.params.aMm.x / 1000, 0, w.params.aMm.z / 1000);
    const refB = new THREE.Vector3(w.params.bMm.x / 1000, 0, w.params.bMm.z / 1000);
    const just = w.params.justification ?? "center";
    const s = (w.params.exteriorSign ?? 1) as 1 | -1;
    const { a, b } = wallRefLineToCenterLine(refA, refB, w.params.thicknessMm, just, s);
    // Revit-like join rendering in 3D: extend ends to form miter-like corner joins.
    // This does not change stored axis endpoints (aMm/bMm); only the rendered mesh.
    const d = b.clone().sub(a);
    if (d.lengthSq() < 1e-8) {
      updateWallMesh(w.mesh, a, b, w.params.thicknessMm);
      return;
    }
    d.normalize();

    const aMmC = toMmPoint(a);
    const bMmC = toMmPoint(b);

    const dirOutCenter = (at: "a" | "b", aa: { x: number; z: number }, bb: { x: number; z: number }) =>
      at === "a" ? new THREE.Vector3(bb.x - aa.x, 0, bb.z - aa.z) : new THREE.Vector3(aa.x - bb.x, 0, aa.z - bb.z);

    const joinExtAt = (node: { x: number; z: number }, at: "a" | "b") => {
      const neighbors: Array<{ v: THREE.Vector3 }> = [];
      for (const other of walls) {
        if (other.id === w.id) continue;
        const oRefA = new THREE.Vector3(other.params.aMm.x / 1000, 0, other.params.aMm.z / 1000);
        const oRefB = new THREE.Vector3(other.params.bMm.x / 1000, 0, other.params.bMm.z / 1000);
        const oJust = other.params.justification ?? "center";
        const oS = (other.params.exteriorSign ?? 1) as 1 | -1;
        const oC = wallRefLineToCenterLine(oRefA, oRefB, other.params.thicknessMm, oJust, oS);
        const oa = toMmPoint(oC.a);
        const ob = toMmPoint(oC.b);
        const isA = mmDist(oa, node) <= wallJoinTolMm;
        const isB = mmDist(ob, node) <= wallJoinTolMm;
        if (!isA && !isB) continue;
        const v = dirOutCenter(isA && !isB ? "a" : "b", oa, ob);
        if (v.lengthSq() > 1e-6) neighbors.push({ v });
      }

      if (neighbors.length === 0) return 0;

      const v0 = dirOutCenter(at, aMmC, bMmC);
      if (v0.lengthSq() < 1e-6) return 0;
      v0.normalize();

      let bestTheta = Infinity;
      for (const n of neighbors) {
        const v1 = n.v.clone().normalize();
        const dot = Math.max(-1, Math.min(1, v0.dot(v1)));
        const theta = Math.acos(dot);
        if (theta < 0.2 || Math.abs(Math.PI - theta) < 0.2) continue;
        if (theta < bestTheta) bestTheta = theta;
      }
      if (!isFinite(bestTheta) || bestTheta === Infinity) return 0;

      const thickM = Math.max(0.01, w.params.thicknessMm / 1000);
      const tanHalf = Math.tan(bestTheta / 2);
      if (tanHalf < 1e-4) return 0;
      const ext = (thickM / 2) / tanHalf;
      return Math.min(1.2, Math.max(0, ext));
    };

    const extA = joinExtAt(aMmC, "a");
    const extB = joinExtAt(bMmC, "b");

    const aExt = a.clone().addScaledVector(d, -extA);
    const bExt = b.clone().addScaledVector(d, extB);
    updateWallMesh(w.mesh, aExt, bExt, w.params.thicknessMm);
  }

  function addWall(a: THREE.Vector3, b: THREE.Vector3, thicknessMm: number) {
    const id = `w${wallCounter++}`;
    const root = new THREE.Group();
    root.name = `wall_${id}`;

    const mesh = createWallMesh(a, b, thicknessMm);
    mesh.name = `wallMesh_${id}`;
    mesh.userData.kind = "wall";
    mesh.userData.wallId = id;
    root.add(mesh);

    const aMm = toMmPoint(a);
    const bMm = toMmPoint(b);
    const params: WallParams = {
      thicknessMm: Math.max(10, Math.round(thicknessMm)),
      materialId: wallDefault.materialId,
      justification: wallDefault.justification,
      exteriorSign: wallDefault.exteriorSign,
      aMm,
      bMm
    };

    const inst: WallInstance = { id, params, root, mesh };
    layoutRoot.add(root);
    walls.push(inst);
    rebuildWall(inst);
    rebuildWallPlanMesh();
    commitHistory();
    return inst;
  }

  const wallEps = 0.002;
  const wallDefs: Record<
    WallId,
    {
      plane: THREE.Plane;
      inwardNormal: THREE.Vector3;
      axis: "x" | "z";
      fixedPos: THREE.Vector3;
      axisHalf: number;
    }
  > = {
    back: {
      plane: new THREE.Plane().setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -roomBounds.halfD)
      ),
      inwardNormal: new THREE.Vector3(0, 0, 1),
      axis: "x",
      fixedPos: new THREE.Vector3(0, 0, -roomBounds.halfD + wallEps),
      axisHalf: roomBounds.halfW
    },
    left: {
      plane: new THREE.Plane().setFromNormalAndCoplanarPoint(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-roomBounds.halfW, 0, 0)
      ),
      inwardNormal: new THREE.Vector3(1, 0, 0),
      axis: "z",
      fixedPos: new THREE.Vector3(-roomBounds.halfW + wallEps, 0, 0),
      axisHalf: roomBounds.halfD
    },
    right: {
      plane: new THREE.Plane().setFromNormalAndCoplanarPoint(
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(roomBounds.halfW, 0, 0)
      ),
      inwardNormal: new THREE.Vector3(-1, 0, 0),
      axis: "z",
      fixedPos: new THREE.Vector3(roomBounds.halfW - wallEps, 0, 0),
      axisHalf: roomBounds.halfD
    }
  };

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const dragState = {
    active: false,
    id: null as string | null,
    offset: new THREE.Vector3(),
    lastValid: new THREE.Vector3()
  };

  const underlayDragState = {
    active: false,
    pointerId: null as number | null,
    startWorld: new THREE.Vector3(),
    startOffsetMm: { x: 0, z: 0 }
  };

  const dimensionDragState = {
    active: false,
    id: null as string | null,
    pointerId: null as number | null,
    startWorld: new THREE.Vector3(),
    startOffsetM: 0
  };

  const windowDragState = {
    active: false,
    wall: null as WallId | null,
    offsetMm: 0
  };

  const navClock = new THREE.Clock();
  const navKeys = new Set<string>();
  const isTypingTarget = (t: EventTarget | null) => {
    const el = t as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if ((el as any).isContentEditable) return true;
    return false;
  };

  const setToolSelect = () => {
    ensureLayoutMode();
    layoutTool = "select";
    clearToolHud();
    wallDraw.active = false;
    wallDraw.a = null;
    wallDraw.chainStart = null;
    wallDraw.segments = 0;
    if (wallDraw.preview) {
      layoutRoot.remove(wallDraw.preview);
      wallDraw.preview.geometry.dispose();
      (wallDraw.preview.material as THREE.Material).dispose();
      wallDraw.preview = null;
    }
    wallSnapHud.style.display = "none";
    setUnderlayStatus("");
    mountProps();
  };

  const setToolWall = () => {
    ensureLayoutMode();
    layoutTool = "wall";
    clearToolHud();
    wallDraw.active = false;
    wallDraw.a = null;
    if (wallDraw.preview) {
      layoutRoot.remove(wallDraw.preview);
      wallDraw.preview.geometry.dispose();
      (wallDraw.preview.material as THREE.Material).dispose();
      wallDraw.preview = null;
    }
    wallDraw.chainStart = null;
    wallDraw.segments = 0;
    if (viewMode !== "2d") {
      view2d.checked = true;
      setView2d(true);
    } else {
      view2d.checked = true;
    }
    selectedKind = null;
    selectedWallId = null;
    setInstanceSelected(null);
    if (selectedWallBox) {
      scene.remove(selectedWallBox);
      selectedWallBox.geometry.dispose();
      (selectedWallBox.material as THREE.Material).dispose();
      selectedWallBox = null;
    }
    mountProps();
  };

  const setToolAlign = () => {
    ensureLayoutMode();
    layoutTool = "align";
    clearToolHud();
    wallDraw.active = false;
    wallDraw.a = null;
    wallDraw.chainStart = null;
    wallDraw.segments = 0;
    wallDraw.hoverB = null;
    wallDraw.typedMm = "";
    wallTypedHud.style.display = "none";
    wallSnapHud.style.display = "none";
    if (wallDraw.preview) {
      layoutRoot.remove(wallDraw.preview);
      wallDraw.preview.geometry.dispose();
      (wallDraw.preview.material as THREE.Material).dispose();
      wallDraw.preview = null;
    }
    alignState.ref = null;
    alignState.hover = null;
    alignState.lastA = null;
    alignState.lastB = null;
    alignState.lastUntilMs = 0;
    if (viewMode !== "2d") {
      view2d.checked = true;
      setView2d(true);
    } else {
      view2d.checked = true;
    }
    setUnderlayStatus("Align: click reference line...");
    mountProps();
  };

  const setToolTrim = () => {
    ensureLayoutMode();
    layoutTool = "trim";
    clearToolHud();
    wallDraw.active = false;
    wallDraw.a = null;
    wallDraw.chainStart = null;
    wallDraw.segments = 0;
    wallDraw.hoverB = null;
    wallDraw.typedMm = "";
    wallTypedHud.style.display = "none";
    wallSnapHud.style.display = "none";
    if (wallDraw.preview) {
      layoutRoot.remove(wallDraw.preview);
      wallDraw.preview.geometry.dispose();
      (wallDraw.preview.material as THREE.Material).dispose();
      wallDraw.preview = null;
    }
    trimState.step = "pickTarget";
    trimState.targetWallId = null;
    trimState.targetPick = null;
    trimState.targetClick = null;
    trimState.hover = null;
    trimState.lastTarget = null;
    trimState.lastCutter = null;
    trimState.lastUntilMs = 0;
    if (viewMode !== "2d") {
      view2d.checked = true;
      setView2d(true);
    } else {
      view2d.checked = true;
    }
    setUnderlayStatus("Trim: click target wall...");
    mountProps();
  };

  const setToolDimension = () => {
    ensureLayoutMode();
    layoutTool = "dimension";
    clearToolHud();
    wallDraw.active = false;
    wallDraw.a = null;
    wallDraw.chainStart = null;
    wallDraw.segments = 0;
    wallDraw.hoverB = null;
    wallDraw.typedMm = "";
    wallTypedHud.style.display = "none";
    wallSnapHud.style.display = "none";
    if (wallDraw.preview) {
      layoutRoot.remove(wallDraw.preview);
      wallDraw.preview.geometry.dispose();
      (wallDraw.preview.material as THREE.Material).dispose();
      wallDraw.preview = null;
    }
    dimTool.a = null;
    dimTool.tA = 0.5;
    dimTool.hover = null;
    dimTool.offsetM = 0.2;
    dimPreview.root.visible = false;
    if (viewMode !== "2d") {
      view2d.checked = true;
      setView2d(true);
    } else {
      view2d.checked = true;
    }
    setUnderlayStatus("Dimension: click first line...");
    mountProps();
  };

  window.addEventListener("keydown", (ev) => {
    if (isTypingTarget(ev.target)) return;

    if (mode === "layout") {
      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey) {
        const k = ev.key;
        if (k === "z" || k === "Z") {
          if (ev.shiftKey) redo();
          else undo();
          ev.preventDefault();
          return;
        }
        if (k === "y" || k === "Y") {
          redo();
          ev.preventDefault();
          return;
        }
      }

      if (transformState.kind) {
        if (ev.key === "Escape") {
          clearTransform({ restore: true, status: "Canceled." });
          ev.preventDefault();
          return;
        }

        if (transformState.kind === "rotate" && transformState.step === "rotating") {
          const isDigit = ev.key.length === 1 && ev.key >= "0" && ev.key <= "9";
          if (isDigit) {
            transformState.typed = `${transformState.typed}${ev.key}`.slice(0, 6);
            setUnderlayStatus(`Rotate: ${transformState.typed}° (Enter)`);
            ev.preventDefault();
            return;
          }
          if (ev.key === "Backspace") {
            transformState.typed = transformState.typed.slice(0, -1);
            setUnderlayStatus(transformState.typed.length ? `Rotate: ${transformState.typed}° (Enter)` : "Rotate: move mouse to set direction, or type degrees + Enter.");
            ev.preventDefault();
            return;
          }
          if (ev.key === "Enter" && transformState.typed.trim().length > 0) {
            const n = Number(transformState.typed.trim().replace(",", "."));
            if (Number.isFinite(n) && n !== 0) {
              const sign = transformState.lastAngleSign || 1;
              const ang = (Math.abs(n) * Math.PI) / 180 * sign;
              applyRotateAngle(ang);
              setUnderlayStatus(`Rotate: ${sign < 0 ? "CW" : "CCW"} ${Math.abs(Math.round(n))}° (click to finish)`);
            }
            transformState.typed = "";
            ev.preventDefault();
            return;
          }
        }
      }

      const nudgeStepM = () => {
        if (viewMode !== "2d") return 0;
        const c = cam();
        if (!(c instanceof THREE.OrthographicCamera)) return 0;
        const visibleW = Math.abs(c.right - c.left) / Math.max(1e-6, c.zoom);
        const visibleH = Math.abs(c.top - c.bottom) / Math.max(1e-6, c.zoom);
        const visible = Math.min(visibleW, visibleH);
        if (visible >= 20) return 1;
        if (visible >= 12) return 0.5;
        if (visible >= 7) return 0.25;
        if (visible >= 4) return 0.1;
        if (visible >= 2) return 0.05;
        return 0.01;
      };

      const nudgeSelection = (dxM: number, dzM: number) => {
        if (viewMode !== "2d" || layoutTool !== "select") return false;
        if (measureState.enabled) return false;
        if (dragState.active || windowDragState.active || wallEditHud.drag || marquee.active) return false;
        if (underlayCal.active) return false;

        const dxMm = Math.round(dxM * 1000);
        const dzMm = Math.round(dzM * 1000);

        let moved = false;

        // Walls (single or multi)
        const wallIds = selectedWallIds.size > 0 ? Array.from(selectedWallIds) : selectedKind === "wall" && selectedWallId ? [selectedWallId] : [];
        if (wallIds.length > 0) {
          const touched = new Set<string>();
          const movedEnds = new Set<string>();
          const moveEnd = (w: WallInstance, which: "a" | "b") => {
            const k = `${w.id}:${which}`;
            if (movedEnds.has(k)) return;
            if (pinnedWallIds.has(w.id)) return;
            if (which === "a") w.params.aMm = { x: w.params.aMm.x + dxMm, z: w.params.aMm.z + dzMm };
            else w.params.bMm = { x: w.params.bMm.x + dxMm, z: w.params.bMm.z + dzMm };
            movedEnds.add(k);
            touched.add(w.id);
          };

          for (const id of wallIds) {
            const w = walls.find((x) => x.id === id) ?? null;
            if (!w) continue;
            if (pinnedWallIds.has(w.id)) continue;

            const oldA = { x: w.params.aMm.x, z: w.params.aMm.z };
            const oldB = { x: w.params.bMm.x, z: w.params.bMm.z };

            // Move selected wall (translate both endpoints)
            moveEnd(w, "a");
            moveEnd(w, "b");

            // Propagate corner moves: any wall endpoint connected to oldA/oldB follows.
            for (const other of walls) {
              if (other.id === w.id) continue;
              if (pinnedWallIds.has(other.id)) continue;
              const wa = wallEndpointWhich(other, oldA, wallJoinTolMm);
              if (wa) moveEnd(other, wa);
              const wb = wallEndpointWhich(other, oldB, wallJoinTolMm);
              if (wb) moveEnd(other, wb);
            }
          }

          for (const id of touched) {
            const w = walls.find((x) => x.id === id) ?? null;
            if (w) rebuildWall(w);
          }
          if (touched.size > 0) {
            rebuildWallPlanMesh();
            moved = true;
          }
        }

        // Modules (single or multi)
        const instIds =
          selectedInstanceIds.size > 0
            ? Array.from(selectedInstanceIds)
            : selectedKind === "module" && selectedInstanceId
              ? [selectedInstanceId]
              : [];
        if (instIds.length > 0) {
          for (const id of instIds) {
            const inst = findInstance(id);
            if (!inst) continue;
            const prev = inst.root.position.clone();
            const desired = new THREE.Vector3(inst.root.position.x + dxMm / 1000, 0, inst.root.position.z + dzMm / 1000);
            const desiredInRoom = applyWallConstraints(inst, desired);
            inst.root.position.copy(desiredInRoom);
            if (anyOverlap(inst, null)) {
              inst.root.position.copy(prev);
            } else {
              autoOrientModuleToRoomWallIfSnapped(inst);
              moved = true;
            }
          }
          if (moved) updateLayoutPanel();
        }

        if (moved) {
          mountProps();
          commitHistory();
        }
        return moved;
      };

      if (ev.key.startsWith("Arrow")) {
        const step = nudgeStepM();
        if (step > 0) {
          let dx = 0;
          let dz = 0;
          if (ev.key === "ArrowLeft") dx = -step;
          if (ev.key === "ArrowRight") dx = step;
          if (ev.key === "ArrowUp") dz = -step;
          if (ev.key === "ArrowDown") dz = step;
          if (dx !== 0 || dz !== 0) {
            const moved = nudgeSelection(dx, dz);
            if (moved) {
              ev.preventDefault();
              return;
            }
          }
        }
      }

      if ((ev.key === "m" || ev.key === "M") && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        if (startTransformFromSelection("move")) {
          ev.preventDefault();
          return;
        }
      }

      if ((ev.key === "r" || ev.key === "R") && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        if (startTransformFromSelection("rotate")) {
          ev.preventDefault();
          return;
        }
      }

      if ((ev.key === "w" || ev.key === "W") && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        setToolWall();
        ev.preventDefault();
        return;
      }
      if ((ev.key === "a" || ev.key === "A") && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        setToolAlign();
        ev.preventDefault();
        return;
      }
      if ((ev.key === "t" || ev.key === "T") && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        setToolTrim();
        ev.preventDefault();
        return;
      }
      if ((ev.key === "d" || ev.key === "D") && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        setToolDimension();
        ev.preventDefault();
        return;
      }
      if (ev.key === " " || ev.code === "Space") {
        // Mirror wall side (Revit-like): works while drawing + when wall is selected.
        if (layoutTool === "wall") {
          wallDefault.exteriorSign = wallDefault.exteriorSign === 1 ? -1 : 1;
          setUnderlayStatus(`Wall: exterior ${wallDefault.exteriorSign === 1 ? "left" : "right"} of A->B.`);
          if (wallDraw.preview && wallDraw.a) {
            updateWallMeshWithJustification(
              wallDraw.preview,
              wallDraw.a,
              wallDraw.hoverB ?? wallDraw.a,
              wallDefault.thicknessMm,
              wallDefault.justification,
              wallDefault.exteriorSign
            );
          }
          mountProps();
          ev.preventDefault();
          return;
        }

        if (selectedKind === "wall" && selectedWallId) {
          const w = walls.find((x) => x.id === selectedWallId) ?? null;
          if (w) {
            w.params.exteriorSign = (w.params.exteriorSign ?? 1) === 1 ? -1 : 1;
            for (const ww of walls) rebuildWall(ww);
            rebuildWallPlanMesh();
            mountProps();
          }
          ev.preventDefault();
          return;
        }

        setToolSelect();
        ev.preventDefault();
        return;
      }

      if (ev.key === "Escape" && layoutTool === "align") {
        if (alignState.ref) {
          alignState.ref = null;
          setUnderlayStatus("Align: canceled. Click reference line...");
        } else {
          setToolSelect();
        }
        ev.preventDefault();
        return;
      }

      if (ev.key === "Escape" && layoutTool === "trim") {
        if (trimState.step !== "pickTarget") {
          trimState.step = "pickTarget";
          trimState.targetWallId = null;
          trimState.targetPick = null;
          trimState.targetClick = null;
          trimState.hover = null;
          trimState.lastTarget = null;
          trimState.lastCutter = null;
          trimState.lastUntilMs = 0;
          clearToolHud();
          setUnderlayStatus("Trim: click target wall...");
          mountProps();
        } else {
          setToolSelect();
        }
        ev.preventDefault();
        return;
      }

      if (ev.key === "Escape" && layoutTool === "dimension") {
        if (dimTool.a) {
          dimTool.a = null;
          dimPreview.root.visible = false;
          setUnderlayStatus("Dimension: canceled. Click first line...");
        } else {
          setToolSelect();
        }
        ev.preventDefault();
        return;
      }

      if (ev.key === "Escape" && layoutTool === "wall") {
        wallDraw.active = false;
        wallDraw.a = null;
        wallDraw.chainStart = null;
        wallDraw.segments = 0;
        wallDraw.hoverB = null;
        wallDraw.typedMm = "";
        if (wallDraw.preview) {
          layoutRoot.remove(wallDraw.preview);
          wallDraw.preview.geometry.dispose();
          (wallDraw.preview.material as THREE.Material).dispose();
          wallDraw.preview = null;
        }
        wallSnapHud.style.display = "none";
        wallTypedHud.style.display = "none";
        setUnderlayStatus("Wall: stopped.");
        layoutTool = "select";
        mountProps();
        ev.preventDefault();
        return;
      }

      // Typed length while placing wall segment (Revit-style).
      if (layoutTool === "wall" && wallDraw.active && wallDraw.a && viewMode === "2d") {
        const isDigit = ev.key.length === 1 && ev.key >= "0" && ev.key <= "9";
        if (isDigit) {
          wallDraw.typedMm = `${wallDraw.typedMm}${ev.key}`.slice(0, 8);
          wallTypedHud.textContent = `${wallDraw.typedMm} mm`;
          wallTypedHud.style.left = `${wallDraw.lastPointerPx.x}px`;
          wallTypedHud.style.top = `${wallDraw.lastPointerPx.y}px`;
          wallTypedHud.style.display = "block";
          setUnderlayStatus(`Wall: ${wallDraw.typedMm} mm (Enter = place, Backspace = edit)`);
          ev.preventDefault();
          return;
        }
        if (ev.key === "Backspace") {
          wallDraw.typedMm = wallDraw.typedMm.slice(0, Math.max(0, wallDraw.typedMm.length - 1));
          if (wallDraw.typedMm.trim().length > 0) {
            wallTypedHud.textContent = `${wallDraw.typedMm} mm`;
            wallTypedHud.style.left = `${wallDraw.lastPointerPx.x}px`;
            wallTypedHud.style.top = `${wallDraw.lastPointerPx.y}px`;
            wallTypedHud.style.display = "block";
            setUnderlayStatus(`Wall: ${wallDraw.typedMm} mm (Enter = place, Backspace = edit)`);
          } else {
            wallTypedHud.style.display = "none";
            setUnderlayStatus("Wall: druhý bod... (píš mm + Enter, Shift = bez axis snap, Esc = stop)");
          }
          ev.preventDefault();
          return;
        }
        if (ev.key === "Enter" && wallDraw.typedMm.trim().length > 0) {
          const mm = Math.max(1, Math.round(Number(wallDraw.typedMm)));
          if (Number.isFinite(mm) && wallDraw.a) {
            const a = wallDraw.a.clone();
            const hb = wallDraw.hoverB ? wallDraw.hoverB.clone() : a.clone().add(new THREE.Vector3(1, 0, 0));
            const dir = hb.clone().sub(a);
            if (dir.lengthSq() < 1e-8) dir.set(1, 0, 0);
            dir.normalize();
            const end = a.clone().addScaledVector(dir, mm / 1000);

            const bMm = { x: Math.round(end.x * 1000), z: Math.round(end.z * 1000) };
            const bExact = new THREE.Vector3(bMm.x / 1000, 0, bMm.z / 1000);

            // close loop when near chain start
            const closeTolM = 0.03;
            const cs = wallDraw.chainStart;
            const closes =
              !!cs && wallDraw.segments >= 2 && Math.hypot(bExact.x - cs.x, bExact.z - cs.z) <= closeTolM;
            const finalEnd = closes && cs ? cs.clone() : bExact;

            const w = addWall(a, finalEnd, wallDefault.thicknessMm);
            autoJoinAtMmPoint(w.params.aMm);
            autoJoinAtMmPoint(w.params.bMm);
            wallDraw.segments += 1;

            wallDraw.typedMm = "";
            wallTypedHud.style.display = "none";

            if (closes) {
              wallDraw.active = false;
              wallDraw.a = null;
              wallDraw.chainStart = null;
              wallDraw.segments = 0;
              wallDraw.hoverB = null;
              if (wallDraw.preview) {
                layoutRoot.remove(wallDraw.preview);
                wallDraw.preview.geometry.dispose();
                (wallDraw.preview.material as THREE.Material).dispose();
                wallDraw.preview = null;
              }
              setUnderlayStatus("Wall: chain closed.");
              ev.preventDefault();
              return;
            }

            wallDraw.active = true;
            wallDraw.a = new THREE.Vector3(w.params.bMm.x / 1000, 0, w.params.bMm.z / 1000);
            wallDraw.hoverB = wallDraw.a.clone();
        updateWallMeshWithJustification(
          wallDraw.preview!,
          wallDraw.a,
          wallDraw.a,
          wallDefault.thicknessMm,
          wallDefault.justification,
          wallDefault.exteriorSign
        );
            setUnderlayStatus("Wall: ďalší bod... (píš mm + Enter, Shift = bez axis snap, Esc = stop)");
            selectedKind = "wall";
            selectedWallId = w.id;
            mountProps();
            ev.preventDefault();
            return;
          }
        }
      }

      if (ev.key === "Delete" || ev.key === "Backspace") {
        if (selectedKind === "dimension" && selectedDimensionId) {
          deleteDimension(selectedDimensionId);
          ev.preventDefault();
          return;
        }
        if (selectedInstanceIds.size > 0) {
          const ids = Array.from(selectedInstanceIds);
          for (const id of ids) deleteInstance(id);
          setSelectedModule(null);
          selectedInstanceIds.clear();
          commitHistory();
          ev.preventDefault();
          return;
        }
        if (selectedWallIds.size > 0) {
          const ids = Array.from(selectedWallIds);
          for (const id of ids) deleteWall(id);
          setSelectedWall(null);
          selectedWallIds.clear();
          ev.preventDefault();
          return;
        }
      }
    }

    const code = ev.code;
    if (
      code !== "KeyW" &&
      code !== "KeyA" &&
      code !== "KeyS" &&
      code !== "KeyD" &&
      code !== "KeyQ" &&
      code !== "KeyE" &&
      code !== "ShiftLeft" &&
      code !== "ShiftRight" &&
      code !== "Space"
    )
      return;
    navKeys.add(code);
    if (code === "Space") ev.preventDefault();
  });

  window.addEventListener("keyup", (ev) => {
    navKeys.delete(ev.code);
  });

  window.addEventListener("blur", () => {
    navKeys.clear();
  });

  args.viewerEl.addEventListener("pointerleave", () => {
    wallSnapHud.style.display = "none";
  });

  let selectedMesh: THREE.Mesh | null = null;
  let selectedBox: THREE.BoxHelper | null = null;
  let grainArrow: THREE.ArrowHelper | null = null;

  let overlapBoxes: Array<{ mesh: THREE.Mesh; helper: THREE.BoxHelper }> = [];

  // Measurement (planar XZ, axis-locked by default)
  const measureOverlay = document.createElement("div");
  measureOverlay.style.position = "absolute";
  measureOverlay.style.inset = "0";
  measureOverlay.style.pointerEvents = "none";
  args.viewerEl.appendChild(measureOverlay);

  const wallSnapHud = document.createElement("div");
  wallSnapHud.style.position = "absolute";
  wallSnapHud.style.width = "10px";
  wallSnapHud.style.height = "10px";
  wallSnapHud.style.border = "2px solid #e6e8ee";
  wallSnapHud.style.background = "transparent";
  wallSnapHud.style.transform = "translate(-50%, -50%)";
  wallSnapHud.style.display = "none";
  wallSnapHud.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.45)";
  measureOverlay.appendChild(wallSnapHud);

  // Typed-length HUD while drawing walls (shows the number near cursor).
  const wallTypedHud = document.createElement("div");
  wallTypedHud.style.position = "absolute";
  wallTypedHud.style.transform = "translate(10px, -28px)";
  wallTypedHud.style.display = "none";
  wallTypedHud.style.pointerEvents = "none";
  wallTypedHud.style.padding = "2px 6px";
  wallTypedHud.style.borderRadius = "8px";
  wallTypedHud.style.border = "1px solid rgba(36, 40, 54, 0.95)";
  wallTypedHud.style.background = "rgba(18, 20, 26, 0.92)";
  wallTypedHud.style.color = "rgba(230, 232, 238, 0.98)";
  wallTypedHud.style.fontSize = "12px";
  wallTypedHud.style.lineHeight = "18px";
  wallTypedHud.style.whiteSpace = "nowrap";
  measureOverlay.appendChild(wallTypedHud);

  // Wall edit HUD (2D): endpoints + dimension label
  const wallEditHud = {
    root: document.createElement("div"),
    label: document.createElement("div"),
    input: document.createElement("input"),
    lenLine: document.createElement("div"),
    lenExtA: document.createElement("div"),
    lenExtB: document.createElement("div"),
    offsetLabel: document.createElement("div"),
    offsetInput: document.createElement("input"),
    offsetLine: document.createElement("div"),
    offsetTickA: document.createElement("div"),
    offsetTickB: document.createElement("div"),
    handleA: document.createElement("div"),
    handleB: document.createElement("div"),
    handleMid: document.createElement("div"),
    offsetRefWallId: null as string | null,
    drag: null as
      | null
      | {
          wallId: string;
          kind: "a" | "b" | "move";
          pointerId: number;
          startWorld: THREE.Vector3;
          startA: { x: number; z: number };
          startB: { x: number; z: number };
          connectedA: Array<{ wallId: string; which: "a" | "b" }>;
          connectedB: Array<{ wallId: string; which: "a" | "b" }>;
        }
  };
  {
    const root = wallEditHud.root;
    root.style.position = "absolute";
    root.style.inset = "0";
    root.style.pointerEvents = "none";
    root.style.zIndex = "9";
    args.viewerEl.appendChild(root);

    const lineBase = (el: HTMLDivElement, color = "rgba(92, 140, 255, 0.95)") => {
      el.style.position = "absolute";
      el.style.height = "1px";
      el.style.background = color;
      el.style.transformOrigin = "0 0";
      el.style.display = "none";
      el.style.pointerEvents = "none";
    };
    lineBase(wallEditHud.lenLine, "rgba(92, 140, 255, 0.95)");
    lineBase(wallEditHud.lenExtA, "rgba(92, 140, 255, 0.85)");
    lineBase(wallEditHud.lenExtB, "rgba(92, 140, 255, 0.85)");
    root.appendChild(wallEditHud.lenLine);
    root.appendChild(wallEditHud.lenExtA);
    root.appendChild(wallEditHud.lenExtB);

    lineBase(wallEditHud.offsetLine, "rgba(92, 140, 255, 0.95)");
    lineBase(wallEditHud.offsetTickA, "rgba(92, 140, 255, 0.95)");
    lineBase(wallEditHud.offsetTickB, "rgba(92, 140, 255, 0.95)");
    root.appendChild(wallEditHud.offsetLine);
    root.appendChild(wallEditHud.offsetTickA);
    root.appendChild(wallEditHud.offsetTickB);

    const handleBase = (el: HTMLDivElement) => {
      el.style.position = "absolute";
      el.style.width = "10px";
      el.style.height = "10px";
      el.style.borderRadius = "999px";
      el.style.border = "2px solid rgba(230, 232, 238, 0.95)";
      el.style.background = "rgba(12, 14, 18, 0.35)";
      el.style.transform = "translate(-50%, -50%)";
      el.style.display = "none";
      el.style.pointerEvents = "auto";
      el.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.45)";
    };

    handleBase(wallEditHud.handleA);
    wallEditHud.handleA.title = "Wall start";
    root.appendChild(wallEditHud.handleA);

    handleBase(wallEditHud.handleB);
    wallEditHud.handleB.title = "Wall end";
    root.appendChild(wallEditHud.handleB);

    const mid = wallEditHud.handleMid;
    mid.style.position = "absolute";
    mid.style.width = "10px";
    mid.style.height = "10px";
    mid.style.borderRadius = "6px";
    mid.style.border = "2px solid rgba(61, 220, 151, 0.95)";
    mid.style.background = "rgba(12, 14, 18, 0.35)";
    mid.style.transform = "translate(-50%, -50%)";
    mid.style.display = "none";
    mid.style.pointerEvents = "auto";
    mid.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.45)";
    mid.title = "Move wall";
    root.appendChild(mid);

    const label = wallEditHud.label;
    label.style.position = "absolute";
    label.style.transform = "translate(-50%, -50%)";
    label.style.display = "none";
    label.style.pointerEvents = "auto";
    label.style.cursor = "pointer";
    label.style.padding = "2px 6px";
    label.style.borderRadius = "8px";
    label.style.border = "1px solid rgba(36, 40, 54, 0.95)";
    label.style.background = "rgba(18, 20, 26, 0.92)";
    label.style.color = "rgba(230, 232, 238, 0.98)";
    label.style.fontSize = "12px";
    label.style.lineHeight = "18px";
    label.style.userSelect = "none";
    label.style.whiteSpace = "nowrap";
    root.appendChild(label);

    const input = wallEditHud.input;
    input.type = "text";
    input.inputMode = "numeric";
    input.placeholder = "mm";
    input.style.position = "absolute";
    input.style.display = "none";
    input.style.pointerEvents = "auto";
    input.style.zIndex = "12";
    input.style.width = "88px";
    input.style.height = "22px";
    input.style.borderRadius = "7px";
    input.style.border = "1px solid rgba(36, 40, 54, 0.95)";
    input.style.background = "#0f1117";
    input.style.color = "var(--text)";
    input.style.padding = "0 6px";
    input.style.fontSize = "12px";
    input.style.outline = "none";
    root.appendChild(input);

    const oLabel = wallEditHud.offsetLabel;
    oLabel.style.position = "absolute";
    oLabel.style.transform = "translate(-50%, -50%)";
    oLabel.style.display = "none";
    oLabel.style.pointerEvents = "auto";
    oLabel.style.cursor = "pointer";
    oLabel.style.padding = "2px 6px";
    oLabel.style.borderRadius = "8px";
    oLabel.style.border = "1px solid rgba(36, 40, 54, 0.95)";
    oLabel.style.background = "rgba(18, 20, 26, 0.92)";
    oLabel.style.color = "rgba(230, 232, 238, 0.98)";
    oLabel.style.fontSize = "12px";
    oLabel.style.lineHeight = "18px";
    oLabel.style.userSelect = "none";
    oLabel.style.whiteSpace = "nowrap";
    root.appendChild(oLabel);

    const oInput = wallEditHud.offsetInput;
    oInput.type = "text";
    oInput.inputMode = "numeric";
    oInput.placeholder = "mm";
    oInput.style.position = "absolute";
    oInput.style.display = "none";
    oInput.style.pointerEvents = "auto";
    oInput.style.zIndex = "12";
    oInput.style.width = "88px";
    oInput.style.height = "22px";
    oInput.style.borderRadius = "7px";
    oInput.style.border = "1px solid rgba(36, 40, 54, 0.95)";
    oInput.style.background = "#0f1117";
    oInput.style.color = "var(--text)";
    oInput.style.padding = "0 6px";
    oInput.style.fontSize = "12px";
    oInput.style.outline = "none";
    root.appendChild(oInput);
  }

  const marquee = {
    active: false,
    pending: false,
    pointerId: null as number | null,
    hitSomething: false,
    startX: 0,
    startY: 0,
    mode: "contain" as "contain" | "touch"
  };
  const marqueeEl = document.createElement("div");
  marqueeEl.style.position = "absolute";
  marqueeEl.style.border = "1px solid rgba(255, 209, 102, 0.95)";
  marqueeEl.style.background = "rgba(255, 209, 102, 0.08)";
  marqueeEl.style.display = "none";
  marqueeEl.style.pointerEvents = "none";
  measureOverlay.appendChild(marqueeEl);

  const measureState = {
    enabled: false,
    axisLock: true,
    firstPoint: null as THREE.Vector3 | null,
    hoverPoint: null as THREE.Vector3 | null,
    hoverSnap: "none" as "none" | "free" | "edge" | "corner",
    previewLine: null as THREE.Line | null,
    previewLabel: null as HTMLDivElement | null,
    cursorEl: null as HTMLDivElement | null,
    measures: [] as Array<{
      a: THREE.Vector3;
      b: THREE.Vector3;
      line: THREE.Line;
      label: HTMLDivElement;
    }>
  };

  // Cursor HUD for measurement (shows snap state)
  {
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.width = "10px";
    el.style.height = "10px";
    el.style.borderRadius = "999px";
    el.style.border = "2px solid #00e5ff";
    el.style.background = "transparent";
    el.style.transform = "translate(-50%, -50%)";
    el.style.display = "none";
    el.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.4)";
    measureOverlay.appendChild(el);
    measureState.cursorEl = el;
  }

  args.axisLockEl.addEventListener("change", () => {
    measureState.axisLock = args.axisLockEl.checked;
  });

  args.measureBtn.addEventListener("click", () => {
    measureState.enabled = !measureState.enabled;
    measureState.firstPoint = null;
    measureState.hoverPoint = null;
    measureState.hoverSnap = "none";
    args.measureBtn.textContent = measureState.enabled ? "Measure: On" : "Measure: Off";
    args.measureReadoutEl.textContent = measureState.enabled ? "Click 2 points to measure (planar X/Z)." : "";

    if (!measureState.enabled) {
      clearPreview();
      if (measureState.cursorEl) measureState.cursorEl.style.display = "none";
    }
  });

  args.clearMeasuresBtn.addEventListener("click", () => {
    for (const m of measureState.measures) {
      scene.remove(m.line);
      m.line.geometry.dispose();
      (m.line.material as THREE.Material).dispose();
      m.label.remove();
    }
    measureState.measures = [];
    measureState.firstPoint = null;
    clearPreview();
    args.measureReadoutEl.textContent = measureState.enabled ? "Click 2 points to measure (planar X/Z)." : "";
  });

  // Editor UI
  args.formEl.innerHTML = "";

  const modeWrap = document.createElement("div");
  modeWrap.className = "field";

  const modeLabel = document.createElement("label");
  modeLabel.textContent = "Mode";
  modeLabel.htmlFor = "appMode";

  const modeSelect = document.createElement("select");
  modeSelect.id = "appMode";
  modeSelect.style.width = "120px";
  modeSelect.style.height = "36px";
  modeSelect.style.borderRadius = "10px";
  modeSelect.style.border = "1px solid var(--border)";
  modeSelect.style.background = "#0f1117";
  modeSelect.style.color = "var(--text)";
  modeSelect.innerHTML = `
    <option value="build">build</option>
    <option value="layout">layout</option>
  `;

  modeWrap.appendChild(modeLabel);
  modeWrap.appendChild(modeSelect);
  args.formEl.appendChild(modeWrap);

  const buildUi = document.createElement("div");
  const layoutUi = document.createElement("div");
  layoutUi.style.display = "none";
  args.formEl.appendChild(buildUi);
  args.formEl.appendChild(layoutUi);

  // Build UI: model switcher + model-specific controls
  const modelWrap = document.createElement("div");
  modelWrap.className = "field";

  const modelLabel = document.createElement("label");
  modelLabel.textContent = "Model";
  modelLabel.htmlFor = "modelType";

  const modelSelect = document.createElement("select");
  modelSelect.id = "modelType";
  modelSelect.style.width = "120px";
  modelSelect.style.height = "36px";
  modelSelect.style.borderRadius = "10px";
  modelSelect.style.border = "1px solid var(--border)";
  modelSelect.style.background = "#0f1117";
  modelSelect.style.color = "var(--text)";

  modelSelect.innerHTML = `
      <option value="drawer_low">drawer_low</option>
      <option value="nested_drawer_low">nested_drawer_low</option>
      <option value="fridge_tall">fridge_tall</option>
      <option value="shelves">shelves</option>
      <option value="corner_shelf_lower">corner_shelf_lower</option>
      <option value="flap_shelves_low">flap_shelves_low</option>
      <option value="swing_shelves_low">swing_shelves_low</option>
      <option value="oven_base_low">oven_base_low</option>
      <option value="microwave_oven_tall">microwave_oven_tall</option>
      <option value="top_drawers_doors_low">top_drawers_doors_low</option>
    `;

  modelWrap.appendChild(modelLabel);
  modelWrap.appendChild(modelSelect);
  buildUi.appendChild(modelWrap);

  const editorHost = document.createElement("div");
  buildUi.appendChild(editorHost);

  // Layout UI: add/duplicate/delete + 2D toggle + selected params
  const addWrap = document.createElement("div");
  addWrap.className = "actions";
  addWrap.style.gridTemplateColumns = "1fr 1fr";
  const addDrawerBtn = document.createElement("button");
  addDrawerBtn.type = "button";
  addDrawerBtn.textContent = "Add drawer";
  const addNestedDrawerBtn = document.createElement("button");
  addNestedDrawerBtn.type = "button";
  addNestedDrawerBtn.textContent = "Add nested drawer";
  const addFridgeBtn = document.createElement("button");
  addFridgeBtn.type = "button";
  addFridgeBtn.textContent = "Add fridge";
  const addShelvesBtn = document.createElement("button");
  addShelvesBtn.type = "button";
  addShelvesBtn.textContent = "Add shelves";
  const addCornerBtn = document.createElement("button");
  addCornerBtn.type = "button";
  addCornerBtn.textContent = "Add corner";
  const addFlapBtn = document.createElement("button");
  addFlapBtn.type = "button";
  addFlapBtn.textContent = "Add flap shelves";
  const addSwingBtn = document.createElement("button");
  addSwingBtn.type = "button";
  addSwingBtn.textContent = "Add swing shelves";
  const addOvenBaseBtn = document.createElement("button");
  addOvenBaseBtn.type = "button";
  addOvenBaseBtn.textContent = "Add oven base";
  const addMicrowaveTallBtn = document.createElement("button");
  addMicrowaveTallBtn.type = "button";
  addMicrowaveTallBtn.textContent = "Add microwave+oven";
  const addTopDrawersDoorsBtn = document.createElement("button");
  addTopDrawersDoorsBtn.type = "button";
  addTopDrawersDoorsBtn.textContent = "Add top drawers/doors";
  addWrap.appendChild(addDrawerBtn);
  addWrap.appendChild(addNestedDrawerBtn);
  addWrap.appendChild(addFridgeBtn);
  addWrap.appendChild(addShelvesBtn);
  addWrap.appendChild(addCornerBtn);
  addWrap.appendChild(addFlapBtn);
  addWrap.appendChild(addSwingBtn);
  addWrap.appendChild(addOvenBaseBtn);
  addWrap.appendChild(addMicrowaveTallBtn);
  addWrap.appendChild(addTopDrawersDoorsBtn);

  const addWindowBtn = document.createElement("button");
  addWindowBtn.type = "button";
  addWindowBtn.textContent = "Add window";
  addWrap.appendChild(addWindowBtn);
  layoutUi.appendChild(addWrap);

  const layoutActions = document.createElement("div");
  layoutActions.className = "actions";
  const dupBtn = document.createElement("button");
  dupBtn.type = "button";
  dupBtn.textContent = "Duplicate selected";
  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.textContent = "Delete selected";
  delBtn.style.borderColor = "#3a1f23";
  delBtn.style.background = "#1a0f12";
  delBtn.style.color = "#ff6b6b";
  layoutActions.appendChild(dupBtn);
  layoutActions.appendChild(delBtn);
  layoutUi.appendChild(layoutActions);

  const viewWrap = document.createElement("div");
  viewWrap.className = "field";
  const viewLabel = document.createElement("label");
  viewLabel.textContent = "2D top view";
  viewLabel.htmlFor = "view2d";
  const view2d = document.createElement("input");
  view2d.id = "view2d";
  view2d.type = "checkbox";
  view2d.checked = true;
  view2d.style.justifySelf = "start";
  viewWrap.appendChild(viewLabel);
  viewWrap.appendChild(view2d);
  layoutUi.appendChild(viewWrap);

  const sunHost = document.createElement("div");
  sunHost.className = "field";
  sunHost.style.display = "grid";
  sunHost.style.gap = "10px";
  sunHost.style.padding = "10px";
  sunHost.style.border = "1px solid var(--border)";
  sunHost.style.borderRadius = "12px";
  sunHost.style.background = "rgba(10,12,16,0.4)";

  const sunTitle = document.createElement("div");
  sunTitle.textContent = "Lighting";
  sunTitle.style.fontWeight = "600";
  sunHost.appendChild(sunTitle);

  const sunRow = (label: string, el: HTMLElement) => {
    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = "160px 1fr";
    wrap.style.gap = "8px";
    wrap.style.alignItems = "center";
    const l = document.createElement("div");
    l.textContent = label;
    wrap.appendChild(l);
    wrap.appendChild(el);
    sunHost.appendChild(wrap);
  };

  const mkNum = (v: number) => {
    const i = document.createElement("input");
    i.type = "number";
    i.value = String(v);
    i.step = "1";
    return i;
  };

  const day = document.createElement("input");
  day.type = "range";
  day.min = "0";
  day.max = "25";
  day.step = "0.1";
  day.value = "9";
  day.addEventListener("input", () => setDaylightIntensity(Number(day.value)));
  sunRow("Window daylight", day);

  const shadowSel = document.createElement("select");
  shadowSel.innerHTML = `
    <option value="pcfsoft">Shadows: PCFSoft</option>
    <option value="vsm">Shadows: VSM (experimental)</option>
  `;
  shadowSel.value = getShadowAlgorithm();
  shadowSel.addEventListener("change", () => {
    const next = shadowSel.value === "vsm" ? "vsm" : "pcfsoft";
    setShadowAlgorithm(next);
  });
  sunRow("Shadows", shadowSel);

  const renderModeSel = document.createElement("select");
  renderModeSel.innerHTML = `
    <option value="realtime">Render: realtime</option>
    ${ENABLE_SSGI ? `<option value="realtime_ssgi">Render: realtime + SSGI (experimental)</option>` : ""}
    ${ENABLE_PHOTO ? `<option value="photo_pathtrace">Render: photo mode (path tracing)</option>` : ""}
  `;
  renderModeSel.value = renderMode;

  const photoWrap = document.createElement("div");
  photoWrap.style.display = renderMode === "photo_pathtrace" ? "" : "none";
  photoWrap.style.paddingLeft = "168px";
  photoWrap.style.marginTop = "-6px";

  renderModeSel.addEventListener("change", () => {
    const v = renderModeSel.value as RenderMode;
    renderMode = v === "realtime_ssgi" || v === "photo_pathtrace" ? v : "realtime";

    if (renderMode !== "realtime_ssgi") {
      ssgi?.dispose();
      ssgi = null;
      ssgiCameraUuid = null;
    }
    if (renderMode !== "photo_pathtrace") {
      photo?.dispose();
      photo = null;
      photoCameraUuid = null;
      photoLastLightingRevision = -1;
    }

    photoWrap.style.display = renderMode === "photo_pathtrace" ? "" : "none";
  });
  sunRow("Render mode", renderModeSel);
  sunHost.appendChild(photoWrap);

  const photoControls = document.createElement("div");
  photoControls.style.display = "flex";
  photoControls.style.flexWrap = "wrap";
  photoControls.style.gap = "8px";
  photoWrap.appendChild(photoControls);

  const photoSamples = document.createElement("input");
  photoSamples.type = "number";
  photoSamples.min = "1";
  photoSamples.max = "4096";
  photoSamples.step = "1";
  photoSamples.value = "256";
  photoSamples.style.width = "110px";
  photoControls.appendChild(photoSamples);

  const photoReset = document.createElement("button");
  photoReset.type = "button";
  photoReset.textContent = "Reset";
  photoControls.appendChild(photoReset);

  const photoSave = document.createElement("button");
  photoSave.type = "button";
  photoSave.textContent = "Save PNG";
  photoControls.appendChild(photoSave);

  const photoStatus = document.createElement("div");
  photoStatus.style.opacity = "0.9";
  photoStatus.style.fontSize = "12px";
  photoStatus.style.marginTop = "6px";
  photoWrap.appendChild(photoStatus);

  const downloadPng = (name: string) => {
    const url = renderer.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  };

  photoReset.addEventListener("click", () => {
    photo?.reset();
  });

  photoSave.addEventListener("click", () => {
    downloadPng(`kitchen-${new Date().toISOString().replaceAll(":", "").slice(0, 15)}.png`);
  });

  const hdriSel = document.createElement("select");
  hdriSel.innerHTML = `
    <option value="">HDRI: off</option>
    <option value="/hdri/OutdoorFieldBaseballDayClear001/HdrOutdoorFieldBaseballDayClear001_HDR_2K.exr">Outdoor day (2K)</option>
    <option value="/hdri/SkySunset007/HdrSkySunset007_HDR_1K.exr">Sunset (1K)</option>
  `;
  hdriSel.value = "";
  sunRow("HDRI", hdriSel);

  const hdriBg = document.createElement("input");
  hdriBg.type = "checkbox";
  hdriBg.checked = false;
  sunRow("HDRI background", hdriBg);

  const hdriIntensity = document.createElement("input");
  hdriIntensity.type = "range";
  hdriIntensity.min = "0";
  hdriIntensity.max = "1";
  hdriIntensity.step = "0.01";
  hdriIntensity.value = "0.15";
  sunRow("HDRI intensity", hdriIntensity);

  const applyHdri = () => {
    const id = hdriSel.value || null;
    const envIntensity = Number(hdriIntensity.value);
    if (id && !hdriBg.checked) hdriBg.checked = true; // make it visible by default
    setHdri({ id, background: hdriBg.checked, envIntensity, backgroundIntensity: 1 });
  };

  hdriSel.addEventListener("change", applyHdri);
  hdriBg.addEventListener("change", applyHdri);
  hdriIntensity.addEventListener("input", applyHdri);

  layoutUi.appendChild(sunHost);

  const instanceEditorHost = document.createElement("div");
  layoutUi.appendChild(instanceEditorHost);

  const windowEditorHost = document.createElement("div");
  windowEditorHost.style.display = "none";
  layoutUi.appendChild(windowEditorHost);

  // Panels
  args.partsEl.innerHTML = "";
  const partsBuildHost = document.createElement("div");
  const partsLayoutHost = document.createElement("div");
  partsLayoutHost.style.display = "none";
  args.partsEl.appendChild(partsBuildHost);
  args.partsEl.appendChild(partsLayoutHost);

  const partPanel = createPartPanel(partsBuildHost, {
    onSelect: (name) => selectByName(name),
    onSetVisible: (name, visible) => setVisibleByName(name, visible),
    onHighlightPair: (a, b) => highlightOverlap(a, b)
  });

  const layoutPanel = createLayoutPanel(partsLayoutHost, {
    onSelect: (id) => selectInstanceById(id),
    onDuplicate: (id) => duplicateInstance(id),
    onDelete: (id) => deleteInstance(id)
  });

  // Ribbon (Revit-style tabs) [legacy]
  let underlayStatusEl: HTMLDivElement | null = null;
  let underlayScaleEl: HTMLInputElement | null = null;
  let underlayOffXEl: HTMLInputElement | null = null;
  let underlayOffZEl: HTMLInputElement | null = null;
  let underlayRotEl: HTMLInputElement | null = null;
  let underlayOpacityEl: HTMLInputElement | null = null;
  const setUnderlayStatus = (text: string) => {
    if (underlayStatusEl) underlayStatusEl.textContent = text;
  };

  const hideWallEditHud = () => {
    wallEditHud.lenLine.style.display = "none";
    wallEditHud.lenExtA.style.display = "none";
    wallEditHud.lenExtB.style.display = "none";
    wallEditHud.offsetLine.style.display = "none";
    wallEditHud.offsetTickA.style.display = "none";
    wallEditHud.offsetTickB.style.display = "none";
    wallEditHud.handleA.style.display = "none";
    wallEditHud.handleB.style.display = "none";
    wallEditHud.handleMid.style.display = "none";
    wallEditHud.label.style.display = "none";
    wallEditHud.input.style.display = "none";
    wallEditHud.offsetLabel.style.display = "none";
    wallEditHud.offsetInput.style.display = "none";
    wallEditHud.offsetRefWallId = null;
  };

  const commitWallLengthMm = (raw: string) => {
    if (selectedKind !== "wall" || !selectedWallId) return;
    const w = walls.find((x) => x.id === selectedWallId) ?? null;
    if (!w) return;

    const v = Number(String(raw).trim().replace(/[^0-9.\\-]/g, ""));
    if (!Number.isFinite(v)) return;
    const lenMm = Math.max(1, Math.round(v));

    const oldB = { ...w.params.bMm };
    const a = fromMmPoint(w.params.aMm);
    const b = fromMmPoint(w.params.bMm);
    const d = b.clone().sub(a);
    if (d.lengthSq() < 1e-8) d.set(1, 0, 0);
    d.normalize();
    const newB = a.clone().addScaledVector(d, lenMm / 1000);
    const newBMm = toMmPoint(newB);
    setWallEndpointMm(w, "b", newBMm);

    // Keep connected joins attached (move any walls that shared the old endpoint).
    for (const other of walls) {
      if (other.id === w.id) continue;
      const which = wallEndpointWhich(other, oldB, wallJoinTolMm);
      if (which) setWallEndpointMm(other, which, newBMm);
    }

    autoJoinAtMmPoint(w.params.aMm);
    autoJoinAtMmPoint(w.params.bMm);
    rebuildWallPlanMesh();
    mountProps();
  };

  const commitWallOffsetMm = (raw: string) => {
    if (selectedKind !== "wall" || !selectedWallId) return;
    const w = walls.find((x) => x.id === selectedWallId) ?? null;
    const refId = wallEditHud.offsetRefWallId;
    const ref = refId ? walls.find((x) => x.id === refId) ?? null : null;
    if (!w || !ref) return;

    const v = Number(String(raw).trim().replace(/[^0-9.\\-]/g, ""));
    if (!Number.isFinite(v)) return;
    const desiredOffsetMm = Math.max(0, Math.round(v));

    const a = fromMmPoint(w.params.aMm);
    const b = fromMmPoint(w.params.bMm);
    const d = b.clone().sub(a);
    if (d.lengthSq() < 1e-8) return;
    d.normalize();
    const n = new THREE.Vector3(-d.z, 0, d.x).normalize();

    const ra = fromMmPoint(ref.params.aMm);
    const rb = fromMmPoint(ref.params.bMm);
    const rmid = ra.clone().add(rb).multiplyScalar(0.5);
    const mid = a.clone().add(b).multiplyScalar(0.5);

    const signed = rmid.clone().sub(mid).dot(n);
    const sign = signed >= 0 ? 1 : -1;
    const currentCenterDistM = Math.abs(signed);
    const desiredCenterDistM = desiredOffsetMm / 1000 + (w.params.thicknessMm + ref.params.thicknessMm) / 2000;
    const desiredSigned = sign * desiredCenterDistM;
    const shift = signed - desiredSigned;

    const shiftMm = { x: Math.round(n.x * shift * 1000), z: Math.round(n.z * shift * 1000) };

    const oldA = { ...w.params.aMm };
    const oldB = { ...w.params.bMm };

    w.params.aMm = { x: w.params.aMm.x + shiftMm.x, z: w.params.aMm.z + shiftMm.z };
    w.params.bMm = { x: w.params.bMm.x + shiftMm.x, z: w.params.bMm.z + shiftMm.z };

    // Keep connected joins attached at both ends.
    for (const other of walls) {
      if (other.id === w.id) continue;
      const wa = wallEndpointWhich(other, oldA, wallJoinTolMm);
      if (wa) setWallEndpointMm(other, wa, w.params.aMm);
      const wb = wallEndpointWhich(other, oldB, wallJoinTolMm);
      if (wb) setWallEndpointMm(other, wb, w.params.bMm);
    }

    rebuildWall(w);
    autoJoinAtMmPoint(w.params.aMm);
    autoJoinAtMmPoint(w.params.bMm);
    rebuildWallPlanMesh();
    mountProps();
  };

  wallEditHud.label.addEventListener("pointerdown", (ev) => {
    if (selectedKind !== "wall" || !selectedWallId) return;
    if (mode !== "layout" || viewMode !== "2d") return;
    if (layoutTool === "wall" && wallDraw.active) return;
    ev.preventDefault();
    ev.stopPropagation();

    const w = walls.find((x) => x.id === selectedWallId) ?? null;
    if (!w) return;
    wallEditHud.input.value = String(Math.round(mmDist(w.params.aMm, w.params.bMm)));
    wallEditHud.input.style.left = wallEditHud.label.style.left;
    wallEditHud.input.style.top = wallEditHud.label.style.top;
    wallEditHud.input.style.transform = "translate(-50%, -50%)";
    wallEditHud.input.style.display = "block";
    wallEditHud.input.focus();
    wallEditHud.input.select();
  });

  wallEditHud.input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      commitWallLengthMm(wallEditHud.input.value);
      wallEditHud.input.blur();
      ev.preventDefault();
    } else if (ev.key === "Escape") {
      wallEditHud.input.style.display = "none";
      wallEditHud.input.blur();
      ev.preventDefault();
    }
  });
  wallEditHud.input.addEventListener("blur", () => {
    wallEditHud.input.style.display = "none";
  });

  wallEditHud.offsetLabel.addEventListener("pointerdown", (ev) => {
    if (selectedKind !== "wall" || !selectedWallId) return;
    if (mode !== "layout" || viewMode !== "2d") return;
    if (layoutTool === "wall" && wallDraw.active) return;
    ev.preventDefault();
    ev.stopPropagation();

    wallEditHud.offsetInput.value = String(wallEditHud.offsetLabel.textContent?.replace(/[^0-9\\-]/g, "") ?? "");
    wallEditHud.offsetInput.style.left = wallEditHud.offsetLabel.style.left;
    wallEditHud.offsetInput.style.top = wallEditHud.offsetLabel.style.top;
    wallEditHud.offsetInput.style.transform = "translate(-50%, -50%)";
    wallEditHud.offsetInput.style.display = "block";
    wallEditHud.offsetInput.focus();
    wallEditHud.offsetInput.select();
  });

  wallEditHud.offsetInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      commitWallOffsetMm(wallEditHud.offsetInput.value);
      wallEditHud.offsetInput.blur();
      ev.preventDefault();
    } else if (ev.key === "Escape") {
      wallEditHud.offsetInput.style.display = "none";
      wallEditHud.offsetInput.blur();
      ev.preventDefault();
    }
  });
  wallEditHud.offsetInput.addEventListener("blur", () => {
    wallEditHud.offsetInput.style.display = "none";
  });

  const beginWallDrag = (
    ev: PointerEvent,
    wallId: string,
    kind: "a" | "b" | "move"
  ) => {
    if (mode !== "layout" || viewMode !== "2d") return;
    if (layoutTool !== "select") return;
    if (measureState.enabled) return;

    const w = walls.find((x) => x.id === wallId) ?? null;
    if (!w) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    pointerNdc.set(x, y);
    raycaster.setFromCamera(pointerNdc, cam());
    const hitPoint = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;

    const gatherConnected = (p: { x: number; z: number }) => {
      const out: Array<{ wallId: string; which: "a" | "b" }> = [];
      for (const other of walls) {
        if (other.id === wallId) continue;
        const which = wallEndpointWhich(other, p, wallJoinTolMm);
        if (which) out.push({ wallId: other.id, which });
      }
      return out;
    };

    wallEditHud.drag = {
      wallId,
      kind,
      pointerId: ev.pointerId,
      startWorld: hitPoint.clone(),
      startA: { ...w.params.aMm },
      startB: { ...w.params.bMm },
      connectedA: gatherConnected(w.params.aMm),
      connectedB: gatherConnected(w.params.bMm)
    };

    try {
      renderer.domElement.setPointerCapture(ev.pointerId);
    } catch {
      // ignore
    }

    ev.preventDefault();
    ev.stopPropagation();
  };

  wallEditHud.handleA.addEventListener("pointerdown", (ev) => {
    if (selectedKind !== "wall" || !selectedWallId) return;
    beginWallDrag(ev, selectedWallId, "a");
  });
  wallEditHud.handleB.addEventListener("pointerdown", (ev) => {
    if (selectedKind !== "wall" || !selectedWallId) return;
    beginWallDrag(ev, selectedWallId, "b");
  });
  wallEditHud.handleMid.addEventListener("pointerdown", (ev) => {
    if (selectedKind !== "wall" || !selectedWallId) return;
    beginWallDrag(ev, selectedWallId, "move");
  });

  const ensureLayoutMode = () => {
    if (mode !== "layout") {
      modeSelect.value = "layout";
      setMode("layout");
    }
  };

  /* legacy ribbon UI (disabled)
  createRibbon(args.ribbonEl, [
    {
      id: "kitchens",
      title: "Kuchyne",
      build(panelEl) {
        const g = ribbonGroup(panelEl, "Moduly");
        const a = ribbonActions(g, 3);
        ribbonButton(a, "Pridať drawer", () => {
          ensureLayoutMode();
          addInstance("drawer_low");
        });
        ribbonButton(a, "Pridať shelves", () => {
          ensureLayoutMode();
          addInstance("shelves");
        });
        ribbonButton(a, "Pridať corner", () => {
          ensureLayoutMode();
          addInstance("corner_shelf_lower");
        });

        const g2 = ribbonGroup(panelEl, "Výber");
        const a2 = ribbonActions(g2, 3);
        ribbonButton(a2, "Duplikovať", () => {
          ensureLayoutMode();
          if (!selectedInstanceId) return;
          duplicateInstance(selectedInstanceId);
        });
        ribbonButton(a2, "Zmazať", () => {
          ensureLayoutMode();
          if (!selectedInstanceId) return;
          deleteInstance(selectedInstanceId);
        });
        ribbonButton(a2, "2D pohľad", () => {
          ensureLayoutMode();
          view2d.checked = !view2d.checked;
          setView2d(view2d.checked);
        });

        const g3 = ribbonGroup(panelEl, "Projekt");
        const a3 = ribbonActions(g3, 3);
        ribbonButton(a3, "Reset defaults", () => args.resetBtn.click());
        ribbonButton(a3, "Export JSON", () => args.exportBtn.click());
        ribbonButton(a3, "Copy export", () => args.copyBtn.click());

        const resetViewBtn = args.viewerEl.querySelector("#resetViewBtn") as HTMLButtonElement | null;
        ribbonButton(a3, "Reset view", () => resetViewBtn?.click());
      }
    },
    {
      id: "walls",
      title: "Stena",
      build(panelEl) {
        const g = ribbonGroup(panelEl, "Podklad (PDF/PNG)");

        const file = document.createElement("input");
        file.type = "file";
        file.accept = ".png,.pdf,image/png,application/pdf";
        ribbonRow(g, "Nahrať", file);

        const clearBtnWrap = ribbonActions(g, 1);
        ribbonButton(clearBtnWrap, "Odstrániť podklad", () => {
          ensureLayoutMode();
          clearUnderlay();
          setUnderlayStatus("Podklad odstránený.");
        });

        const opacity = document.createElement("input");
        opacity.type = "range";
        opacity.min = "0";
        opacity.max = "1";
        opacity.step = "0.01";
        opacity.value = String(underlayState.opacity);
        ribbonRow(g, "Opacity", opacity);

        const rot = document.createElement("input");
        rot.type = "number";
        rot.step = "1";
        rot.value = String(underlayState.rotationDeg);
        ribbonRow(g, "Rotácia (°)", rot);

        const offX = document.createElement("input");
        offX.type = "number";
        offX.step = "1";
        offX.value = String(underlayState.offsetMm.x);
        ribbonRow(g, "Offset X (mm)", offX);

        const offZ = document.createElement("input");
        offZ.type = "number";
        offZ.step = "1";
        offZ.value = String(underlayState.offsetMm.z);
        ribbonRow(g, "Offset Z (mm)", offZ);

        const known = document.createElement("input");
        known.type = "number";
        known.step = "1";
        known.value = String(underlayCal.knownMm);
        ribbonRow(g, "Kalibrácia (mm)", known);

        const calWrap = ribbonActions(g, 2);
        ribbonButton(calWrap, "Kalibrovať škálu", () => {
          ensureLayoutMode();
          if (!underlayMesh.visible) {
            setUnderlayStatus("Najprv nahraj podklad.");
            return;
          }
          underlayCal.knownMm = Math.max(1, Number(known.value) || 1);
          underlayCal.active = true;
          underlayCal.first = null;
          setUnderlayStatus("Kalibrácia: klikni prvý bod...");
        });
        ribbonButton(calWrap, "Reset škály", () => {
          ensureLayoutMode();
          underlayState.scale = 1;
          updateUnderlayTransform();
          setUnderlayStatus("Škála resetnutá.");
        });

        underlayStatusEl = document.createElement("div");
        underlayStatusEl.className = "muted";
        underlayStatusEl.style.fontSize = "12px";
        underlayStatusEl.textContent = "Nahraj PDF/PNG podklad a nastav 1:1 kalibráciou.";
        g.appendChild(underlayStatusEl);

        file.addEventListener("change", async () => {
          ensureLayoutMode();
          const f = file.files?.[0] ?? null;
          if (!f) return;
          setUnderlayStatus("Načítavam...");
          try {
            const res = await loadUnderlayToCanvas(f);
            setUnderlayFromCanvas(res.canvas, res.name, res.kind);
            opacity.value = String(underlayState.opacity);
            rot.value = String(underlayState.rotationDeg);
            offX.value = String(underlayState.offsetMm.x);
            offZ.value = String(underlayState.offsetMm.z);
            setUnderlayStatus(`Podklad: ${res.name}`);
          } catch (e) {
            setUnderlayStatus(`Chyba pri načítaní: ${(e as Error).message}`);
          } finally {
            file.value = "";
          }
        });

        opacity.addEventListener("input", () => {
          underlayState.opacity = Math.min(1, Math.max(0, Number(opacity.value) || 0));
          updateUnderlayTransform();
        });

        rot.addEventListener("change", () => {
          underlayState.rotationDeg = Number(rot.value) || 0;
          updateUnderlayTransform();
        });

        offX.addEventListener("change", () => {
          underlayState.offsetMm.x = Number(offX.value) || 0;
          updateUnderlayTransform();
        });

        offZ.addEventListener("change", () => {
          underlayState.offsetMm.z = Number(offZ.value) || 0;
          updateUnderlayTransform();
        });

        const g2 = ribbonGroup(panelEl, "Steny");
        const a2 = ribbonActions(g2, 3);
        ribbonButton(a2, "Pridať stenu");
        ribbonButton(a2, "Odsadiť stenu");
        ribbonButton(a2, "Zmazať stenu");
      }
    },
    {
      id: "doors",
      title: "Dvere",
      build(panelEl) {
        const g = ribbonGroup(panelEl, "Dvere");
        const a = ribbonActions(g, 3);
        ribbonButton(a, "Pridať dvere");
        ribbonButton(a, "Editovať dvere");
        ribbonButton(a, "Odstrániť dvere");
      }
    },
    {
      id: "windows",
      title: "Okno",
      build(panelEl) {
        const g = ribbonGroup(panelEl, "Okno");
        const a = ribbonActions(g, 3);
        ribbonButton(a, "Pridať/označiť okno", () => {
          ensureLayoutMode();
          addOrSelectWindow();
        });
      }
    }
  ]);
  */

  // Top bar (single strip with icon buttons)
  const icon = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  const I_SELECT = icon("M4 4h7v2H6v5H4V4zm14 0v7h-2V6h-5V4h7zM4 20v-7h2v5h5v2H4zm16-7v7h-7v-2h5v-5h2z");
  const I_WALL = icon("M4 6h16v2H4V6zm0 10h16v2H4v-2zM6 8h2v8H6V8zm10 0h2v8h-2V8z");
  const I_WINDOW = icon("M5 4h14v16H5V4zm2 2v6h5V6H7zm7 0v6h5V6h-5zM7 14v4h5v-4H7zm7 0v4h5v-4h-5z");
  const I_DOOR = icon("M6 3h12v18h-2V5H8v16H6V3zm5 10h2v8h-2v-8z");
  const I_UNDERLAY = icon("M6 2h9l3 3v17H6V2zm9 1.5V6h2.5L15 3.5zM8 9h8v2H8V9zm0 4h8v2H8v-2z");
  const I_CABINET = icon("M4 6h16v14H4V6zm2 2v3h12V8H6zm0 5v5h5v-5H6zm7 0v5h5v-5h-5z");
  const I_GRID2D = icon("M4 4h16v16H4V4zm2 2v4h4V6H6zm6 0v4h6V6h-6zM6 12v6h4v-6H6zm6 0v6h6v-6h-6z");
  const I_DUP = icon("M7 7h10v10H7V7zm-3 3h2v10h10v2H4V10z");
  const I_TRASH = icon("M9 3h6l1 2h5v2H3V5h5l1-2zm1 6h2v10h-2V9zm4 0h2v10h-2V9z");
  const I_EXPORT = icon("M12 3v10l3-3 1.4 1.4L12 16.8 7.6 11.4 9 10l3 3V3h0zM5 19h14v2H5v-2z");
  const I_COPY = icon("M8 7h11v14H8V7zM5 3h11v2H7v12H5V3z");
  const I_RESET = icon("M12 6V3l-4 4 4 4V8c2.8 0 5 2.2 5 5a5 5 0 1 1-9.8-1H5.1A7 7 0 1 0 12 6z");
  const I_VIEW = icon("M12 5c5.5 0 9.5 5.5 9.5 7s-4 7-9.5 7S2.5 14.5 2.5 12 6.5 5 12 5zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z");
  const I_DEBUG = icon("M4 12h16v2H4v-2zm7-8h2v16h-2V4z");
  const I_ALIGN = icon("M4 7h12v2H4V7zm0 8h12v2H4v-2zM18 6l4 3-4 3V6zm0 6l4 3-4 3v-6z");
  const I_TRIM = icon("M4 7h11v2H4V7zm0 8h8v2H4v-2zM18 5l4 4-2 2-4-4 2-2zm-4 4l4 4-2 2-4-4 2-2z");
  const I_DIM = icon("M3 7h18v2H3V7zm0 8h18v2H3v-2zM6 9v6H4V9h2zm16 0v6h-2V9h2z");
  const I_UNDO = icon("M12 5H7.8l1.6-1.6L8 2 4 6l4 4 1.4-1.4L7.8 7H12c3.3 0 6 2.7 6 6 0 1.1-.3 2.1-.8 3l1.7 1c.7-1.2 1.1-2.6 1.1-4 0-4.4-3.6-8-8-8z");
  const I_REDO = icon("M12 5c-4.4 0-8 3.6-8 8 0 1.4.4 2.8 1.1 4l1.7-1c-.5-.9-.8-1.9-.8-3 0-3.3 2.7-6 6-6h4.2l-1.6 1.6L16 10l4-4-4-4-1.4 1.4L16.2 5H12z");

  const tb = createTopbar(args.ribbonEl);

  const props = {
    setTitle(title: string) {
      args.propertiesEl.innerHTML = "";
      const t = document.createElement("div");
      t.className = "props-title";
      t.textContent = title;
      args.propertiesEl.appendChild(t);
    },
    section() {
      const s = document.createElement("div");
      s.className = "props-section";
      args.propertiesEl.appendChild(s);
      return s;
    },
    row(sectionEl: HTMLElement, label: string, inputEl: HTMLElement) {
      const r = document.createElement("div");
      r.className = "props-row";
      const l = document.createElement("label");
      l.textContent = label;
      r.appendChild(l);
      r.appendChild(inputEl);
      sectionEl.appendChild(r);
      return r;
    }
  };

  const showNoProps = () => {
    props.setTitle("Properties");
    const s = props.section();
    const p = document.createElement("div");
    p.className = "muted";
    p.textContent = mode === "layout" ? "Vyber objekt alebo nástroj." : "Properties sú dostupné iba v layout mode.";
    s.appendChild(p);
  };

  const mountWallToolProps = () => {
    props.setTitle("Wall");
    const s = props.section();
    const th = document.createElement("input");
    th.type = "number";
    th.step = "1";
    th.value = String(wallDefault.thicknessMm);
    props.row(s, "Thickness (mm)", th);
    const just = document.createElement("select");
    just.innerHTML = `
      <option value="center">Center</option>
      <option value="interior">Finish face: interior</option>
      <option value="exterior">Finish face: exterior</option>
    `;
    just.value = wallDefault.justification;
    props.row(s, "Justification", just);
    const flip = document.createElement("button");
    flip.type = "button";
    flip.textContent = "Flip exterior";
    flip.style.height = "34px";
    props.row(s, "Exterior", flip);
    const mat = document.createElement("select");
    mat.innerHTML = `<option value="default">Default</option>`;
    mat.value = wallDefault.materialId;
    props.row(s, "Material", mat);
    const hint = document.createElement("div");
    hint.className = "muted";
    hint.textContent = "Klikni 2 body v 2D. Shift = bez axis snap. Esc = stop chain.";
    s.appendChild(hint);
    const updatePreview = () => {
      if (!wallDraw.preview || !wallDraw.a) return;
      updateWallMeshWithJustification(
        wallDraw.preview,
        wallDraw.a,
        wallDraw.hoverB ?? wallDraw.a,
        wallDefault.thicknessMm,
        wallDefault.justification,
        wallDefault.exteriorSign
      );
    };
    th.addEventListener("change", () => {
      wallDefault.thicknessMm = Math.max(10, Number(th.value) || wallDefault.thicknessMm);
      th.value = String(wallDefault.thicknessMm);
      updatePreview();
    });
    just.addEventListener("change", () => {
      wallDefault.justification =
        just.value === "interior" ? "interior" : just.value === "exterior" ? "exterior" : "center";
      updatePreview();
    });
    flip.addEventListener("click", () => {
      wallDefault.exteriorSign = wallDefault.exteriorSign === 1 ? -1 : 1;
      updatePreview();
      setUnderlayStatus(`Wall: exterior ${wallDefault.exteriorSign === 1 ? "left" : "right"} of A→B.`);
    });
    mat.addEventListener("change", () => {
      wallDefault.materialId = mat.value || "default";
    });
  };

  const mountAlignToolProps = () => {
    props.setTitle("Align");
    const s = props.section();
    const hint = document.createElement("div");
    hint.className = "muted";
    hint.textContent = "Klikni referenÄŤnĂş lĂ­niu, potom druhĂş rovnobeĹľnĂş lĂ­niu (stena sa posunie alebo sa upravĂ­ koniec). Esc = zruĹˇiĹĄ.";
    s.appendChild(hint);
    const cur = document.createElement("div");
    cur.className = "muted";
    cur.style.marginTop = "8px";
    cur.textContent = alignState.ref ? `Reference: ${alignState.ref.label}` : "Reference: (none)";
    s.appendChild(cur);
  };

  const mountTrimToolProps = () => {
    props.setTitle("Trim");
    const s = props.section();
    const hint = document.createElement("div");
    hint.className = "muted";
    hint.textContent = "Klikni cieľovú stenu (ktorú chceš skrátiť), potom klikni cutter líniu. Esc = späť.";
    s.appendChild(hint);

    const step = document.createElement("div");
    step.className = "muted";
    step.style.marginTop = "8px";
    step.textContent = trimState.step === "pickTarget" ? "Step: pick target" : "Step: pick cutter";
    s.appendChild(step);

    const cur = document.createElement("div");
    cur.className = "muted";
    cur.style.marginTop = "6px";
    cur.textContent = trimState.targetPick ? `Target: ${trimState.targetPick.label}` : "Target: (none)";
    s.appendChild(cur);
  };

  const mountDimensionToolProps = () => {
    props.setTitle("Dimension");
    const s = props.section();
    const hint = document.createElement("div");
    hint.className = "muted";
    hint.textContent = "Klikni 1. líniu, potom 2. rovnobežnú líniu. Kóta sa preview-uje podľa kurzora, zostane v scéne, dá sa posúvať a mazať.";
    s.appendChild(hint);
    const cur = document.createElement("div");
    cur.className = "muted";
    cur.style.marginTop = "8px";
    cur.textContent = dimTool.a ? `First: ${dimTool.a.label}` : "First: (none)";
    s.appendChild(cur);
  };

  const mountWallProps = (w: WallInstance) => {
    props.setTitle(`Wall (${w.id})`);
    const s = props.section();
    const th = document.createElement("input");
    th.type = "number";
    th.step = "1";
    th.value = String(w.params.thicknessMm);
    props.row(s, "Thickness (mm)", th);
    const just = document.createElement("select");
    just.innerHTML = `
      <option value="center">Center</option>
      <option value="interior">Finish face: interior</option>
      <option value="exterior">Finish face: exterior</option>
    `;
    just.value = w.params.justification ?? "center";
    props.row(s, "Justification", just);
    const flip = document.createElement("button");
    flip.type = "button";
    flip.textContent = "Flip exterior";
    flip.style.height = "34px";
    props.row(s, "Exterior", flip);
    const mat = document.createElement("select");
    mat.innerHTML = `<option value="default">Default</option>`;
    mat.value = w.params.materialId;
    props.row(s, "Material", mat);
    const len = document.createElement("div");
    len.className = "muted";
    const dx = w.params.bMm.x - w.params.aMm.x;
    const dz = w.params.bMm.z - w.params.aMm.z;
    len.textContent = `Length: ${Math.round(Math.hypot(dx, dz))} mm`;
    s.appendChild(len);
    th.addEventListener("change", () => {
      w.params.thicknessMm = Math.max(10, Number(th.value) || w.params.thicknessMm);
      th.value = String(w.params.thicknessMm);
      for (const ww of walls) rebuildWall(ww);
      rebuildWallPlanMesh();
    });
    just.addEventListener("change", () => {
      w.params.justification = just.value === "interior" ? "interior" : just.value === "exterior" ? "exterior" : "center";
      for (const ww of walls) rebuildWall(ww);
      rebuildWallPlanMesh();
    });
    flip.addEventListener("click", () => {
      w.params.exteriorSign = (w.params.exteriorSign ?? 1) === 1 ? -1 : 1;
      for (const ww of walls) rebuildWall(ww);
      rebuildWallPlanMesh();
      mountProps();
    });
    mat.addEventListener("change", () => {
      w.params.materialId = mat.value || "default";
      // only one material for now; keep hook for later
    });
  };

  const mountModuleProps = (id: string) => {
    const inst = findInstance(id);
    if (!inst) return showNoProps();
    props.setTitle(`Module (${inst.id})`);
    const s = props.section();
    const type = document.createElement("div");
    type.className = "muted";
    type.textContent = `Type: ${inst.params.type}`;
    s.appendChild(type);
    const pos = document.createElement("div");
    pos.className = "muted";
    pos.textContent = `Pos: ${Math.round(inst.root.position.x * 1000)}×${Math.round(inst.root.position.z * 1000)} mm`;
    s.appendChild(pos);

    const rowHost = document.createElement("div");
    rowHost.style.marginTop = "10px";
    s.appendChild(rowHost);

    const rot = document.createElement("input");
    rot.type = "number";
    rot.step = "1";
    rot.value = String(Math.round((inst.root.rotation.y * 180) / Math.PI));
    props.row(rowHost, "Rotation (deg)", rot);

    const pinned = document.createElement("input");
    pinned.type = "checkbox";
    pinned.checked = pinnedInstanceIds.has(inst.id);
    props.row(rowHost, "Pinned", pinned);

    const applyRot = () => {
      const n = Number(String(rot.value).trim().replace(",", "."));
      if (!Number.isFinite(n)) return;
      const deg = ((n % 360) + 360) % 360;
      const next = (deg * Math.PI) / 180;
      const prevRot = inst.root.rotation.y;
      inst.root.rotation.y = next;
      const inRoom = roomContainsBoxXZ(instanceWorldBox(inst));
      const overlaps = anyOverlap(inst, null);
      if (!inRoom || overlaps) {
        inst.root.rotation.y = prevRot;
        rot.value = String(Math.round((prevRot * 180) / Math.PI));
        return;
      }
      commitHistory();
      mountProps();
    };

    rot.addEventListener("change", applyRot);
    rot.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") applyRot();
    });

    pinned.addEventListener("change", () => {
      if (pinned.checked) pinnedInstanceIds.add(inst.id);
      else pinnedInstanceIds.delete(inst.id);
      commitHistory();
      mountProps();
    });

    const editorHost = document.createElement("div");
    editorHost.style.marginTop = "10px";
    s.appendChild(editorHost);

    const worktopArgs = { getWorktopThicknessMm: () => 0 };
    const onChange = () => {
      rebuildInstance(inst);
      commitHistory();
      mountProps();
    };

    if (inst.params.type === "drawer_low") {
      createDrawerLowControls(editorHost, inst.params, { ...worktopArgs, onChange });
      return;
    }
    if (inst.params.type === "nested_drawer_low") {
      createNestedDrawerLowControls(editorHost, inst.params, { ...worktopArgs, onChange });
      return;
    }
    if (inst.params.type === "fridge_tall") {
      createFridgeTallControls(editorHost, inst.params, { onChange });
      return;
    }
    if (inst.params.type === "flap_shelves_low") {
      createFlapShelvesLowControls(editorHost, inst.params, { ...worktopArgs, onChange });
      return;
    }
    if (inst.params.type === "swing_shelves_low") {
      createSwingShelvesLowControls(editorHost, inst.params, { ...worktopArgs, onChange });
      return;
    }
    if (inst.params.type === "oven_base_low") {
      createOvenBaseLowControls(editorHost, inst.params, { ...worktopArgs, onChange });
      return;
    }
    if (inst.params.type === "microwave_oven_tall") {
      createMicrowaveOvenTallControls(editorHost, inst.params, { ...worktopArgs, onChange });
      return;
    }
    if (inst.params.type === "top_drawers_doors_low") {
      createTopDrawersDoorsLowControls(editorHost, inst.params, { ...worktopArgs, onChange });
      return;
    }
    if (inst.params.type === "shelves") {
      createShelvesControls(editorHost, inst.params, { onChange });
      return;
    }
    createCornerShelfLowerControls(editorHost, inst.params, { onChange });
  };

  const setDimensionValueMm = (d: DimensionInstance, desiredMm: number) => {
    const v = dimValueMm(d.params);
    if (!v) {
      setUnderlayStatus("Dimension: invalid refs.");
      return;
    }
    const desiredM = Math.max(1, desiredMm) / 1000;
    const curM = Math.abs(v.signedM);
    const deltaM = desiredM - curM;
    if (Math.abs(deltaM) < 1e-6) return;

    const dirInc = v.signedM >= 0 ? v.n.clone() : v.n.clone().multiplyScalar(-1);
    const moveB = !pinnedWallIds.has(d.params.b.wallId);
    const moveA = !pinnedWallIds.has(d.params.a.wallId);
    if (!moveB && !moveA) {
      setUnderlayStatus("Dimension: both walls are pinned.");
      return;
    }

    if (moveB) {
      const wb = walls.find((x) => x.id === d.params.b.wallId) ?? null;
      if (!wb) {
        setUnderlayStatus("Dimension: target wall missing.");
        return;
      }
      const shift = dirInc.clone().multiplyScalar(deltaM);
      translateWallAndConnected(wb, Math.round(shift.x * 1000), Math.round(shift.z * 1000));
    } else {
      const wa = walls.find((x) => x.id === d.params.a.wallId) ?? null;
      if (!wa) {
        setUnderlayStatus("Dimension: target wall missing.");
        return;
      }
      const shift = dirInc.clone().multiplyScalar(-deltaM);
      translateWallAndConnected(wa, Math.round(shift.x * 1000), Math.round(shift.z * 1000));
    }

    commitHistory();
    setUnderlayStatus("Dimension: updated.");
    mountProps();
  };

  const mountDimensionProps = (id: string) => {
    const d = dimensions.find((x) => x.id === id) ?? null;
    if (!d) return showNoProps();
    props.setTitle(`Dimension (${d.id})`);
    const s = props.section();
    const v = dimValueMm(d.params);
    const curMm = v?.absMm ?? 0;

    const inp = document.createElement("input");
    inp.type = "number";
    inp.step = "1";
    inp.value = String(curMm);
    props.row(s, "Value (mm)", inp);

    const hint = document.createElement("div");
    hint.className = "muted";
    hint.style.marginTop = "8px";
    hint.textContent = "Enter/blur = apply (posunie jednu stenu). Drag kótu = zmena odsadenia.";
    s.appendChild(hint);

    const apply = () => {
      const n = Number(String(inp.value).trim().replace(",", "."));
      if (!n || !Number.isFinite(n) || n <= 0) return;
      setDimensionValueMm(d, Math.round(n));
    };
    inp.addEventListener("change", apply);
    inp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") apply();
    });
  };

  const mountWindowProps = () => {
    props.setTitle("Window");
    const s = props.section();
    const p = document.createElement("div");
    p.className = "muted";
    p.textContent = "Nastavenia okna zatiaľ zostávajú vpravo (TODO: presunúť do properties).";
    s.appendChild(p);
  };

  const mountProps = () => {
    if (mode !== "layout") return showNoProps();
    if (layoutTool === "wall") return mountWallToolProps();
    if (layoutTool === "align") return mountAlignToolProps();
    if (layoutTool === "trim") return mountTrimToolProps();
    if (layoutTool === "dimension") return mountDimensionToolProps();
    if (selectedWallIds.size + selectedInstanceIds.size > 1) {
      args.propertiesEl.innerHTML = "";
      const t = document.createElement("div");
      t.className = "props-title";
      t.textContent = "Properties";
      args.propertiesEl.appendChild(t);
      const s = document.createElement("div");
      s.className = "props-section";
      s.innerHTML = `<div class="muted">Selected: ${selectedWallIds.size} wall(s), ${selectedInstanceIds.size} module(s)</div>
      <div class="muted" style="margin-top:6px;">Delete = remove selected</div>`;
      args.propertiesEl.appendChild(s);
      return;
    }
    if (selectedKind === "wall") {
      const w = walls.find((x) => x.id === selectedWallId) ?? null;
      if (w) return mountWallProps(w);
      return showNoProps();
    }
    if (selectedKind === "window") return mountWindowProps();
    if (selectedKind === "module" && selectedInstanceId) return mountModuleProps(selectedInstanceId);
    if (selectedKind === "dimension" && selectedDimensionId) return mountDimensionProps(selectedDimensionId);
    showNoProps();
  };

  const g1 = tb.addGroup();
  tb.toolButton(g1, {
    title: "Select",
    iconSvg: I_SELECT,
    onClick: () => {
      setToolSelect();
    }
  });
  tb.toolButton(g1, {
    title: "Wall",
    iconSvg: I_WALL,
    onClick: () => {
      setToolWall();
    }
  });
  tb.toolButton(g1, {
    title: "Debug",
    iconSvg: I_DEBUG,
    onClick: () => {
      ensureLayoutMode();
      wallDebugEnabled = !wallDebugEnabled;
      rebuildWallPlanMesh();
    }
  });
  tb.toolButton(g1, { title: "Window", iconSvg: I_WINDOW, onClick: () => (ensureLayoutMode(), addOrSelectWindow()) });
  tb.toolButton(g1, { title: "Door (TODO)", iconSvg: I_DOOR, onClick: () => ensureLayoutMode() });

  const gEdit = tb.addGroup("Edit");
  undoBtnEl = tb.toolButton(gEdit, {
    title: "Undo (Ctrl+Z)",
    iconSvg: I_UNDO,
    onClick: () => {
      ensureLayoutMode();
      undo();
    }
  });
  redoBtnEl = tb.toolButton(gEdit, {
    title: "Redo (Ctrl+Y / Ctrl+Shift+Z)",
    iconSvg: I_REDO,
    onClick: () => {
      ensureLayoutMode();
      redo();
    }
  });
  tb.toolButton(gEdit, {
    title: "Align (A)",
    iconSvg: I_ALIGN,
    onClick: () => {
      setToolAlign();
    }
  });
  tb.toolButton(gEdit, {
    title: "Trim",
    iconSvg: I_TRIM,
    onClick: () => {
      setToolTrim();
    }
  });
  tb.toolButton(gEdit, {
    title: "Dimension (D)",
    iconSvg: I_DIM,
    onClick: () => {
      setToolDimension();
    }
  });

  const g2 = tb.addGroup();
  tb.toolButton(g2, { title: "Add drawer", iconSvg: I_CABINET, onClick: () => (ensureLayoutMode(), addInstance("drawer_low")) });
  tb.toolButton(g2, { title: "Add fridge", iconSvg: I_CABINET, onClick: () => (ensureLayoutMode(), addInstance("fridge_tall")) });
  tb.toolButton(g2, { title: "Add shelves", iconSvg: I_CABINET, onClick: () => (ensureLayoutMode(), addInstance("shelves")) });
  tb.toolButton(g2, { title: "Add corner", iconSvg: I_CABINET, onClick: () => (ensureLayoutMode(), addInstance("corner_shelf_lower")) });
  tb.toolButton(g2, {
    title: "2D",
    iconSvg: I_GRID2D,
    onClick: () => {
      ensureLayoutMode();
      view2d.checked = !view2d.checked;
      setView2d(view2d.checked);
    }
  });
  tb.toolButton(g2, {
    title: "Duplicate",
    iconSvg: I_DUP,
    onClick: () => {
      ensureLayoutMode();
      if (!selectedInstanceId) return;
      duplicateInstance(selectedInstanceId);
    }
  });
  tb.toolButton(g2, {
    title: "Delete",
    iconSvg: I_TRASH,
    onClick: () => {
      ensureLayoutMode();
      if (!selectedInstanceId) return;
      deleteInstance(selectedInstanceId);
    }
  });

  const g3 = tb.addGroup();
  tb.panelButton(g3, {
    title: "Underlay",
    iconSvg: I_UNDERLAY,
    buildPanel(panelEl) {
      const row = (label: string, el: HTMLElement) => {
        const wrap = document.createElement("div");
        wrap.className = "row";
        const l = document.createElement("label");
        l.textContent = label;
        wrap.appendChild(l);
        wrap.appendChild(el);
        panelEl.appendChild(wrap);
      };

      const file = document.createElement("input");
      file.type = "file";
      file.accept = ".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf";
      row("Upload", file);

      const scaleInput = document.createElement("input");
      scaleInput.type = "text";
      scaleInput.inputMode = "decimal";
      scaleInput.value = "1";
      row("Scale (x or 1:n)", scaleInput);
      underlayScaleEl = scaleInput;

      const opacity = document.createElement("input");
      opacity.type = "range";
      opacity.min = "0";
      opacity.max = "1";
      opacity.step = "0.01";
      opacity.value = String(underlayState.opacity);
      row("Opacity", opacity);
      underlayOpacityEl = opacity;

      const rot = document.createElement("input");
      rot.type = "number";
      rot.step = "1";
      rot.value = String(underlayState.rotationDeg);
      row("Rotate (deg)", rot);
      underlayRotEl = rot;

      const offX = document.createElement("input");
      offX.type = "number";
      offX.step = "1";
      offX.value = String(underlayState.offsetMm.x);
      row("Offset X (mm)", offX);
      underlayOffXEl = offX;

      const offZ = document.createElement("input");
      offZ.type = "number";
      offZ.step = "1";
      offZ.value = String(underlayState.offsetMm.z);
      row("Offset Z (mm)", offZ);
      underlayOffZEl = offZ;

      const known = document.createElement("input");
      known.type = "number";
      known.step = "1";
      known.value = String(underlayCal.knownMm);
      row("Calibrate (mm)", known);

      const actions = document.createElement("div");
      actions.className = "actions";
      panelEl.appendChild(actions);

      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.textContent = "Confirm";
      actions.appendChild(confirmBtn);

      const pinBtn = document.createElement("button");
      pinBtn.type = "button";
      pinBtn.textContent = "Pin selected";
      actions.appendChild(pinBtn);

      const unpinUnderlayBtn = document.createElement("button");
      unpinUnderlayBtn.type = "button";
      unpinUnderlayBtn.textContent = "Unpin underlay";
      actions.appendChild(unpinUnderlayBtn);

      const calBtn = document.createElement("button");
      calBtn.type = "button";
      calBtn.textContent = "Calibrate";
      actions.appendChild(calBtn);

      const refScaleBtn = document.createElement("button");
      refScaleBtn.type = "button";
      refScaleBtn.textContent = "Reference scale";
      actions.appendChild(refScaleBtn);

      const resetScaleBtn = document.createElement("button");
      resetScaleBtn.type = "button";
      resetScaleBtn.textContent = "Reset scale";
      actions.appendChild(resetScaleBtn);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "Remove";
      actions.appendChild(removeBtn);

      underlayStatusEl = document.createElement("div");
      underlayStatusEl.className = "muted";
      underlayStatusEl.style.marginTop = "8px";
      underlayStatusEl.textContent = "Upload PDF/PNG and calibrate 1:1.";
      panelEl.appendChild(underlayStatusEl);

      file.addEventListener("change", async () => {
        ensureLayoutMode();
        const f = file.files?.[0] ?? null;
        if (!f) return;
        const parseScale = (s: string) => {
          const v = s.trim().replace(",", ".");
          if (v.includes(":") || v.includes("/")) {
            const parts = v.split(v.includes(":") ? ":" : "/").map((x) => x.trim());
            const a = Number(parts[0]);
            const b = Number(parts[1]);
            if (Number.isFinite(a) && Number.isFinite(b) && a !== 0) return Math.abs(b / a);
          }
          const n = Number(v);
          if (Number.isFinite(n)) return Math.abs(n);
          return null;
        };

        const scalePrompt = window.prompt("Mierka pri importe (x alebo 1:n)", scaleInput.value);
        if (scalePrompt !== null && scalePrompt.trim() !== "") scaleInput.value = scalePrompt.trim();
        const parsed = parseScale(scaleInput.value) ?? 1;
        const uploadScale = Math.max(0.001, parsed);
        scaleInput.value = String(uploadScale);
        setUnderlayStatus("Loading...");
        try {
          const res = await loadUnderlayToCanvas(f);
          let physical = res.physicalSizeMm ?? null;
          if ((res.kind === "png" || res.kind === "jpg") && !physical) {
            const wPrompt = window.prompt("Obrázok šírka v mm (prázdne = fit do miestnosti)", "");
            const wMm = wPrompt && wPrompt.trim().length > 0 ? Number(wPrompt.trim().replace(",", ".")) : null;
            if (wMm && Number.isFinite(wMm) && wMm > 0) {
              const aspect = res.canvas.height / Math.max(1, res.canvas.width);
              physical = { w: wMm, h: wMm * aspect };
            }
          }

          setUnderlayFromCanvas(res.canvas, res.name, res.kind, physical);
          underlayState.scale = uploadScale;
          const t = ctl().target;
          underlayState.offsetMm = { x: Math.round(t.x * 1000), z: Math.round(t.z * 1000) };
          updateUnderlayTransform();
          if (underlayScaleEl) underlayScaleEl.value = String(underlayState.scale);
          opacity.value = String(underlayState.opacity);
          rot.value = String(underlayState.rotationDeg);
          offX.value = String(underlayState.offsetMm.x);
          offZ.value = String(underlayState.offsetMm.z);
          const mmTxt = physical ? ` - ${Math.round(physical.w)}x${Math.round(physical.h)} mm` : "";
          setUnderlayStatus(`Underlay (${res.kind.toUpperCase()}): ${res.name}${mmTxt}`);
        } catch (e) {
          setUnderlayStatus(`Error: ${(e as Error).message}`);
        } finally {
          file.value = "";
        }
      });

      const setPending = () => setUnderlayStatus("Pending changes (Confirm).");

      opacity.addEventListener("input", setPending);
      rot.addEventListener("input", setPending);
      offX.addEventListener("input", setPending);
      offZ.addEventListener("input", setPending);
      scaleInput.addEventListener("input", setPending);

      confirmBtn.addEventListener("click", () => {
        ensureLayoutMode();
        if (!underlayMesh.visible) {
          setUnderlayStatus("Upload underlay first.");
          return;
        }

        const v = scaleInput.value.trim().replace(",", ".");
        let scale = 1;
        if (v.includes(":") || v.includes("/")) {
          const parts = v.split(v.includes(":") ? ":" : "/").map((x) => x.trim());
          const a = Number(parts[0]);
          const b = Number(parts[1]);
          if (Number.isFinite(a) && Number.isFinite(b) && a !== 0) scale = Math.abs(b / a);
        } else {
          const n = Number(v);
          if (Number.isFinite(n)) scale = Math.abs(n);
        }

        underlayState.scale = Math.max(0.001, scale || 1);
        scaleInput.value = String(underlayState.scale);
        underlayState.opacity = Math.min(1, Math.max(0, Number(opacity.value) || 0));
        underlayState.rotationDeg = Number(rot.value) || 0;
        underlayState.offsetMm.x = Number(offX.value) || 0;
        underlayState.offsetMm.z = Number(offZ.value) || 0;
        updateUnderlayTransform();
        setUnderlayStatus("Confirmed.");
      });

      pinBtn.addEventListener("click", () => {
        ensureLayoutMode();
        for (const id of selectedInstanceIds) pinnedInstanceIds.add(id);
        for (const id of selectedWallIds) pinnedWallIds.add(id);
        if (selectedKind === "underlay" && underlayMesh.visible) {
          underlayState.pinned = true;
          underlayDragState.active = false;
          underlayDragState.pointerId = null;
          if (selectedUnderlayBox) {
            scene.remove(selectedUnderlayBox);
            selectedUnderlayBox.geometry.dispose();
            (selectedUnderlayBox.material as THREE.Material).dispose();
            selectedUnderlayBox = null;
          }
          selectedKind = null;
        }
        setSelectedWall(null);
        setSelectedModule(null);
        setUnderlayStatus("Pinned.");
      });

      unpinUnderlayBtn.addEventListener("click", () => {
        ensureLayoutMode();
        underlayState.pinned = false;
        setUnderlayStatus("Underlay unpinned.");
      });

      calBtn.addEventListener("click", () => {
        ensureLayoutMode();
        if (!underlayMesh.visible) {
          setUnderlayStatus("Upload underlay first.");
          return;
        }
        underlayCal.knownMm = Math.max(1, Number(known.value) || 1);
        underlayCal.mode = "calibrate";
        underlayCal.active = true;
        underlayCal.first = null;
        setUnderlayStatus("Calibrate: click first point...");
      });

      refScaleBtn.addEventListener("click", () => {
        ensureLayoutMode();
        if (!underlayMesh.visible) {
          setUnderlayStatus("Upload underlay first.");
          return;
        }
        underlayCal.mode = "reference";
        underlayCal.active = true;
        underlayCal.first = null;
        setUnderlayStatus("Reference scale: click first point...");
      });

      resetScaleBtn.addEventListener("click", () => {
        ensureLayoutMode();
        underlayState.scale = 1;
        updateUnderlayTransform();
        setUnderlayStatus("Scale reset.");
        if (underlayScaleEl) underlayScaleEl.value = "1";
      });

      removeBtn.addEventListener("click", () => {
        ensureLayoutMode();
        clearUnderlay();
        setUnderlayStatus("Underlay removed.");
      });
    }
  });

  const g4 = tb.addGroup();
  tb.toolButton(g4, { title: "Reset defaults", iconSvg: I_RESET, onClick: () => args.resetBtn.click() });
  tb.toolButton(g4, { title: "Export JSON", iconSvg: I_EXPORT, onClick: () => args.exportBtn.click() });
  tb.toolButton(g4, { title: "Copy export", iconSvg: I_COPY, onClick: () => args.copyBtn.click() });
  tb.toolButton(g4, {
    title: "Reset view",
    iconSvg: I_VIEW,
    onClick: () => (args.viewerEl.querySelector("#resetViewBtn") as HTMLButtonElement | null)?.click()
  });

  modeSelect.addEventListener("change", () => {
    const next = modeSelect.value === "layout" ? "layout" : "build";
    setMode(next);
  });

  addDrawerBtn.addEventListener("click", () => addInstance("drawer_low"));
  addNestedDrawerBtn.addEventListener("click", () => addInstance("nested_drawer_low"));
  addFridgeBtn.addEventListener("click", () => addInstance("fridge_tall"));
  addShelvesBtn.addEventListener("click", () => addInstance("shelves"));
  addCornerBtn.addEventListener("click", () => addInstance("corner_shelf_lower"));
  addFlapBtn.addEventListener("click", () => addInstance("flap_shelves_low"));
  addSwingBtn.addEventListener("click", () => addInstance("swing_shelves_low"));
  addOvenBaseBtn.addEventListener("click", () => addInstance("oven_base_low"));
  addMicrowaveTallBtn.addEventListener("click", () => addInstance("microwave_oven_tall"));
  addTopDrawersDoorsBtn.addEventListener("click", () => addInstance("top_drawers_doors_low"));
  addWindowBtn.addEventListener("click", () => addOrSelectWindow());

  dupBtn.addEventListener("click", () => {
    if (!selectedInstanceId) return;
    duplicateInstance(selectedInstanceId);
  });

  delBtn.addEventListener("click", () => {
    if (!selectedInstanceId) return;
    deleteInstance(selectedInstanceId);
  });

  view2d.addEventListener("change", () => {
    if (mode !== "layout") return;
    setView2d(view2d.checked);
  });

  function findInstance(id: string) {
    return instances.find((x) => x.id === id) ?? null;
  }

  function instanceWorldBox(inst: LayoutInstance) {
    inst.root.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(inst.module);
  }

  function instanceWorldBoxAt(inst: LayoutInstance, pos: THREE.Vector3) {
    const prev = inst.root.position.clone();
    inst.root.position.copy(pos);
    const box = instanceWorldBox(inst);
    inst.root.position.copy(prev);
    inst.root.updateMatrixWorld(true);
    return box;
  }

  function roomContainsBoxXZ(box: THREE.Box3, eps = 0.0005) {
    return (
      box.min.x >= -roomBounds.halfW - eps &&
      box.max.x <= roomBounds.halfW + eps &&
      box.min.z >= -roomBounds.halfD - eps &&
      box.max.z <= roomBounds.halfD + eps
    );
  }

  function ensurePickAndOutline(inst: LayoutInstance) {
    const box = inst.localBox;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Pick mesh (invisible but raycastable)
    const pickH = 0.02;
    inst.pick.geometry.dispose();
    inst.pick.geometry = new THREE.BoxGeometry(Math.max(0.01, size.x), pickH, Math.max(0.01, size.z));
    inst.pick.position.set(center.x, pickH / 2, center.z);

    // Outline (XZ rectangle)
    const pts = [
      new THREE.Vector3(box.min.x, 0.01, box.min.z),
      new THREE.Vector3(box.max.x, 0.01, box.min.z),
      new THREE.Vector3(box.max.x, 0.01, box.max.z),
      new THREE.Vector3(box.min.x, 0.01, box.max.z),
      new THREE.Vector3(box.min.x, 0.01, box.min.z)
    ];
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    inst.outline.geometry.dispose();
    inst.outline.geometry = g;
    inst.outline.position.set(0, 0, 0);
  }

  function createInstance(nextParams: ModuleParams, opts?: { id?: string }) {
    const id = opts?.id ?? `m${instanceCounter++}`;
    // Keep counter ahead of restored ids ("m123" => 124)
    if (opts?.id) {
      const m = /^m(\d+)$/.exec(id);
      const n = m ? Number(m[1]) : NaN;
      if (Number.isFinite(n) && n >= instanceCounter) instanceCounter = n + 1;
    }
    const root = new THREE.Group();
    root.name = `module_${id}`;

    const module = buildModule(nextParams);
    module.name = `moduleGeom_${id}`;
    root.add(module);

    const localBox = new THREE.Box3().setFromObject(module);

    const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const pick = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.1), pickMat);
    pick.name = `pick_${id}`;
    pick.userData.instanceId = id;
    root.add(pick);

    const lineMat = new THREE.LineBasicMaterial({ color: 0x7a8499, transparent: true, opacity: 0.6 });
    const outline = new THREE.Line(gEmpty(), lineMat);
    outline.name = `outline_${id}`;
    root.add(outline);

    const inst: LayoutInstance = { id, params: nextParams, root, module, localBox, pick, outline };
    ensurePickAndOutline(inst);
    return inst;
  }

  function gEmpty() {
    return new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]);
  }

  function updateLayoutPanel() {
    layoutPanel.setRows(
      instances.map((i) => ({
        id: i.id,
        type: i.params.type,
        xMm: i.root.position.x * 1000,
        zMm: i.root.position.z * 1000
      }))
    );
    layoutPanel.setSelected(selectedInstanceId);
  }

  function setInstanceSelected(id: string | null) {
    selectedInstanceId = id;
    layoutPanel.setSelected(id);

    if (selectedInstanceBox) {
      scene.remove(selectedInstanceBox);
      selectedInstanceBox.geometry.dispose();
      (selectedInstanceBox.material as THREE.Material).dispose();
      selectedInstanceBox = null;
    }

    const inst = id ? findInstance(id) : null;
    if (!inst) return;
    selectedInstanceBox = new THREE.BoxHelper(inst.root, 0x3ddc97);
    selectedInstanceBox.name = "instanceSelectionBox";
    scene.add(selectedInstanceBox);
  }

    function setSelectedModule(id: string | null) {
      if (layoutTool !== "wall") layoutTool = "select";
      if (id && pinnedInstanceIds.has(id)) id = null;
      selectedKind = id ? "module" : null;
      selectedInstanceId = id;
      selectedInstanceIds.clear();
      if (id) selectedInstanceIds.add(id);
      selectedWallId = null;
      selectedWallIds.clear();
      selectedDimensionId = null;
      setInstanceSelected(id);
      if (selectedUnderlayBox) {
        scene.remove(selectedUnderlayBox);
        selectedUnderlayBox.geometry.dispose();
        (selectedUnderlayBox.material as THREE.Material).dispose();
        selectedUnderlayBox = null;
      }
      updateSelectionHighlights();
      updateDimensionSelectionHighlights();
      mountProps();
    }

  function setSelectedWindow() {
    if (layoutTool !== "wall") layoutTool = "select";
    selectedKind = "window";
    selectedWallId = null;
    selectedDimensionId = null;
    setInstanceSelected(null);
    if (selectedUnderlayBox) {
      scene.remove(selectedUnderlayBox);
      selectedUnderlayBox.geometry.dispose();
      (selectedUnderlayBox.material as THREE.Material).dispose();
      selectedUnderlayBox = null;
    }
    updateDimensionSelectionHighlights();
    mountProps();
  }

  function setSelectedUnderlay() {
    if (layoutTool !== "wall") layoutTool = "select";
    if (!underlayMesh.visible || underlayState.pinned) return;
    selectedKind = "underlay";
    selectedWallId = null;
    selectedWallIds.clear();
    selectedInstanceId = null;
    selectedInstanceIds.clear();
    selectedDimensionId = null;
    setInstanceSelected(null);
    if (selectedWallBox) {
      scene.remove(selectedWallBox);
      selectedWallBox.geometry.dispose();
      (selectedWallBox.material as THREE.Material).dispose();
      selectedWallBox = null;
    }
    if (selectedUnderlayBox) {
      scene.remove(selectedUnderlayBox);
      selectedUnderlayBox.geometry.dispose();
      (selectedUnderlayBox.material as THREE.Material).dispose();
      selectedUnderlayBox = null;
    }
    selectedUnderlayBox = new THREE.BoxHelper(underlayMesh, 0x5c8cff);
    selectedUnderlayBox.name = "underlaySelectionBox";
    scene.add(selectedUnderlayBox);
    mountProps();
  }

  function setSelectedDimension(id: string | null) {
    if (layoutTool !== "wall") layoutTool = "select";
    selectedKind = id ? "dimension" : null;
    selectedDimensionId = id;
    selectedWallId = null;
    selectedWallIds.clear();
    selectedInstanceId = null;
    selectedInstanceIds.clear();
    setInstanceSelected(null);
    if (selectedWallBox) {
      scene.remove(selectedWallBox);
      selectedWallBox.geometry.dispose();
      (selectedWallBox.material as THREE.Material).dispose();
      selectedWallBox = null;
    }
    if (selectedUnderlayBox) {
      scene.remove(selectedUnderlayBox);
      selectedUnderlayBox.geometry.dispose();
      (selectedUnderlayBox.material as THREE.Material).dispose();
      selectedUnderlayBox = null;
    }
    showWallSnapMarkersFor(null);
    updateSelectionHighlights();
    updateDimensionSelectionHighlights();
    mountProps();
  }

  function setSelectedWall(id: string | null) {
    if (layoutTool !== "wall") layoutTool = "select";
    if (id && pinnedWallIds.has(id)) id = null;
    selectedKind = id ? "wall" : null;
    selectedWallId = id;
    selectedWallIds.clear();
    if (id) selectedWallIds.add(id);
    setInstanceSelected(null);
    selectedInstanceIds.clear();
    selectedDimensionId = null;
    if (selectedUnderlayBox) {
      scene.remove(selectedUnderlayBox);
      selectedUnderlayBox.geometry.dispose();
      (selectedUnderlayBox.material as THREE.Material).dispose();
      selectedUnderlayBox = null;
    }

    if (selectedWallBox) {
      scene.remove(selectedWallBox);
      selectedWallBox.geometry.dispose();
      (selectedWallBox.material as THREE.Material).dispose();
      selectedWallBox = null;
    }

    const w = id ? walls.find((x) => x.id === id) ?? null : null;
    if (!w) {
      showWallSnapMarkersFor(null);
      updateSelectionHighlights();
      mountProps();
      return;
    }

    selectedWallBox = new THREE.BoxHelper(w.root, 0x3ddc97);
    selectedWallBox.name = "wallSelectionBox";
    scene.add(selectedWallBox);
    showWallSnapMarkersFor(id);
    updateSelectionHighlights();
    updateDimensionSelectionHighlights();
    mountProps();
  }

  function deleteWall(id: string) {
    const idx = walls.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const w = walls[idx];
    removeWall(w);

    if (selectedWallId === id) {
      setSelectedWall(null);
    }

    // keep properties in sync
    mountProps();
    commitHistory();
  }

  function createWindow(defaultWall: WallId = "back") {
    const params: WindowParams = {
      wall: defaultWall,
      widthMm: 900,
      heightMm: 900,
      sillHeightMm: 900,
      centerMm: 0
    };

    const root = new THREE.Group();
    root.name = "windowRoot";

    const pick = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.02), new THREE.MeshBasicMaterial({ visible: false }));
    pick.name = "windowPick";
    pick.userData.kind = "window";
    root.add(pick);

    const outline = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.95 })
    );
    outline.name = "windowOutline";
    root.add(outline);

    const inst: WindowInstance = { params, root, pick, outline };
    updateWindowTransform(inst);
    return inst;
  }

  function clampWindowParams(p: WindowParams) {
    const widthMm = Math.max(200, Math.min(4800, Math.round(p.widthMm)));
    const heightMm = Math.max(200, Math.min(2600, Math.round(p.heightMm)));
    const maxSill = Math.max(0, Math.round(roomBounds.h * 1000 - heightMm));
    const sillHeightMm = Math.max(0, Math.min(Math.round(p.sillHeightMm), maxSill));

    const axisHalfMm = wallDefs[p.wall].axisHalf * 1000;
    const maxCenter = Math.max(0, axisHalfMm - widthMm / 2);
    const centerMm = Math.max(-maxCenter, Math.min(Math.round(p.centerMm), maxCenter));

    return { ...p, widthMm, heightMm, sillHeightMm, centerMm };
  }

  function updateWindowTransform(inst: WindowInstance) {
    inst.params = clampWindowParams(inst.params);
    const def = wallDefs[inst.params.wall];

    const widthM = inst.params.widthMm / 1000;
    const heightM = inst.params.heightMm / 1000;
    const centerAxisM = inst.params.centerMm / 1000;

    const y = inst.params.sillHeightMm / 1000 + heightM / 2;
    const pos = def.fixedPos.clone();
    pos.y = y;
    if (def.axis === "x") pos.x = centerAxisM;
    else pos.z = centerAxisM;

    inst.root.position.copy(pos);

    if (inst.params.wall === "back") inst.root.rotation.set(0, 0, 0);
    if (inst.params.wall === "left") inst.root.rotation.set(0, Math.PI / 2, 0);
    if (inst.params.wall === "right") inst.root.rotation.set(0, -Math.PI / 2, 0);

    inst.pick.geometry.dispose();
    inst.pick.geometry = new THREE.BoxGeometry(Math.max(0.05, widthM), Math.max(0.05, heightM), 0.03);
    inst.pick.position.set(0, 0, 0);

    const pts = [
      new THREE.Vector3(-widthM / 2, -heightM / 2, 0.006),
      new THREE.Vector3(widthM / 2, -heightM / 2, 0.006),
      new THREE.Vector3(widthM / 2, heightM / 2, 0.006),
      new THREE.Vector3(-widthM / 2, heightM / 2, 0.006),
      new THREE.Vector3(-widthM / 2, -heightM / 2, 0.006)
    ];
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    inst.outline.geometry.dispose();
    inst.outline.geometry = g;

    const centerWorld = inst.root.getWorldPosition(new THREE.Vector3());
    setWindowOpening({
      center: centerWorld,
      inwardNormal: def.inwardNormal,
      width: widthM,
      height: heightM
    });

    setWindowCutout({
      wall: inst.params.wall,
      centerAxisM: centerAxisM,
      sillM: inst.params.sillHeightMm / 1000,
      widthM,
      heightM
    });
  }

  function addOrSelectWindow() {
    if (mode !== "layout") return;
    if (!windowInst) {
      windowInst = createWindow("back");
      scene.add(windowInst.root);
    }
    setSelectedWindow();
  }

  function mountWindowControls() {
    windowEditorHost.innerHTML = "";
    if (!windowInst) return;

    const title = document.createElement("div");
    title.textContent = "Window";
    title.style.margin = "8px 0";
    title.style.fontWeight = "600";
    windowEditorHost.appendChild(title);

    const row = (label: string, el: HTMLElement) => {
      const wrap = document.createElement("div");
      wrap.style.display = "grid";
      wrap.style.gridTemplateColumns = "140px 1fr";
      wrap.style.gap = "8px";
      wrap.style.alignItems = "center";
      const l = document.createElement("div");
      l.textContent = label;
      wrap.appendChild(l);
      wrap.appendChild(el);
      windowEditorHost.appendChild(wrap);
    };

    const wallSel = document.createElement("select");
    wallSel.innerHTML = `<option value="back">back</option><option value="left">left</option><option value="right">right</option>`;
    wallSel.value = windowInst.params.wall;
    wallSel.addEventListener("change", () => {
      if (!windowInst) return;
      windowInst.params.wall = wallSel.value as WallId;
      updateWindowTransform(windowInst);
      mountWindowControls();
    });
    row("Wall", wallSel);

    const mkNum = (v: number) => {
      const i = document.createElement("input");
      i.type = "number";
      i.value = String(v);
      i.step = "1";
      return i;
    };

    const width = mkNum(windowInst.params.widthMm);
    width.addEventListener("input", () => {
      if (!windowInst) return;
      windowInst.params.widthMm = Number(width.value);
      updateWindowTransform(windowInst);
    });
    row("Width (mm)", width);

    const height = mkNum(windowInst.params.heightMm);
    height.addEventListener("input", () => {
      if (!windowInst) return;
      windowInst.params.heightMm = Number(height.value);
      updateWindowTransform(windowInst);
    });
    row("Height (mm)", height);

    const sill = mkNum(windowInst.params.sillHeightMm);
    sill.addEventListener("input", () => {
      if (!windowInst) return;
      windowInst.params.sillHeightMm = Number(sill.value);
      updateWindowTransform(windowInst);
    });
    row("Sill (mm)", sill);

    const center = mkNum(windowInst.params.centerMm);
    center.addEventListener("input", () => {
      if (!windowInst) return;
      windowInst.params.centerMm = Number(center.value);
      updateWindowTransform(windowInst);
    });
    row(windowInst.params.wall === "back" ? "Center X (mm)" : "Center Z (mm)", center);
  }

  function clearWindowLightIfMissing() {
    if (!windowInst) setWindowOpening(null);
    if (!windowInst) setWindowCutout(null);
  }

  function mountInstanceControls(inst: LayoutInstance) {
    instanceEditorHost.innerHTML = "";

    const worktopArgs = { getWorktopThicknessMm: () => 0 };

    if (inst.params.type === "drawer_low") {
      createDrawerLowControls(instanceEditorHost, inst.params, { ...worktopArgs, onChange: () => rebuildInstance(inst) });
      return;
    }
    if (inst.params.type === "nested_drawer_low") {
      createNestedDrawerLowControls(instanceEditorHost, inst.params, { ...worktopArgs, onChange: () => rebuildInstance(inst) });
      return;
    }
    if (inst.params.type === "fridge_tall") {
      createFridgeTallControls(instanceEditorHost, inst.params, { onChange: () => rebuildInstance(inst) });
      return;
    }
    if (inst.params.type === "flap_shelves_low") {
      createFlapShelvesLowControls(instanceEditorHost, inst.params, { ...worktopArgs, onChange: () => rebuildInstance(inst) });
      return;
    }
    if (inst.params.type === "swing_shelves_low") {
      createSwingShelvesLowControls(instanceEditorHost, inst.params, { ...worktopArgs, onChange: () => rebuildInstance(inst) });
      return;
    }
    if (inst.params.type === "oven_base_low") {
      createOvenBaseLowControls(instanceEditorHost, inst.params, { ...worktopArgs, onChange: () => rebuildInstance(inst) });
      return;
    }
    if (inst.params.type === "microwave_oven_tall") {
      createMicrowaveOvenTallControls(instanceEditorHost, inst.params, { ...worktopArgs, onChange: () => rebuildInstance(inst) });
      return;
    }
    if (inst.params.type === "top_drawers_doors_low") {
      createTopDrawersDoorsLowControls(instanceEditorHost, inst.params, { ...worktopArgs, onChange: () => rebuildInstance(inst) });
      return;
    }
    if (inst.params.type === "shelves") {
      createShelvesControls(instanceEditorHost, inst.params, { onChange: () => rebuildInstance(inst) });
      return;
    }

    createCornerShelfLowerControls(instanceEditorHost, inst.params, { onChange: () => rebuildInstance(inst) });
  }

  function rebuildInstance(inst: LayoutInstance) {
    const errors = validateModule(inst.params);
    renderErrors(args.errorsEl, errors);
    if (errors.length > 0) return;

    const next = buildModule(inst.params);

    const prevModule = inst.module;
    const prevBox = inst.localBox.clone();
    const prevPos = inst.root.position.clone();

    inst.root.remove(prevModule);
    inst.module = next;
    inst.root.add(inst.module);
    inst.localBox = new THREE.Box3().setFromObject(inst.module);
    ensurePickAndOutline(inst);

    const clamped = applyWallConstraints(inst, inst.root.position.clone());
    inst.root.position.copy(clamped);

    const inRoom = roomContainsBoxXZ(instanceWorldBox(inst));
    const overlaps = anyOverlap(inst, null);
    if (!inRoom || overlaps) {
      // Revert (layout must never allow overlaps)
      inst.root.remove(inst.module);
      disposeObject3D(inst.module);
      inst.module = prevModule;
      inst.localBox = prevBox;
      inst.root.position.copy(prevPos);
      inst.root.add(inst.module);
      ensurePickAndOutline(inst);
      renderErrors(args.errorsEl, [
        !inRoom ? "Module doesn't fit inside the room bounds in layout mode." : "Module would overlap another module in layout mode."
      ]);
      return;
    }

    disposeObject3D(prevModule);
    updateLayoutPanel();
  }

  function selectInstanceById(id: string) {
    if (mode !== "layout") return;
    const inst = findInstance(id);
    if (!inst) return;
    setSelectedModule(id);
  }

  function duplicateInstance(id: string) {
    if (mode !== "layout") return;
    const inst = findInstance(id);
    if (!inst) return;
    const clonedParams = structuredClone(inst.params) as ModuleParams;
    const next = createInstance(clonedParams);
    next.root.position.copy(inst.root.position).add(new THREE.Vector3(0.2, 0, 0.2));
    layoutRoot.add(next.root);
    instances.push(next);
    placeWithoutOverlap(next);
    setSelectedModule(next.id);
    updateLayoutPanel();
  }

  function deleteInstance(id: string) {
    if (mode !== "layout") return;
    const idx = instances.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const inst = instances[idx];
    if (selectedInstanceId === id) setSelectedModule(null);
    layoutRoot.remove(inst.root);
    disposeObject3D(inst.root);
    instances.splice(idx, 1);
    updateLayoutPanel();
  }

  function placeWithoutOverlap(inst: LayoutInstance) {
    const step = 0.25;
    const maxR = 40;
    const origin = applyWallConstraints(inst, inst.root.position.clone());
    for (let r = 0; r < maxR; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          const desired = new THREE.Vector3(origin.x + dx * step, 0, origin.z + dz * step);
          const clamped = applyWallConstraints(inst, desired);
          inst.root.position.copy(clamped);
          if (!roomContainsBoxXZ(instanceWorldBox(inst))) continue;
          if (!anyOverlap(inst, null)) return;
        }
      }
    }
  }

  function aabbOverlapXZ(a: THREE.Box3, b: THREE.Box3, eps = 0.0005) {
    const ax0 = a.min.x;
    const ax1 = a.max.x;
    const az0 = a.min.z;
    const az1 = a.max.z;
    const bx0 = b.min.x;
    const bx1 = b.max.x;
    const bz0 = b.min.z;
    const bz1 = b.max.z;
    return ax0 < bx1 - eps && ax1 > bx0 + eps && az0 < bz1 - eps && az1 > bz0 + eps;
  }

  function anyOverlap(moving: LayoutInstance, ignoreId: string | null) {
    const a = instanceWorldBox(moving);
    for (const other of instances) {
      if (other.id === moving.id) continue;
      if (ignoreId && other.id === ignoreId) continue;
      const b = instanceWorldBox(other);
      if (aabbOverlapXZ(a, b)) return true;
    }
    return false;
  }

  function anyOverlapIgnoring(moving: LayoutInstance, ignoreIds: Set<string>) {
    const a = instanceWorldBox(moving);
    for (const other of instances) {
      if (other.id === moving.id) continue;
      if (ignoreIds.has(other.id)) continue;
      const b = instanceWorldBox(other);
      if (aabbOverlapXZ(a, b)) return true;
    }
    return false;
  }

  function snapPosition(moving: LayoutInstance, desired: THREE.Vector3) {
    const snapDist = 0.03; // 30mm
    const minOverlap = 0.05; // 50mm
    const alignBackMaxShift = 0.25; // 250mm (align "backs" when snapping side-by-side)

    const currentPos = moving.root.position.clone();
    moving.root.position.copy(desired);
    const a = instanceWorldBox(moving);

    const candidates: Array<{ pos: THREE.Vector3; score: number }> = [];
    candidates.push({ pos: desired.clone(), score: 0 });

    for (const other of instances) {
      if (other.id === moving.id) continue;
      const b = instanceWorldBox(other);

      const overlapX = Math.max(0, Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x));
      const overlapZ = Math.max(0, Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z));
      const backAlignDz = b.min.z - a.min.z;

      // Snap along X (requires Z overlap)
      if (overlapZ >= minOverlap) {
        const d1 = b.min.x - a.max.x;
        const d2 = b.max.x - a.min.x;

        const pushCandidate = (dx: number) => {
          const base = desired.clone().add(new THREE.Vector3(dx, 0, 0));
          const scoreBase = Math.abs(dx);
          candidates.push({ pos: base, score: scoreBase });

          // When snapping modules together side-by-side, also align "backs" (min.z) to avoid staggered back edges.
          if (Math.abs(backAlignDz) <= alignBackMaxShift) {
            candidates.push({
              pos: base.clone().add(new THREE.Vector3(0, 0, backAlignDz)),
              score: scoreBase + Math.abs(backAlignDz) * 0.15
            });
          }
        };

        if (Math.abs(d1) <= snapDist) pushCandidate(d1);
        if (Math.abs(d2) <= snapDist) pushCandidate(d2);
      }

      // Snap along Z (requires X overlap)
      if (overlapX >= minOverlap) {
        const d1 = b.min.z - a.max.z;
        const d2 = b.max.z - a.min.z;

        const pushCandidate = (dz: number) => {
          const base = desired.clone().add(new THREE.Vector3(0, 0, dz));
          const scoreBase = Math.abs(dz);
          candidates.push({ pos: base, score: scoreBase });
        };

        if (Math.abs(d1) <= snapDist) pushCandidate(d1);
        if (Math.abs(d2) <= snapDist) pushCandidate(d2);
      }
    }

    moving.root.position.copy(currentPos);

    let best = desired.clone();
    let bestScore = Infinity;
    for (const c of candidates) {
      const clamped = applyWallConstraints(moving, c.pos);
      const prev = moving.root.position.clone();
      moving.root.position.copy(clamped);
      const overlaps = anyOverlap(moving, null);
      moving.root.position.copy(prev);
      if (overlaps) continue;
      if (c.score < bestScore) {
        bestScore = c.score;
        best = clamped;
      }
    }

    return best;
  }

  function applyWallConstraints(moving: LayoutInstance, desired: THREE.Vector3) {
    const snapDist = 0.03; // 30mm

    const currentPos = moving.root.position.clone();
    moving.root.position.copy(desired);
    const a = instanceWorldBox(moving);
    moving.root.position.copy(currentPos);

    const next = desired.clone();

    // Hard clamp inside room bounds.
    if (a.min.x < -roomBounds.halfW) next.x += -roomBounds.halfW - a.min.x;
    if (a.max.x > roomBounds.halfW) next.x -= a.max.x - roomBounds.halfW;
    if (a.min.z < -roomBounds.halfD) next.z += -roomBounds.halfD - a.min.z;
    if (a.max.z > roomBounds.halfD) next.z -= a.max.z - roomBounds.halfD;

    // Soft snap to walls when close.
    const trySnap = (delta: THREE.Vector3) => {
      const prev = moving.root.position.clone();
      moving.root.position.copy(next.clone().add(delta));
      const ok = !anyOverlap(moving, null);
      moving.root.position.copy(prev);
      if (ok) next.add(delta);
    };

    const currentPos2 = moving.root.position.clone();
    moving.root.position.copy(next);
    const b = instanceWorldBox(moving);
    moving.root.position.copy(currentPos2);

    const dxL = -roomBounds.halfW - b.min.x;
    const dxR = roomBounds.halfW - b.max.x;
    const dzB = -roomBounds.halfD - b.min.z; // back wall (-Z)
    const dzF = roomBounds.halfD - b.max.z; // front wall (+Z)

    if (Math.abs(dxL) <= snapDist) trySnap(new THREE.Vector3(dxL, 0, 0));
    if (Math.abs(dxR) <= snapDist) trySnap(new THREE.Vector3(dxR, 0, 0));
    if (Math.abs(dzB) <= snapDist) trySnap(new THREE.Vector3(0, 0, dzB));
    if (Math.abs(dzF) <= snapDist) trySnap(new THREE.Vector3(0, 0, dzF));

    return next;
  }

  function autoOrientModuleToRoomWallIfSnapped(inst: LayoutInstance, ignoreIds?: Set<string>) {
    const snapDist = 0.03; // 30mm
    const box = instanceWorldBox(inst);
    const dxL = -roomBounds.halfW - box.min.x;
    const dxR = roomBounds.halfW - box.max.x;
    const dzB = -roomBounds.halfD - box.min.z; // back (-Z)
    const dzF = roomBounds.halfD - box.max.z; // front (+Z)

    const candidates: Array<{ dist: number; rotY: number }> = [];
    if (Math.abs(dxL) <= snapDist + 1e-6) candidates.push({ dist: Math.abs(dxL), rotY: Math.PI / 2 }); // back = -X
    if (Math.abs(dxR) <= snapDist + 1e-6) candidates.push({ dist: Math.abs(dxR), rotY: -Math.PI / 2 }); // back = +X
    if (Math.abs(dzB) <= snapDist + 1e-6) candidates.push({ dist: Math.abs(dzB), rotY: 0 }); // back = -Z
    if (Math.abs(dzF) <= snapDist + 1e-6) candidates.push({ dist: Math.abs(dzF), rotY: Math.PI }); // back = +Z
    if (candidates.length === 0) return;

    candidates.sort((a, b) => a.dist - b.dist);
    const targetRot = candidates[0].rotY;

    const prevPos = inst.root.position.clone();
    const prevRot = inst.root.rotation.y;

    inst.root.rotation.y = targetRot;
    inst.root.position.copy(applyWallConstraints(inst, inst.root.position.clone()));
    const inRoom = roomContainsBoxXZ(instanceWorldBox(inst));
    const overlaps = ignoreIds ? anyOverlapIgnoring(inst, ignoreIds) : anyOverlap(inst, null);
    if (!inRoom || overlaps) {
      inst.root.rotation.y = prevRot;
      inst.root.position.copy(prevPos);
      inst.root.updateMatrixWorld(true);
      return;
    }
    inst.root.updateMatrixWorld(true);
  }

  function addInstance(type: ModuleParams["type"]) {
    if (mode !== "layout") return;
    let nextParams: ModuleParams;
    switch (type) {
      case "drawer_low":
        nextParams = makeDefaultDrawerLowParams();
        break;
      case "nested_drawer_low":
        nextParams = makeDefaultNestedDrawerLowParams();
        break;
      case "fridge_tall":
        nextParams = makeDefaultFridgeTallParams();
        break;
      case "shelves":
        nextParams = makeDefaultShelvesParams();
        break;
      case "corner_shelf_lower":
        nextParams = makeDefaultCornerShelfLowerParams();
        break;
      case "flap_shelves_low":
        nextParams = makeDefaultFlapShelvesLowParams();
        break;
      case "swing_shelves_low":
        nextParams = makeDefaultSwingShelvesLowParams();
        break;
      case "oven_base_low":
        nextParams = makeDefaultOvenBaseLowParams();
        break;
      case "microwave_oven_tall":
        nextParams = makeDefaultMicrowaveOvenTallParams();
        break;
      case "top_drawers_doors_low":
        nextParams = makeDefaultTopDrawersDoorsLowParams();
        break;
      default:
        nextParams = makeDefaultDrawerLowParams();
    }

    // Keep layout view clean (no open doors for bounding boxes).
    if ("doorOpen" in nextParams) (nextParams as any).doorOpen = false;

    const inst = createInstance(nextParams);
    inst.root.position.set(0, 0, 0);
    layoutRoot.add(inst.root);
    instances.push(inst);
    placeWithoutOverlap(inst);
    setSelectedModule(inst.id);
    updateLayoutPanel();
  }

  function setView2d(enabled: boolean) {
    viewMode = enabled ? "2d" : "3d";
    setViewMode(enabled ? "2d" : "3d");

    // Simplify visuals in 2D: hide geometry, keep outlines.
    for (const inst of instances) {
      inst.module.visible = !enabled;
      (inst.outline.material as THREE.LineBasicMaterial).opacity = enabled ? 0.95 : 0.6;
      inst.outline.visible = true;
    }

    if (windowInst) {
      (windowInst.outline.material as THREE.LineBasicMaterial).opacity = enabled ? 0.98 : 0.75;
      windowInst.outline.visible = true;
    }

    wallSnapMarkers.visible = enabled && selectedKind === "wall" && !!selectedWallId;
    updateSelectionHighlights();

      // Walls: render merged 2D mesh in plan view for clean joins.
      wallPlanGroup.visible = enabled;
      if (enabled) {
        rebuildWallPlanMesh();
        const hasMerged = !!wallPlanUnionMesh;
        for (const w of walls) w.mesh.visible = !hasMerged;
      } else {
        for (const w of walls) w.mesh.visible = true;
      }
      updateAllDimensions(renderer.domElement.getBoundingClientRect());
    }

  function setMode(next: AppMode) {
    mode = next;

    const isLayout = mode === "layout";
    buildUi.style.display = isLayout ? "none" : "";
    layoutUi.style.display = isLayout ? "" : "none";
    partsBuildHost.style.display = isLayout ? "none" : "";
    partsLayoutHost.style.display = isLayout ? "" : "none";

    args.propertiesEl.hidden = !isLayout;
    if (!isLayout) {
      layoutTool = "select";
      wallDraw.active = false;
      wallDraw.a = null;
      if (wallDraw.preview) {
        layoutRoot.remove(wallDraw.preview);
        wallDraw.preview.geometry.dispose();
        (wallDraw.preview.material as THREE.Material).dispose();
        wallDraw.preview = null;
      }
    }

    // Disable measuring in layout (for now).
    if (isLayout) {
      measureState.enabled = false;
      args.measureBtn.textContent = "Measure: Off";
      clearPreview();
      if (measureState.cursorEl) measureState.cursorEl.style.display = "none";
      args.measureReadoutEl.textContent = "";
    }

    layoutRoot.visible = isLayout;

    if (cabinetGroup) cabinetGroup.visible = !isLayout;
    clearOverlapHighlight();
    selectMesh(null);

    if (isLayout) {
      setView2d(view2d.checked);
      updateLayoutPanel();
      if (selectedKind === "window") setSelectedWindow();
      else if (selectedKind === "wall") setSelectedWall(selectedWallId);
      else setSelectedModule(selectedInstanceId);

      // Hide selection editors in right panel (use properties panel on the left).
      windowEditorHost.style.display = "none";
      instanceEditorHost.style.display = "none";
      mountProps();
    } else {
      setView2d(false);
      selectedKind = null;
      selectedWallId = null;
      windowEditorHost.style.display = "none";
      instanceEditorHost.style.display = "";
      setInstanceSelected(null);
      mountControls();
      rebuild();
      showNoProps();
    }
  }

  function buildLayoutExportPayload() {
    return {
      mode: "layout" as const,
      units: "mm" as const,
      generatedAt: new Date().toISOString(),
      window: windowInst ? windowInst.params : null,
      modules: instances.map((i) => ({
        id: i.id,
        type: i.params.type,
        positionMm: { x: Math.round(i.root.position.x * 1000), z: Math.round(i.root.position.z * 1000) },
        params: i.params
      }))
    };
  }

  const selectMesh = (mesh: THREE.Mesh | null) => {
    selectedMesh = mesh;

    if (selectedBox) {
      scene.remove(selectedBox);
      selectedBox.geometry.dispose();
      (selectedBox.material as THREE.Material).dispose();
      selectedBox = null;
    }

    if (grainArrow) {
      scene.remove(grainArrow);
      (grainArrow.line.material as THREE.Material).dispose();
      (grainArrow.cone.material as THREE.Material).dispose();
      grainArrow = null;
    }

    if (!mesh) {
      partPanel.setSelected(null);
      return;
    }

    partPanel.setSelected(mesh.name);

    selectedBox = new THREE.BoxHelper(mesh, 0xffe066);
    selectedBox.name = "selectionBox";
    scene.add(selectedBox);

    const grain = computeGrainArrow(mesh);
    if (grain) {
      grainArrow = new THREE.ArrowHelper(grain.dir, grain.origin, grain.length, 0x3ddc97, grain.length * 0.22, grain.length * 0.12);
      grainArrow.name = "grainArrow";
      scene.add(grainArrow);
    }
  };

  window.addEventListener("keydown", (ev) => {
    if (!selectedMesh) return;
    const k = ev.key.toLowerCase();
    if (k === "p") toggleSelectedPbr(selectedMesh, "all");
    if (k === "n") toggleSelectedPbr(selectedMesh, "normal");
    if (k === "r") toggleSelectedPbr(selectedMesh, "roughness");
  });

  const selectByName = (name: string) => {
    const mesh = cabinetGroup ? findSelectableMeshByName(cabinetGroup, name) : null;
    if (!mesh || !mesh.visible) {
      selectMesh(null);
      return;
    }
    selectMesh(mesh);
  };

  const setVisibleByName = (name: string, visible: boolean) => {
    if (visible) hiddenParts.delete(name);
    else hiddenParts.add(name);

    const mesh = cabinetGroup ? findSelectableMeshByName(cabinetGroup, name) : null;
    if (mesh) mesh.visible = visible;

    partPanel.updateVisibility(name, visible);

    if (selectedMesh?.name === name && !visible) selectMesh(null);
  };

  const clearOverlapHighlight = () => {
    for (const o of overlapBoxes) {
      scene.remove(o.helper);
      o.helper.geometry.dispose();
      (o.helper.material as THREE.Material).dispose();
    }
    overlapBoxes = [];
  };

  const showForHighlight = (name: string) => {
    if (hiddenParts.has(name)) {
      hiddenParts.delete(name);
      const mesh = cabinetGroup ? findSelectableMeshByName(cabinetGroup, name) : null;
      if (mesh) mesh.visible = true;
      partPanel.updateVisibility(name, true);
    }
  };

  const highlightOverlap = (a: string, b: string) => {
    if (!cabinetGroup) return;

    showForHighlight(a);
    showForHighlight(b);

    const ma = findSelectableMeshByName(cabinetGroup, a);
    const mb = findSelectableMeshByName(cabinetGroup, b);
    if (!ma || !mb) return;

    clearOverlapHighlight();

    const ha = new THREE.BoxHelper(ma, 0xff6b6b);
    const hb = new THREE.BoxHelper(mb, 0xffd166);
    scene.add(ha);
    scene.add(hb);
    overlapBoxes = [
      { mesh: ma, helper: ha },
      { mesh: mb, helper: hb }
    ];
  };

  const mountControls = () => {
    editorHost.innerHTML = "";

    const worktopArgs = { getWorktopThicknessMm: () => 0 };

    if (params.type === "drawer_low") {
      createDrawerLowControls(editorHost, params, { ...worktopArgs, onChange: () => afterParamsChanged() });
    } else if (params.type === "nested_drawer_low") {
      createNestedDrawerLowControls(editorHost, params, { ...worktopArgs, onChange: () => afterParamsChanged() });
    } else if (params.type === "fridge_tall") {
      createFridgeTallControls(editorHost, params, { onChange: () => afterParamsChanged() });
    } else if (params.type === "flap_shelves_low") {
      createFlapShelvesLowControls(editorHost, params, { ...worktopArgs, onChange: () => afterParamsChanged() });
    } else if (params.type === "swing_shelves_low") {
      createSwingShelvesLowControls(editorHost, params, { ...worktopArgs, onChange: () => afterParamsChanged() });
    } else if (params.type === "oven_base_low") {
      createOvenBaseLowControls(editorHost, params, { ...worktopArgs, onChange: () => afterParamsChanged() });
    } else if (params.type === "microwave_oven_tall") {
      createMicrowaveOvenTallControls(editorHost, params, { ...worktopArgs, onChange: () => afterParamsChanged() });
    } else if (params.type === "top_drawers_doors_low") {
      createTopDrawersDoorsLowControls(editorHost, params, { ...worktopArgs, onChange: () => afterParamsChanged() });
    } else if (params.type === "shelves") {
      createShelvesControls(editorHost, params, { onChange: () => afterParamsChanged() });
    } else {
      createCornerShelfLowerControls(editorHost, params, { onChange: () => afterParamsChanged() });
    }
  };

  const afterParamsChanged = () => {
    rebuild();
    args.exportOutEl.value = "";
  };

  const rebuild = () => {
    const errors = validateModule(params);
    renderErrors(args.errorsEl, errors);
    if (errors.length > 0) return;

    const next = buildModule(params);

    if (cabinetGroup) {
      scene.remove(cabinetGroup);
      disposeObject3D(cabinetGroup);
    }
    cabinetGroup = next;
    scene.add(cabinetGroup);

    const parts = getSelectableMeshes(cabinetGroup).map((m) => {
      m.visible = !hiddenParts.has(m.name);
      return {
        name: m.name,
        visible: m.visible,
        dimensionsMm: readDimensionsMm(m),
        grainAlong: readGrainAlong(m)
      };
    });
    partPanel.setRows(parts);

    partPanel.setOverlaps(computeOverlaps(cabinetGroup));
    clearOverlapHighlight();

    if (selectedMesh) {
      const keepName = selectedMesh.name;
      const nextSelected = findSelectableMeshByName(cabinetGroup, keepName);
      selectMesh(nextSelected && nextSelected.visible ? nextSelected : null);
    } else {
      partPanel.setSelected(null);
    }

    // Frame a bit better after rebuild.
    const box = new THREE.Box3().setFromObject(cabinetGroup);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    const controls = ctl();
    const camera = cam() as THREE.PerspectiveCamera;
    controls.target.copy(center);
    camera.position.set(center.x + maxDim * 0.9, center.y + maxDim * 0.6, center.z + maxDim * 1.2);
    camera.near = Math.max(0.01, maxDim / 100);
    camera.far = Math.max(50, maxDim * 20);
    camera.updateProjectionMatrix();
    controls.update();
  };

  const setModel = (type: ModuleParams["type"]) => {
    switch (type) {
      case "drawer_low":
        params = makeDefaultDrawerLowParams();
        break;
      case "nested_drawer_low":
        params = makeDefaultNestedDrawerLowParams();
        break;
      case "fridge_tall":
        params = makeDefaultFridgeTallParams();
        break;
      case "shelves":
        params = makeDefaultShelvesParams();
        break;
      case "corner_shelf_lower":
        params = makeDefaultCornerShelfLowerParams();
        break;
      case "flap_shelves_low":
        params = makeDefaultFlapShelvesLowParams();
        break;
      case "swing_shelves_low":
        params = makeDefaultSwingShelvesLowParams();
        break;
      case "oven_base_low":
        params = makeDefaultOvenBaseLowParams();
        break;
      case "microwave_oven_tall":
        params = makeDefaultMicrowaveOvenTallParams();
        break;
      case "top_drawers_doors_low":
        params = makeDefaultTopDrawersDoorsLowParams();
        break;
      default:
        params = makeDefaultDrawerLowParams();
    }
    modelSelect.value = type;
    hiddenParts.clear();
    selectMesh(null);
    mountControls();
    rebuild();
    args.exportOutEl.value = "";
  };

  args.resetBtn.addEventListener("click", () => {
    if (mode === "build") {
      setModel(params.type);
      return;
    }

    if (!selectedInstanceId) return;
    const inst = findInstance(selectedInstanceId);
    if (!inst) return;

    switch (inst.params.type) {
      case "drawer_low":
        inst.params = makeDefaultDrawerLowParams();
        break;
      case "nested_drawer_low":
        inst.params = makeDefaultNestedDrawerLowParams();
        break;
      case "fridge_tall":
        inst.params = makeDefaultFridgeTallParams();
        break;
      case "shelves":
        inst.params = makeDefaultShelvesParams();
        break;
      case "corner_shelf_lower":
        inst.params = makeDefaultCornerShelfLowerParams();
        break;
      case "flap_shelves_low":
        inst.params = makeDefaultFlapShelvesLowParams();
        break;
      case "swing_shelves_low":
        inst.params = makeDefaultSwingShelvesLowParams();
        break;
      case "oven_base_low":
        inst.params = makeDefaultOvenBaseLowParams();
        break;
      case "microwave_oven_tall":
        inst.params = makeDefaultMicrowaveOvenTallParams();
        break;
      case "top_drawers_doors_low":
        inst.params = makeDefaultTopDrawersDoorsLowParams();
        break;
      default:
        inst.params = makeDefaultDrawerLowParams();
    }
    mountInstanceControls(inst);
    rebuildInstance(inst);
  });

  args.exportBtn.addEventListener("click", async () => {
    args.copyStatusEl.textContent = "";

    let json = "";
    if (mode === "build") {
      const errors = validateModule(params);
      renderErrors(args.errorsEl, errors);
      if (errors.length > 0) return;
      json = JSON.stringify(buildExportPayload(params, cabinetGroup), null, 2);
    } else {
      const payload = buildLayoutExportPayload();
      json = JSON.stringify(payload, null, 2);
    }

    args.exportOutEl.value = json;

    // Best-effort copy to clipboard.
    try {
      await navigator.clipboard.writeText(json);
      args.copyStatusEl.textContent = "Copied.";
    } catch {
      args.copyStatusEl.textContent = "Copy failed (browser permission).";
    }
  });

  args.exportSceneBtn.addEventListener("click", async () => {
    args.copyStatusEl.textContent = "";
    const statusEl = document.getElementById("blenderStatus");
    const spinnerEl = document.getElementById("blenderSpinner");
    const errorEl = document.getElementById("blenderError");
    const previewLinkEl = document.getElementById("blenderPreviewLink") as HTMLAnchorElement | null;
    const previewImg = document.getElementById("blenderPreview") as HTMLImageElement | null;

    const setUi = (state: "idle" | "running" | "done" | "error", msg: string, detail?: string) => {
      if (statusEl) statusEl.textContent = msg;
      if (spinnerEl) spinnerEl.classList.toggle("visible", state === "running");
      if (errorEl) {
        if (state === "error" && detail) {
          errorEl.textContent = detail;
          (errorEl as HTMLElement).style.display = "block";
        } else {
          (errorEl as HTMLElement).style.display = "none";
          errorEl.textContent = "";
        }
      }
      if (previewLinkEl) previewLinkEl.style.display = state === "done" ? "inline" : "none";
    };

    const hdri = getHdriSettings();
    const opening = getWindowOpening();
    const sunDirection = opening ? opening.inwardNormal.clone().normalize() : undefined;
    const cameraTarget = (ctl() as any)?.target instanceof THREE.Vector3 ? ((ctl() as any).target as THREE.Vector3) : undefined;
    const daylightIntensity = getDaylightIntensity();

    const payload = exportSceneToJson({
      scene,
      camera: cam(),
      cameraTarget,
      environment: {
        hdriPath: hdri.id,
        hdriStrength: 5,
        hdriBackground: hdri.background,
        hdriBackgroundStrength: 5,
        hdriRotationDeg: 60
      },
      colorManagement: { viewTransform: "AgX", exposure: 0.5, look: "Medium High Contrast" },
      lighting: { sunDirection, sunStrength: 5, sunAngle: 30 },
      window: { opening, daylightIntensity },
      includeInvisible: false
    });

    const json = JSON.stringify(payload, null, 2);
    args.exportOutEl.value = json;

    const tryCopy = async () => {
      try {
        await navigator.clipboard.writeText(json);
        return true;
      } catch {
        return false;
      }
    };

    args.exportSceneBtn.disabled = true;
    setUi("running", "Running Blender (up to 60s)…");
    if (previewImg) previewImg.removeAttribute("src");

    try {
      const ctrl = new AbortController();
      const t = window.setTimeout(() => ctrl.abort(), 65_000);
      const res = await fetch("/api/blender/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneJson: payload }),
        signal: ctrl.signal
      });
      window.clearTimeout(t);

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        // ignore
      }

      if (!res.ok || !data?.ok) {
        throw new Error((data && typeof data.error === "string" && data.error) || text || `HTTP ${res.status}`);
      }

      const copyOk = await tryCopy();
      const previewUrl = typeof data.previewUrl === "string" ? data.previewUrl : null;
      if (!previewUrl) throw new Error("Backend did not return previewUrl.");

      if (previewLinkEl) previewLinkEl.href = previewUrl;
      if (previewImg) previewImg.src = previewUrl;

      setUi("done", `Done. ${copyOk ? "Copied JSON." : "Copy failed."}`);
      args.copyStatusEl.textContent = "";
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setUi("error", "Blender export failed.", msg);
      args.copyStatusEl.textContent = "";
    } finally {
      args.exportSceneBtn.disabled = false;
    }
  });

  args.copyBtn.addEventListener("click", async () => {
    args.copyStatusEl.textContent = "";
    const fallback = mode === "build" ? JSON.stringify(buildExportPayload(params, cabinetGroup), null, 2) : JSON.stringify(buildLayoutExportPayload(), null, 2);
    const text = args.exportOutEl.value.trim().length > 0 ? args.exportOutEl.value : fallback;
    args.exportOutEl.value = text;
    try {
      await navigator.clipboard.writeText(text);
      args.copyStatusEl.textContent = "Copied.";
    } catch {
      args.copyStatusEl.textContent = "Copy failed (browser permission).";
    }
  });

  const ro = new ResizeObserver(() => {
    const w = args.viewerEl.clientWidth;
    const h = args.viewerEl.clientHeight;
    setSize(w, h);
    ssgi?.setSize(w, h);
    photo?.setSize(w, h);
  });
  ro.observe(args.viewerEl);

  // Prevent browser context menu so right-drag marquee works.
  renderer.domElement.addEventListener("contextmenu", (ev) => {
    if (mode === "layout" && viewMode === "2d" && layoutTool === "select") {
      ev.preventDefault();
    }
  });

  // Quick edit dimension value (double click)
  renderer.domElement.addEventListener("dblclick", (ev) => {
    if (mode !== "layout" || viewMode !== "2d") return;
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    pointerNdc.set(x, y);
    raycaster.setFromCamera(pointerNdc, cam());
    const picks = dimensions.map((d) => d.pick);
    const hit = raycaster.intersectObjects(picks, false)[0]?.object as THREE.Mesh | undefined;
    const dimId = (hit?.userData?.dimensionId as string | undefined) ?? null;
    if (!dimId) return;
    const d = dimensions.find((x) => x.id === dimId) ?? null;
    if (!d) return;
    setSelectedDimension(dimId);
    const cur = dimValueMm(d.params)?.absMm ?? 0;
    const s = window.prompt("Dimension (mm)", String(cur));
    if (!s) return;
    const n = Number(s.trim().replace(",", "."));
    if (!n || !Number.isFinite(n) || n <= 0) return;
    setDimensionValueMm(d, Math.round(n));
  });

  renderer.domElement.addEventListener("pointerdown", (ev) => {
    // Marquee selection in 2D layout select tool (left button) - start pending, activate on drag.
    if (mode === "layout" && viewMode === "2d" && layoutTool === "select" && !transformState.kind && ev.button === 0 && !measureState.enabled) {
      const rect = renderer.domElement.getBoundingClientRect();
      marquee.pending = true;
      marquee.active = false;
      marquee.pointerId = ev.pointerId;
      marquee.hitSomething = false;
      marquee.startX = ev.clientX - rect.left;
      marquee.startY = ev.clientY - rect.top;
      marquee.mode = "contain";
      marqueeEl.style.display = "none";
      try {
        renderer.domElement.setPointerCapture(ev.pointerId);
      } catch {
        // ignore
      }
      // do not return; we still want click selection / dragging to work
    }

    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    pointerNdc.set(x, y);

    raycaster.setFromCamera(pointerNdc, cam());

    if (mode === "layout") {
      if (underlayCal.active) {
        if (!underlayMesh.visible || underlayState.pinned) {
          underlayCal.active = false;
          underlayCal.first = null;
          setUnderlayStatus("Underlay not available.");
          return;
        }

        const hit = raycaster.intersectObject(underlayMesh, false)[0];
        if (!hit) {
          setUnderlayStatus("Click on underlay.");
          return;
        }
        const hitPoint = hit.point.clone();
        if (!underlayCal.first) {
          underlayCal.first = hitPoint.clone();
          setUnderlayStatus(underlayCal.mode === "reference" ? "Reference scale: click second point..." : "Kalibrácia: klikni druhý bod...");
          return;
        }

        const a = underlayCal.first;
        const b = hitPoint;
        const distM = Math.hypot(b.x - a.x, b.z - a.z);
        if (distM <= 1e-6) {
          setUnderlayStatus("Reference scale failed (zero distance).");
          underlayCal.active = false;
          underlayCal.first = null;
          return;
        }

        let desiredMm = Math.max(1, underlayCal.knownMm);
        if (underlayCal.mode === "reference") {
          const measuredMm = Math.round(distM * 1000);
          const s = window.prompt("Reálna vzdialenosť (mm)", String(measuredMm));
          const n = s === null ? null : Number(s.trim().replace(",", "."));
          if (!n || !Number.isFinite(n) || n <= 0) {
            setUnderlayStatus("Reference scale canceled.");
            underlayCal.active = false;
            underlayCal.first = null;
            return;
          }
          desiredMm = n;
        }

        const desiredM = desiredMm / 1000;
        if (distM > 1e-6 && underlayMesh.visible) {
          const factor = desiredM / distM;
          underlayState.scale *= factor;
          updateUnderlayTransform();
          if (underlayScaleEl) underlayScaleEl.value = String(underlayState.scale);
          setUnderlayStatus(underlayCal.mode === "reference" ? `Reference scale OK: ${Math.round(desiredMm)} mm` : `Kalibrácia OK: ${Math.round(desiredMm)} mm`);
        } else {
          setUnderlayStatus("Kalibrácia zlyhala (nulová vzdialenosť).");
        }

        underlayCal.active = false;
        underlayCal.first = null;
        return;
      }

      if (layoutTool === "select" && viewMode === "2d" && transformState.kind) {
        if (ev.button !== 0) return;
        const hitPoint = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;
        const snapped = snapPoint2D(hitPoint, rect, cam());
        const p = snapped.kind !== "none" ? snapped.point : hitPoint;

        if (transformState.kind === "move") {
          if (transformState.step === "pickBase") {
            transformState.base = p.clone();
            transformState.step = "pickTarget";
            transformState.lastValidDelta.set(0, 0, 0);
            setUnderlayStatus("Move: click target point...");
            return;
          }
          if (transformState.step === "pickTarget" && transformState.base) {
            const delta = p.clone().sub(transformState.base);
            applyMoveDelta(delta);
            commitHistory();
            clearTransform({ status: "Move: done." });
            mountProps();
            return;
          }
        }

        if (transformState.kind === "rotate") {
          if (transformState.step === "pickPivot") {
            transformState.pivot = p.clone();
            transformState.step = "rotating";
            transformState.typed = "";
            transformState.lastValidAngle = 0;
            transformState.startPointerAngle = Math.atan2(hitPoint.z - p.z, hitPoint.x - p.x);
            setUnderlayStatus("Rotate: move mouse to rotate (type degrees + Enter). Click to finish.");
            return;
          }
          if (transformState.step === "rotating") {
            commitHistory();
            clearTransform({ status: "Rotate: done." });
            mountProps();
            return;
          }
        }
      }

      if (layoutTool === "align") {
        if (viewMode !== "2d") return;
        if (ev.button !== 0) return;

        const hitPoint = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;

        const rect2 = renderer.domElement.getBoundingClientRect();
        const mouse = { x: ev.clientX - rect2.left, y: ev.clientY - rect2.top };
        const picked = pickAlignLineAt(hitPoint, mouse, rect2);

        if (!picked) {
          setUnderlayStatus("Align: click a wall line (center/face/end).");
          return;
        }

        if (!alignState.ref) {
          alignState.ref = picked;
          alignState.lastA = null;
          alignState.lastB = null;
          alignState.lastUntilMs = 0;
          setUnderlayStatus("Align: click second parallel line...");
          mountProps();
          return;
        }

        const ref = alignState.ref;
        if (!alignParallel(ref, picked)) {
          setUnderlayStatus("Align: lines must be parallel.");
          return;
        }

        const shift = alignShiftVec(ref, picked);
        const dxMm = Math.round(shift.x * 1000);
        const dzMm = Math.round(shift.z * 1000);

        const w = walls.find((x) => x.id === picked.wallId) ?? null;
        if (!w) {
          setUnderlayStatus("Align: wall not found.");
          alignState.ref = null;
          mountProps();
          return;
        }
        if (pinnedWallIds.has(w.id)) {
          setUnderlayStatus("Align: target wall is pinned.");
          alignState.ref = null;
          mountProps();
          return;
        }

        if (dxMm === 0 && dzMm === 0) {
          setUnderlayStatus("Align: already aligned.");
          alignState.ref = null;
          mountProps();
          return;
        }

        if (picked.wallLine === "endA" || picked.wallLine === "endB") {
          moveWallEndpointAndConnected(w, picked.wallLine === "endA" ? "a" : "b", dxMm, dzMm);
        } else {
          translateWallAndConnected(w, dxMm, dzMm);
        }
        commitHistory();

        alignState.lastA = ref;
        alignState.lastB = picked;
        alignState.lastUntilMs = performance.now() + 2500;
        alignState.ref = null;
        setUnderlayStatus("Align: done. Click reference line...");
        mountProps();
        return;
      }

      if (layoutTool === "trim") {
        if (viewMode !== "2d") return;
        if (ev.button !== 0) return;

        const hitPoint = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;

        const rect2 = renderer.domElement.getBoundingClientRect();
        const mouse = { x: ev.clientX - rect2.left, y: ev.clientY - rect2.top };
        const picked = pickAlignLineAt(hitPoint, mouse, rect2);
        if (!picked) {
          setUnderlayStatus(trimState.step === "pickTarget" ? "Trim: click target wall line." : "Trim: click cutter line.");
          return;
        }

        if (trimState.step === "pickTarget") {
          trimState.targetWallId = picked.wallId;
          trimState.targetPick = picked;
          trimState.targetClick = hitPoint.clone();
          trimState.step = "pickCutter";
          trimState.lastTarget = null;
          trimState.lastCutter = null;
          trimState.lastUntilMs = 0;
          setUnderlayStatus("Trim: click cutter line...");
          mountProps();
          return;
        }

        const cutterClick = hitPoint.clone();

        const wallId = trimState.targetWallId;
        const w = wallId ? (walls.find((x) => x.id === wallId) ?? null) : null;
        if (!w) {
          trimState.step = "pickTarget";
          trimState.targetWallId = null;
          trimState.targetPick = null;
          setUnderlayStatus("Trim: target missing. Click target wall...");
          mountProps();
          return;
        }
        if (pinnedWallIds.has(w.id)) {
          trimState.step = "pickTarget";
          trimState.targetWallId = null;
          trimState.targetPick = null;
          trimState.targetClick = null;
          setUnderlayStatus("Trim: target is pinned.");
          mountProps();
          return;
        }

        // Wall-to-wall Trim/Extend to Corner: if second click hits another wall line, extend/trim both walls to their intersection.
        if (picked.wallId !== w.id && trimState.targetPick && trimState.targetClick) {
          const w2 = walls.find((x) => x.id === picked.wallId) ?? null;
          if (w2 && !pinnedWallIds.has(w2.id)) {
            const I = lineLineIntersectionXZ(trimState.targetPick.p, trimState.targetPick.dir, picked.p, picked.dir);
            if (!I) {
              setUnderlayStatus("Trim: walls must not be parallel.");
              return;
            }

            const chooseEnd = (wall: WallInstance, click: THREE.Vector3) => {
              const a = new THREE.Vector3(wall.params.aMm.x / 1000, 0, wall.params.aMm.z / 1000);
              const b = new THREE.Vector3(wall.params.bMm.x / 1000, 0, wall.params.bMm.z / 1000);
              return click.distanceTo(a) <= click.distanceTo(b) ? ("a" as const) : ("b" as const);
            };

            const iMm = toMmPoint(I);
            const end1 = chooseEnd(w, trimState.targetClick);
            const end2 = chooseEnd(w2, cutterClick);

            const old1 = end1 === "a" ? w.params.aMm : w.params.bMm;
            const old2 = end2 === "a" ? w2.params.aMm : w2.params.bMm;

            const dx1 = iMm.x - old1.x;
            const dz1 = iMm.z - old1.z;
            const dx2 = iMm.x - old2.x;
            const dz2 = iMm.z - old2.z;

            if (dx1 !== 0 || dz1 !== 0) moveWallEndpointAndConnected(w, end1, dx1, dz1);
            if (dx2 !== 0 || dz2 !== 0) moveWallEndpointAndConnected(w2, end2, dx2, dz2);
            commitHistory();

            trimState.lastTarget = trimState.targetPick;
            trimState.lastCutter = picked;
            trimState.lastUntilMs = performance.now() + 2500;
            trimState.step = "pickTarget";
            trimState.targetWallId = null;
            trimState.targetPick = null;
            trimState.targetClick = null;
            setUnderlayStatus("Trim: corner done. Click target wall...");
            mountProps();
            return;
          }
        }

        const aW = new THREE.Vector3(w.params.aMm.x / 1000, 0, w.params.aMm.z / 1000);
        const bW = new THREE.Vector3(w.params.bMm.x / 1000, 0, w.params.bMm.z / 1000);
        const ab = bW.clone().sub(aW);
        const len2 = ab.lengthSq();
        if (len2 < 1e-10) {
          setUnderlayStatus("Trim: wall too small.");
          return;
        }
        const dW = ab.clone().normalize();
        const dC = picked.dir.clone().normalize();
        const I = lineLineIntersectionXZ(aW, dW, picked.p, dC);
        if (!I) {
          setUnderlayStatus("Trim: cutter must not be parallel.");
          return;
        }

        const t = I.clone().sub(aW).dot(ab) / len2;
        if (t < -1e-5 || t > 1 + 1e-5) {
          setUnderlayStatus("Trim: cutter must cross the wall segment.");
          return;
        }

        const nC = new THREE.Vector3(-dC.z, 0, dC.x);
        const sign = (v: number) => (v > 1e-7 ? 1 : v < -1e-7 ? -1 : 0);
        let sClick = sign(nC.dot(hitPoint.clone().sub(picked.p)));
        const sA = sign(nC.dot(aW.clone().sub(picked.p)));
        const sB = sign(nC.dot(bW.clone().sub(picked.p)));
        if (sClick === 0) sClick = sA !== 0 ? sA : sB;

        let moveWhich: "a" | "b" = "a";
        if (sClick !== 0) {
          if (sA === sClick && sB !== sClick) moveWhich = "a";
          else if (sB === sClick && sA !== sClick) moveWhich = "b";
          else {
            // ambiguous: choose closer endpoint to the click point
            moveWhich = cutterClick.distanceTo(aW) <= cutterClick.distanceTo(bW) ? "a" : "b";
          }
        } else {
          moveWhich = cutterClick.distanceTo(aW) <= cutterClick.distanceTo(bW) ? "a" : "b";
        }

        const iMm = toMmPoint(I);
        const old = moveWhich === "a" ? w.params.aMm : w.params.bMm;
        const dxMm = iMm.x - old.x;
        const dzMm = iMm.z - old.z;

        if (dxMm === 0 && dzMm === 0) {
          setUnderlayStatus("Trim: no change.");
          trimState.step = "pickTarget";
          trimState.targetWallId = null;
          trimState.targetPick = null;
          trimState.targetClick = null;
          mountProps();
          return;
        }

        moveWallEndpointAndConnected(w, moveWhich, dxMm, dzMm);
        commitHistory();

        trimState.lastTarget = trimState.targetPick ?? picked;
        trimState.lastCutter = picked;
        trimState.lastUntilMs = performance.now() + 2500;
        trimState.step = "pickTarget";
        trimState.targetWallId = null;
        trimState.targetPick = null;
        trimState.targetClick = null;
        setUnderlayStatus("Trim: done. Click target wall...");
        mountProps();
        return;
      }

      if (layoutTool === "dimension") {
        if (viewMode !== "2d") return;
        if (ev.button !== 0) return;

        const hitPoint = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;

        const rect2 = renderer.domElement.getBoundingClientRect();
        const mouse = { x: ev.clientX - rect2.left, y: ev.clientY - rect2.top };
        const picked = pickAlignLineAt(hitPoint, mouse, rect2);
        if (!picked) {
          setUnderlayStatus(dimTool.a ? "Dimension: click second parallel line." : "Dimension: click first line.");
          return;
        }

        if (!dimTool.a) {
          dimTool.a = picked;
          dimTool.tA = segClosestT(hitPoint, picked.segA, picked.segB);
          setUnderlayStatus("Dimension: click second parallel line...");
          mountProps();
          return;
        }

        const a = dimTool.a;
        if (!alignParallel(a, picked)) {
          setUnderlayStatus("Dimension: lines must be parallel.");
          return;
        }
        if (a.wallId === picked.wallId) {
          setUnderlayStatus("Dimension: pick a different wall.");
          return;
        }
        if (a.wallLine === "endA" || a.wallLine === "endB" || picked.wallLine === "endA" || picked.wallLine === "endB") {
          setUnderlayStatus("Dimension: pick face/center lines (not end lines).");
          return;
        }

        const tB = segClosestT(hitPoint, picked.segA, picked.segB);
        const dir = a.dir.clone().normalize();
        const n = new THREE.Vector3(-dir.z, 0, dir.x);
        const aPt = a.segA.clone().lerp(a.segB, dimTool.tA);
        dimTool.offsetM = n.dot(hitPoint.clone().sub(aPt));

        createDimension(
          { wallId: a.wallId, wallLine: a.wallLine, t: dimTool.tA },
          { wallId: picked.wallId, wallLine: picked.wallLine, t: tB },
          dimTool.offsetM
        );

        dimTool.a = null;
        dimPreview.root.visible = false;
        setUnderlayStatus("Dimension: placed. Click first line...");
        mountProps();
        return;
      }

      if (layoutTool === "wall") {
        if (ev.button !== 0) return;
        // Place wall by 2 clicks on ground (XZ).
        const hitPoint = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;
        const rect2 = renderer.domElement.getBoundingClientRect();
        const snapped = snapPoint2D(hitPoint, rect2, cam());
        const shouldAxisSnap = !ev.shiftKey && snapped.kind === "none";

      if (!wallDraw.active) {
        wallDraw.active = true;
        wallDraw.segments = wallDraw.segments || 0;
        const start = snapped.kind !== "none" ? snapped.point : hitPoint.clone();
        const startMm = { x: Math.round(start.x * 1000), z: Math.round(start.z * 1000) };
        wallDraw.a = new THREE.Vector3(startMm.x / 1000, 0, startMm.z / 1000);
        if (!wallDraw.chainStart) wallDraw.chainStart = wallDraw.a.clone();
        wallDraw.hoverB = wallDraw.a.clone();
        wallDraw.typedMm = "";
        wallTypedHud.style.display = "none";
        if (!wallDraw.preview) {
          wallDraw.preview = makeWallPreviewMesh(wallDraw.a, wallDraw.a, wallDefault.thicknessMm);
          wallDraw.preview.name = "wallPreview";
          layoutRoot.add(wallDraw.preview);
        }
        updateWallMeshWithJustification(
          wallDraw.preview,
          wallDraw.a,
          wallDraw.a,
          wallDefault.thicknessMm,
          wallDefault.justification,
          wallDefault.exteriorSign
        );
        setUnderlayStatus("Wall: druhý bod... (píš mm + Enter, Shift = bez axis snap, Esc = stop)");
        return;
      }

        const a = wallDraw.a;
        if (!a) return;
        const b0 = snapped.kind !== "none" ? snapped.point : hitPoint.clone();
        const b = shouldAxisSnap ? snapAxisXZ(a, b0, true) : b0;
        const bMm = { x: Math.round(b.x * 1000), z: Math.round(b.z * 1000) };
        const bExact = new THREE.Vector3(bMm.x / 1000, 0, bMm.z / 1000);

        // Snap to chain start when closing loop.
        const closeTolM = 0.03;
        const cs = wallDraw.chainStart;
        const closes =
          !!cs && wallDraw.segments >= 2 && Math.hypot(bExact.x - cs.x, bExact.z - cs.z) <= closeTolM;
        const end = closes && cs ? cs.clone() : bExact;

        // Finish wall
        const w = addWall(a, end, wallDefault.thicknessMm);
        autoJoinAtMmPoint(w.params.aMm);
        autoJoinAtMmPoint(w.params.bMm);
        wallDraw.segments += 1;

        if (closes) {
          wallDraw.active = false;
          wallDraw.a = null;
          wallDraw.chainStart = null;
          wallDraw.segments = 0;
          if (wallDraw.preview) {
            layoutRoot.remove(wallDraw.preview);
            wallDraw.preview.geometry.dispose();
            (wallDraw.preview.material as THREE.Material).dispose();
            wallDraw.preview = null;
          }
          setUnderlayStatus("Wall: chain closed.");
          return;
        }

        // Continue chain from end point.
        wallDraw.active = true;
        wallDraw.a = new THREE.Vector3(w.params.bMm.x / 1000, 0, w.params.bMm.z / 1000);
        wallDraw.hoverB = wallDraw.a.clone();
        wallDraw.typedMm = "";
        wallTypedHud.style.display = "none";
        updateWallMeshWithJustification(
          wallDraw.preview!,
          wallDraw.a,
          wallDraw.a,
          wallDefault.thicknessMm,
          wallDefault.justification,
          wallDefault.exteriorSign
        );
        setUnderlayStatus("Wall: ďalší bod... (píš mm + Enter, Shift = bez axis snap, Esc = stop)");
        // Keep wall tool active; just show properties for the placed wall.
        selectedKind = "wall";
        selectedWallId = w.id;
        mountProps();
        return;
      }

      if (measureState.enabled) return;

      // 2D wall selection without raycasting (walls are hidden in 2D; plan mesh is merged).
      if (viewMode === "2d" && layoutTool === "select" && ev.button === 0) {
        const hitPoint = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;
        const pMm = toMmPoint(hitPoint);
        const rect2 = renderer.domElement.getBoundingClientRect();
        const mouse = { x: ev.clientX - rect2.left, y: ev.clientY - rect2.top };

        const pointInPoly = (p: { x: number; z: number }, poly: Array<{ x: number; z: number }>) => {
          let inside = false;
          for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, zi = poly[i].z;
            const xj = poly[j].x, zj = poly[j].z;
            const intersect = (zi > p.z) !== (zj > p.z) && p.x < ((xj - xi) * (p.z - zi)) / (zj - zi + 1e-12) + xi;
            if (intersect) inside = !inside;
          }
          return inside;
        };

        // Prefer polygon hit-testing when available.
        let bestPoly: { id: string; px: number } | null = null;
        const pW = { x: pMm.x / 1000, z: pMm.z / 1000 };
        for (const [id, poly] of wallSolvedOutlines) {
          if (poly.length < 3) continue;
          if (!pointInPoly(pW, poly)) continue;
          // score by distance to mouse from wall midpoint (stable pick)
          const w = walls.find((x) => x.id === id) ?? null;
          const mid = w ? new THREE.Vector3((w.params.aMm.x + w.params.bMm.x) / 2000, 0, (w.params.aMm.z + w.params.bMm.z) / 2000) : new THREE.Vector3(pW.x, 0, pW.z);
          const s = worldToScreen(mid, cam(), rect2);
          const px = Math.hypot(s.x - mouse.x, s.y - mouse.y);
          if (!bestPoly || px < bestPoly.px) bestPoly = { id, px };
        }
        if (bestPoly) {
          if (marquee.pending && marquee.pointerId === ev.pointerId) {
            marquee.hitSomething = true;
            marquee.pending = false;
            marquee.active = false;
            marqueeEl.style.display = "none";
          }
          setSelectedWall(bestPoly.id);
          return;
        }

        let best: { id: string; px: number } | null = null;
        for (const w of walls) {
          const closest = pointOnWallAxisMm(w, pMm);
          if (!Number.isFinite(closest.distMm)) continue;
          const cp = new THREE.Vector3(closest.closest.x / 1000, 0, closest.closest.z / 1000);
          const s = worldToScreen(cp, cam(), rect2);
          const px = Math.hypot(s.x - mouse.x, s.y - mouse.y);
          if (!best || px < best.px) best = { id: w.id, px };
        }

        if (best && best.px <= 10) {
          if (marquee.pending && marquee.pointerId === ev.pointerId) {
            marquee.hitSomething = true;
            marquee.pending = false;
            marquee.active = false;
            marqueeEl.style.display = "none";
          }
          setSelectedWall(best.id);
          return;
        }
      }

      const picks = instances.map((i) => i.pick);
      if (windowInst) picks.push(windowInst.pick);
      for (const w of walls) picks.push(w.mesh);
      for (const d of dimensions) picks.push(d.pick);
      const hits = raycaster.intersectObjects(picks, false);
      const first = hits[0]?.object as THREE.Mesh | undefined;
      const kind = (first?.userData?.kind as string | undefined) ?? "module";

      if (kind === "window") {
        if (!windowInst) return;
        if (marquee.pending && marquee.pointerId === ev.pointerId) {
          marquee.hitSomething = true;
          marquee.pending = false;
          marquee.active = false;
          marqueeEl.style.display = "none";
        }
        setSelectedWindow();

        windowDragState.active = true;
        windowDragState.wall = windowInst.params.wall;

        const def = wallDefs[windowInst.params.wall];
        const hitPoint = new THREE.Vector3();
        const okWall = raycaster.ray.intersectPlane(def.plane, hitPoint);
        if (!okWall) {
          if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;
        }
        const axis = def.axis === "x" ? hitPoint.x : hitPoint.z;
        windowDragState.offsetMm = windowInst.params.centerMm - axis * 1000;
        renderer.domElement.setPointerCapture(ev.pointerId);
        return;
      }

      if (kind === "dimension") {
        const dimId = (first?.userData?.dimensionId as string | undefined) ?? null;
        if (!dimId) return;
        if (marquee.pending && marquee.pointerId === ev.pointerId) {
          marquee.hitSomething = true;
          marquee.pending = false;
          marquee.active = false;
          marqueeEl.style.display = "none";
        }
        setSelectedDimension(dimId);
        if (viewMode !== "2d" || layoutTool !== "select" || ev.button !== 0) return;
        const d = dimensions.find((x) => x.id === dimId) ?? null;
        if (!d) return;
        const hitPoint = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;
        dimensionDragState.active = true;
        dimensionDragState.id = dimId;
        dimensionDragState.pointerId = ev.pointerId;
        dimensionDragState.startWorld.copy(hitPoint);
        dimensionDragState.startOffsetM = d.params.offsetM;
        renderer.domElement.setPointerCapture(ev.pointerId);
        return;
      }

      const id = (first?.userData?.instanceId as string | undefined) ?? null;
      const wallId = (first?.userData?.wallId as string | undefined) ?? null;
      if (kind === "wall") {
        if (!wallId) {
          setSelectedWall(null);
          return;
        }
        if (marquee.pending && marquee.pointerId === ev.pointerId) {
          marquee.hitSomething = true;
          marquee.pending = false;
          marquee.active = false;
          marqueeEl.style.display = "none";
        }
        setSelectedWall(wallId);
        return;
      }
      if (!id) {
        if (viewMode === "2d" && layoutTool === "select" && ev.button === 0 && underlayMesh.visible && !underlayState.pinned) {
          const underlayHit = raycaster.intersectObject(underlayMesh, false)[0];
          if (underlayHit) {
            if (marquee.pending && marquee.pointerId === ev.pointerId) {
              marquee.hitSomething = true;
              marquee.pending = false;
              marquee.active = false;
              marqueeEl.style.display = "none";
            }
            setSelectedUnderlay();
            const hitPoint = new THREE.Vector3();
            if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;
            underlayDragState.active = true;
            underlayDragState.pointerId = ev.pointerId;
            underlayDragState.startWorld.copy(hitPoint);
            underlayDragState.startOffsetMm = { x: underlayState.offsetMm.x, z: underlayState.offsetMm.z };
            renderer.domElement.setPointerCapture(ev.pointerId);
            setUnderlayStatus("Drag underlay... (Pin when ready)");
            return;
          }
        }
        if (marquee.pending && marquee.pointerId === ev.pointerId) {
          // don't clear selection yet; if it becomes a drag we want marquee selection
          return;
        }
        setSelectedWall(null);
        setSelectedModule(null);
        clearWindowLightIfMissing();
        return;
      }

      const inst = findInstance(id);
      if (!inst) return;
      if (marquee.pending && marquee.pointerId === ev.pointerId) {
        marquee.hitSomething = true;
        marquee.pending = false;
        marquee.active = false;
        marqueeEl.style.display = "none";
      }
      setSelectedModule(id);

      // Disable object dragging in 3D view (layout edits happen in 2D).
      if (viewMode !== "2d") return;
      if (pinnedInstanceIds.has(id)) return;

      const hitPoint = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;
      dragState.active = true;
      dragState.id = id;
      dragState.offset.set(hitPoint.x - inst.root.position.x, 0, hitPoint.z - inst.root.position.z);
      dragState.lastValid.copy(inst.root.position);
      renderer.domElement.setPointerCapture(ev.pointerId);
      return;
    }

    if (!cabinetGroup) return;

    const meshes = getSelectableMeshes(cabinetGroup).filter((m) => m.visible);

    if (measureState.enabled) {
      const hit = pickSurfacePoint(raycaster, meshes);
      if (!hit) return;

      const snapped = snapPointXZ(hit.point, hit.object);
      if (!measureState.firstPoint) {
        measureState.firstPoint = snapped.point;
        args.measureReadoutEl.textContent = `First point (${snapped.kind}): ${formatMm(snapped.point)} — pick second point…`;
        return;
      }

      let a = measureState.firstPoint;
      let b = snapped.point;
      if (measureState.axisLock) b = axisLockXZ(a, b);

      addMeasurement(a, b);
      measureState.firstPoint = null;
      clearPreview();
      return;
    }

    const hits = raycaster.intersectObjects(meshes, false);
    const first = hits[0]?.object as THREE.Mesh | undefined;
    selectMesh(first ?? null);
  });

  // Live hover + preview (SketchUp-like)
  renderer.domElement.addEventListener("pointermove", (ev) => {
    // Wall edit drag (2D, select tool)
    if (mode === "layout" && viewMode === "2d" && layoutTool === "select" && wallEditHud.drag) {
      const d = wallEditHud.drag;
      const w = walls.find((x) => x.id === d.wallId) ?? null;
      if (!w) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      pointerNdc.set(x, y);
      raycaster.setFromCamera(pointerNdc, cam());
      const hitPoint = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;

      if (d.kind === "move") {
        const dx = hitPoint.x - d.startWorld.x;
        const dz = hitPoint.z - d.startWorld.z;
        const nextA = { x: Math.round(d.startA.x + dx * 1000), z: Math.round(d.startA.z + dz * 1000) };
        const nextB = { x: Math.round(d.startB.x + dx * 1000), z: Math.round(d.startB.z + dz * 1000) };
        w.params.aMm = nextA;
        w.params.bMm = nextB;

        const touched = new Set<string>();
        touched.add(w.id);
        for (const c of d.connectedA) {
          const ow = walls.find((x) => x.id === c.wallId) ?? null;
          if (!ow) continue;
          if (c.which === "a") ow.params.aMm = nextA;
          else ow.params.bMm = nextA;
          touched.add(ow.id);
        }
        for (const c of d.connectedB) {
          const ow = walls.find((x) => x.id === c.wallId) ?? null;
          if (!ow) continue;
          if (c.which === "a") ow.params.aMm = nextB;
          else ow.params.bMm = nextB;
          touched.add(ow.id);
        }

        for (const id of touched) {
          const ww = walls.find((x) => x.id === id) ?? null;
          if (ww) rebuildWall(ww);
        }
        rebuildWallPlanMesh();
        return;
      }

      const which = d.kind;
      const other = which === "a" ? fromMmPoint(d.startB) : fromMmPoint(d.startA);
      const snapped = snapPoint2D(hitPoint, rect, cam());
      const shouldAxisSnap = !ev.shiftKey && snapped.kind === "none";
      const p0 = snapped.kind !== "none" ? snapped.point : hitPoint;
      const p = shouldAxisSnap ? snapAxisXZ(other, p0, true) : p0;
      const pMm = toMmPoint(p);

      if (which === "a") w.params.aMm = pMm;
      else w.params.bMm = pMm;

      const touched = new Set<string>();
      touched.add(w.id);
      const connected = which === "a" ? d.connectedA : d.connectedB;
      for (const c of connected) {
        const ow = walls.find((x) => x.id === c.wallId) ?? null;
        if (!ow) continue;
        if (c.which === "a") ow.params.aMm = pMm;
        else ow.params.bMm = pMm;
        touched.add(ow.id);
      }
      for (const id of touched) {
        const ww = walls.find((x) => x.id === id) ?? null;
        if (ww) rebuildWall(ww);
      }
      rebuildWallPlanMesh();
      return;
    }

    if (mode === "layout" && viewMode === "2d" && layoutTool === "select" && transformState.kind) {
      const rect = renderer.domElement.getBoundingClientRect();
      transformState.lastPointerPx.x = ev.clientX - rect.left;
      transformState.lastPointerPx.y = ev.clientY - rect.top;

      const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      pointerNdc.set(x, y);
      raycaster.setFromCamera(pointerNdc, cam());
      const hitPoint = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;

      const snapped = snapPoint2D(hitPoint, rect, cam());
      const p = snapped.kind !== "none" ? snapped.point : hitPoint;
      if (snapped.kind !== "none") {
        const s = worldToScreen(p, cam(), rect);
        wallSnapHud.style.left = `${s.x}px`;
        wallSnapHud.style.top = `${s.y}px`;
        wallSnapHud.style.display = "block";
      } else {
        wallSnapHud.style.display = "none";
      }

      if (transformState.kind === "move" && transformState.step === "pickTarget" && transformState.base) {
        const delta = p.clone().sub(transformState.base);
        applyMoveDelta(delta);
        setUnderlayStatus(`Move: Δ ${Math.round(delta.x * 1000)}×${Math.round(delta.z * 1000)} mm (click to finish)`);
        return;
      }

      if (transformState.kind === "rotate" && transformState.step === "rotating" && transformState.pivot) {
        const pivot = transformState.pivot;
        const a0 = transformState.startPointerAngle;
        const a1 = Math.atan2(hitPoint.z - pivot.z, hitPoint.x - pivot.x);
        let d = a1 - a0;
        // normalize
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        transformState.lastAngleSign = d < 0 ? -1 : 1;
        applyRotateAngle(d);
        setUnderlayStatus(`Rotate: ${Math.round((d * 180) / Math.PI)}° (click to finish)`);
        return;
      }
    }

    if (marquee.active) {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      marquee.mode = x >= marquee.startX ? "contain" : "touch";
      if (marquee.mode === "contain") {
        marqueeEl.style.border = "1px solid rgba(92, 140, 255, 0.95)";
        marqueeEl.style.background = "rgba(92, 140, 255, 0.10)";
      } else {
        marqueeEl.style.border = "1px solid rgba(61, 220, 151, 0.95)";
        marqueeEl.style.background = "rgba(61, 220, 151, 0.10)";
      }
      const x0 = Math.min(marquee.startX, x);
      const y0 = Math.min(marquee.startY, y);
      const x1 = Math.max(marquee.startX, x);
      const y1 = Math.max(marquee.startY, y);
      marqueeEl.style.left = `${x0}px`;
      marqueeEl.style.top = `${y0}px`;
      marqueeEl.style.width = `${Math.max(0, x1 - x0)}px`;
      marqueeEl.style.height = `${Math.max(0, y1 - y0)}px`;
    }

    if (marquee.pending && !marquee.active && marquee.pointerId === ev.pointerId) {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const w = Math.abs(x - marquee.startX);
      const h = Math.abs(y - marquee.startY);
      if (w >= 6 || h >= 6) {
        marquee.active = true;
        marqueeEl.style.border = "1px solid rgba(92, 140, 255, 0.95)";
        marqueeEl.style.background = "rgba(92, 140, 255, 0.10)";
        marqueeEl.style.left = `${marquee.startX}px`;
        marqueeEl.style.top = `${marquee.startY}px`;
        marqueeEl.style.width = "0px";
        marqueeEl.style.height = "0px";
        marqueeEl.style.display = "block";
      }
    }

    if (mode === "layout" && viewMode === "2d" && layoutTool === "select" && underlayDragState.active && underlayDragState.pointerId === ev.pointerId) {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      pointerNdc.set(x, y);
      raycaster.setFromCamera(pointerNdc, cam());
      const hitPoint = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;
      const dxMm = Math.round((hitPoint.x - underlayDragState.startWorld.x) * 1000);
      const dzMm = Math.round((hitPoint.z - underlayDragState.startWorld.z) * 1000);
      underlayState.offsetMm.x = underlayDragState.startOffsetMm.x + dxMm;
      underlayState.offsetMm.z = underlayDragState.startOffsetMm.z + dzMm;
      updateUnderlayTransform();
      if (underlayOffXEl) underlayOffXEl.value = String(underlayState.offsetMm.x);
      if (underlayOffZEl) underlayOffZEl.value = String(underlayState.offsetMm.z);
      if (selectedUnderlayBox) (selectedUnderlayBox as any).update?.();
      return;
    }

    if (mode === "layout" && viewMode === "2d" && layoutTool === "select" && dimensionDragState.active && dimensionDragState.pointerId === ev.pointerId) {
      const d = dimensions.find((x) => x.id === dimensionDragState.id) ?? null;
      if (!d) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      pointerNdc.set(x, y);
      raycaster.setFromCamera(pointerNdc, cam());
      const hitPoint = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;

      const la = wallLineSegment(d.params.a.wallId, d.params.a.wallLine);
      if (!la) return;
      const dir = la.dir.clone().normalize();
      const n = new THREE.Vector3(-dir.z, 0, dir.x);
      const delta = hitPoint.clone().sub(dimensionDragState.startWorld);
      d.params.offsetM = dimensionDragState.startOffsetM + n.dot(delta);
      updateDimensionGeometry(d, rect);
      return;
    }

    // Align/Trim/Dimension hover highlight
    if (mode === "layout" && viewMode === "2d" && (layoutTool === "align" || layoutTool === "trim" || layoutTool === "dimension")) {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      pointerNdc.set(x, y);
      raycaster.setFromCamera(pointerNdc, cam());
      const hitPoint = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
        clearToolHud();
      } else {
        const mouse = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
        const picked = pickAlignLineAt(hitPoint, mouse, rect);
        const thick = hudLineThicknessM(rect);

        const now = performance.now();
        if (layoutTool === "align") {
          alignState.hover = picked;
          if (picked) updateHudLine(hudHoverLine, picked.segA, picked.segB, thick);
          else hudHoverLine.visible = false;

          if (alignState.ref) {
            updateHudLine(hudPickLine1, alignState.ref.segA, alignState.ref.segB, thick);
            hudPickLine2.visible = false;
          } else if (alignState.lastA && alignState.lastB && alignState.lastUntilMs > now) {
            updateHudLine(hudPickLine1, alignState.lastA.segA, alignState.lastA.segB, thick);
            updateHudLine(hudPickLine2, alignState.lastB.segA, alignState.lastB.segB, thick);
          } else {
            alignState.lastA = null;
            alignState.lastB = null;
            alignState.lastUntilMs = 0;
            hudPickLine1.visible = false;
            hudPickLine2.visible = false;
          }
        } else if (layoutTool === "trim") {
          trimState.hover = picked;
          if (picked) updateHudLine(hudHoverLine, picked.segA, picked.segB, thick);
          else hudHoverLine.visible = false;

          if (trimState.targetPick) updateHudLine(hudPickLine1, trimState.targetPick.segA, trimState.targetPick.segB, thick);
          else hudPickLine1.visible = false;

          if (trimState.lastTarget && trimState.lastCutter && trimState.lastUntilMs > now) {
            updateHudLine(hudPickLine1, trimState.lastTarget.segA, trimState.lastTarget.segB, thick);
            updateHudLine(hudPickLine2, trimState.lastCutter.segA, trimState.lastCutter.segB, thick);
          } else if (trimState.step === "pickCutter" && trimState.targetPick) {
            hudPickLine2.visible = false;
          } else {
            if (trimState.lastUntilMs <= now) {
              trimState.lastTarget = null;
              trimState.lastCutter = null;
              trimState.lastUntilMs = 0;
              if (!trimState.targetPick) {
                hudPickLine1.visible = false;
                hudPickLine2.visible = false;
              }
            }
          }
          dimPreview.root.visible = false;
        } else {
          // dimension
          dimTool.hover = picked;
          if (picked) updateHudLine(hudHoverLine, picked.segA, picked.segB, thick);
          else hudHoverLine.visible = false;

          if (dimTool.a) {
            updateHudLine(hudPickLine1, dimTool.a.segA, dimTool.a.segB, thick);
            if (picked && alignParallel(dimTool.a, picked) && picked.wallId !== dimTool.a.wallId) {
              updateHudLine(hudPickLine2, picked.segA, picked.segB, thick);
            } else {
              hudPickLine2.visible = false;
            }
          } else {
            hudPickLine1.visible = false;
            hudPickLine2.visible = false;
          }

          // preview dimension (first ref + hovered parallel line)
          if (dimTool.a && picked && alignParallel(dimTool.a, picked) && picked.wallId !== dimTool.a.wallId && picked.wallLine !== "endA" && picked.wallLine !== "endB" && dimTool.a.wallLine !== "endA" && dimTool.a.wallLine !== "endB") {
            const dir = dimTool.a.dir.clone().normalize();
            const n = new THREE.Vector3(-dir.z, 0, dir.x);
            const aPt = dimTool.a.segA.clone().lerp(dimTool.a.segB, dimTool.tA);
            const bT = segClosestT(hitPoint, picked.segA, picked.segB);
            const bPt = picked.segA.clone().lerp(picked.segB, bT);
            const off = n.dot(hitPoint.clone().sub(aPt));
            dimTool.offsetM = off;
            const aDim = aPt.clone().addScaledVector(n, off);
            const bDim = bPt.clone().addScaledVector(n, off);

            const thickDim = thick * 1.2;
            updateDimBar(dimPreview.ext1, aPt, aDim, thickDim);
            updateDimBar(dimPreview.ext2, bPt, bDim, thickDim);
            updateDimBar(dimPreview.dim, aDim, bDim, thickDim);

            const dimDir = bDim.clone().sub(aDim);
            const len = dimDir.length();
            const u = len > 1e-6 ? dimDir.clone().multiplyScalar(1 / len) : new THREE.Vector3(1, 0, 0);
            const tickDir = u.clone().add(n.clone().normalize()).normalize();
            const tickLen = Math.max(thickDim * 10, thickDim * 8);
            const t1a = aDim.clone().addScaledVector(tickDir, tickLen / 2);
            const t1b = aDim.clone().addScaledVector(tickDir, -tickLen / 2);
            const t2a = bDim.clone().addScaledVector(tickDir, tickLen / 2);
            const t2b = bDim.clone().addScaledVector(tickDir, -tickLen / 2);
            updateDimBar(dimPreview.tick1, t1a, t1b, thickDim);
            updateDimBar(dimPreview.tick2, t2a, t2b, thickDim);

            const mid = aDim.clone().add(bDim).multiplyScalar(0.5);
            dimPreview.text.position.set(mid.x, 0.06, mid.z);
            const mm = Math.round(Math.abs(n.dot(bPt.clone().sub(aPt))) * 1000);
            updateSpriteText(dimPreview.text, `${mm}`);
            setSpriteScreenFixedScale(dimPreview.text, rect);
            dimPreview.root.visible = true;
          } else {
            dimPreview.root.visible = false;
          }
        }
      }
      // no return; other pointermove handling can still run (e.g. marquee box)
    }

    if (mode === "layout" && layoutTool === "wall" && wallDraw.active && wallDraw.a && wallDraw.preview) {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      wallDraw.lastPointerPx.x = ev.clientX - rect.left;
      wallDraw.lastPointerPx.y = ev.clientY - rect.top;
      pointerNdc.set(x, y);
      raycaster.setFromCamera(pointerNdc, cam());
      const hitPoint = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;
      const snapped = snapPoint2D(hitPoint, rect, cam());
      if (snapped.kind !== "none") {
        const s = worldToScreen(snapped.point, cam(), rect);
        wallSnapHud.style.left = `${s.x}px`;
        wallSnapHud.style.top = `${s.y}px`;
        wallSnapHud.style.display = "block";
      } else {
        wallSnapHud.style.display = "none";
      }

      const shouldAxisSnap = !ev.shiftKey && snapped.kind === "none";
      const b0 = snapped.kind !== "none" ? snapped.point : hitPoint;
      const b = shouldAxisSnap ? snapAxisXZ(wallDraw.a, b0, true) : b0;
      wallDraw.hoverB = b.clone();
      updateWallMeshWithJustification(
        wallDraw.preview,
        wallDraw.a,
        b,
        wallDefault.thicknessMm,
        wallDefault.justification,
        wallDefault.exteriorSign
      );

      if (wallDraw.typedMm.trim().length > 0) {
        wallTypedHud.textContent = `${wallDraw.typedMm} mm`;
        wallTypedHud.style.left = `${ev.clientX - rect.left}px`;
        wallTypedHud.style.top = `${ev.clientY - rect.top}px`;
        wallTypedHud.style.display = "block";
      } else {
        wallTypedHud.style.display = "none";
      }
      return;
    }

    if (mode === "layout" && layoutTool === "wall" && viewMode === "2d") {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      wallDraw.lastPointerPx.x = ev.clientX - rect.left;
      wallDraw.lastPointerPx.y = ev.clientY - rect.top;
      pointerNdc.set(x, y);
      raycaster.setFromCamera(pointerNdc, cam());
      const hitPoint = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;
      const snapped = snapPoint2D(hitPoint, rect, cam());
      if (snapped.kind !== "none") {
        const s = worldToScreen(snapped.point, cam(), rect);
        wallSnapHud.style.left = `${s.x}px`;
        wallSnapHud.style.top = `${s.y}px`;
        wallSnapHud.style.display = "block";
        const c =
          snapped.kind === "corner"
            ? "#ff4dff"
            : snapped.kind === "edge"
              ? "#ffd166"
              : snapped.kind === "endpoint"
                ? "#3ddc97"
                : "#00e5ff";
        wallSnapHud.style.borderColor = c;
        wallSnapHud.style.background = `${c}33`;
      } else {
        wallSnapHud.style.display = "none";
      }
    }

    if (mode === "layout" && viewMode === "2d" && layoutTool === "select" && !dragState.active && !windowDragState.active && !wallEditHud.drag && !marquee.active) {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      pointerNdc.set(x, y);
      raycaster.setFromCamera(pointerNdc, cam());
      const hitPoint = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;
      const snapped = snapPoint2D(hitPoint, rect, cam(), 12);
      if (snapped.kind !== "none") {
        const s = worldToScreen(snapped.point, cam(), rect);
        wallSnapHud.style.left = `${s.x}px`;
        wallSnapHud.style.top = `${s.y}px`;
        wallSnapHud.style.display = "block";
      } else {
        wallSnapHud.style.display = "none";
      }
    }

    if (mode === "layout" && windowDragState.active && windowInst && windowDragState.wall) {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      pointerNdc.set(x, y);
      raycaster.setFromCamera(pointerNdc, cam());

      const def = wallDefs[windowDragState.wall];
      const hitPoint = new THREE.Vector3();
      const okWall = raycaster.ray.intersectPlane(def.plane, hitPoint);
      if (!okWall) {
        if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;
      }

      const axis = def.axis === "x" ? hitPoint.x : hitPoint.z;
      windowInst.params.centerMm = axis * 1000 + windowDragState.offsetMm;
      updateWindowTransform(windowInst);
      mountWindowControls();
      return;
    }

    if (mode === "layout" && dragState.active && dragState.id) {
      const inst = findInstance(dragState.id);
      if (!inst) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      pointerNdc.set(x, y);
      raycaster.setFromCamera(pointerNdc, cam());

      const hitPoint = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;

      const desired = new THREE.Vector3(hitPoint.x - dragState.offset.x, 0, hitPoint.z - dragState.offset.z);
      const desiredInRoom = applyWallConstraints(inst, desired);
      const snapped = snapPosition(inst, desiredInRoom);
      const finalPos = applyWallConstraints(inst, snapped);

      inst.root.position.copy(finalPos);
      autoOrientModuleToRoomWallIfSnapped(inst);
      if (anyOverlap(inst, null)) {
        inst.root.position.copy(dragState.lastValid);
      } else {
        dragState.lastValid.copy(inst.root.position);
        updateLayoutPanel();
      }
      return;
    }

    if (!measureState.enabled || !cabinetGroup) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    pointerNdc.set(x, y);
    raycaster.setFromCamera(pointerNdc, cam());

    const meshes = getSelectableMeshes(cabinetGroup).filter((m) => m.visible);
    const hit = pickSurfacePoint(raycaster, meshes);
    if (!hit) {
      measureState.hoverPoint = null;
      measureState.hoverSnap = "none";
      if (measureState.cursorEl) measureState.cursorEl.style.display = "none";
      args.measureReadoutEl.textContent = measureState.firstPoint
        ? "Pick second point… (no surface)"
        : "Click 2 points to measure (planar X/Z).";
      clearPreview();
      return;
    }

    const snapped = snapPointXZ(hit.point, hit.object);
    measureState.hoverPoint = snapped.point;
    measureState.hoverSnap = snapped.kind;

    // Cursor indicator
    if (measureState.cursorEl) {
      const s = worldToScreen(snapped.point, cam(), rect);
      measureState.cursorEl.style.left = `${s.x}px`;
      measureState.cursorEl.style.top = `${s.y}px`;
      measureState.cursorEl.style.display = "block";
      // Color by snap state: corner=magenta, edge=yellow, free=cyan
      const c = snapped.kind === "corner" ? "#ff4dff" : snapped.kind === "edge" ? "#ffd166" : "#00e5ff";
      measureState.cursorEl.style.borderColor = c;
    }

    // Preview line after first click
    if (measureState.firstPoint) {
      let a = measureState.firstPoint;
      let b = snapped.point;
      if (measureState.axisLock) b = axisLockXZ(a, b);
      updatePreview(a, b, rect);
      args.measureReadoutEl.textContent = `Measuring (${snapped.kind}) — ${Math.round(planarDistanceMm(a, b))} mm`;
    } else {
      args.measureReadoutEl.textContent = `Hover (${snapped.kind}): ${formatMm(snapped.point)} — click first point`;
      clearPreview();
    }
  });

  renderer.domElement.addEventListener("pointerup", (ev) => {
    if (mode !== "layout") return;

    if (wallEditHud.drag && wallEditHud.drag.pointerId === ev.pointerId) {
      const d = wallEditHud.drag;
      wallEditHud.drag = null;
      const w = walls.find((x) => x.id === d.wallId) ?? null;
      if (w) {
        autoJoinAtMmPoint(w.params.aMm);
        autoJoinAtMmPoint(w.params.bMm);
      }
      rebuildWallPlanMesh();
      mountProps();
      commitHistory();
      try {
        renderer.domElement.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    if (underlayDragState.active && underlayDragState.pointerId === ev.pointerId) {
      underlayDragState.active = false;
      underlayDragState.pointerId = null;
      setUnderlayStatus("Underlay moved.");
      commitHistory();
      try {
        renderer.domElement.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    if (dimensionDragState.active && dimensionDragState.pointerId === ev.pointerId) {
      dimensionDragState.active = false;
      dimensionDragState.pointerId = null;
      dimensionDragState.id = null;
      commitHistory();
      try {
        renderer.domElement.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    if (marquee.pending && marquee.pointerId === ev.pointerId && !marquee.active) {
      marquee.pending = false;
      marquee.pointerId = null;
      if (!marquee.hitSomething && viewMode === "2d" && layoutTool === "select") {
        setSelectedWall(null);
        setSelectedModule(null);
      }
      try {
        renderer.domElement.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    if (marquee.active) {
      marquee.active = false;
      marquee.pending = false;
      marquee.pointerId = null;
      marqueeEl.style.display = "none";

      const rect = renderer.domElement.getBoundingClientRect();
      const endX = ev.clientX - rect.left;
      const endY = ev.clientY - rect.top;
      const x0 = Math.min(marquee.startX, endX);
      const y0 = Math.min(marquee.startY, endY);
      const x1 = Math.max(marquee.startX, endX);
      const y1 = Math.max(marquee.startY, endY);
      const w = x1 - x0;
      const h = y1 - y0;

      // If it's a click-sized drag, let normal click selection handle it.
      if (w >= 6 && h >= 6 && viewMode === "2d" && layoutTool === "select") {
        const rectSel = { x0, y0, x1, y1 };
        const contains = (b: { minX: number; minY: number; maxX: number; maxY: number }) =>
          b.minX >= rectSel.x0 && b.maxX <= rectSel.x1 && b.minY >= rectSel.y0 && b.maxY <= rectSel.y1;
        const overlaps = (b: { minX: number; minY: number; maxX: number; maxY: number }) =>
          b.maxX >= rectSel.x0 && b.minX <= rectSel.x1 && b.maxY >= rectSel.y0 && b.minY <= rectSel.y1;

        const wallBounds = (w: WallInstance) => {
          const a = fromMmPoint(w.params.aMm);
          const b = fromMmPoint(w.params.bMm);
          const d = b.clone().sub(a);
          const len = d.length();
          if (len < 1e-8) {
            const s = worldToScreen(a, cam(), rect);
            return { minX: s.x, maxX: s.x, minY: s.y, maxY: s.y };
          }
          d.multiplyScalar(1 / len);
          const n = new THREE.Vector3(-d.z, 0, d.x);
          const h = Math.max(1, w.params.thicknessMm / 2) / 1000;
          const p1 = a.clone().addScaledVector(n, h);
          const p2 = a.clone().addScaledVector(n, -h);
          const p3 = b.clone().addScaledVector(n, -h);
          const p4 = b.clone().addScaledVector(n, h);
          const s1 = worldToScreen(p1, cam(), rect);
          const s2 = worldToScreen(p2, cam(), rect);
          const s3 = worldToScreen(p3, cam(), rect);
          const s4 = worldToScreen(p4, cam(), rect);
          const xs = [s1.x, s2.x, s3.x, s4.x];
          const ys = [s1.y, s2.y, s3.y, s4.y];
          return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys)
          };
        };

        const instBounds = (id: string) => {
          const inst = findInstance(id);
          if (!inst) return null;
          const box = instanceWorldBox(inst);
          const pts = [
            new THREE.Vector3(box.min.x, 0, box.min.z),
            new THREE.Vector3(box.min.x, 0, box.max.z),
            new THREE.Vector3(box.max.x, 0, box.min.z),
            new THREE.Vector3(box.max.x, 0, box.max.z)
          ];
          const ss = pts.map((p) => worldToScreen(p, cam(), rect));
          const xs = ss.map((p) => p.x);
          const ys = ss.map((p) => p.y);
          return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
        };

        const hitWalls: string[] = [];
        for (const ww of walls) {
          if (pinnedWallIds.has(ww.id)) continue;
          const b = wallBounds(ww);
          const ok = marquee.mode === "contain" ? contains(b) : overlaps(b);
          if (ok) hitWalls.push(ww.id);
        }

        const hitMods: string[] = [];
        for (const inst of instances) {
          if (pinnedInstanceIds.has(inst.id)) continue;
          const b = instBounds(inst.id);
          if (!b) continue;
          const ok = marquee.mode === "contain" ? contains(b) : overlaps(b);
          if (ok) hitMods.push(inst.id);
        }

        // Apply multi-selection (Shift = add).
        const nextWalls = new Set<string>(ev.shiftKey ? Array.from(selectedWallIds) : []);
        const nextMods = new Set<string>(ev.shiftKey ? Array.from(selectedInstanceIds) : []);
        for (const id of hitWalls) nextWalls.add(id);
        for (const id of hitMods) nextMods.add(id);

        // Pick primary (keep current if still selected when shift-adding).
        let primaryWall = selectedWallId && nextWalls.has(selectedWallId) ? selectedWallId : null;
        let primaryMod = selectedInstanceId && nextMods.has(selectedInstanceId) ? selectedInstanceId : null;
        if (!primaryWall && !primaryMod) {
          primaryWall = hitWalls[0] ?? null;
          primaryMod = primaryWall ? null : hitMods[0] ?? null;
        }

        // Set primary selection for handles/props, then populate sets.
        if (primaryWall) setSelectedWall(primaryWall);
        else if (primaryMod) setSelectedModule(primaryMod);
        else {
          setSelectedWall(null);
          setSelectedModule(null);
        }

        selectedWallIds.clear();
        for (const id of nextWalls) selectedWallIds.add(id);
        selectedInstanceIds.clear();
        for (const id of nextMods) selectedInstanceIds.add(id);
        updateSelectionHighlights();
        mountProps();
      }

      try {
        renderer.domElement.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    if (windowDragState.active) {
      windowDragState.active = false;
      windowDragState.wall = null;
      try {
        renderer.domElement.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore
      }
      return;
    }
    if (!dragState.active) return;
    dragState.active = false;
    dragState.id = null;
    try {
      renderer.domElement.releasePointerCapture(ev.pointerId);
    } catch {
      // ignore
    }
  });

  modelSelect.addEventListener("change", () => {
    if (mode !== "build") return;
    const v = modelSelect.value as ModuleParams["type"];
    setModel(v);
  });

  modeSelect.value = "layout";
  setMode("layout");
  history.current = captureLayoutSnapshot();
  history.past = [];
  history.future = [];
  updateUndoRedoUi();

  const navForward = new THREE.Vector3();
  const navRight = new THREE.Vector3();
  const navMove = new THREE.Vector3();
  const navUp = new THREE.Vector3(0, 1, 0);

  function applyKeyboardNav(dt: number) {
    if (navKeys.size === 0) return;
    if (mode === "layout" && dragState.active) return;

    const shift = navKeys.has("ShiftLeft") || navKeys.has("ShiftRight");
    const space = navKeys.has("Space");

    let speedMult = 1;
    if (shift && space) speedMult = 4;
    else if (shift) speedMult = 2.5;
    else if (space) speedMult = 0.35;

    const baseSpeedMps = 1.4;
    const speed = baseSpeedMps * speedMult;

    const xAxis = (navKeys.has("KeyD") ? 1 : 0) - (navKeys.has("KeyA") ? 1 : 0);
    const zAxis = (navKeys.has("KeyW") ? 1 : 0) - (navKeys.has("KeyS") ? 1 : 0);
    const yAxis = (navKeys.has("KeyQ") ? 1 : 0) - (navKeys.has("KeyE") ? 1 : 0);

    if (xAxis === 0 && zAxis === 0 && yAxis === 0) return;

    const camera = cam() as any;
    const controls = ctl() as any;

    if (viewMode === "2d") {
      navMove.set(xAxis, 0, -zAxis);
      if (navMove.lengthSq() > 1) navMove.normalize();
      navMove.multiplyScalar(speed * dt);
      camera.position.add(navMove);
      controls.target.add(navMove);
      controls.update();
      return;
    }

    navForward.set(0, 0, -1);
    navForward.applyQuaternion(camera.quaternion);
    navForward.y = 0;
    if (navForward.lengthSq() < 1e-8) navForward.set(0, 0, -1);
    navForward.normalize();

    navRight.copy(navForward).cross(navUp).normalize();

    navMove.set(0, 0, 0);
    if (xAxis) navMove.addScaledVector(navRight, xAxis);
    if (zAxis) navMove.addScaledVector(navForward, zAxis);
    if (yAxis) navMove.addScaledVector(navUp, yAxis);
    if (navMove.lengthSq() > 1) navMove.normalize();
    navMove.multiplyScalar(speed * dt);

    camera.position.add(navMove);
    controls.target.add(navMove);
    controls.update();
  }

  const updateWallEditHud = () => {
    if (mode !== "layout" || viewMode !== "2d" || layoutTool !== "select") {
      hideWallEditHud();
      return;
    }
    if (measureState.enabled) {
      hideWallEditHud();
      return;
    }
    if (wallEditHud.drag) {
      // keep HUD visible during drag
    }

    if (selectedKind !== "wall" || !selectedWallId) {
      hideWallEditHud();
      return;
    }
    const w = walls.find((x) => x.id === selectedWallId) ?? null;
    if (!w) {
      hideWallEditHud();
      return;
    }

    const a = fromMmPoint(w.params.aMm);
    const b = fromMmPoint(w.params.bMm);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const rect = renderer.domElement.getBoundingClientRect();
    const sa = worldToScreen(a, cam(), rect);
    const sb = worldToScreen(b, cam(), rect);
    const sm = worldToScreen(mid, cam(), rect);

    const setLine = (el: HTMLDivElement, p0: { x: number; y: number }, p1: { x: number; y: number }) => {
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.max(0.001, Math.hypot(dx, dy));
      el.style.left = `${p0.x}px`;
      el.style.top = `${p0.y}px`;
      el.style.width = `${len}px`;
      el.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      el.style.display = "block";
    };

    wallEditHud.handleA.style.left = `${sa.x}px`;
    wallEditHud.handleA.style.top = `${sa.y}px`;
    wallEditHud.handleA.style.display = "block";

    wallEditHud.handleB.style.left = `${sb.x}px`;
    wallEditHud.handleB.style.top = `${sb.y}px`;
    wallEditHud.handleB.style.display = "block";

    wallEditHud.handleMid.style.left = `${sm.x}px`;
    wallEditHud.handleMid.style.top = `${sm.y}px`;
    wallEditHud.handleMid.style.display = "block";

    const lenMm = Math.round(mmDist(w.params.aMm, w.params.bMm));
    wallEditHud.label.textContent = `${lenMm} mm`;

    // offset dimension line + label a bit perpendicular to wall direction in screen space
    const dir = b.clone().sub(a);
    const n = new THREE.Vector2(-dir.z, dir.x);
    if (n.lengthSq() > 1e-8) n.normalize();

    const off = { x: n.x * 18, y: n.y * 18 };
    const da = { x: sa.x + off.x, y: sa.y + off.y };
    const db = { x: sb.x + off.x, y: sb.y + off.y };
    const dm = { x: sm.x + off.x, y: sm.y + off.y };

    setLine(wallEditHud.lenLine, da, db);
    setLine(wallEditHud.lenExtA, sa, da);
    setLine(wallEditHud.lenExtB, sb, db);

    wallEditHud.label.style.left = `${dm.x}px`;
    wallEditHud.label.style.top = `${dm.y}px`;
    if (wallEditHud.input.style.display !== "block") {
      wallEditHud.label.style.display = "block";
    } else {
      wallEditHud.label.style.display = "none";
    }

    // Auto-dimension to nearest parallel wall (face-to-face)
    wallEditHud.offsetRefWallId = null;
    wallEditHud.offsetLine.style.display = "none";
    wallEditHud.offsetTickA.style.display = "none";
    wallEditHud.offsetTickB.style.display = "none";
    wallEditHud.offsetLabel.style.display = "none";

    const selDir = b.clone().sub(a);
    if (selDir.lengthSq() > 1e-8) {
      selDir.normalize();
      const selN = new THREE.Vector3(-selDir.z, 0, selDir.x).normalize();
      const tA = a.dot(selDir);
      const tB = b.dot(selDir);
      const minSel = Math.min(tA, tB);
      const maxSel = Math.max(tA, tB);

      let best: { w: WallInstance; dist: number; signed: number; overlapMin: number; overlapMax: number } | null = null;
      for (const other of walls) {
        if (other.id === w.id) continue;
        const oa = fromMmPoint(other.params.aMm);
        const ob = fromMmPoint(other.params.bMm);
        const od = ob.clone().sub(oa);
        if (od.lengthSq() < 1e-8) continue;
        od.normalize();
        const parallel = Math.abs(od.dot(selDir)) > 0.985;
        if (!parallel) continue;

        const toA = oa.dot(selDir);
        const toB = ob.dot(selDir);
        const minO = Math.min(toA, toB);
        const maxO = Math.max(toA, toB);
        const overlapMin = Math.max(minSel, minO);
        const overlapMax = Math.min(maxSel, maxO);
        if (overlapMax - overlapMin < 0.08) continue;

        const oMid = oa.clone().add(ob).multiplyScalar(0.5);
        const signed = oMid.clone().sub(mid).dot(selN);
        const dist = Math.abs(signed);
        if (!best || dist < best.dist) best = { w: other, dist, signed, overlapMin, overlapMax };
      }

      if (best) {
        const ref = best.w;
        wallEditHud.offsetRefWallId = ref.id;

        const sign = best.signed >= 0 ? 1 : -1;
        const refA = fromMmPoint(ref.params.aMm);
        const refB = fromMmPoint(ref.params.bMm);
        const tRefA = refA.dot(selDir);
        const tRefB = refB.dot(selDir);
        const overlapT = (best.overlapMin + best.overlapMax) / 2;

        const selDen = tB - tA;
        const refDen = tRefB - tRefA;
        const uSel = Math.abs(selDen) < 1e-8 ? 0.5 : clamp((overlapT - tA) / selDen, 0, 1);
        const uRef = Math.abs(refDen) < 1e-8 ? 0.5 : clamp((overlapT - tRefA) / refDen, 0, 1);

        const pSel = a.clone().lerp(b, uSel);
        const pRef = refA.clone().lerp(refB, uRef);

        const tSel = w.params.thicknessMm / 1000;
        const tRef = ref.params.thicknessMm / 1000;
        const faceOffsetM = (tSel + tRef) / 2;
        const faceDistM = Math.max(0, best.dist - faceOffsetM);
        const faceDistMm = Math.round(faceDistM * 1000);

        const p0 = pSel.clone().addScaledVector(selN, (tSel / 2) * sign);
        const p1 = pRef.clone().addScaledVector(selN, (-tRef / 2) * sign);

        const s0 = worldToScreen(p0, cam(), rect);
        const s1 = worldToScreen(p1, cam(), rect);
        setLine(wallEditHud.offsetLine, s0, s1);

        const ddx = s1.x - s0.x;
        const ddy = s1.y - s0.y;
        const dlen = Math.max(0.001, Math.hypot(ddx, ddy));
        const ux = ddx / dlen;
        const uy = ddy / dlen;
        const vx = -uy;
        const vy = ux;
        const tick = 6;
        setLine(
          wallEditHud.offsetTickA,
          { x: s0.x - vx * tick, y: s0.y - vy * tick },
          { x: s0.x + vx * tick, y: s0.y + vy * tick }
        );
        setLine(
          wallEditHud.offsetTickB,
          { x: s1.x - vx * tick, y: s1.y - vy * tick },
          { x: s1.x + vx * tick, y: s1.y + vy * tick }
        );

        wallEditHud.offsetLabel.textContent = `${faceDistMm} mm`;
        wallEditHud.offsetLabel.style.left = `${(s0.x + s1.x) / 2 + vx * 16}px`;
        wallEditHud.offsetLabel.style.top = `${(s0.y + s1.y) / 2 + vy * 16}px`;
        if (wallEditHud.offsetInput.style.display !== "block") {
          wallEditHud.offsetLabel.style.display = "block";
        } else {
          wallEditHud.offsetLabel.style.display = "none";
        }
      }
    }
  };

  const tick = () => {
    const dt = Math.min(0.05, navClock.getDelta());
    applyKeyboardNav(dt);
    ctl().update();
    if (selectedBox && selectedMesh) selectedBox.setFromObject(selectedMesh);
    if (selectedInstanceBox && selectedInstanceId) {
      const inst = findInstance(selectedInstanceId);
      if (inst) selectedInstanceBox.setFromObject(inst.root);
    }
    if (grainArrow && selectedMesh) {
      const grain = computeGrainArrow(selectedMesh);
      if (grain) {
        grainArrow.position.copy(grain.origin);
        grainArrow.setDirection(grain.dir);
        grainArrow.setLength(grain.length, grain.length * 0.22, grain.length * 0.12);
      }
    }
    for (const o of overlapBoxes) o.helper.setFromObject(o.mesh);
    updateMeasureLabels();
    updateWallEditHud();

    const activeCam = cam();
    if (mode === "layout" && viewMode === "2d" && activeCam instanceof THREE.OrthographicCamera) {
      // Frame-driven scale update (no threshold) to avoid any zoom "jitter" on dimension text.
      if (dimensions.length > 0 || dimPreview.root.visible) {
        const rect = renderer.domElement.getBoundingClientRect();
        updateDimensionTextScale(rect);
      }
    }
    const isPhoto = renderMode === "photo_pathtrace" && ENABLE_PHOTO && activeCam instanceof THREE.PerspectiveCamera;
    const isSsgi = renderMode === "realtime_ssgi" && ENABLE_SSGI && activeCam instanceof THREE.PerspectiveCamera;

    if (isPhoto) {
      ssgi?.dispose();
      ssgi = null;
      ssgiCameraUuid = null;

      if (!photo || photoCameraUuid !== activeCam.uuid) {
        photo?.dispose();
        photo = createPhotoPathTracer({ renderer, scene, camera: activeCam });
        photoCameraUuid = activeCam.uuid;
        photoLastLightingRevision = getLightingRevision();
        photo.setSize(args.viewerEl.clientWidth, args.viewerEl.clientHeight);
        photo.setMaxSamples(Number(photoSamples.value));
        copyM16(lastCameraWorld, activeCam.matrixWorld);
        copyM16(lastCameraProj, activeCam.projectionMatrix);
      }

      const lightingRev = getLightingRevision();
      if (lightingRev !== photoLastLightingRevision) {
        photo.updateFromScene();
        photoLastLightingRevision = lightingRev;
      }

      if (matrixChanged(lastCameraWorld, activeCam.matrixWorld) || matrixChanged(lastCameraProj, activeCam.projectionMatrix)) {
        photo.updateCamera();
        copyM16(lastCameraWorld, activeCam.matrixWorld);
        copyM16(lastCameraProj, activeCam.projectionMatrix);
      }

      photo.setMaxSamples(Number(photoSamples.value));
      photo.renderSample();
      photoStatus.textContent = `Samples: ${photo.getSamples()} / ${photo.getMaxSamples()}`;
    } else if (isSsgi) {
      photo?.dispose();
      photo = null;
      photoCameraUuid = null;
      photoLastLightingRevision = -1;
      photoStatus.textContent = "";

      if (!ssgi || ssgiCameraUuid !== activeCam.uuid) {
        ssgi?.dispose();
        ssgi = createSsgiPipeline({ renderer, scene, camera: activeCam });
        ssgiCameraUuid = activeCam.uuid;
        ssgi.setSize(args.viewerEl.clientWidth, args.viewerEl.clientHeight);
      }
      ssgi.render(dt);
    } else {
      if (ssgi) {
        ssgi.dispose();
        ssgi = null;
        ssgiCameraUuid = null;
      }
      if (photo) {
        photo.dispose();
        photo = null;
        photoCameraUuid = null;
        photoLastLightingRevision = -1;
        photoStatus.textContent = "";
      }
      renderer.render(scene, activeCam);
    }
    requestAnimationFrame(tick);
  };
  tick();

  function addMeasurement(a: THREE.Vector3, b: THREE.Vector3) {
    const y = Math.max(a.y, b.y) + 0.002;
    const p1 = new THREE.Vector3(a.x, y, a.z);
    const p2 = new THREE.Vector3(b.x, y, b.z);

    const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const material = new THREE.LineBasicMaterial({ color: 0x00e5ff });
    const line = new THREE.Line(geometry, material);
    line.name = "measureLine";
    scene.add(line);

    const label = document.createElement("div");
    label.style.position = "absolute";
    label.style.transform = "translate(-50%, -50%)";
    label.style.padding = "4px 8px";
    label.style.borderRadius = "10px";
    label.style.border = "1px solid var(--border)";
    label.style.background = "#0f1117";
    label.style.color = "var(--text)";
    label.style.fontSize = "12px";
    label.style.whiteSpace = "nowrap";

    const mm = planarDistanceMm(a, b);
    label.textContent = `${Math.round(mm)} mm`;
    measureOverlay.appendChild(label);

    measureState.measures.push({ a: a.clone(), b: b.clone(), line, label });
    args.measureReadoutEl.textContent = `Measured: ${Math.round(mm)} mm`;
  }

  function updateMeasureLabels() {
    if (measureState.measures.length === 0) return;

    const rect = renderer.domElement.getBoundingClientRect();
    for (const m of measureState.measures) {
      const mid = new THREE.Vector3((m.a.x + m.b.x) / 2, (m.a.y + m.b.y) / 2 + 0.02, (m.a.z + m.b.z) / 2);
      const p = mid.project(cam());
      const sx = (p.x * 0.5 + 0.5) * rect.width;
      const sy = (-p.y * 0.5 + 0.5) * rect.height;
      m.label.style.left = `${sx}px`;
      m.label.style.top = `${sy}px`;
    }
  }

  function updatePreview(a: THREE.Vector3, b: THREE.Vector3, rect: DOMRect) {
    const y = Math.max(a.y, b.y) + 0.002;
    const p1 = new THREE.Vector3(a.x, y, a.z);
    const p2 = new THREE.Vector3(b.x, y, b.z);

    if (!measureState.previewLine) {
      const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const material = new THREE.LineBasicMaterial({ color: 0x88f7ff });
      const line = new THREE.Line(geometry, material);
      line.name = "measurePreviewLine";
      scene.add(line);
      measureState.previewLine = line;
    } else {
      measureState.previewLine.geometry.setFromPoints([p1, p2]);
    }

    if (!measureState.previewLabel) {
      const label = document.createElement("div");
      label.style.position = "absolute";
      label.style.transform = "translate(-50%, -50%)";
      label.style.padding = "4px 8px";
      label.style.borderRadius = "10px";
      label.style.border = "1px dashed var(--border)";
      label.style.background = "#0f1117";
      label.style.color = "var(--text)";
      label.style.fontSize = "12px";
      label.style.whiteSpace = "nowrap";
      measureOverlay.appendChild(label);
      measureState.previewLabel = label;
    }

    const mm = planarDistanceMm(a, b);
    measureState.previewLabel.textContent = `${Math.round(mm)} mm`;

    const mid = new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.02, (a.z + b.z) / 2);
    const s = worldToScreen(mid, cam(), rect);
    measureState.previewLabel.style.left = `${s.x}px`;
    measureState.previewLabel.style.top = `${s.y}px`;
  }

  function clearPreview() {
    if (measureState.previewLine) {
      scene.remove(measureState.previewLine);
      measureState.previewLine.geometry.dispose();
      (measureState.previewLine.material as THREE.Material).dispose();
      measureState.previewLine = null;
    }
    if (measureState.previewLabel) {
      measureState.previewLabel.remove();
      measureState.previewLabel = null;
    }
  }
}

function planarDistanceMm(a: THREE.Vector3, b: THREE.Vector3) {
  const dx = (b.x - a.x) * 1000;
  const dz = (b.z - a.z) * 1000;
  return Math.hypot(dx, dz);
}

function axisLockXZ(a: THREE.Vector3, b: THREE.Vector3) {
  const dx = Math.abs(b.x - a.x);
  const dz = Math.abs(b.z - a.z);
  if (dx >= dz) return new THREE.Vector3(b.x, b.y, a.z);
  return new THREE.Vector3(a.x, b.y, b.z);
}

function pickSurfacePoint(raycaster: THREE.Raycaster, meshes: THREE.Mesh[]) {
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length === 0) return null;
  const h = hits[0];
  return { point: h.point.clone(), object: h.object as THREE.Mesh };
}

function snapPointXZ(point: THREE.Vector3, mesh: THREE.Mesh): { point: THREE.Vector3; kind: "free" | "edge" | "corner" } {
  const threshold = 0.015; // 15mm
  const box = new THREE.Box3().setFromObject(mesh);

  const candidates: THREE.Vector3[] = [];
  const cornerCount = 4;
  const corners = [
    new THREE.Vector3(box.min.x, point.y, box.min.z),
    new THREE.Vector3(box.min.x, point.y, box.max.z),
    new THREE.Vector3(box.max.x, point.y, box.min.z),
    new THREE.Vector3(box.max.x, point.y, box.max.z)
  ];
  candidates.push(...corners);

  // Snap-to-edge projections (XZ): force x or z to min/max if close.
  const proj = [
    new THREE.Vector3(box.min.x, point.y, clamp(point.z, box.min.z, box.max.z)),
    new THREE.Vector3(box.max.x, point.y, clamp(point.z, box.min.z, box.max.z)),
    new THREE.Vector3(clamp(point.x, box.min.x, box.max.x), point.y, box.min.z),
    new THREE.Vector3(clamp(point.x, box.min.x, box.max.x), point.y, box.max.z)
  ];
  candidates.push(...proj);

  let best = point.clone();
  let bestD = Infinity;
  let bestIdx = -1;
  for (let idx = 0; idx < candidates.length; idx++) {
    const c = candidates[idx];
    const d = Math.hypot(c.x - point.x, c.z - point.z);
    if (d < bestD) {
      bestD = d;
      best = c;
      bestIdx = idx;
    }
  }

  if (bestD > threshold) return { point: point.clone(), kind: "free" };
  return { point: best, kind: bestIdx >= 0 && bestIdx < cornerCount ? "corner" : "edge" };
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function formatMm(v: THREE.Vector3) {
  return `${Math.round(v.x * 1000)}, ${Math.round(v.z * 1000)}`;
}

function worldToScreen(world: THREE.Vector3, camera: THREE.Camera, rect: DOMRect) {
  const p = world.clone().project(camera);
  return {
    x: (p.x * 0.5 + 0.5) * rect.width,
    y: (-p.y * 0.5 + 0.5) * rect.height
  };
}

function getSelectableMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.userData?.selectable !== true) return;
    if (typeof m.name !== "string" || m.name.length === 0) return;
    meshes.push(m);
  });
  return meshes;
}

function findSelectableMeshByName(root: THREE.Object3D, name: string): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  root.traverse((o) => {
    if (found) return;
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.name !== name) return;
    if (m.userData?.selectable !== true) return;
    found = m;
  });
  return found;
}

function readDimensionsMm(mesh: THREE.Mesh) {
  const d = mesh.userData?.dimensionsMm as { width: number; height: number; depth: number } | undefined;
  if (d && Number.isFinite(d.width) && Number.isFinite(d.height) && Number.isFinite(d.depth)) return d;

  // Fallback for safety (shouldn't happen for our generated parts).
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  return { width: size.x * 1000, height: size.y * 1000, depth: size.z * 1000 };
}

function readGrainAlong(mesh: THREE.Mesh): GrainAlong {
  const raw = mesh.userData?.grainAlong;
  if (raw === "width" || raw === "height" || raw === "depth" || raw === "none") return raw;
  return "none";
}

function computeGrainArrow(mesh: THREE.Mesh): { origin: THREE.Vector3; dir: THREE.Vector3; length: number } | null {
  const grainAlong = readGrainAlong(mesh);
  if (grainAlong === "none") return null;
  const n = mesh.name ?? "";
  if (n.includes("hinge") || n.startsWith("leg")) return null;

  const localAxis =
    grainAlong === "width"
      ? new THREE.Vector3(1, 0, 0)
      : grainAlong === "height"
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1);

  const q = new THREE.Quaternion();
  mesh.getWorldQuaternion(q);

  const dir = localAxis.applyQuaternion(q).normalize();
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const origin = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const length = Math.max(0.08, Math.min(0.35, maxDim * 0.7));
  return { origin, dir, length };
}

function toggleSelectedPbr(mesh: THREE.Mesh, kind: "all" | "normal" | "roughness") {
  const matAny = mesh.material as unknown;
  if (!(matAny instanceof THREE.MeshStandardMaterial)) return;

  const mat = matAny;

  if (mesh.userData?.__pbrMaterialCloned !== true) {
    mesh.material = mat.clone();
    mesh.userData.__pbrMaterialCloned = true;
    return toggleSelectedPbr(mesh, kind);
  }

  const m = mesh.material as THREE.MeshStandardMaterial;
  const backup = (m.userData.__pbrBackup as
    | { map: THREE.Texture | null; normalMap: THREE.Texture | null; roughnessMap: THREE.Texture | null }
    | undefined) ?? { map: m.map ?? null, normalMap: m.normalMap ?? null, roughnessMap: m.roughnessMap ?? null };
  m.userData.__pbrBackup = backup;

  const toggle = (key: "map" | "normalMap" | "roughnessMap") => {
    (m as any)[key] = (m as any)[key] ? null : (backup as any)[key];
  };

  if (kind === "all") {
    const anyOn = Boolean(m.map || m.normalMap || m.roughnessMap);
    m.map = anyOn ? null : backup.map;
    m.normalMap = anyOn ? null : backup.normalMap;
    m.roughnessMap = anyOn ? null : backup.roughnessMap;
  } else if (kind === "normal") {
    toggle("normalMap");
  } else if (kind === "roughness") {
    toggle("roughnessMap");
  }

  m.needsUpdate = true;
}

function computeOverlaps(root: THREE.Object3D): OverlapRow[] {
  const meshes = getSelectableMeshes(root).filter((m) => {
    const n = m.name ?? "";
    if (n.includes("hinge")) return false;
    if (n.startsWith("leg")) return false;
    return true;
  });

  const boxes = meshes.map((m) => ({ m, box: new THREE.Box3().setFromObject(m) }));

  const eps = 0.0005; // 0.5mm: touching is OK, overlap must exceed eps on all axes
  const out: OverlapRow[] = [];

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];

      // Allowed overlaps (construction joins) are still reported, but marked as allowed.
      const aAllow = (a.m.userData?.allowOverlapWith as string[] | undefined) ?? [];
      const bAllow = (b.m.userData?.allowOverlapWith as string[] | undefined) ?? [];
      const allowed = aAllow.includes(b.m.name) || bAllow.includes(a.m.name);
      const reason =
        (a.m.userData?.allowOverlapReason as string | undefined) ?? (b.m.userData?.allowOverlapReason as string | undefined);

      const minX = Math.max(a.box.min.x, b.box.min.x);
      const minY = Math.max(a.box.min.y, b.box.min.y);
      const minZ = Math.max(a.box.min.z, b.box.min.z);
      const maxX = Math.min(a.box.max.x, b.box.max.x);
      const maxY = Math.min(a.box.max.y, b.box.max.y);
      const maxZ = Math.min(a.box.max.z, b.box.max.z);

      const sx = maxX - minX;
      const sy = maxY - minY;
      const sz = maxZ - minZ;

      if (sx <= eps || sy <= eps || sz <= eps) continue;

      const overlapMm = { x: sx * 1000, y: sy * 1000, z: sz * 1000 };
      const intersectionMm = {
        min: { x: minX * 1000, y: minY * 1000, z: minZ * 1000 },
        max: { x: maxX * 1000, y: maxY * 1000, z: maxZ * 1000 }
      };
      const aBoxMm = {
        min: { x: a.box.min.x * 1000, y: a.box.min.y * 1000, z: a.box.min.z * 1000 },
        max: { x: a.box.max.x * 1000, y: a.box.max.y * 1000, z: a.box.max.z * 1000 }
      };
      const bBoxMm = {
        min: { x: b.box.min.x * 1000, y: b.box.min.y * 1000, z: b.box.min.z * 1000 },
        max: { x: b.box.max.x * 1000, y: b.box.max.y * 1000, z: b.box.max.z * 1000 }
      };
      out.push({
        a: a.m.name,
        b: b.m.name,
        status: allowed ? "allowed" : "error",
        reason: allowed ? reason ?? "whitelisted overlap" : undefined,
        overlapMm,
        intersectionMm,
        aBoxMm,
        bBoxMm,
        volumeMm3: overlapMm.x * overlapMm.y * overlapMm.z
      });
    }
  }

  out.sort((x, y) => (x.status === y.status ? y.volumeMm3 - x.volumeMm3 : x.status === "error" ? -1 : 1));
  return out.slice(0, 40);
}

function buildExportPayload(params: ModuleParams, cabinetGroup: THREE.Group | null) {
  if (cabinetGroup) cabinetGroup.updateMatrixWorld(true);
  const overlaps = cabinetGroup ? computeOverlaps(cabinetGroup) : [];
  const parts = cabinetGroup
    ? getSelectableMeshes(cabinetGroup).map((m) => ({
        name: m.name,
        dimensionsMm: readDimensionsMm(m),
        grainAlong: readGrainAlong(m)
      }))
    : [];

  const roundBox = (box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }) => ({
    min: { x: round01(box.min.x), y: round01(box.min.y), z: round01(box.min.z) },
    max: { x: round01(box.max.x), y: round01(box.max.y), z: round01(box.max.z) }
  });

  const out = {
    ...params,
    isCorner: params.type === "corner_shelf_lower",
    __debug: {
      units: "mm",
      generatedAt: new Date().toISOString(),
      parts,
      overlaps: overlaps.map((o) => ({
        a: o.a,
        b: o.b,
        status: o.status,
        reason: o.reason,
        overlapMm: { x: round01(o.overlapMm.x), y: round01(o.overlapMm.y), z: round01(o.overlapMm.z) },
        intersectionMm: roundBox(o.intersectionMm),
        aBoxMm: roundBox(o.aBoxMm),
        bBoxMm: roundBox(o.bBoxMm)
      }))
    }
  };

  return out;
}

function round01(n: number) {
  return Math.round(n * 10) / 10;
}

function renderErrors(el: HTMLElement, errors: string[]) {
  if (errors.length === 0) {
    el.classList.remove("visible");
    el.innerHTML = "";
    return;
  }

  el.classList.add("visible");
  el.innerHTML = `<ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`;
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
