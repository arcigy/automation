import * as THREE from "three";
import type { ModuleParams } from "./model/cabinetTypes";
import { makeDefaultCornerShelfLowerParams, makeDefaultDrawerLowParams, makeDefaultShelvesParams, validateModule } from "./model/cabinetTypes";
import { buildModule } from "./geometry/buildModule";
import { createScene } from "./scene/createScene";
import { createPartPanel, type OverlapRow } from "./ui/createPartPanel";
import { disposeObject3D } from "./scene/disposeObject3D";
import { createDrawerLowControls } from "./ui/createDrawerLowControls";
import { createShelvesControls } from "./ui/createShelvesControls";
import { createCornerShelfLowerControls } from "./ui/createCornerShelfLowerControls";

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
};

export function startApp(args: AppArgs) {
  let params: ModuleParams = makeDefaultDrawerLowParams();

  const { scene, camera, renderer, controls, setSize } = createScene(args.viewerEl);

  let cabinetGroup: THREE.Group | null = null;
  const hiddenParts = new Set<string>();

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  let selectedMesh: THREE.Mesh | null = null;
  let selectedBox: THREE.BoxHelper | null = null;

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

  // Editor UI: model switcher + model-specific controls
  args.formEl.innerHTML = "";
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
  args.formEl.appendChild(modelWrap);

  const editorHost = document.createElement("div");
  args.formEl.appendChild(editorHost);

  const partPanel = createPartPanel(args.partsEl, {
    onSelect: (name) => selectByName(name),
    onSetVisible: (name, visible) => setVisibleByName(name, visible),
    onHighlightPair: (a, b) => highlightOverlap(a, b)
  });

  const selectMesh = (mesh: THREE.Mesh | null) => {
    selectedMesh = mesh;

    if (selectedBox) {
      scene.remove(selectedBox);
      selectedBox.geometry.dispose();
      (selectedBox.material as THREE.Material).dispose();
      selectedBox = null;
    }

    if (!mesh) {
      partPanel.setSelected(null);
      return;
    }

    partPanel.setSelected(mesh.name);

    selectedBox = new THREE.BoxHelper(mesh, 0xffe066);
    selectedBox.name = "selectionBox";
    scene.add(selectedBox);
  };

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
        dimensionsMm: readDimensionsMm(m)
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
    setModel(params.type);
  });

  args.exportBtn.addEventListener("click", async () => {
    args.copyStatusEl.textContent = "";
    const errors = validateModule(params);
    renderErrors(args.errorsEl, errors);
    if (errors.length > 0) return;

    const payload = buildExportPayload(params, cabinetGroup);
    const json = JSON.stringify(payload, null, 2);
    args.exportOutEl.value = json;

    // Best-effort copy to clipboard.
    try {
      await navigator.clipboard.writeText(json);
      args.copyStatusEl.textContent = "Copied.";
    } catch {
      args.copyStatusEl.textContent = "Copy failed (browser permission).";
    }
  });

  args.copyBtn.addEventListener("click", async () => {
    args.copyStatusEl.textContent = "";
    const text = args.exportOutEl.value.trim().length > 0 ? args.exportOutEl.value : JSON.stringify(buildExportPayload(params, cabinetGroup), null, 2);
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
  });
  ro.observe(args.viewerEl);

  renderer.domElement.addEventListener("pointerdown", (ev) => {
    if (!cabinetGroup) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    pointerNdc.set(x, y);

    raycaster.setFromCamera(pointerNdc, camera);

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
    if (!measureState.enabled || !cabinetGroup) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    pointerNdc.set(x, y);
    raycaster.setFromCamera(pointerNdc, camera);

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
      const s = worldToScreen(snapped.point, camera, rect);
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

  modelSelect.addEventListener("change", () => {
    const v = modelSelect.value;
    const next =
      v === "shelves" ? "shelves" : v === "corner_shelf_lower" ? "corner_shelf_lower" : "drawer_low";
    setModel(next);
  });

  mountControls();
  rebuild();

  const tick = () => {
    controls.update();
    if (selectedBox && selectedMesh) selectedBox.setFromObject(selectedMesh);
    for (const o of overlapBoxes) o.helper.setFromObject(o.mesh);
    updateMeasureLabels();
    renderer.render(scene, camera);
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
      const p = mid.project(camera);
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
    const s = worldToScreen(mid, camera, rect);
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
  const overlaps = cabinetGroup ? computeOverlaps(cabinetGroup) : [];

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
