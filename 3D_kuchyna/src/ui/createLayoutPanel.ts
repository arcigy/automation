import type { ModuleParams } from "../model/cabinetTypes";

export type LayoutRow = {
  id: string;
  type: ModuleParams["type"];
  xMm: number;
  zMm: number;
};

type CreateLayoutPanelArgs = {
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

export function createLayoutPanel(container: HTMLElement, args: CreateLayoutPanelArgs) {
  container.innerHTML = "";

  const selected = document.createElement("div");
  selected.className = "selected";
  selected.innerHTML = `
    <div class="name muted">Click a module…</div>
    <div class="dims muted"></div>
    <div class="actions" style="grid-template-columns:1fr 1fr;">
      <button type="button" disabled id="dupBtn">Duplicate</button>
      <button type="button" disabled id="delBtn" style="border-color:#3a1f23;background:#1a0f12;color:#ff6b6b;">Delete</button>
    </div>
  `;
  container.appendChild(selected);

  const selectedNameEl = selected.querySelector(".name") as HTMLDivElement;
  const selectedDimsEl = selected.querySelector(".dims") as HTMLDivElement;
  const dupBtn = selected.querySelector("#dupBtn") as HTMLButtonElement;
  const delBtn = selected.querySelector("#delBtn") as HTMLButtonElement;

  const list = document.createElement("div");
  list.className = "list";
  container.appendChild(list);

  let rows: LayoutRow[] = [];
  let selectedId: string | null = null;

  const renderSelected = () => {
    if (!selectedId) {
      selectedNameEl.textContent = "Click a module…";
      selectedNameEl.classList.add("muted");
      selectedDimsEl.textContent = "";
      dupBtn.disabled = true;
      delBtn.disabled = true;
      return;
    }

    const row = rows.find((r) => r.id === selectedId) ?? null;
    if (!row) {
      selectedId = null;
      renderSelected();
      return;
    }

    selectedNameEl.textContent = `${row.type} (${row.id})`;
    selectedNameEl.classList.remove("muted");
    selectedDimsEl.textContent = `pos: ${Math.round(row.xMm)}×${Math.round(row.zMm)} mm`;
    dupBtn.disabled = false;
    delBtn.disabled = false;
  };

  const renderList = () => {
    list.innerHTML = "";
    for (const row of rows) {
      const item = document.createElement("div");
      item.className = "item";
      item.style.gridTemplateColumns = "1fr";

      const rowWrap = document.createElement("div");
      rowWrap.className = "row";
      rowWrap.style.gridTemplateColumns = "1fr auto";

      const label = document.createElement("button");
      label.type = "button";
      label.className = "label";
      label.textContent = `${row.type} • ${row.id}`;
      label.addEventListener("click", () => args.onSelect(row.id));

      const dims = document.createElement("div");
      dims.className = "muted";
      dims.style.fontSize = "12px";
      dims.textContent = `${Math.round(row.xMm)}×${Math.round(row.zMm)} mm`;

      rowWrap.appendChild(label);
      rowWrap.appendChild(dims);
      item.appendChild(rowWrap);
      list.appendChild(item);
    }
  };

  dupBtn.addEventListener("click", () => {
    if (!selectedId) return;
    args.onDuplicate(selectedId);
  });

  delBtn.addEventListener("click", () => {
    if (!selectedId) return;
    args.onDelete(selectedId);
  });

  return {
    setRows(next: LayoutRow[]) {
      rows = [...next];
      renderList();
      renderSelected();
    },
    setSelected(id: string | null) {
      selectedId = id;
      renderSelected();
    },
    getSelectedId() {
      return selectedId;
    }
  };
}

