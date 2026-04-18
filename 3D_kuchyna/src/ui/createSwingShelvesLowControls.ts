import type { SwingShelvesLowParams } from "../model/cabinetTypes";
import { computeEqualShelfGaps } from "../model/cabinetTypes";

type ControlApi = {
  syncFromParams: () => void;
};

type CreateControlsArgs = {
  onChange: () => void;
  getWorktopThicknessMm: () => number;
};

export function createSwingShelvesLowControls(
  container: HTMLElement,
  params: SwingShelvesLowParams,
  args: CreateControlsArgs
): ControlApi {
  container.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "grid";
  container.appendChild(grid);

  const numberFields: Array<{ key: keyof SwingShelvesLowParams; input: HTMLInputElement }> = [];
  const keyFields: Array<{
    key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey";
    input: HTMLInputElement;
  }> = [];
  const colorFields: Array<{
    key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor";
    input: HTMLInputElement;
  }> = [];

  const addNumber = (key: keyof SwingShelvesLowParams, label: string, opts: { min?: number; step?: number } = {}) => {
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

  // Reveals / gaps
  addNumber("frontGap", "Center door gap (mm)", { min: 0, step: 0.5 });
  addNumber("sideGap", "Side reveal (mm)", { min: 0, step: 0.5 });
  addNumber("topGap", "Top reveal (mm)", { min: 0, step: 0.5 });
  addNumber("bottomGap", "Bottom reveal (mm)", { min: 0, step: 0.5 });

  // Doors
  const doorsWrap = document.createElement("div");
  doorsWrap.className = "field";
  doorsWrap.style.gridTemplateColumns = "1fr 120px";

  const doorsLabel = document.createElement("label");
  doorsLabel.textContent = "Double door";
  doorsLabel.htmlFor = "f_doorDouble";

  const doorDouble = document.createElement("input");
  doorDouble.id = "f_doorDouble";
  doorDouble.type = "checkbox";
  doorDouble.checked = params.doorDouble === true;
  doorDouble.style.justifySelf = "start";

  doorsWrap.appendChild(doorsLabel);
  doorsWrap.appendChild(doorDouble);
  grid.appendChild(doorsWrap);

  const openWrap = document.createElement("div");
  openWrap.className = "field";
  openWrap.style.gridTemplateColumns = "1fr 120px";

  const openLabel = document.createElement("label");
  openLabel.textContent = "Door open";
  openLabel.htmlFor = "f_doorOpen";

  const doorOpen = document.createElement("input");
  doorOpen.id = "f_doorOpen";
  doorOpen.type = "checkbox";
  doorOpen.checked = params.doorOpen === true;
  doorOpen.style.justifySelf = "start";

  openWrap.appendChild(openLabel);
  openWrap.appendChild(doorOpen);
  grid.appendChild(openWrap);

  // Hinges
  const hingeSideWrap = document.createElement("div");
  hingeSideWrap.className = "field";
  hingeSideWrap.style.gridTemplateColumns = "1fr 120px";

  const hingeSideLabel = document.createElement("label");
  hingeSideLabel.textContent = "Hinge side (single door)";
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

  // Shelves
  addNumber("shelfCount", "Shelf count (compartments)", { min: 1, step: 1 });
  addNumber("shelfThickness", "Shelf thickness (mm)", { min: 5, step: 1 });

  const autoWrap = document.createElement("div");
  autoWrap.className = "field";
  autoWrap.style.gridTemplateColumns = "1fr 120px";

  const autoLabel = document.createElement("label");
  autoLabel.textContent = "Auto-fit equal shelves";
  autoLabel.htmlFor = "f_autoFit";

  const autoFit = document.createElement("input");
  autoFit.id = "f_autoFit";
  autoFit.type = "checkbox";
  autoFit.checked = params.shelfAutoFit === true;
  autoFit.style.justifySelf = "start";

  autoWrap.appendChild(autoLabel);
  autoWrap.appendChild(autoFit);
  grid.appendChild(autoWrap);

  const gapsWrap = document.createElement("div");
  gapsWrap.className = "field";
  gapsWrap.style.gridTemplateColumns = "1fr";

  const gapsLabel = document.createElement("label");
  gapsLabel.textContent = "Shelf gaps (mm) – comma-separated (count = shelfCount)";
  gapsLabel.htmlFor = "f_shelfGaps";
  gapsWrap.appendChild(gapsLabel);

  const shelfGaps = document.createElement("textarea");
  shelfGaps.id = "f_shelfGaps";
  shelfGaps.rows = 3;
  shelfGaps.placeholder = "e.g. 200, 200, 200, 200";
  gapsWrap.appendChild(shelfGaps);
  grid.appendChild(gapsWrap);

  addKey("materials.bodyKey", "Body material key");
  addKey("materials.frontKey", "Front material key");
  addKey("materials.drawerKey", "Drawer material key");

  addColor("materials.bodyColor", "Body color");
  addColor("materials.frontColor", "Front color");
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

    wallMounted.checked = params.wallMounted === true;
    doorDouble.checked = params.doorDouble === true;
    doorOpen.checked = params.doorOpen === true;
    hingeSide.value = params.hingeSide ?? "left";
    autoFit.checked = params.shelfAutoFit === true;
    shelfGaps.value = params.shelfGaps.join(", ");
    shelfGaps.readOnly = autoFit.checked;

    const plinthField = numberFields.find((f) => f.key === "plinthHeight");
    if (plinthField) plinthField.input.disabled = wallMounted.checked;
    const setbackField = numberFields.find((f) => f.key === "plinthSetbackMm");
    if (setbackField) setbackField.input.disabled = wallMounted.checked;
  };

  const readNumber = (input: HTMLInputElement, fallback: number) => {
    const n = Number(input.value);
    return Number.isFinite(n) ? n : fallback;
  };

  const getWorktopT = () => Math.max(0, Math.round(args.getWorktopThicknessMm()));
  const isUnderWorktop = () => {
    if (params.wallMounted === true) return false;
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

  const onInputsChanged = () => {
    for (const f of numberFields) {
      const current = params[f.key];
      if (typeof current !== "number") continue;
      (params[f.key] as number) = readNumber(f.input, current);
    }

    params.wallMounted = wallMounted.checked;
    if (params.wallMounted) params.plinthHeight = 0;

    params.shelfCount = Math.max(1, Math.round(params.shelfCount));
    params.doorDouble = doorDouble.checked;
    params.doorOpen = doorOpen.checked;
    params.hingeSide = (hingeSide.value as SwingShelvesLowParams["hingeSide"]) ?? "left";
    params.hingeCountPerDoor = Math.max(1, Math.min(6, Math.round(params.hingeCountPerDoor)));
    params.shelfAutoFit = autoFit.checked;

    for (const f of keyFields) setMaterialKey(params, f.key, f.input.value);
    for (const f of colorFields) setMaterialColor(params, f.key, f.input.value);

    if (autoFit.checked) {
      params.shelfGaps = computeEqualShelfGaps(params);
      shelfGaps.value = params.shelfGaps.join(", ");
    } else {
      const typed = parseNumbers(shelfGaps.value);
      const expected = params.shelfCount;
      params.shelfGaps = normalizeHeights(typed, expected);
      shelfGaps.value = params.shelfGaps.join(", ");
    }

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

  wallMounted.addEventListener("change", () => {
    const plinthField = numberFields.find((f) => f.key === "plinthHeight");
    if (plinthField) plinthField.input.disabled = wallMounted.checked;
    const setbackField = numberFields.find((f) => f.key === "plinthSetbackMm");
    if (setbackField) setbackField.input.disabled = wallMounted.checked;
    if (wallMounted.checked) {
      const plinthField2 = numberFields.find((f) => f.key === "plinthHeight");
      if (plinthField2) plinthField2.input.value = "0";
      const setbackField2 = numberFields.find((f) => f.key === "plinthSetbackMm");
      if (setbackField2) setbackField2.input.value = String(params.plinthSetbackMm ?? 60);
    }
    onInputsChanged();
  });

  doorDouble.addEventListener("change", onInputsChanged);
  doorOpen.addEventListener("change", onInputsChanged);
  hingeSide.addEventListener("change", onInputsChanged);

  autoFit.addEventListener("change", () => {
    shelfGaps.readOnly = autoFit.checked;
    if (!doorOpen.checked) {
      doorOpen.checked = true;
      params.doorOpen = true;
    }
    onInputsChanged();
  });

  shelfGaps.addEventListener("input", () => {
    if (autoFit.checked) {
      autoFit.checked = false;
      shelfGaps.readOnly = false;
      params.shelfAutoFit = false;
    }
    if (!doorOpen.checked) {
      doorOpen.checked = true;
      params.doorOpen = true;
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

function normalizeHeights(existing: number[], count: number): number[] {
  const out = existing.slice(0, Math.max(0, count));
  if (out.length === 0 && count > 0) out.push(200);
  while (out.length < count) out.push(out[out.length - 1] ?? 200);
  return out;
}

function getMaterialColor(
  params: SwingShelvesLowParams,
  key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor"
) {
  if (key === "materials.bodyColor") return params.materials.bodyColor;
  if (key === "materials.frontColor") return params.materials.frontColor;
  return params.materials.drawerColor;
}

function setMaterialColor(
  params: SwingShelvesLowParams,
  key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor",
  value: string
) {
  if (key === "materials.bodyColor") params.materials.bodyColor = value;
  else if (key === "materials.frontColor") params.materials.frontColor = value;
  else params.materials.drawerColor = value;
}

function getMaterialKey(
  params: SwingShelvesLowParams,
  key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey"
) {
  if (key === "materials.bodyKey") return params.materials.bodyKey;
  if (key === "materials.frontKey") return params.materials.frontKey;
  return params.materials.drawerKey;
}

function setMaterialKey(
  params: SwingShelvesLowParams,
  key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey",
  value: string
) {
  if (key === "materials.bodyKey") params.materials.bodyKey = value;
  else if (key === "materials.frontKey") params.materials.frontKey = value;
  else params.materials.drawerKey = value;
}

