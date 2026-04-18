import type { OvenBaseLowParams } from "../model/cabinetTypes";

type ControlApi = {
  syncFromParams: () => void;
};

type CreateControlsArgs = {
  onChange: () => void;
  getWorktopThicknessMm: () => number;
};

export function createOvenBaseLowControls(
  container: HTMLElement,
  params: OvenBaseLowParams,
  args: CreateControlsArgs
): ControlApi {
  container.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "grid";
  container.appendChild(grid);

  const numberFields: Array<{ key: keyof OvenBaseLowParams; input: HTMLInputElement }> = [];
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

  const addNumber = (key: keyof OvenBaseLowParams, label: string, opts: { min?: number; step?: number } = {}) => {
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

  // Dimensions
  addNumber("width", "Width (mm)", { min: 200, step: 1 });

  // Height: final + carcass helper (same behavior as drawer_low)
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

  const wallWrap = document.createElement("div");
  wallWrap.className = "field";
  wallWrap.style.gridTemplateColumns = "1fr 120px";
  const wallLabel = document.createElement("label");
  wallLabel.textContent = "Wall mounted (no legs/sockel)";
  wallLabel.htmlFor = "f_wallMounted";
  const wallMounted = document.createElement("input");
  wallMounted.id = "f_wallMounted";
  wallMounted.type = "checkbox";
  wallMounted.checked = params.wallMounted === true;
  wallMounted.style.justifySelf = "start";
  wallWrap.appendChild(wallLabel);
  wallWrap.appendChild(wallMounted);
  grid.appendChild(wallWrap);

  // Drawer toggles
  const drawerWrap = document.createElement("div");
  drawerWrap.className = "field";
  drawerWrap.style.gridTemplateColumns = "1fr 120px";
  const drawerLabel = document.createElement("label");
  drawerLabel.textContent = "Bottom drawer";
  drawerLabel.htmlFor = "f_drawerEnabled";
  const drawerEnabled = document.createElement("input");
  drawerEnabled.id = "f_drawerEnabled";
  drawerEnabled.type = "checkbox";
  drawerEnabled.checked = params.drawerEnabled === true;
  drawerEnabled.style.justifySelf = "start";
  drawerWrap.appendChild(drawerLabel);
  drawerWrap.appendChild(drawerEnabled);
  grid.appendChild(drawerWrap);

  addNumber("drawerFrontHeightMm", "Drawer front height (mm)", { min: 0, step: 1 });
  addNumber("drawerGapAboveMm", "Gap above drawer (mm)", { min: 0, step: 1 });
  addNumber("sideGap", "Side reveal (mm)", { min: 0, step: 0.5 });
  addNumber("bottomGap", "Bottom reveal (mm)", { min: 0, step: 0.5 });
  addNumber("frontThicknessMm", "Front thickness (mm)", { min: 5, step: 1 });

  // Handles (same as drawer cabinet)
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

  // Drawer hardware
  addNumber("sideClearanceMm", "Side clearance (mm)", { min: 0, step: 0.5 });
  addNumber("drawerBoxThickness", "Drawer box thickness (mm)", { min: 3, step: 1 });
  addNumber("drawerBoxSideHeight", "Drawer box side/back height (mm)", { min: 30, step: 1 });
  addNumber("drawerBoxDepthMm", "Drawer box depth (mm)", { min: 50, step: 1 });

  // Oven sizing
  addNumber("ovenWidthMm", "Oven niche width (mm)", { min: 100, step: 1 });
  addNumber("ovenHeightMm", "Oven niche height (mm)", { min: 100, step: 1 });
  addNumber("ovenDepthMm", "Oven niche depth (mm)", { min: 100, step: 1 });
  addNumber("ovenSideClearanceMm", "Oven niche side clearance (mm)", { min: 0, step: 0.5 });
  addNumber("ovenTopClearanceMm", "Oven niche top clearance (mm)", { min: 0, step: 0.5 });
  addNumber("ovenBottomClearanceMm", "Oven niche bottom clearance (mm)", { min: 0, step: 0.5 });

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

  // Body tint
  {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.textContent = "Body wood tint";
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

  {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.textContent = "Body tint strength";
    lab.htmlFor = "f_bodyTintStrength";
    const input = document.createElement("input");
    input.id = "f_bodyTintStrength";
    input.type = "range";
    input.min = "0";
    input.max = "100";
    input.step = "1";
    wrap.appendChild(lab);
    wrap.appendChild(input);
    grid.appendChild(wrap);
    bodyTintStrength = input;
  }

  const readNumber = (input: HTMLInputElement, fallback: number) => {
    const n = Number(input.value);
    return Number.isFinite(n) ? n : fallback;
  };

  const getWorktopT = () => Math.max(0, Math.round(args.getWorktopThicknessMm()));
  const isUnderWorktop = () => {
    if (wallMounted.checked) return false;
    return getWorktopT() > 0;
  };
  const computeCarcassHeight = () => {
    if (!isUnderWorktop()) return params.height;
    return Math.max(50, Math.round(params.height - getWorktopT()));
  };
  const setFinalHeightFromCarcass = (carcassMm: number) => {
    const c = Math.max(50, Math.round(carcassMm));
    params.height = isUnderWorktop() ? c + getWorktopT() : c;
  };

  const updateUiState = () => {
    const type = (handleType.value as OvenBaseLowParams["handleType"]) ?? "none";
    const pos = numberFields.find((f) => f.key === "handlePositionMm")?.input ?? null;
    if (pos) pos.disabled = type === "none" || type === "gola";

    const len = numberFields.find((f) => f.key === "handleLengthMm")?.input ?? null;
    if (len) len.disabled = type === "none" || type === "knob";

    const size = numberFields.find((f) => f.key === "handleSizeMm")?.input ?? null;
    if (size) size.disabled = type === "none";

    const proj = numberFields.find((f) => f.key === "handleProjectionMm")?.input ?? null;
    if (proj) proj.disabled = type === "none";

    const plinth = numberFields.find((f) => f.key === "plinthHeight")?.input ?? null;
    const setback = numberFields.find((f) => f.key === "plinthSetbackMm")?.input ?? null;
    if (plinth) plinth.disabled = wallMounted.checked;
    if (setback) setback.disabled = wallMounted.checked;

    const drawerFields: Array<keyof OvenBaseLowParams> = [
      "drawerFrontHeightMm",
      "drawerGapAboveMm",
      "sideGap",
      "bottomGap",
      "frontThicknessMm",
      "handlePositionMm",
      "handleLengthMm",
      "handleSizeMm",
      "handleProjectionMm",
      "sideClearanceMm",
      "drawerBoxThickness",
      "drawerBoxSideHeight",
      "drawerBoxDepthMm"
    ];
    for (const k of drawerFields) {
      const inp = numberFields.find((f) => f.key === k)?.input ?? null;
      if (inp) inp.disabled = !drawerEnabled.checked;
    }
    handleType.disabled = !drawerEnabled.checked;
  };

  const syncFromParams = () => {
    for (const f of numberFields) {
      const value = params[f.key];
      f.input.value = typeof value === "number" ? String(value) : "";
    }
    heightFinal.value = String(params.height);
    heightCarcass.value = String(computeCarcassHeight());
    for (const f of keyFields) f.input.value = getMaterialKey(params, f.key);
    for (const f of nameFields) f.input.value = getMaterialName(params, f.key);
    for (const f of colorFields) f.input.value = getMaterialColor(params, f.key);
    if (bodyTextureRotation) bodyTextureRotation.value = String(params.materials.bodyPbr?.rotationDeg ?? 0);
    if (bodyTintColor) bodyTintColor.value = params.materials.bodyPbr?.tintColor ?? "#ffffff";
    if (bodyTintStrength) bodyTintStrength.value = String(Math.round((params.materials.bodyPbr?.tintStrength ?? 0) * 100));
    handleType.value = (params.handleType as any) ?? "none";
    drawerEnabled.checked = params.drawerEnabled === true;
    wallMounted.checked = params.wallMounted === true;
    updateUiState();
  };

  const onInputsChanged = () => {
    for (const f of numberFields) {
      const current = params[f.key];
      if (typeof current !== "number") continue;
      (params[f.key] as number) = readNumber(f.input, current);
    }

    params.wallMounted = wallMounted.checked;
    params.drawerEnabled = drawerEnabled.checked;
    params.handleType = (handleType.value as OvenBaseLowParams["handleType"]) ?? "none";

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

    updateUiState();
    args.onChange();
  };

  for (const f of numberFields) f.input.addEventListener("input", onInputsChanged);
  for (const f of keyFields) f.input.addEventListener("input", onInputsChanged);
  for (const f of nameFields) f.input.addEventListener("input", onInputsChanged);
  for (const f of colorFields) f.input.addEventListener("input", onInputsChanged);
  bodyTextureRotation?.addEventListener("change", onInputsChanged);
  bodyTintColor?.addEventListener("input", onInputsChanged);
  bodyTintStrength?.addEventListener("input", onInputsChanged);
  handleType.addEventListener("change", onInputsChanged);
  wallMounted.addEventListener("change", onInputsChanged);
  drawerEnabled.addEventListener("change", onInputsChanged);

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

  syncFromParams();
  return { syncFromParams };
}

function getMaterialKey(
  params: OvenBaseLowParams,
  key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey"
) {
  if (key === "materials.bodyKey") return params.materials.bodyKey;
  if (key === "materials.frontKey") return params.materials.frontKey;
  return params.materials.drawerKey;
}

function setMaterialKey(
  params: OvenBaseLowParams,
  key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey",
  value: string
) {
  if (key === "materials.bodyKey") params.materials.bodyKey = value;
  else if (key === "materials.frontKey") params.materials.frontKey = value;
  else params.materials.drawerKey = value;
}

function getMaterialName(params: OvenBaseLowParams, key: "materials.bodyName" | "materials.frontName" | "materials.drawerName") {
  if (key === "materials.bodyName") return params.materials.bodyName ?? "";
  if (key === "materials.frontName") return params.materials.frontName ?? "";
  return params.materials.drawerName ?? "";
}

function setMaterialName(
  params: OvenBaseLowParams,
  key: "materials.bodyName" | "materials.frontName" | "materials.drawerName",
  value: string
) {
  if (key === "materials.bodyName") params.materials.bodyName = value;
  else if (key === "materials.frontName") params.materials.frontName = value;
  else params.materials.drawerName = value;
}

function getMaterialColor(
  params: OvenBaseLowParams,
  key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor"
) {
  if (key === "materials.bodyColor") return params.materials.bodyColor;
  if (key === "materials.frontColor") return params.materials.frontColor;
  return params.materials.drawerColor;
}

function setMaterialColor(
  params: OvenBaseLowParams,
  key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor",
  value: string
) {
  if (key === "materials.bodyColor") params.materials.bodyColor = value;
  else if (key === "materials.frontColor") params.materials.frontColor = value;
  else params.materials.drawerColor = value;
}
