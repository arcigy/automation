export type PartDimensionsMm = {
  width: number;
  height: number;
  depth: number;
};

export type PartRow = {
  name: string;
  visible: boolean;
  dimensionsMm: PartDimensionsMm;
};

export type OverlapRow = {
  a: string;
  b: string;
  status: "error" | "allowed";
  reason?: string;
  overlapMm: { x: number; y: number; z: number };
  intersectionMm: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
  aBoxMm: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
  bBoxMm: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
  volumeMm3: number;
};

type CreatePartPanelArgs = {
  onSelect: (name: string) => void;
  onSetVisible: (name: string, visible: boolean) => void;
  onHighlightPair: (a: string, b: string) => void;
};

export function createPartPanel(container: HTMLElement, args: CreatePartPanelArgs) {
  container.innerHTML = "";

  const selected = document.createElement("div");
  selected.className = "selected";
  selected.innerHTML = `
    <div class="name muted">Click a part…</div>
    <div class="dims muted"></div>
    <button type="button" disabled>Hide selected</button>
  `;
  container.appendChild(selected);

  const selectedNameEl = selected.querySelector(".name") as HTMLDivElement;
  const selectedDimsEl = selected.querySelector(".dims") as HTMLDivElement;
  const selectedBtn = selected.querySelector("button") as HTMLButtonElement;

  const list = document.createElement("div");
  list.className = "list";
  container.appendChild(list);

  const overlapsWrap = document.createElement("div");
  overlapsWrap.className = "overlaps";
  overlapsWrap.innerHTML = `
    <div class="overlapsHeader">
      <div>Overlaps</div>
      <label class="overlapsToggle muted"><input id="showAllowedOverlaps" type="checkbox" /> show allowed</label>
    </div>
    <div class="overlapsList muted">No overlaps.</div>
  `;
  container.appendChild(overlapsWrap);

  const overlapsListEl = overlapsWrap.querySelector(".overlapsList") as HTMLDivElement;
  const showAllowedEl = overlapsWrap.querySelector("#showAllowedOverlaps") as HTMLInputElement;

  let rows: PartRow[] = [];
  let selectedName: string | null = null;
  let overlaps: OverlapRow[] = [];

  const renderSelected = () => {
    if (!selectedName) {
      selectedNameEl.textContent = "Click a part…";
      selectedNameEl.classList.add("muted");
      selectedDimsEl.textContent = "";
      selectedBtn.disabled = true;
      selectedBtn.textContent = "Hide selected";
      return;
    }

    const row = rows.find((r) => r.name === selectedName) ?? null;
    if (!row) {
      selectedName = null;
      renderSelected();
      return;
    }

    selectedNameEl.textContent = row.name;
    selectedNameEl.classList.remove("muted");
    selectedDimsEl.textContent = formatDims(row.dimensionsMm);
    selectedBtn.disabled = false;
    selectedBtn.textContent = row.visible ? "Hide selected" : "Show selected";
  };

  const renderList = () => {
    list.innerHTML = "";
    for (const row of rows) {
      const item = document.createElement("div");
      item.className = "item";

      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = row.visible;
      check.title = row.visible ? "Visible" : "Hidden";
      check.addEventListener("change", () => {
        args.onSetVisible(row.name, check.checked);
      });

      const rowWrap = document.createElement("div");
      rowWrap.className = "row";

      const label = document.createElement("button");
      label.type = "button";
      label.className = "label";
      label.textContent = row.name;
      label.addEventListener("click", () => args.onSelect(row.name));

      const dims = document.createElement("div");
      dims.className = "muted";
      dims.style.fontSize = "12px";
      dims.textContent = formatDims(row.dimensionsMm);

      rowWrap.appendChild(label);
      rowWrap.appendChild(dims);

      item.appendChild(check);
      item.appendChild(rowWrap);
      list.appendChild(item);
    }
  };

  const renderOverlaps = () => {
    overlapsListEl.innerHTML = "";

    const visible = showAllowedEl.checked ? overlaps : overlaps.filter((o) => o.status === "error");

    if (visible.length === 0) {
      overlapsListEl.textContent = "No overlaps.";
      overlapsListEl.classList.add("muted");
      return;
    }

    overlapsListEl.classList.remove("muted");

    for (const o of visible) {
      const item = document.createElement("div");
      item.className = `overlapItem ${o.status === "allowed" ? "allowed" : ""}`;

      const text = document.createElement("div");
      text.className = "overlapText";
      const ox = round1(o.overlapMm.x);
      const oy = round1(o.overlapMm.y);
      const oz = round1(o.overlapMm.z);
      const prefix = o.status === "allowed" ? "ALLOWED: " : "";
      const suffix = o.status === "allowed" && o.reason ? ` — ${o.reason}` : "";
      text.textContent = `${prefix}${o.a} ↔ ${o.b} (${ox}×${oy}×${oz} mm)${suffix}`;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Highlight";
      btn.addEventListener("click", () => args.onHighlightPair(o.a, o.b));

      item.appendChild(text);
      item.appendChild(btn);
      overlapsListEl.appendChild(item);
    }
  };

  showAllowedEl.addEventListener("change", () => renderOverlaps());

  selectedBtn.addEventListener("click", () => {
    if (!selectedName) return;
    const row = rows.find((r) => r.name === selectedName);
    if (!row) return;
    args.onSetVisible(selectedName, !row.visible);
  });

  const api = {
    setRows(next: PartRow[]) {
      rows = [...next].sort((a, b) => a.name.localeCompare(b.name));
      if (selectedName && !rows.some((r) => r.name === selectedName)) selectedName = null;
      renderList();
      renderSelected();
    },
    setOverlaps(next: OverlapRow[]) {
      overlaps = [...next];
      renderOverlaps();
    },
    setSelected(name: string | null) {
      selectedName = name;
      renderSelected();
    },
    updateVisibility(name: string, visible: boolean) {
      const row = rows.find((r) => r.name === name);
      if (!row) return;
      row.visible = visible;
      renderList();
      renderSelected();
    },
    getSelectedName() {
      return selectedName;
    }
  };

  return api;
}

function formatDims(d: PartDimensionsMm) {
  const w = round1(d.width);
  const h = round1(d.height);
  const dep = round1(d.depth);
  return `${w}×${h}×${dep} mm`;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
