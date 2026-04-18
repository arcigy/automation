import type { FridgeTallParams } from "../model/cabinetTypes";

type ControlApi = { syncFromParams: () => void };

type CreateControlsArgs = {
  onChange: () => void;
};

export function createFridgeTallControls(container: HTMLElement, params: FridgeTallParams, args: CreateControlsArgs): ControlApi {
  container.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "grid";
  container.appendChild(grid);

  const numberFields: Array<{ key: keyof FridgeTallParams; input: HTMLInputElement }> = [];
  const keyFields: Array<{
    key: "materials.bodyKey" | "materials.frontKey" | "materials.drawerKey";
    input: HTMLInputElement;
  }> = [];
  const colorFields: Array<{
    key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor";
    input: HTMLInputElement;
  }> = [];
  let bodyTextureRotation: HTMLSelectElement | null = null;
  let bodyTintColor: HTMLInputElement | null = null;
  let bodyTintStrength: HTMLInputElement | null = null;
  let frontTextureRotation: HTMLSelectElement | null = null;
  let frontTintColor: HTMLInputElement | null = null;
  let frontTintStrength: HTMLInputElement | null = null;
  let drawerTextureRotation: HTMLSelectElement | null = null;
  let drawerTintColor: HTMLInputElement | null = null;
  let drawerTintStrength: HTMLInputElement | null = null;
  let fridgePresetSelect: HTMLSelectElement | null = null;

  const addNumber = (key: keyof FridgeTallParams, label: string, opts: { min?: number; step?: number } = {}) => {
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
    lab.htmlFor = `f_${key.replace(".", "_")}`;
    const input = document.createElement("input");
    input.id = `f_${key.replace(".", "_")}`;
    input.type = "text";
    wrap.appendChild(lab);
    wrap.appendChild(input);
    grid.appendChild(wrap);
    keyFields.push({ key, input });
  };

  const addColor = (key: "materials.bodyColor" | "materials.frontColor" | "materials.drawerColor", label: string) => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.style.gridTemplateColumns = "1fr 120px";

    const lab = document.createElement("label");
    lab.textContent = label;
    lab.htmlFor = `f_${key.replace(".", "_")}`;

    const input = document.createElement("input");
    input.id = `f_${key.replace(".", "_")}`;
    input.type = "color";

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

  // Drawer fronts (optional)
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
  heightsLabel.textContent = "Drawer front heights (mm) – comma-separated (count = drawerCount)";
  heightsLabel.htmlFor = "f_drawerFrontHeights";
  heightsWrap.appendChild(heightsLabel);
  const heights = document.createElement("textarea");
  heights.id = "f_drawerFrontHeights";
  heights.rows = 2;
  heights.placeholder = "e.g. 200, 200";
  heightsWrap.appendChild(heights);
  grid.appendChild(heightsWrap);

  // Handles (same contract as other models)
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

  addNumber("handlePositionMm", "Handle position from top (mm)", { min: 0, step: 1 });
  addNumber("handleLengthMm", "Handle length (mm)", { min: 0, step: 1 });
  addNumber("handleSizeMm", "Handle size (mm)", { min: 0, step: 1 });
  addNumber("handleProjectionMm", "Handle projection (mm)", { min: 0, step: 1 });

  addNumber("gapAboveDrawersMm", "Gap above drawers (mm)", { min: 0, step: 1 });

  // Fridge niche
  addNumber("fridgeWidthMm", "Fridge niche width (mm)", { min: 100, step: 1 });
  addNumber("fridgeHeightMm", "Fridge niche height (mm)", { min: 100, step: 1 });
  addNumber("fridgeDepthMm", "Fridge niche depth (mm)", { min: 100, step: 1 });
  addNumber("fridgeSideClearanceMm", "Fridge side clearance (mm)", { min: 0, step: 0.5 });
  addNumber("fridgeTopClearanceMm", "Fridge top clearance (mm)", { min: 0, step: 0.5 });
  addNumber("fridgeBottomClearanceMm", "Fridge bottom clearance (mm)", { min: 0, step: 0.5 });

  // Common real-world presets (built-in fridge opening)
  {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.textContent = "Fridge preset";
    lab.htmlFor = "f_fridgePreset";
    const sel = document.createElement("select");
    sel.id = "f_fridgePreset";
    sel.innerHTML = `
      <option value="560_1770_550">56w / 177h / 55d</option>
      <option value="570_1780_550">57w / 178h / 55d</option>
    `;
    wrap.appendChild(lab);
    wrap.appendChild(sel);
    grid.appendChild(wrap);
    fridgePresetSelect = sel;

    sel.addEventListener("change", () => {
      const [w, h, d] = String(sel.value)
        .split("_")
        .map((x) => Number(x));
      if (![w, h, d].every((n) => Number.isFinite(n))) return;
      params.fridgeWidthMm = w;
      params.fridgeHeightMm = h;
      params.fridgeDepthMm = d;

      const fw = numberFields.find((x) => x.key === "fridgeWidthMm");
      if (fw) fw.input.value = String(w);
      const fh = numberFields.find((x) => x.key === "fridgeHeightMm");
      if (fh) fh.input.value = String(h);
      const fd = numberFields.find((x) => x.key === "fridgeDepthMm");
      if (fd) fd.input.value = String(d);

      args.onChange();
    });
  }

  // Door split (freezer + fridge)
  addNumber("freezerDoorHeightMm", "Freezer door height (mm)", { min: 50, step: 1 });
  addNumber("fridgeDoorGapMm", "Door gap (mm)", { min: 0, step: 0.5 });
  addNumber("doorHandleOffsetFromSplitMm", "Handle offset from split (mm)", { min: 0, step: 1 });

  // No top cabinet in this variant (the unit ends at the fridge height).

  // Materials
  addKey("materials.bodyKey", "Body key");
  addKey("materials.frontKey", "Front key");
  addKey("materials.drawerKey", "Drawer key");
  addColor("materials.bodyColor", "Body color");
  addColor("materials.frontColor", "Front color");
  addColor("materials.drawerColor", "Drawer color");

  // Body texture rotation
  {
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.style.gridTemplateColumns = "1fr 120px";
    const lab = document.createElement("label");
    lab.textContent = "Body texture rotation";
    lab.htmlFor = "f_bodyTextureRotation";
    const sel = document.createElement("select");
    sel.id = "f_bodyTextureRotation";
    sel.innerHTML = `
      <option value="0">0Â°</option>
      <option value="90">90Â°</option>
      <option value="180">180Â°</option>
      <option value="270">270Â°</option>
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
    wrap.style.gridTemplateColumns = "1fr 120px";
    const lab = document.createElement("label");
    lab.textContent = "Body wood tint";
    lab.htmlFor = "f_bodyTintColor";
    const input = document.createElement("input");
    input.id = "f_bodyTintColor";
    input.type = "color";
    wrap.appendChild(lab);
    wrap.appendChild(input);
    grid.appendChild(wrap);
    bodyTintColor = input;
  }
  {
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.style.gridTemplateColumns = "1fr 120px";
    const lab = document.createElement("label");
    lab.textContent = "Body tint strength";
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

  const addTextureRotation = (id: string, label: string) => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.style.gridTemplateColumns = "1fr 120px";
    const lab = document.createElement("label");
    lab.textContent = label;
    lab.htmlFor = id;
    const sel = document.createElement("select");
    sel.id = id;
    sel.innerHTML = `
      <option value="0">0°</option>
      <option value="90">90°</option>
      <option value="180">180°</option>
      <option value="270">270°</option>
    `;
    wrap.appendChild(lab);
    wrap.appendChild(sel);
    grid.appendChild(wrap);
    return sel;
  };

  const addTintColor = (id: string, label: string) => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.style.gridTemplateColumns = "1fr 120px";
    const lab = document.createElement("label");
    lab.textContent = label;
    lab.htmlFor = id;
    const input = document.createElement("input");
    input.id = id;
    input.type = "color";
    wrap.appendChild(lab);
    wrap.appendChild(input);
    grid.appendChild(wrap);
    return input;
  };

  const addTintStrength = (id: string, label: string) => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.style.gridTemplateColumns = "1fr 120px";
    const lab = document.createElement("label");
    lab.textContent = label;
    lab.htmlFor = id;
    const input = document.createElement("input");
    input.id = id;
    input.type = "number";
    input.min = "0";
    input.max = "100";
    input.step = "1";
    wrap.appendChild(lab);
    wrap.appendChild(input);
    grid.appendChild(wrap);
    return input;
  };

  frontTextureRotation = addTextureRotation("f_frontTextureRotation", "Front texture rotation");
  frontTintColor = addTintColor("f_frontTintColor", "Front wood tint");
  frontTintStrength = addTintStrength("f_frontTintStrength", "Front tint strength");

  drawerTextureRotation = addTextureRotation("f_drawerTextureRotation", "Drawer texture rotation");
  drawerTintColor = addTintColor("f_drawerTintColor", "Drawer wood tint");
  drawerTintStrength = addTintStrength("f_drawerTintStrength", "Drawer tint strength");

  const readNumber = (input: HTMLInputElement, fallback: number) => {
    const n = Number(input.value);
    return Number.isFinite(n) ? n : fallback;
  };

  const updateUiState = () => {
    const type = (handleType.value as FridgeTallParams["handleType"]) ?? "none";
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

    for (const f of keyFields) {
      const [_, k] = f.key.split(".") as ["materials", keyof FridgeTallParams["materials"]];
      f.input.value = String((params.materials as any)[k] ?? "");
    }
    for (const f of colorFields) {
      const [_, k] = f.key.split(".") as ["materials", keyof FridgeTallParams["materials"]];
      f.input.value = String((params.materials as any)[k] ?? "#ffffff");
    }
    if (bodyTextureRotation) bodyTextureRotation.value = String(params.materials.bodyPbr?.rotationDeg ?? 0);
    if (bodyTintColor) bodyTintColor.value = params.materials.bodyPbr?.tintColor ?? "#ffffff";
    if (bodyTintStrength) bodyTintStrength.value = String(Math.round((params.materials.bodyPbr?.tintStrength ?? 0) * 100));
    if (frontTextureRotation) frontTextureRotation.value = String(params.materials.frontPbr?.rotationDeg ?? 0);
    if (frontTintColor) frontTintColor.value = params.materials.frontPbr?.tintColor ?? "#ffffff";
    if (frontTintStrength) frontTintStrength.value = String(Math.round((params.materials.frontPbr?.tintStrength ?? 0) * 100));
    if (drawerTextureRotation) drawerTextureRotation.value = String(params.materials.drawerPbr?.rotationDeg ?? 0);
    if (drawerTintColor) drawerTintColor.value = params.materials.drawerPbr?.tintColor ?? "#ffffff";
    if (drawerTintStrength) drawerTintStrength.value = String(Math.round((params.materials.drawerPbr?.tintStrength ?? 0) * 100));

    heights.value = params.drawerFrontHeights.join(", ");
    handleType.value = (params.handleType as any) ?? "none";
    if (fridgePresetSelect) {
      const w = Math.round(Number(params.fridgeWidthMm));
      const h = Math.round(Number(params.fridgeHeightMm));
      const d = Math.round(Number(params.fridgeDepthMm));
      fridgePresetSelect.value = `${w}_${h}_${d}`;
    }
    updateUiState();
  };

  const parseHeights = (txt: string) =>
    txt
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));

  const normalizeHeights = (arr: number[], count: number) => {
    const out = arr.slice(0, count);
    while (out.length < count) out.push(out[out.length - 1] ?? 200);
    return out.map((n) => Math.max(1, Math.round(n)));
  };

  const onInputsChanged = () => {
    for (const f of numberFields) {
      const current = params[f.key];
      if (typeof current !== "number") continue;
      (params[f.key] as number) = readNumber(f.input, current);
    }

    params.drawerCount = Math.max(0, Math.min(6, Math.round(params.drawerCount)));
    params.handleType = (handleType.value as any) ?? "none";

    const typed = parseHeights(heights.value);
    params.drawerFrontHeights = normalizeHeights(typed, params.drawerCount);
    heights.value = params.drawerFrontHeights.join(", ");

    for (const f of keyFields) {
      const [_, k] = f.key.split(".") as ["materials", keyof FridgeTallParams["materials"]];
      (params.materials as any)[k] = f.input.value;
    }
    for (const f of colorFields) {
      const [_, k] = f.key.split(".") as ["materials", keyof FridgeTallParams["materials"]];
      (params.materials as any)[k] = f.input.value;
    }

    if (bodyTextureRotation) {
      if (!params.materials.bodyPbr) params.materials.bodyPbr = { id: "wood_veneer_oak_7760_1k", rotationDeg: 0 };
      params.materials.bodyPbr.rotationDeg = (Number(bodyTextureRotation.value) as 0 | 90 | 180 | 270) ?? 0;
    }
    if (bodyTintColor || bodyTintStrength) {
      if (!params.materials.bodyPbr) params.materials.bodyPbr = { id: "wood_veneer_oak_7760_1k", rotationDeg: 0 };
      if (bodyTintColor) params.materials.bodyPbr.tintColor = bodyTintColor.value;
      if (bodyTintStrength) params.materials.bodyPbr.tintStrength = Number(bodyTintStrength.value) / 100;
    }

    if (frontTextureRotation) {
      if (!params.materials.frontPbr) params.materials.frontPbr = { id: "wood_veneer_oak_7760_1k", rotationDeg: 0 };
      params.materials.frontPbr.rotationDeg = (Number(frontTextureRotation.value) as 0 | 90 | 180 | 270) ?? 0;
    }
    if (frontTintColor || frontTintStrength) {
      if (!params.materials.frontPbr) params.materials.frontPbr = { id: "wood_veneer_oak_7760_1k", rotationDeg: 0 };
      if (frontTintColor) params.materials.frontPbr.tintColor = frontTintColor.value;
      if (frontTintStrength) params.materials.frontPbr.tintStrength = Number(frontTintStrength.value) / 100;
    }

    if (drawerTextureRotation) {
      if (!params.materials.drawerPbr) params.materials.drawerPbr = { id: "wood_veneer_oak_7760_1k", rotationDeg: 0 };
      params.materials.drawerPbr.rotationDeg = (Number(drawerTextureRotation.value) as 0 | 90 | 180 | 270) ?? 0;
    }
    if (drawerTintColor || drawerTintStrength) {
      if (!params.materials.drawerPbr) params.materials.drawerPbr = { id: "wood_veneer_oak_7760_1k", rotationDeg: 0 };
      if (drawerTintColor) params.materials.drawerPbr.tintColor = drawerTintColor.value;
      if (drawerTintStrength) params.materials.drawerPbr.tintStrength = Number(drawerTintStrength.value) / 100;
    }

    updateUiState();
    args.onChange();
  };

  for (const f of numberFields) {
    f.input.addEventListener("input", onInputsChanged);
  }
  heights.addEventListener("input", onInputsChanged);
  handleType.addEventListener("change", onInputsChanged);
  for (const f of keyFields) f.input.addEventListener("input", onInputsChanged);
  for (const f of colorFields) f.input.addEventListener("input", onInputsChanged);
  bodyTextureRotation?.addEventListener("change", onInputsChanged);
  bodyTintColor?.addEventListener("input", onInputsChanged);
  bodyTintStrength?.addEventListener("input", onInputsChanged);
  frontTextureRotation?.addEventListener("change", onInputsChanged);
  frontTintColor?.addEventListener("input", onInputsChanged);
  frontTintStrength?.addEventListener("input", onInputsChanged);
  drawerTextureRotation?.addEventListener("change", onInputsChanged);
  drawerTintColor?.addEventListener("input", onInputsChanged);
  drawerTintStrength?.addEventListener("input", onInputsChanged);

  syncFromParams();
  return { syncFromParams };
}
