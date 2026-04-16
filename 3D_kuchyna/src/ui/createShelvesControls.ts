import type { ShelvesParams } from "../model/cabinetTypes";
import { computeEqualShelfGaps } from "../model/cabinetTypes";

type ControlApi = {
  syncFromParams: () => void;
};

type CreateControlsArgs = {
  onChange: () => void;
};

export function createShelvesControls(container: HTMLElement, params: ShelvesParams, args: CreateControlsArgs): ControlApi {
  container.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "grid";
  container.appendChild(grid);

  const numberFields: Array<{ key: keyof ShelvesParams; input: HTMLInputElement }> = [];
  const keyFields: Array<{
    key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey";
    input: HTMLInputElement;
  }> = [];
  const colorFields: Array<{
    key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor";
    input: HTMLInputElement;
  }> = [];

  const addNumber = (key: keyof ShelvesParams, label: string, opts: { min?: number; step?: number } = {}) => {
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

  addNumber("width", "Width (mm)", { min: 200, step: 1 });
  addNumber("height", "Height (mm)", { min: 200, step: 1 });
  addNumber("depth", "Depth (mm)", { min: 200, step: 1 });
  addNumber("boardThickness", "Board thickness (mm)", { min: 5, step: 1 });
  addNumber("backThickness", "Back thickness (mm)", { min: 3, step: 1 });
  addNumber("plinthHeight", "Plinth height (mm)", { min: 0, step: 1 });
  addNumber("shelfCount", "Shelf count (compartments)", { min: 1, step: 1 });
  addNumber("shelfThickness", "Shelf thickness (mm)", { min: 5, step: 1 });

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

  // Hinge count
  const hingeWrap = document.createElement("div");
  hingeWrap.className = "field";
  hingeWrap.style.gridTemplateColumns = "1fr 120px";

  const hingeLabel = document.createElement("label");
  hingeLabel.textContent = "Hinges per door";
  hingeLabel.htmlFor = "f_hingeCount";

  const hingeCount = document.createElement("select");
  hingeCount.id = "f_hingeCount";
  hingeCount.style.width = "120px";
  hingeCount.style.height = "36px";
  hingeCount.style.borderRadius = "10px";
  hingeCount.style.border = "1px solid var(--border)";
  hingeCount.style.background = "#0f1117";
  hingeCount.style.color = "var(--text)";
  hingeCount.innerHTML = `
    <option value="2">2</option>
    <option value="3">3</option>
  `;

  hingeWrap.appendChild(hingeLabel);
  hingeWrap.appendChild(hingeCount);
  grid.appendChild(hingeWrap);

  // Auto-fit checkbox
  const autoWrap = document.createElement("div");
  autoWrap.className = "field";
  autoWrap.style.gridTemplateColumns = "1fr 120px";

  const autoLabel = document.createElement("label");
  autoLabel.textContent = "Auto-fit centered shelves";
  autoLabel.htmlFor = "f_shelfAutoFit";

  const autoFit = document.createElement("input");
  autoFit.id = "f_shelfAutoFit";
  autoFit.type = "checkbox";
  autoFit.checked = params.shelfAutoFit === true;
  autoFit.style.justifySelf = "start";

  autoWrap.appendChild(autoLabel);
  autoWrap.appendChild(autoFit);
  grid.appendChild(autoWrap);

  // Shelf gaps (comma-separated) - clear gaps between boards
  const heightsWrap = document.createElement("div");
  heightsWrap.className = "field";
  heightsWrap.style.gridTemplateColumns = "1fr";

  const heightsLabel = document.createElement("label");
  heightsLabel.textContent = "Shelf gaps (mm) – comma-separated (count = shelfCount)";
  heightsLabel.htmlFor = "f_shelfGaps";
  heightsWrap.appendChild(heightsLabel);

  const heights = document.createElement("textarea");
  heights.id = "f_shelfGaps";
  heights.rows = 3;
  heights.placeholder = "e.g. 200, 200, 200, 200";
  heightsWrap.appendChild(heights);
  grid.appendChild(heightsWrap);

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
    for (const f of keyFields) f.input.value = getMaterialKey(params, f.key);
    for (const f of colorFields) f.input.value = getMaterialColor(params, f.key);
    doorDouble.checked = params.doorDouble === true;
    doorOpen.checked = params.doorOpen === true;
    hingeCount.value = String(params.hingeCountPerDoor);
    autoFit.checked = params.shelfAutoFit === true;
    heights.value = params.shelfGaps.join(", ");
    heights.readOnly = autoFit.checked;
  };

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

    params.shelfCount = Math.max(1, Math.round(params.shelfCount));
    params.doorDouble = doorDouble.checked;
    params.doorOpen = doorOpen.checked;
    params.hingeCountPerDoor = hingeCount.value === "2" ? 2 : 3;
    params.shelfAutoFit = autoFit.checked;

    for (const f of keyFields) setMaterialKey(params, f.key, f.input.value);
    for (const f of colorFields) setMaterialColor(params, f.key, f.input.value);

    if (autoFit.checked) {
      params.shelfGaps = computeEqualShelfGaps(params);
      heights.value = params.shelfGaps.join(", ");
    } else {
      const typed = parseHeights(heights.value);
      params.shelfGaps = typed;
      const expected = params.shelfCount;
      if (params.shelfGaps.length !== expected) {
        params.shelfGaps = normalizeHeights(typed, expected);
        heights.value = params.shelfGaps.join(", ");
      }
    }

    args.onChange();
  };

  for (const f of numberFields) f.input.addEventListener("input", onInputsChanged);
  for (const f of keyFields) f.input.addEventListener("input", onInputsChanged);
  for (const f of colorFields) f.input.addEventListener("input", onInputsChanged);
  heights.addEventListener("input", () => {
    // Any manual typing should switch out of auto-fit, otherwise values get overwritten.
    if (autoFit.checked) {
      autoFit.checked = false;
      heights.readOnly = false;
      params.shelfAutoFit = false;
    }
    // When editing inner layout, auto-open door so changes are visible.
    if (!doorOpen.checked) {
      doorOpen.checked = true;
      params.doorOpen = true;
    }
    onInputsChanged();
  });
  autoFit.addEventListener("change", () => {
    heights.readOnly = autoFit.checked;
    if (!doorOpen.checked) {
      doorOpen.checked = true;
      params.doorOpen = true;
    }
    onInputsChanged();
  });
  doorDouble.addEventListener("change", onInputsChanged);
  doorOpen.addEventListener("change", onInputsChanged);
  hingeCount.addEventListener("change", onInputsChanged);

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

function getMaterialColor(params: ShelvesParams, key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor") {
  if (key === "materials.bodyColor") return params.materials.bodyColor;
  if (key === "materials.frontColor") return params.materials.frontColor;
  return params.materials.drawerColor;
}

function setMaterialColor(
  params: ShelvesParams,
  key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor",
  value: string
) {
  if (key === "materials.bodyColor") params.materials.bodyColor = value;
  else if (key === "materials.frontColor") params.materials.frontColor = value;
  else params.materials.drawerColor = value;
}

function getMaterialKey(params: ShelvesParams, key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey") {
  if (key === "materials.bodyKey") return params.materials.bodyKey;
  if (key === "materials.frontKey") return params.materials.frontKey;
  return params.materials.drawerKey;
}

function setMaterialKey(params: ShelvesParams, key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey", value: string) {
  if (key === "materials.bodyKey") params.materials.bodyKey = value;
  else if (key === "materials.frontKey") params.materials.frontKey = value;
  else params.materials.drawerKey = value;
}
