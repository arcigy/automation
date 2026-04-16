import type { DrawerLowParams } from "../model/cabinetTypes";
import { computeEqualDrawerFrontHeights } from "../model/cabinetTypes";

type ControlApi = {
  syncFromParams: () => void;
  isAutoFitEnabled: () => boolean;
};

type CreateControlsArgs = {
  onChange: () => void;
};

export function createDrawerLowControls(
  container: HTMLElement,
  params: DrawerLowParams,
  args: CreateControlsArgs
): ControlApi {
  container.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "grid";
  container.appendChild(grid);

  const numberFields: Array<{ key: keyof DrawerLowParams; input: HTMLInputElement }> = [];
  const keyFields: Array<{
    key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey";
    input: HTMLInputElement;
  }> = [];
  const colorFields: Array<{
    key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor";
    input: HTMLInputElement;
  }> = [];

  const addNumber = (key: keyof DrawerLowParams, label: string, opts: { min?: number; step?: number } = {}) => {
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

  const addKey = (
    key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey",
    label: string
  ) => {
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

  const addColor = (
    key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor",
    label: string
  ) => {
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
  addNumber("height", "Height (mm)", { min: 200, step: 1 });
  addNumber("depth", "Depth (mm)", { min: 200, step: 1 });
  addNumber("boardThickness", "Board thickness (mm)", { min: 5, step: 1 });
  addNumber("backThickness", "Back thickness (mm)", { min: 3, step: 1 });
  addNumber("plinthHeight", "Plinth height (mm)", { min: 0, step: 1 });

  // Front/drawers
  addNumber("frontGap", "Front gap (mm)", { min: 0, step: 0.5 });
  addNumber("sideGap", "Side reveal (mm)", { min: 0, step: 0.5 });
  addNumber("topGap", "Top reveal (mm)", { min: 0, step: 0.5 });
  addNumber("bottomGap", "Bottom reveal (mm)", { min: 0, step: 0.5 });
  addNumber("drawerCount", "Drawer count", { min: 1, step: 1 });
  addNumber("drawerBoxThickness", "Drawer box thickness (mm)", { min: 5, step: 1 });
  addNumber("drawerBoxSideHeight", "Drawer box side/back height (mm)", { min: 30, step: 1 });

  addKey("materials.bodyKey", "Body material key");
  addKey("materials.frontKey", "Fronts material key");
  addKey("materials.drawerKey", "Drawer material key");

  addColor("materials.bodyColor", "Body color");
  addColor("materials.frontColor", "Fronts color");
  addColor("materials.drawerColor", "Drawer color");

  // Auto-fit checkbox
  const autoWrap = document.createElement("div");
  autoWrap.className = "field";
  autoWrap.style.gridTemplateColumns = "1fr 120px";

  const autoLabel = document.createElement("label");
  autoLabel.textContent = "Auto-fit equal fronts";
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
  heightsLabel.textContent = "Drawer front heights (mm) – comma-separated";
  heightsLabel.htmlFor = "f_drawerFrontHeights";
  heightsWrap.appendChild(heightsLabel);

  const heights = document.createElement("textarea");
  heights.id = "f_drawerFrontHeights";
  heights.rows = 3;
  heights.placeholder = "e.g. 200, 200, 200";
  heightsWrap.appendChild(heights);
  grid.appendChild(heightsWrap);

  const syncFromParams = () => {
    for (const f of numberFields) {
      const value = params[f.key];
      f.input.value = typeof value === "number" ? String(value) : "";
    }
    for (const f of keyFields) f.input.value = getMaterialKey(params, f.key);
    for (const f of colorFields) f.input.value = getMaterialColor(params, f.key);

    heights.value = params.drawerFrontHeights.join(", ");
    heights.readOnly = autoFit.checked;
  };

  let lastDrawerCount = params.drawerCount;

  const readNumber = (input: HTMLInputElement, fallback: number) => {
    const n = Number(input.value);
    return Number.isFinite(n) ? n : fallback;
  };

  const onInputsChanged = () => {
    for (const f of numberFields) {
      const current = params[f.key];
      if (typeof current !== "number") continue;
      (params[f.key] as number) = readNumber(f.input, current);
    }

    params.drawerCount = Math.max(1, Math.round(params.drawerCount));

    for (const f of keyFields) setMaterialKey(params, f.key, f.input.value);
    for (const f of colorFields) setMaterialColor(params, f.key, f.input.value);

    if (autoFit.checked) {
      params.drawerFrontHeights = computeEqualDrawerFrontHeights(params);
      heights.value = params.drawerFrontHeights.join(", ");
    } else {
      const typed = parseHeights(heights.value);
      params.drawerFrontHeights = typed;
      if (params.drawerCount !== lastDrawerCount) {
        params.drawerFrontHeights = normalizeHeights(typed, params.drawerCount);
        heights.value = params.drawerFrontHeights.join(", ");
        lastDrawerCount = params.drawerCount;
      }
    }

    args.onChange();
  };

  for (const f of numberFields) f.input.addEventListener("input", onInputsChanged);
  for (const f of keyFields) f.input.addEventListener("input", onInputsChanged);
  for (const f of colorFields) f.input.addEventListener("input", onInputsChanged);
  heights.addEventListener("input", onInputsChanged);
  autoFit.addEventListener("change", () => {
    heights.readOnly = autoFit.checked;
    onInputsChanged();
  });

  syncFromParams();
  return { syncFromParams, isAutoFitEnabled: () => autoFit.checked };
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

function getMaterialColor(
  params: DrawerLowParams,
  key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor"
) {
  if (key === "materials.bodyColor") return params.materials.bodyColor;
  if (key === "materials.frontColor") return params.materials.frontColor;
  return params.materials.drawerColor;
}

function setMaterialColor(
  params: DrawerLowParams,
  key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor",
  value: string
) {
  if (key === "materials.bodyColor") params.materials.bodyColor = value;
  else if (key === "materials.frontColor") params.materials.frontColor = value;
  else params.materials.drawerColor = value;
}

function getMaterialKey(params: DrawerLowParams, key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey") {
  if (key === "materials.bodyKey") return params.materials.bodyKey;
  if (key === "materials.frontKey") return params.materials.frontKey;
  return params.materials.drawerKey;
}

function setMaterialKey(
  params: DrawerLowParams,
  key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey",
  value: string
) {
  if (key === "materials.bodyKey") params.materials.bodyKey = value;
  else if (key === "materials.frontKey") params.materials.frontKey = value;
  else params.materials.drawerKey = value;
}

