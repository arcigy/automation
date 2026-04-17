import * as THREE from "three";
import type { ModuleParams } from "./model/cabinetTypes";
import { makeDefaultCornerShelfLowerParams, makeDefaultDrawerLowParams, makeDefaultShelvesParams, validateModule } from "./model/cabinetTypes";
import { buildModule } from "./geometry/buildModule";
import { createScene } from "./scene/createScene";
import { createPartPanel, type GrainAlong, type OverlapRow } from "./ui/createPartPanel";
import { createLayoutPanel } from "./ui/createLayoutPanel";
import { disposeObject3D } from "./scene/disposeObject3D";
import { createDrawerLowControls } from "./ui/createDrawerLowControls";
import { createShelvesControls } from "./ui/createShelvesControls";
import { createCornerShelfLowerControls } from "./ui/createCornerShelfLowerControls";
import { createSsgiPipeline, type SsgiPipeline } from "./rendering/ssgiPipeline";
import { createPhotoPathTracer, type PhotoPathTracer } from "./rendering/photoPathTracer";
import { exportSceneToJson } from "./scene/exportSceneJson";

type AppArgs = {
  viewerEl: HTMLElement;
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

  const roomBounds = {
    halfW: 3, // meters (must match createScene.ts room w=6)
    halfD: 3, // meters (must match createScene.ts room d=6)
    h: 3 // meters (must match createScene.ts room h=3)
  };

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
  let selectedInstanceBox: THREE.BoxHelper | null = null;

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
  let selectedKind: "module" | "window" | null = null;

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

  window.addEventListener("keydown", (ev) => {
    if (isTypingTarget(ev.target)) return;
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
      <option value="shelves">shelves</option>
      <option value="corner_shelf_lower">corner_shelf_lower</option>
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
  const addShelvesBtn = document.createElement("button");
  addShelvesBtn.type = "button";
  addShelvesBtn.textContent = "Add shelves";
  const addCornerBtn = document.createElement("button");
  addCornerBtn.type = "button";
  addCornerBtn.textContent = "Add corner";
  addWrap.appendChild(addDrawerBtn);
  addWrap.appendChild(addShelvesBtn);
  addWrap.appendChild(addCornerBtn);

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
  view2d.checked = false;
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

  modeSelect.addEventListener("change", () => {
    const next = modeSelect.value === "layout" ? "layout" : "build";
    setMode(next);
  });

  addDrawerBtn.addEventListener("click", () => addInstance("drawer_low"));
  addShelvesBtn.addEventListener("click", () => addInstance("shelves"));
  addCornerBtn.addEventListener("click", () => addInstance("corner_shelf_lower"));
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
    const box = inst.localBox.clone();
    box.translate(inst.root.position);
    return box;
  }

  function instanceWorldBoxAt(inst: LayoutInstance, pos: THREE.Vector3) {
    const prev = inst.root.position.clone();
    inst.root.position.copy(pos);
    const box = instanceWorldBox(inst);
    inst.root.position.copy(prev);
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

  function createInstance(nextParams: ModuleParams) {
    const id = `m${instanceCounter++}`;
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
    if (!inst) {
      instanceEditorHost.innerHTML = "";
      return;
    }

    selectedInstanceBox = new THREE.BoxHelper(inst.root, 0x3ddc97);
    selectedInstanceBox.name = "instanceSelectionBox";
    scene.add(selectedInstanceBox);

    mountInstanceControls(inst);
  }

  function setSelectedModule(id: string | null) {
    selectedKind = id ? "module" : null;
    windowEditorHost.style.display = "none";
    instanceEditorHost.style.display = "";
    setInstanceSelected(id);
  }

  function setSelectedWindow() {
    selectedKind = "window";
    setInstanceSelected(null);
    instanceEditorHost.style.display = "none";
    windowEditorHost.style.display = "";
    mountWindowControls();
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
    if (inst.params.type === "drawer_low") {
      createDrawerLowControls(instanceEditorHost, inst.params, { onChange: () => rebuildInstance(inst) });
    } else if (inst.params.type === "shelves") {
      createShelvesControls(instanceEditorHost, inst.params, { onChange: () => rebuildInstance(inst) });
    } else {
      createCornerShelfLowerControls(instanceEditorHost, inst.params, { onChange: () => rebuildInstance(inst) });
    }
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

  function addInstance(type: ModuleParams["type"]) {
    if (mode !== "layout") return;
    const nextParams =
      type === "drawer_low"
        ? makeDefaultDrawerLowParams()
        : type === "shelves"
          ? makeDefaultShelvesParams()
          : makeDefaultCornerShelfLowerParams();

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
  }

  function setMode(next: AppMode) {
    mode = next;

    const isLayout = mode === "layout";
    buildUi.style.display = isLayout ? "none" : "";
    layoutUi.style.display = isLayout ? "" : "none";
    partsBuildHost.style.display = isLayout ? "none" : "";
    partsLayoutHost.style.display = isLayout ? "" : "none";

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
      else setSelectedModule(selectedInstanceId);
    } else {
      setView2d(false);
      selectedKind = null;
      windowEditorHost.style.display = "none";
      instanceEditorHost.style.display = "";
      setInstanceSelected(null);
      mountControls();
      rebuild();
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

    if (params.type === "drawer_low") {
      createDrawerLowControls(editorHost, params, { onChange: () => afterParamsChanged() });
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

  const setModel = (type: "drawer_low" | "shelves" | "corner_shelf_lower") => {
    params =
      type === "drawer_low"
        ? makeDefaultDrawerLowParams()
        : type === "shelves"
          ? makeDefaultShelvesParams()
          : makeDefaultCornerShelfLowerParams();
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

    inst.params =
      inst.params.type === "drawer_low"
        ? makeDefaultDrawerLowParams()
        : inst.params.type === "shelves"
          ? makeDefaultShelvesParams()
          : makeDefaultCornerShelfLowerParams();
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
        hdriStrength: hdri.envIntensity,
        hdriBackground: hdri.background,
        hdriBackgroundStrength: hdri.backgroundIntensity
      },
      lighting: { sunDirection, sunStrength: Math.max(0.1, daylightIntensity * 2.2), sunAngle: 0.5 },
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

  renderer.domElement.addEventListener("pointerdown", (ev) => {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    pointerNdc.set(x, y);

    raycaster.setFromCamera(pointerNdc, cam());

    if (mode === "layout") {
      if (measureState.enabled) return;

      const picks = instances.map((i) => i.pick);
      if (windowInst) picks.push(windowInst.pick);
      const hits = raycaster.intersectObjects(picks, false);
      const first = hits[0]?.object as THREE.Mesh | undefined;
      const kind = (first?.userData?.kind as string | undefined) ?? "module";

      if (kind === "window") {
        if (!windowInst) return;
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

      const id = (first?.userData?.instanceId as string | undefined) ?? null;
      if (!id) {
        setSelectedModule(null);
        clearWindowLightIfMissing();
        return;
      }

      const inst = findInstance(id);
      if (!inst) return;
      setSelectedModule(id);

      // Disable object dragging in 3D view (layout edits happen in 2D).
      if (viewMode !== "2d") return;

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
    const v = modelSelect.value;
    const next =
      v === "shelves" ? "shelves" : v === "corner_shelf_lower" ? "corner_shelf_lower" : "drawer_low";
    setModel(next);
  });

  modeSelect.value = "build";
  setMode("build");

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

    const activeCam = cam();
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
