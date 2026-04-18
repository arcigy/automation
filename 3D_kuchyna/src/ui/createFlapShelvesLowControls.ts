import type { FlapShelvesLowParams } from "../model/cabinetTypes";
import { computeEqualShelfGaps } from "../model/cabinetTypes";

type ControlApi = {
  syncFromParams: () => void;
};

type CreateControlsArgs = {
  onChange: () => void;
  getWorktopThicknessMm: () => number;
};

export function createFlapShelvesLowControls(
  container: HTMLElement,
  params: FlapShelvesLowParams,
  args: CreateControlsArgs
): ControlApi {
  container.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "grid";
  container.appendChild(grid);

  const numberFields: Array<{ key: keyof FlapShelvesLowParams; input: HTMLInputElement }> = [];
  const keyFields: Array<{
    key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey";
    input: HTMLInputElement;
  }> = [];
  const colorFields: Array<{
    key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor";
    input: HTMLInputElement;
  }> = [];

  const addNumber = (key: keyof FlapShelvesLowParams, label: string, opts: { min?: number; step?: number } = {}) => {
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

  // Base (same as drawer_low)
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

  // Reveals
  addNumber("frontGap", "Front gap (mm)", { min: 0, step: 0.5 });
  addNumber("sideGap", "Side reveal (mm)", { min: 0, step: 0.5 });
  addNumber("topGap", "Top reveal (mm)", { min: 0, step: 0.5 });
  addNumber("bottomGap", "Bottom reveal (mm)", { min: 0, step: 0.5 });

  // Shelves
  addNumber("shelfCount", "Shelf count (compartments)", { min: 1, step: 1 });
  addNumber("shelfThickness", "Shelf thickness (mm)", { min: 5, step: 1 });

  // Flap UI
  const flapOpenWrap = document.createElement("div");
  flapOpenWrap.className = "field";
  flapOpenWrap.style.gridTemplateColumns = "1fr 120px";

  const flapOpenLabel = document.createElement("label");
  flapOpenLabel.textContent = "Flap open";
  flapOpenLabel.htmlFor = "f_flapOpen";

  const flapOpen = document.createElement("input");
  flapOpen.id = "f_flapOpen";
  flapOpen.type = "checkbox";
  flapOpen.checked = params.flapOpen === true;
  flapOpen.style.justifySelf = "start";

  flapOpenWrap.appendChild(flapOpenLabel);
  flapOpenWrap.appendChild(flapOpen);
  grid.appendChild(flapOpenWrap);

  const hingeCountWrap = document.createElement("div");
  hingeCountWrap.className = "field";
  hingeCountWrap.style.gridTemplateColumns = "1fr 120px";

  const hingeCountLabel = document.createElement("label");
  hingeCountLabel.textContent = "Hinge count";
  hingeCountLabel.htmlFor = "f_hingeCount";

  const hingeCount = document.createElement("select");
  hingeCount.id = "f_hingeCount";
  hingeCount.innerHTML = `
    <option value="1">1</option>
    <option value="2">2</option>
    <option value="3">3</option>
    <option value="4">4</option>
    <option value="5">5</option>
  `;

  hingeCountWrap.appendChild(hingeCountLabel);
  hingeCountWrap.appendChild(hingeCount);
  grid.appendChild(hingeCountWrap);

  addNumber("hingeInsetFromSideMm", "Hinge inset from sides (mm)", { min: 0, step: 1 });

  // Auto-fit shelves
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

  // Shelf gaps textarea
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
    flapOpen.checked = params.flapOpen === true;
    hingeCount.value = String(params.hingeCount);
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

    params.shelfCount = Math.max(1, Math.round(params.shelfCount));
    params.wallMounted = wallMounted.checked;
    if (params.wallMounted) params.plinthHeight = 0;
    params.flapOpen = flapOpen.checked;
    params.flapHinge = "top";
    params.hingeCount = Math.max(1, Math.min(5, Math.round(Number(hingeCount.value) || 2)));
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
  flapOpen.addEventListener("change", onInputsChanged);
  hingeCount.addEventListener("change", onInputsChanged);
  autoFit.addEventListener("change", () => {
    shelfGaps.readOnly = autoFit.checked;
    // When editing inner layout, auto-open flap so changes are visible.
    if (!flapOpen.checked) {
      flapOpen.checked = true;
      params.flapOpen = true;
    }
    onInputsChanged();
  });
  shelfGaps.addEventListener("input", () => {
    if (autoFit.checked) {
      autoFit.checked = false;
      shelfGaps.readOnly = false;
      params.shelfAutoFit = false;
    }
    if (!flapOpen.checked) {
      flapOpen.checked = true;
      params.flapOpen = true;
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
  params: FlapShelvesLowParams,
  key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor"
) {
  if (key === "materials.bodyColor") return params.materials.bodyColor;
  if (key === "materials.frontColor") return params.materials.frontColor;
  return params.materials.drawerColor;
}

function setMaterialColor(
  params: FlapShelvesLowParams,
  key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor",
  value: string
) {
  if (key === "materials.bodyColor") params.materials.bodyColor = value;
  else if (key === "materials.frontColor") params.materials.frontColor = value;
  else params.materials.drawerColor = value;
}

function getMaterialKey(
  params: FlapShelvesLowParams,
  key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey"
) {
  if (key === "materials.bodyKey") return params.materials.bodyKey;
  if (key === "materials.frontKey") return params.materials.frontKey;
  return params.materials.drawerKey;
}

function setMaterialKey(
  params: FlapShelvesLowParams,
  key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey",
  value: string
) {
  if (key === "materials.bodyKey") params.materials.bodyKey = value;
  else if (key === "materials.frontKey") params.materials.frontKey = value;
  else params.materials.drawerKey = value;
}
