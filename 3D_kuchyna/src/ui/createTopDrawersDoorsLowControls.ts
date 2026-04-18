import type { TopDrawersDoorsLowParams } from "../model/cabinetTypes";
import { computeEqualShelfGaps } from "../model/cabinetTypes";

type ControlApi = {
  syncFromParams: () => void;
};

type CreateControlsArgs = {
  onChange: () => void;
  getWorktopThicknessMm: () => number;
};

export function createTopDrawersDoorsLowControls(
  container: HTMLElement,
  params: TopDrawersDoorsLowParams,
  args: CreateControlsArgs
): ControlApi {
  container.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "grid";
  container.appendChild(grid);

  const numberFields: Array<{ key: keyof TopDrawersDoorsLowParams; input: HTMLInputElement }> = [];
  const keyFields: Array<{
    key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey";
    input: HTMLInputElement;
  }> = [];
  const nameFields: Array<{
    key: "materials.bodyName" | "materials.frontName" | "materials.drawerName";
    input: HTMLInputElement;
  }> = [];
  const colorFields: Array<{
    key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor";
    input: HTMLInputElement;
  }> = [];
  let bodyTextureRotation: HTMLSelectElement | null = null;
  let bodyTintColor: HTMLInputElement | null = null;
  let bodyTintStrength: HTMLInputElement | null = null;

  const addNumber = (key: keyof TopDrawersDoorsLowParams, label: string, opts: { min?: number; step?: number } = {}) => {
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

  const getWorktopT = () => Math.max(0, Math.round(args.getWorktopThicknessMm()));
  const isUnderWorktop = () => params.wallMounted !== true;
  const computeCarcassHeight = () => {
    if (!isUnderWorktop()) return params.height;
    return Math.max(50, Math.round(params.height - getWorktopT()));
  };
  const setFinalHeightFromCarcass = (carcassMm: number) => {
    const c = Math.max(50, Math.round(carcassMm));
    params.height = isUnderWorktop() ? c + getWorktopT() : c;
  };

  // Base
  addNumber("width", "Width (mm)", { min: 200, step: 1 });

  // Height (final + carcass derived)
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

  const heightCarcassWrap = document.createElement("div");
  heightCarcassWrap.className = "field";
  const heightCarcassLabel = document.createElement("label");
  heightCarcassLabel.textContent = "Carcass height (excl. worktop) (mm)";
  heightCarcassLabel.htmlFor = "f_heightCarcassMm";
  const heightCarcass = document.createElement("input");
  heightCarcass.id = "f_heightCarcassMm";
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

  // Plinth / wall mount
  addNumber("plinthHeight", "Plinth height (mm)", { min: 0, step: 1 });
  addNumber("plinthSetbackMm", "Plinth setback (mm)", { min: 0, step: 1 });

  const wallMountedWrap = document.createElement("div");
  wallMountedWrap.className = "field";
  const wallMountedLabel = document.createElement("label");
  wallMountedLabel.textContent = "Wall mounted (no legs/kickboard)";
  wallMountedLabel.htmlFor = "f_wallMounted";
  const wallMounted = document.createElement("input");
  wallMounted.id = "f_wallMounted";
  wallMounted.type = "checkbox";
  wallMounted.style.justifySelf = "start";
  wallMountedWrap.appendChild(wallMountedLabel);
  wallMountedWrap.appendChild(wallMounted);
  grid.appendChild(wallMountedWrap);

  // Front layout
  addNumber("topDrawerCount", "Top drawers count", { min: 1, step: 1 });
  addNumber("bottomDoorCount", "Bottom doors count", { min: 1, step: 1 });
  addNumber("columnGapMm", "Column gap (mm)", { min: 0, step: 0.5 });
  addNumber("rowGapMm", "Row gap (mm)", { min: 0, step: 0.5 });
  addNumber("topDrawerFrontHeightMm", "Top drawer front height (mm)", { min: 40, step: 1 });

  addNumber("sideGap", "Side reveal (mm)", { min: 0, step: 0.5 });
  addNumber("topGap", "Top reveal (mm)", { min: 0, step: 0.5 });
  addNumber("bottomGap", "Bottom reveal (mm)", { min: 0, step: 0.5 });
  addNumber("frontThicknessMm", "Front thickness (mm)", { min: 5, step: 1 });

  const doorOpenWrap = document.createElement("div");
  doorOpenWrap.className = "field";
  const doorOpenLabel = document.createElement("label");
  doorOpenLabel.textContent = "Door open (preview)";
  doorOpenLabel.htmlFor = "f_doorOpen";
  const doorOpen = document.createElement("input");
  doorOpen.id = "f_doorOpen";
  doorOpen.type = "checkbox";
  doorOpen.style.justifySelf = "start";
  doorOpenWrap.appendChild(doorOpenLabel);
  doorOpenWrap.appendChild(doorOpen);
  grid.appendChild(doorOpenWrap);

  // Hinges (bottom doors)
  const hingeSideWrap = document.createElement("div");
  hingeSideWrap.className = "field";
  const hingeSideLabel = document.createElement("label");
  hingeSideLabel.textContent = "Hinge side (bottom doors)";
  hingeSideLabel.htmlFor = "f_hingeSide";
  const hingeSide = document.createElement("select");
  hingeSide.id = "f_hingeSide";
  hingeSide.innerHTML = `
    <option value="left">left</option>
    <option value="right">right</option>
  `;
  hingeSideWrap.appendChild(hingeSideLabel);
  hingeSideWrap.appendChild(hingeSide);
  grid.appendChild(hingeSideWrap);

  addNumber("hingeCountPerDoor", "Hinges per door", { min: 1, step: 1 });
  addNumber("hingeTopOffsetMm", "Hinge top offset (mm)", { min: 0, step: 1 });
  addNumber("hingeBottomOffsetMm", "Hinge bottom offset (mm)", { min: 0, step: 1 });

  // Handles
  const handleTypeWrap = document.createElement("div");
  handleTypeWrap.className = "field";
  const handleTypeLabel = document.createElement("label");
  handleTypeLabel.textContent = "Handle type";
  handleTypeLabel.htmlFor = "f_handleType";
  const handleType = document.createElement("select");
  handleType.id = "f_handleType";
  handleType.innerHTML = `
    <option value="none">none</option>
    <option value="bar">bar</option>
    <option value="knob">knob</option>
    <option value="cup">cup</option>
    <option value="gola">gola</option>
  `;
  handleTypeWrap.appendChild(handleTypeLabel);
  handleTypeWrap.appendChild(handleType);
  grid.appendChild(handleTypeWrap);

  addNumber("handlePositionMm", "Handle position from top (mm)", { min: 0, step: 1 });
  addNumber("handleLengthMm", "Handle length (mm)", { min: 0, step: 1 });
  addNumber("handleSizeMm", "Handle size (mm)", { min: 0, step: 1 });
  addNumber("handleProjectionMm", "Handle projection (mm)", { min: 0, step: 1 });

  // Drawer hardware (top drawers)
  addNumber("sideClearanceMm", "Side clearance (per side) (mm)", { min: 0, step: 0.5 });
  addNumber("drawerBoxThickness", "Drawer box metal thickness (mm)", { min: 5, step: 1 });
  addNumber("drawerBoxSideHeight", "Drawer box metal side height (mm)", { min: 30, step: 1 });

  // Shelves behind doors
  addNumber("shelfCount", "Shelf compartments (per column)", { min: 1, step: 1 });
  addNumber("shelfThickness", "Shelf thickness (mm)", { min: 5, step: 1 });

  const autoFitWrap = document.createElement("div");
  autoFitWrap.className = "field";
  const autoFitLabel = document.createElement("label");
  autoFitLabel.textContent = "Auto-fit equal shelves";
  autoFitLabel.htmlFor = "f_shelfAutoFit";
  const autoFit = document.createElement("input");
  autoFit.id = "f_shelfAutoFit";
  autoFit.type = "checkbox";
  autoFit.style.justifySelf = "start";
  autoFitWrap.appendChild(autoFitLabel);
  autoFitWrap.appendChild(autoFit);
  grid.appendChild(autoFitWrap);

  const gapsWrap = document.createElement("div");
  gapsWrap.className = "field";
  const gapsLabel = document.createElement("label");
  gapsLabel.textContent = "Shelf gaps (mm, comma separated)";
  gapsLabel.htmlFor = "f_shelfGaps";
  const gaps = document.createElement("textarea");
  gaps.id = "f_shelfGaps";
  gaps.rows = 2;
  gaps.placeholder = "e.g. 220, 220, 220";
  gapsWrap.appendChild(gapsLabel);
  gapsWrap.appendChild(gaps);
  grid.appendChild(gapsWrap);

  const autoBtn = document.createElement("button");
  autoBtn.type = "button";
  autoBtn.textContent = "Auto-fit equal shelves now";
  autoBtn.style.justifySelf = "start";
  autoBtn.addEventListener("click", () => {
    params.shelfAutoFit = true;
    params.shelfCount = Math.max(1, Math.round(params.shelfCount));
    const shelfVirtualHeightMm = Math.max(50, params.height - params.topGap - params.rowGapMm - params.topDrawerFrontHeightMm);
    params.shelfGaps = computeEqualShelfGaps({
      height: shelfVirtualHeightMm,
      plinthHeight: params.wallMounted ? 0 : params.plinthHeight,
      boardThickness: params.boardThickness,
      shelfCount: params.shelfCount,
      shelfThickness: params.shelfThickness,
      shelfAutoFit: true,
      shelfGaps: []
    } as any);
    syncFromParams();
    args.onChange();
  });
  grid.appendChild(autoBtn);

  // Materials
  addKey("materials.bodyKey", "Body material key");
  addKey("materials.frontKey", "Fronts material key");
  addKey("materials.drawerKey", "Drawer material key");
  addName("materials.bodyName", "Body material name");
  addName("materials.frontName", "Fronts material name");
  addName("materials.drawerName", "Drawer material name");

  addColor("materials.bodyColor", "Body color");
  addColor("materials.frontColor", "Fronts color");
  addColor("materials.drawerColor", "Drawer color");

  // Body texture rotation
  {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.textContent = "Body texture rotation";
    lab.htmlFor = "f_bodyTextureRotation";
    const sel = document.createElement("select");
    sel.id = "f_bodyTextureRotation";
    sel.innerHTML = `
      <option value="0">0°</option>
      <option value="90">90°</option>
      <option value="180">180°</option>
      <option value="270">270°</option>
    `;
    wrap.appendChild(lab);
    wrap.appendChild(sel);
    grid.appendChild(wrap);
    bodyTextureRotation = sel;
  }

  // Body tint color
  {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.textContent = "Body tint color";
    lab.htmlFor = "f_bodyTintColor";
    const input = document.createElement("input");
    input.id = "f_bodyTintColor";
    input.type = "color";
    input.style.width = "120px";
    input.style.height = "36px";
    input.style.padding = "0";
    input.style.borderRadius = "10px";
    wrap.appendChild(lab);
    wrap.appendChild(input);
    grid.appendChild(wrap);
    bodyTintColor = input;
  }

  // Body tint strength
  {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.textContent = "Body tint strength (%)";
    lab.htmlFor = "f_bodyTintStrength";
    const input = document.createElement("input");
    input.id = "f_bodyTintStrength";
    input.type = "number";
    input.min = "0";
    input.max = "100";
    input.step = "1";
    wrap.appendChild(lab);
    wrap.appendChild(input);
    grid.appendChild(wrap);
    bodyTintStrength = input;
  }

  const readNumber = (input: HTMLInputElement, fallback: number) => {
    const v = Number(input.value);
    if (!Number.isFinite(v)) return fallback;
    return v;
  };

  const onInputsChanged = () => {
    for (const f of numberFields) {
      const current = params[f.key];
      if (typeof current !== "number") continue;
      (params[f.key] as number) = readNumber(f.input, current);
    }

    params.topDrawerCount = Math.max(1, Math.round(params.topDrawerCount));
    params.bottomDoorCount = Math.max(1, Math.round(params.bottomDoorCount));
    params.shelfCount = Math.max(1, Math.round(params.shelfCount));

    for (const f of keyFields) setMaterialKey(params, f.key, f.input.value);
    for (const f of nameFields) setMaterialName(params, f.key, f.input.value);
    for (const f of colorFields) setMaterialColor(params, f.key, f.input.value);
    if (bodyTextureRotation) {
      if (!params.materials.bodyPbr) params.materials.bodyPbr = { id: "wood_veneer_oak_7760_1k", rotationDeg: 0 };
      params.materials.bodyPbr.rotationDeg = (Number(bodyTextureRotation.value) as 0 | 90 | 180 | 270) ?? 0;
    }
    if (bodyTintColor || bodyTintStrength) {
      if (!params.materials.bodyPbr) params.materials.bodyPbr = { id: "wood_veneer_oak_7760_1k", rotationDeg: 0 };
      if (bodyTintColor) params.materials.bodyPbr.tintColor = bodyTintColor.value;
      if (bodyTintStrength) params.materials.bodyPbr.tintStrength = Number(bodyTintStrength.value) / 100;
    }

    params.wallMounted = wallMounted.checked;
    params.doorOpen = doorOpen.checked;
    params.hingeSide = (hingeSide.value as TopDrawersDoorsLowParams["hingeSide"]) ?? "left";
    params.hingeCountPerDoor = Math.max(1, Math.min(6, Math.round(params.hingeCountPerDoor)));
    params.handleType = (handleType.value as TopDrawersDoorsLowParams["handleType"]) ?? "none";

    // Shelf gaps (manual or auto-fit)
    params.shelfAutoFit = autoFit.checked;
    const shelfVirtualHeightMm = Math.max(50, params.height - params.topGap - params.rowGapMm - params.topDrawerFrontHeightMm);
    if (params.shelfAutoFit) {
      params.shelfGaps = computeEqualShelfGaps({
        height: shelfVirtualHeightMm,
        plinthHeight: params.wallMounted ? 0 : params.plinthHeight,
        boardThickness: params.boardThickness,
        shelfCount: params.shelfCount,
        shelfThickness: params.shelfThickness,
        shelfAutoFit: true,
        shelfGaps: []
      } as any);
    } else {
      params.shelfGaps = parseNumbers(gaps.value);
    }

    // Keep derived height field in sync.
    heightCarcass.value = String(computeCarcassHeight());

    updateUiState();
    args.onChange();
  };

  const updateUiState = () => {
    const type = (handleType.value as TopDrawersDoorsLowParams["handleType"]) ?? "none";

    const pos = numberFields.find((f) => f.key === "handlePositionMm")?.input ?? null;
    if (pos) pos.disabled = type === "none" || type === "gola";

    const len = numberFields.find((f) => f.key === "handleLengthMm")?.input ?? null;
    if (len) len.disabled = type === "none" || type === "knob";

    const size = numberFields.find((f) => f.key === "handleSizeMm")?.input ?? null;
    if (size) size.disabled = type === "none";

    const proj = numberFields.find((f) => f.key === "handleProjectionMm")?.input ?? null;
    if (proj) proj.disabled = type === "none";

    gaps.readOnly = autoFit.checked;
  };

  const syncFromParams = () => {
    for (const f of numberFields) f.input.value = String(params[f.key] ?? "");
    heightFinal.value = String(params.height);
    heightCarcass.value = String(computeCarcassHeight());
    wallMounted.checked = params.wallMounted === true;
    doorOpen.checked = params.doorOpen === true;
    hingeSide.value = params.hingeSide ?? "left";
    handleType.value = params.handleType ?? "none";

    for (const f of keyFields) f.input.value = getMaterialKey(params, f.key);
    for (const f of nameFields) f.input.value = getMaterialName(params, f.key);
    for (const f of colorFields) f.input.value = getMaterialColor(params, f.key);
    if (bodyTextureRotation) bodyTextureRotation.value = String(params.materials.bodyPbr?.rotationDeg ?? 0);
    if (bodyTintColor) bodyTintColor.value = params.materials.bodyPbr?.tintColor ?? "#ffffff";
    if (bodyTintStrength) bodyTintStrength.value = String(Math.round((params.materials.bodyPbr?.tintStrength ?? 0) * 100));

    autoFit.checked = params.shelfAutoFit === true;
    gaps.value = (params.shelfGaps ?? []).join(", ");
    updateUiState();
  };

  // Wire events
  for (const f of numberFields) f.input.addEventListener("input", onInputsChanged);
  for (const f of keyFields) f.input.addEventListener("input", onInputsChanged);
  for (const f of nameFields) f.input.addEventListener("input", onInputsChanged);
  for (const f of colorFields) f.input.addEventListener("input", onInputsChanged);
  if (bodyTextureRotation) bodyTextureRotation.addEventListener("change", onInputsChanged);
  if (bodyTintColor) bodyTintColor.addEventListener("input", onInputsChanged);
  if (bodyTintStrength) bodyTintStrength.addEventListener("input", onInputsChanged);
  hingeSide.addEventListener("change", onInputsChanged);
  wallMounted.addEventListener("change", () => {
    // Switching wall-mounted affects whether worktop thickness applies.
    heightCarcass.value = String(computeCarcassHeight());
    onInputsChanged();
  });

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

  doorOpen.addEventListener("change", onInputsChanged);
  handleType.addEventListener("change", onInputsChanged);
  autoFit.addEventListener("change", onInputsChanged);
  gaps.addEventListener("input", () => {
    if (autoFit.checked) {
      autoFit.checked = false;
      gaps.readOnly = false;
    }
    onInputsChanged();
  });

  syncFromParams();
  return { syncFromParams };
}

function parseNumbers(raw: string): number[] {
  const parts = raw
    .split(/[,\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.map((p) => Number(p)).filter((n) => Number.isFinite(n));
}

function getMaterialColor(
  params: TopDrawersDoorsLowParams,
  key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor"
) {
  if (key === "materials.bodyColor") return params.materials.bodyColor;
  if (key === "materials.frontColor") return params.materials.frontColor;
  return params.materials.drawerColor;
}

function setMaterialColor(
  params: TopDrawersDoorsLowParams,
  key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor",
  value: string
) {
  if (key === "materials.bodyColor") params.materials.bodyColor = value;
  else if (key === "materials.frontColor") params.materials.frontColor = value;
  else params.materials.drawerColor = value;
}

function getMaterialKey(
  params: TopDrawersDoorsLowParams,
  key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey"
) {
  if (key === "materials.bodyKey") return params.materials.bodyKey;
  if (key === "materials.frontKey") return params.materials.frontKey;
  return params.materials.drawerKey;
}

function setMaterialKey(
  params: TopDrawersDoorsLowParams,
  key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey",
  value: string
) {
  if (key === "materials.bodyKey") params.materials.bodyKey = value;
  else if (key === "materials.frontKey") params.materials.frontKey = value;
  else params.materials.drawerKey = value;
}

function getMaterialName(
  params: TopDrawersDoorsLowParams,
  key: "materials.bodyName" | "materials.frontName" | "materials.drawerName"
) {
  if (key === "materials.bodyName") return params.materials.bodyName ?? "";
  if (key === "materials.frontName") return params.materials.frontName ?? "";
  return params.materials.drawerName ?? "";
}

function setMaterialName(
  params: TopDrawersDoorsLowParams,
  key: "materials.bodyName" | "materials.frontName" | "materials.drawerName",
  value: string
) {
  if (key === "materials.bodyName") params.materials.bodyName = value;
  else if (key === "materials.frontName") params.materials.frontName = value;
  else params.materials.drawerName = value;
}
