import type { MicrowaveOvenTallParams } from "../model/cabinetTypes";

type ControlApi = { syncFromParams: () => void };

type CreateControlsArgs = {
  onChange: () => void;
  getWorktopThicknessMm: () => number;
};

export function createMicrowaveOvenTallControls(
  container: HTMLElement,
  params: MicrowaveOvenTallParams,
  args: CreateControlsArgs
): ControlApi {
  container.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "grid";
  container.appendChild(grid);

  const numberFields: Array<{ key: keyof MicrowaveOvenTallParams; input: HTMLInputElement }> = [];
  const keyFields: Array<{ key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey"; input: HTMLInputElement }> = [];
  const nameFields: Array<{ key: "materials.bodyName" | "materials.frontName" | "materials.drawerName"; input: HTMLInputElement }> = [];
  const colorFields: Array<{ key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor"; input: HTMLInputElement }> = [];
  let microwavePresetSelect: HTMLSelectElement | null = null;

  const addNumber = (key: keyof MicrowaveOvenTallParams, label: string, opts: { min?: number; step?: number } = {}) => {
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
  };

  const addName = (key: "materials.bodyName" | "materials.frontName" | "materials.drawerName", label: string) => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.textContent = label;
    lab.htmlFor = `f_${key.replaceAll(".", "_")}`;
    const input = document.createElement("input");
    input.id = `f_${key.replaceAll(".", "_")}`;
    input.type = "text";
    input.placeholder = "e.g. Egger U999 ST2 18mm";
    wrap.appendChild(lab);
    wrap.appendChild(input);
    grid.appendChild(wrap);
    nameFields.push({ key, input });
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
  };

  // Base
  addNumber("width", "Width (mm)", { min: 200, step: 1 });
  addNumber("height", "Height (mm)", { min: 400, step: 1 });
  addNumber("depth", "Depth (mm)", { min: 200, step: 1 });
  addNumber("boardThickness", "Board thickness (mm)", { min: 5, step: 1 });
  addNumber("backThickness", "Back thickness (mm)", { min: 3, step: 1 });
  addNumber("plinthHeight", "Plinth height (mm)", { min: 0, step: 1 });
  addNumber("plinthSetbackMm", "Plinth setback (mm)", { min: 0, step: 1 });

  // Drawer fronts
  addNumber("drawerCount", "Drawer count", { min: 0, step: 1 });
  addNumber("frontThicknessMm", "Front thickness (mm)", { min: 5, step: 1 });
  addNumber("frontGap", "Drawer front gap (mm)", { min: 0, step: 0.5 });
  addNumber("sideGap", "Side reveal (mm)", { min: 0, step: 0.5 });
  addNumber("topGap", "Top reveal (mm)", { min: 0, step: 0.5 });
  addNumber("bottomGap", "Bottom reveal (mm)", { min: 0, step: 0.5 });

  const heightsWrap = document.createElement("div");
  heightsWrap.className = "field";
  heightsWrap.style.gridTemplateColumns = "1fr";
  const heightsLabel = document.createElement("label");
  heightsLabel.textContent = "Drawer front heights (mm) - comma-separated (count = drawerCount)";
  heightsLabel.htmlFor = "f_drawerFrontHeights";
  heightsWrap.appendChild(heightsLabel);
  const heights = document.createElement("textarea");
  heights.id = "f_drawerFrontHeights";
  heights.rows = 2;
  heights.placeholder = "e.g. 200, 200";
  heightsWrap.appendChild(heights);
  grid.appendChild(heightsWrap);

  // Handles
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

  addNumber("handlePositionMm", "Handle pos from top (mm)", { min: 0, step: 1 });
  addNumber("handleLengthMm", "Handle length (mm)", { min: 0, step: 1 });
  addNumber("handleSizeMm", "Handle size (mm)", { min: 0, step: 1 });
  addNumber("handleProjectionMm", "Handle projection (mm)", { min: 0, step: 1 });

  // Spacing
  addNumber("gapAboveDrawersMm", "Gap above drawers (mm)", { min: 0, step: 1 });
  addNumber("gapBetweenAppliancesMm", "Gap between appliances (mm)", { min: 0, step: 1 });

  // Top cabinet section
  addNumber("topShelfCount", "Top shelf count (compartments)", { min: 1, step: 1 });
  addNumber("topShelfThickness", "Top shelf thickness (mm)", { min: 5, step: 1 });

  const topOpenWrap = document.createElement("div");
  topOpenWrap.className = "field";
  topOpenWrap.style.gridTemplateColumns = "1fr 120px";
  const topOpenLabel = document.createElement("label");
  topOpenLabel.textContent = "Top flap open (up)";
  topOpenLabel.htmlFor = "f_topFlapOpen";
  const topDoorOpen = document.createElement("input");
  topDoorOpen.id = "f_topFlapOpen";
  topDoorOpen.type = "checkbox";
  topDoorOpen.checked = params.topFlapOpen === true;
  topDoorOpen.style.justifySelf = "start";
  topOpenWrap.appendChild(topOpenLabel);
  topOpenWrap.appendChild(topDoorOpen);
  grid.appendChild(topOpenWrap);

  addNumber("topHingeCount", "Top hinge count", { min: 1, step: 1 });
  addNumber("topHingeInsetFromSideMm", "Top hinge inset from sides (mm)", { min: 0, step: 1 });

  // Oven niche
  addNumber("ovenWidthMm", "Oven niche width (mm)", { min: 100, step: 1 });
  addNumber("ovenHeightMm", "Oven niche height (mm)", { min: 100, step: 1 });
  addNumber("ovenDepthMm", "Oven niche depth (mm)", { min: 100, step: 1 });
  addNumber("ovenSideClearanceMm", "Oven side clearance (mm)", { min: 0, step: 0.5 });
  addNumber("ovenTopClearanceMm", "Oven top clearance (mm)", { min: 0, step: 0.5 });
  addNumber("ovenBottomClearanceMm", "Oven bottom clearance (mm)", { min: 0, step: 0.5 });

  // Microwave niche
  addNumber("microwaveWidthMm", "Microwave niche width (mm)", { min: 100, step: 1 });
  addNumber("microwaveHeightMm", "Microwave niche height (mm)", { min: 100, step: 1 });
  addNumber("microwaveDepthMm", "Microwave niche depth (mm)", { min: 100, step: 1 });
  addNumber("microwaveSideClearanceMm", "Microwave side clearance (mm)", { min: 0, step: 0.5 });
  addNumber("microwaveTopClearanceMm", "Microwave top clearance (mm)", { min: 0, step: 0.5 });
  addNumber("microwaveBottomClearanceMm", "Microwave bottom clearance (mm)", { min: 0, step: 0.5 });

  // Common real-world presets (built-in microwave).
  {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.textContent = "Microwave preset";
    lab.htmlFor = "f_microwavePreset";
    const sel = document.createElement("select");
    sel.id = "f_microwavePreset";
    sel.innerHTML = `
      <option value="standard">Standard (390h / 520d)</option>
      <option value="combi">Combi (450h / 550d)</option>
    `;
    wrap.appendChild(lab);
    wrap.appendChild(sel);
    grid.appendChild(wrap);
    microwavePresetSelect = sel;

    sel.addEventListener("change", () => {
      const preset = String(sel.value);
      const next =
        preset === "combi"
          ? { h: 450, d: 550 }
          : preset === "standard"
            ? { h: 390, d: 520 }
            : null;
      if (!next) return;

      params.microwaveHeightMm = next.h;
      params.microwaveDepthMm = next.d;

      const fh = numberFields.find((x) => x.key === "microwaveHeightMm");
      if (fh) fh.input.value = String(next.h);
      const fd = numberFields.find((x) => x.key === "microwaveDepthMm");
      if (fd) fd.input.value = String(next.d);

      args.onChange();
    });
  }

  addKey("materials.bodyKey", "Body material key");
  addKey("materials.frontKey", "Fronts material key");
  addKey("materials.drawerKey", "Drawer material key");
  addName("materials.bodyName", "Body material name");
  addName("materials.frontName", "Fronts material name");
  addName("materials.drawerName", "Drawer material name");
  addColor("materials.bodyColor", "Body color");
  addColor("materials.frontColor", "Fronts color");
  addColor("materials.drawerColor", "Drawer color");

  const readNumber = (input: HTMLInputElement, fallback: number) => {
    const n = Number(input.value);
    return Number.isFinite(n) ? n : fallback;
  };

  const updateUiState = () => {
    const type = (handleType.value as MicrowaveOvenTallParams["handleType"]) ?? "none";
    const pos = numberFields.find((f) => f.key === "handlePositionMm")?.input ?? null;
    if (pos) pos.disabled = type === "none" || type === "gola";
    const len = numberFields.find((f) => f.key === "handleLengthMm")?.input ?? null;
    if (len) len.disabled = type === "none" || type === "knob";
    const size = numberFields.find((f) => f.key === "handleSizeMm")?.input ?? null;
    if (size) size.disabled = type === "none";
    const proj = numberFields.find((f) => f.key === "handleProjectionMm")?.input ?? null;
    if (proj) proj.disabled = type === "none";
  };

  const syncFromParams = () => {
    for (const f of numberFields) {
      const value = params[f.key];
      f.input.value = typeof value === "number" ? String(value) : "";
    }
    for (const f of keyFields) f.input.value = getMaterialKey(params, f.key);
    for (const f of nameFields) f.input.value = getMaterialName(params, f.key);
    for (const f of colorFields) f.input.value = getMaterialColor(params, f.key);
    heights.value = params.drawerFrontHeights.join(", ");
    handleType.value = (params.handleType as any) ?? "none";
    topDoorOpen.checked = params.topFlapOpen === true;
    if (microwavePresetSelect) {
      const h = Number(params.microwaveHeightMm);
      const d = Number(params.microwaveDepthMm);
      microwavePresetSelect.value = h >= 440 || d >= 540 ? "combi" : "standard";
    }
    updateUiState();
  };

  const onInputsChanged = () => {
    for (const f of numberFields) {
      const current = params[f.key];
      if (typeof current !== "number") continue;
      (params[f.key] as number) = readNumber(f.input, current);
    }

    params.drawerCount = Math.max(0, Math.min(6, Math.round(params.drawerCount)));
    params.handleType = (handleType.value as any) ?? "none";
    params.topShelfCount = Math.max(1, Math.min(8, Math.round(params.topShelfCount)));
    params.topFlapOpen = topDoorOpen.checked;
    params.topHingeCount = Math.max(1, Math.min(6, Math.round(params.topHingeCount)));

    const typed = parseHeights(heights.value);
    params.drawerFrontHeights = normalizeHeights(typed, params.drawerCount);
    heights.value = params.drawerFrontHeights.join(", ");

    for (const f of keyFields) setMaterialKey(params, f.key, f.input.value);
    for (const f of nameFields) setMaterialName(params, f.key, f.input.value);
    for (const f of colorFields) setMaterialColor(params, f.key, f.input.value);

    updateUiState();
    args.onChange();
  };

  for (const f of numberFields) f.input.addEventListener("input", onInputsChanged);
  for (const f of keyFields) f.input.addEventListener("input", onInputsChanged);
  for (const f of nameFields) f.input.addEventListener("input", onInputsChanged);
  for (const f of colorFields) f.input.addEventListener("input", onInputsChanged);
  heights.addEventListener("input", onInputsChanged);
  handleType.addEventListener("change", onInputsChanged);
  topDoorOpen.addEventListener("change", onInputsChanged);

  syncFromParams();
  return { syncFromParams };
}

function parseHeights(raw: string): number[] {
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

function getMaterialKey(
  params: MicrowaveOvenTallParams,
  key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey"
) {
  if (key === "materials.bodyKey") return params.materials.bodyKey;
  if (key === "materials.frontKey") return params.materials.frontKey;
  return params.materials.drawerKey;
}

function setMaterialKey(
  params: MicrowaveOvenTallParams,
  key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey",
  value: string
) {
  if (key === "materials.bodyKey") params.materials.bodyKey = value;
  else if (key === "materials.frontKey") params.materials.frontKey = value;
  else params.materials.drawerKey = value;
}

function getMaterialName(
  params: MicrowaveOvenTallParams,
  key: "materials.bodyName" | "materials.frontName" | "materials.drawerName"
) {
  if (key === "materials.bodyName") return params.materials.bodyName ?? "";
  if (key === "materials.frontName") return params.materials.frontName ?? "";
  return params.materials.drawerName ?? "";
}

function setMaterialName(
  params: MicrowaveOvenTallParams,
  key: "materials.bodyName" | "materials.frontName" | "materials.drawerName",
  value: string
) {
  if (key === "materials.bodyName") params.materials.bodyName = value;
  else if (key === "materials.frontName") params.materials.frontName = value;
  else params.materials.drawerName = value;
}

function getMaterialColor(
  params: MicrowaveOvenTallParams,
  key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor"
) {
  if (key === "materials.bodyColor") return params.materials.bodyColor;
  if (key === "materials.frontColor") return params.materials.frontColor;
  return params.materials.drawerColor;
}

function setMaterialColor(
  params: MicrowaveOvenTallParams,
  key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor",
  value: string
) {
  if (key === "materials.bodyColor") params.materials.bodyColor = value;
  else if (key === "materials.frontColor") params.materials.frontColor = value;
  else params.materials.drawerColor = value;
}
