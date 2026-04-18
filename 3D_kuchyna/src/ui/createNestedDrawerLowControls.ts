import type { NestedDrawerLowParams } from "../model/cabinetTypes";
import { computeEqualNestedDrawerFrontHeights } from "../model/cabinetTypes";

type ControlApi = {
  syncFromParams: () => void;
  highlightParamKeys: (keys: string[]) => void;
  clearHighlights: () => void;
};

type CreateControlsArgs = {
  onChange: () => void;
  getWorktopThicknessMm: () => number;
};

export function createNestedDrawerLowControls(
  container: HTMLElement,
  params: NestedDrawerLowParams,
  args: CreateControlsArgs
): ControlApi {
  container.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "grid";
  container.appendChild(grid);

  const numberFields: Array<{ key: keyof NestedDrawerLowParams; input: HTMLInputElement }> = [];
  const keyFields: Array<{
    key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey";
    input: HTMLInputElement;
  }> = [];
  const colorFields: Array<{
    key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor";
    input: HTMLInputElement;
  }> = [];
  const fieldByKey = new Map<string, HTMLElement>();

  const addNumber = (key: keyof NestedDrawerLowParams, label: string, opts: { min?: number; step?: number } = {}) => {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const lab = document.createElement("label");
    lab.textContent = label;
    lab.htmlFor = `f_${String(key)}`;

    const input = document.createElement("input");
    input.id = `f_${String(key)}`;
    input.type = "number";
    input.inputMode = "decimal";
    if (opts.min !== undefined) input.min = String(opts.min);
    input.step = String(opts.step ?? 1);

    wrap.appendChild(lab);
    wrap.appendChild(input);
    grid.appendChild(wrap);

    numberFields.push({ key, input });
    fieldByKey.set(String(key), wrap);
  };

  const addKey = (key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey", label: string) => {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const lab = document.createElement("label");
    lab.textContent = label;
    lab.htmlFor = `f_${key.replaceAll(".", "_")}`;

    const input = document.createElement("input");
    input.id = `f_${key.replaceAll(".", "_")}`;
    input.type = "text";
    input.placeholder = "e.g. egger_u999_st2";

    wrap.appendChild(lab);
    wrap.appendChild(input);
    grid.appendChild(wrap);

    keyFields.push({ key, input });
    fieldByKey.set(String(key), wrap);
  };

  const addColor = (key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor", label: string) => {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const lab = document.createElement("label");
    lab.textContent = label;
    lab.htmlFor = `f_${key.replaceAll(".", "_")}`;

    const input = document.createElement("input");
    input.id = `f_${key.replaceAll(".", "_")}`;
    input.type = "color";
    input.style.width = "120px";
    input.style.height = "36px";
    input.style.padding = "0";
    input.style.borderRadius = "10px";

    wrap.appendChild(lab);
    wrap.appendChild(input);
    grid.appendChild(wrap);

    colorFields.push({ key, input });
    fieldByKey.set(String(key), wrap);
  };

  // Base
  addNumber("width", "Width (mm)", { min: 200, step: 1 });

  // Height (final incl. worktop + carcass excl. worktop)
  const heightFinalWrap = document.createElement("div");
  heightFinalWrap.className = "field";
  const heightFinalLabel = document.createElement("label");
  heightFinalLabel.textContent = "Final height (incl. worktop) (mm)";
  heightFinalLabel.htmlFor = "f_height";
  const heightFinal = document.createElement("input");
  heightFinal.id = "f_height";
  heightFinal.type = "number";
  heightFinal.inputMode = "decimal";
  heightFinal.min = "50";
  heightFinal.step = "1";
  heightFinalWrap.appendChild(heightFinalLabel);
  heightFinalWrap.appendChild(heightFinal);
  grid.appendChild(heightFinalWrap);
  fieldByKey.set("height", heightFinalWrap);

  const heightCarcassWrap = document.createElement("div");
  heightCarcassWrap.className = "field";
  const heightCarcassLabel = document.createElement("label");
  heightCarcassLabel.textContent = "Carcass height (excl. worktop) (mm)";
  heightCarcassLabel.htmlFor = "f_heightCarcass";
  const heightCarcass = document.createElement("input");
  heightCarcass.id = "f_heightCarcass";
  heightCarcass.type = "number";
  heightCarcass.inputMode = "decimal";
  heightCarcass.min = "50";
  heightCarcass.step = "1";
  heightCarcassWrap.appendChild(heightCarcassLabel);
  heightCarcassWrap.appendChild(heightCarcass);
  grid.appendChild(heightCarcassWrap);

  addNumber("depth", "Depth (mm)", { min: 200, step: 1 });
  addNumber("boardThickness", "Board thickness (mm)", { min: 5, step: 1 });
  addNumber("backThickness", "Back thickness (mm)", { min: 3, step: 1 });
  addNumber("plinthHeight", "Plinth height (mm)", { min: 0, step: 1 });
  addNumber("plinthSetbackMm", "Plinth setback (mm)", { min: 0, step: 1 });

  // Front / reveals
  addNumber("drawerCount", "Drawer count", { min: 2, step: 1 });
  addNumber("frontThicknessMm", "Front thickness (mm)", { min: 5, step: 1 });
  addNumber("frontGap", "Front gap (mm)", { min: 0, step: 0.5 });
  addNumber("sideGap", "Side reveal (mm)", { min: 0, step: 0.5 });
  addNumber("topGap", "Top reveal (mm)", { min: 0, step: 0.5 });
  addNumber("bottomGap", "Bottom reveal (mm)", { min: 0, step: 0.5 });
  addNumber("sideClearanceMm", "Side clearance (mm)", { min: 0, step: 0.5 });
  addNumber("topFrontHeightMm", "Top front height (mm)", { min: 20, step: 1 });
  addNumber("handlePositionMm", "Handle pos from top (mm)", { min: 0, step: 1 });
  addNumber("handleLengthMm", "Handle length (mm)", { min: 0, step: 1 });
  addNumber("handleSizeMm", "Handle size (mm)", { min: 0, step: 1 });
  addNumber("handleProjectionMm", "Handle projection (mm)", { min: 0, step: 1 });

  const stackWrap = document.createElement("div");
  stackWrap.className = "field";
  stackWrap.style.gridTemplateColumns = "1fr 120px";

  const stackLabel = document.createElement("label");
  stackLabel.textContent = "Front stack preset";
  stackLabel.htmlFor = "f_frontStackPreset";

  const stackPreset = document.createElement("select");
  stackPreset.id = "f_frontStackPreset";
  stackPreset.innerHTML = `
    <option value="equal">equal</option>
    <option value="top_small">top_small</option>
    <option value="manual">manual</option>
  `;

  stackWrap.appendChild(stackLabel);
  stackWrap.appendChild(stackPreset);
  grid.appendChild(stackWrap);
  fieldByKey.set("frontStackPreset", stackWrap);

  const handleWrap = document.createElement("div");
  handleWrap.className = "field";
  handleWrap.style.gridTemplateColumns = "1fr 120px";

  const handleLabel = document.createElement("label");
  handleLabel.textContent = "Handle type";
  handleLabel.htmlFor = "f_handleType";

  const handleType = document.createElement("select");
  handleType.id = "f_handleType";
  handleType.innerHTML = `
    <option value="none">none</option>
    <option value="bar">bar</option>
    <option value="knob">knob</option>
    <option value="cup">cup</option>
    <option value="gola">gola</option>
  `;

  handleWrap.appendChild(handleLabel);
  handleWrap.appendChild(handleType);
  grid.appendChild(handleWrap);
  fieldByKey.set("handleType", handleWrap);

  // Auto-fit checkbox
  const autoWrap = document.createElement("div");
  autoWrap.className = "field";
  autoWrap.style.gridTemplateColumns = "1fr 120px";

  const autoLabel = document.createElement("label");
  autoLabel.textContent = "Auto-fit fronts";
  autoLabel.htmlFor = "f_autoFit";

  const autoFit = document.createElement("input");
  autoFit.id = "f_autoFit";
  autoFit.type = "checkbox";
  autoFit.checked = true;
  autoFit.style.justifySelf = "start";

  autoWrap.appendChild(autoLabel);
  autoWrap.appendChild(autoFit);
  grid.appendChild(autoWrap);

  // Drawer front heights (comma-separated)
  const heightsWrap = document.createElement("div");
  heightsWrap.className = "field";
  heightsWrap.style.gridTemplateColumns = "1fr";

  const heightsLabel = document.createElement("label");
  heightsLabel.textContent = "Drawer front heights (mm) - comma-separated";
  heightsLabel.htmlFor = "f_drawerFrontHeights";
  heightsWrap.appendChild(heightsLabel);

  const heights = document.createElement("textarea");
  heights.id = "f_drawerFrontHeights";
  heights.rows = 3;
  heights.placeholder = "e.g. 240, 240, 240";
  heightsWrap.appendChild(heights);
  grid.appendChild(heightsWrap);
  fieldByKey.set("drawerFrontHeights", heightsWrap);

  // Drawer box
  addNumber("drawerBoxThickness", "Drawer box thickness (mm)", { min: 5, step: 1 });
  addNumber("drawerBoxSideHeight", "Outer drawer side/back height (mm)", { min: 30, step: 1 });

  // Inner drawer
  addNumber("innerDrawerDepth", "Inner tray depth (mm)", { min: 80, step: 1 });
  addNumber("innerDrawerSideHeight", "Inner tray side height (mm)", { min: 20, step: 1 });

  addKey("materials.bodyKey", "Body material key");
  addKey("materials.frontKey", "Fronts material key");
  addKey("materials.drawerKey", "Drawer material key");

  addColor("materials.bodyColor", "Body color");
  addColor("materials.frontColor", "Fronts color");
  addColor("materials.drawerColor", "Drawer color");

  const syncFromParams = () => {
    for (const f of numberFields) {
      const value = params[f.key];
      f.input.value = typeof value === "number" ? String(value) : "";
    }
    heightFinal.value = String(params.height);
    heightCarcass.value = String(computeCarcassHeight());
    for (const f of keyFields) f.input.value = getMaterialKey(params, f.key);
    for (const f of colorFields) f.input.value = getMaterialColor(params, f.key);

    heights.value = params.drawerFrontHeights.join(", ");
    stackPreset.value = params.frontStackPreset ?? "equal";
    handleType.value = params.handleType ?? "none";
    updateUiState();
  };

  const updateUiState = () => {
    heights.readOnly = autoFit.checked;

    stackPreset.disabled = !autoFit.checked;

    const topFrontEl = numberFields.find((f) => f.key === "topFrontHeightMm")?.input ?? null;
    if (topFrontEl) topFrontEl.disabled = !autoFit.checked || stackPreset.value !== "top_small";

    const handlePosEl = numberFields.find((f) => f.key === "handlePositionMm")?.input ?? null;
    if (handlePosEl) handlePosEl.disabled = handleType.value === "none" || handleType.value === "gola";

    const handleLenEl = numberFields.find((f) => f.key === "handleLengthMm")?.input ?? null;
    if (handleLenEl)
      handleLenEl.disabled =
        handleType.value === "none" || handleType.value === "knob" ? true : false; // bar/cup/gola use length

    const handleSizeEl = numberFields.find((f) => f.key === "handleSizeMm")?.input ?? null;
    if (handleSizeEl) handleSizeEl.disabled = handleType.value === "none";

    const handleProjEl = numberFields.find((f) => f.key === "handleProjectionMm")?.input ?? null;
    if (handleProjEl) handleProjEl.disabled = handleType.value === "none";
  };

  const readNumber = (input: HTMLInputElement, fallback: number) => {
    const n = Number(input.value);
    return Number.isFinite(n) ? n : fallback;
  };

  const getWorktopT = () => Math.max(0, Math.round(args.getWorktopThicknessMm()));
  const computeCarcassHeight = () => {
    const t = getWorktopT();
    if (t <= 0) return params.height;
    return Math.max(50, Math.round(params.height - t));
  };
  const setFinalHeightFromCarcass = (carcassMm: number) => {
    const c = Math.max(50, Math.round(carcassMm));
    const t = getWorktopT();
    params.height = t > 0 ? c + t : c;
  };

  const onInputsChanged = () => {
    for (const f of numberFields) {
      const current = params[f.key];
      if (typeof current !== "number") continue;
      (params[f.key] as number) = readNumber(f.input, current);
    }

    for (const f of keyFields) setMaterialKey(params, f.key, f.input.value);
    for (const f of colorFields) setMaterialColor(params, f.key, f.input.value);

    params.handleType = (handleType.value as NestedDrawerLowParams["handleType"]) ?? "none";

    params.drawerCount = Math.max(2, Math.round(params.drawerCount));

    if (autoFit.checked) {
      params.frontStackPreset = (stackPreset.value as NestedDrawerLowParams["frontStackPreset"]) ?? "equal";
      params.drawerFrontHeights = computeEqualNestedDrawerFrontHeights(params);
      heights.value = params.drawerFrontHeights.join(", ");
    } else {
      params.frontStackPreset = "manual";
      const typed = parseNumbers(heights.value);
      params.drawerFrontHeights = normalizeHeights(typed, params.drawerCount);
      heights.value = params.drawerFrontHeights.join(", ");
    }

    updateUiState();
    args.onChange();
  };

  for (const f of numberFields) f.input.addEventListener("input", onInputsChanged);
  for (const f of keyFields) f.input.addEventListener("input", onInputsChanged);
  for (const f of colorFields) f.input.addEventListener("input", onInputsChanged);

  heightFinal.addEventListener("input", () => {
    params.height = Math.max(50, Math.round(readNumber(heightFinal, params.height)));
    heightCarcass.value = String(computeCarcassHeight());
    onInputsChanged();
  });
  heightCarcass.addEventListener("input", () => {
    setFinalHeightFromCarcass(readNumber(heightCarcass, computeCarcassHeight()));
    heightFinal.value = String(params.height);
    onInputsChanged();
  });
  heights.addEventListener("input", () => {
    if (autoFit.checked) {
      autoFit.checked = false;
      heights.readOnly = false;
    }
    onInputsChanged();
  });
  stackPreset.addEventListener("change", onInputsChanged);
  handleType.addEventListener("change", onInputsChanged);
  autoFit.addEventListener("change", () => {
    onInputsChanged();
  });

  syncFromParams();

  const clearHighlights = () => {
    for (const el of fieldByKey.values()) el.classList.remove("is-related");
  };

  const highlightParamKeys = (keys: string[]) => {
    clearHighlights();
    let first: HTMLElement | null = null;
    for (const k of keys) {
      const el = fieldByKey.get(k);
      if (!el) continue;
      el.classList.add("is-related");
      if (!first) first = el;
    }
    first?.scrollIntoView({ block: "nearest" });
  };

  return { syncFromParams, highlightParamKeys, clearHighlights };
}

function parseNumbers(raw: string): number[] {
  const parts = raw
    .split(/[,\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.map((p) => Number(p)).filter((n) => Number.isFinite(n));
}

function normalizeHeights(existing: number[], count: number): number[] {
  const out = existing.slice(0, Math.max(0, count));
  if (out.length === 0 && count > 0) out.push(200);
  while (out.length < count) out.push(out[out.length - 1] ?? 200);
  return out;
}

function getMaterialColor(
  params: NestedDrawerLowParams,
  key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor"
) {
  if (key === "materials.bodyColor") return params.materials.bodyColor;
  if (key === "materials.frontColor") return params.materials.frontColor;
  return params.materials.drawerColor;
}

function setMaterialColor(
  params: NestedDrawerLowParams,
  key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor",
  value: string
) {
  if (key === "materials.bodyColor") params.materials.bodyColor = value;
  else if (key === "materials.frontColor") params.materials.frontColor = value;
  else params.materials.drawerColor = value;
}

function getMaterialKey(
  params: NestedDrawerLowParams,
  key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey"
) {
  if (key === "materials.bodyKey") return params.materials.bodyKey;
  if (key === "materials.frontKey") return params.materials.frontKey;
  return params.materials.drawerKey;
}

function setMaterialKey(
  params: NestedDrawerLowParams,
  key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey",
  value: string
) {
  if (key === "materials.bodyKey") params.materials.bodyKey = value;
  else if (key === "materials.frontKey") params.materials.frontKey = value;
  else params.materials.drawerKey = value;
}
