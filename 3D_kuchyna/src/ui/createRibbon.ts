type RibbonTabSpec = {
  id: string;
  title: string;
  build: (panelEl: HTMLElement) => void;
};

export function createRibbon(container: HTMLElement, tabs: RibbonTabSpec[]) {
  container.innerHTML = "";

  const tabsRow = document.createElement("div");
  tabsRow.className = "ribbon-tabs";
  container.appendChild(tabsRow);

  const panelsWrap = document.createElement("div");
  panelsWrap.className = "ribbon-panels";
  container.appendChild(panelsWrap);

  const byId = new Map<
    string,
    {
      btn: HTMLButtonElement;
      panel: HTMLDivElement;
    }
  >();

  const setActive = (id: string) => {
    for (const [tabId, x] of byId) {
      const active = tabId === id;
      x.btn.classList.toggle("active", active);
      x.panel.hidden = !active;
    }
  };

  for (const t of tabs) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ribbon-tab";
    btn.textContent = t.title;
    tabsRow.appendChild(btn);

    const panel = document.createElement("div");
    panel.className = "ribbon-panel";
    panel.hidden = true;
    panelsWrap.appendChild(panel);

    t.build(panel);
    byId.set(t.id, { btn, panel });

    btn.addEventListener("click", () => setActive(t.id));
  }

  const first = tabs[0]?.id;
  if (first) setActive(first);

  return { setActive };
}

export function ribbonGroup(panelEl: HTMLElement, title: string) {
  const group = document.createElement("section");
  group.className = "ribbon-group";
  panelEl.appendChild(group);

  const t = document.createElement("div");
  t.className = "ribbon-group-title";
  t.textContent = title;
  group.appendChild(t);

  return group;
}

export function ribbonActions(groupEl: HTMLElement, cols = 3) {
  const wrap = document.createElement("div");
  wrap.className = "ribbon-group-actions";
  wrap.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 120px))`;
  groupEl.appendChild(wrap);
  return wrap;
}

export function ribbonButton(actionsEl: HTMLElement, label: string, onClick?: () => void) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ribbon-btn";
  btn.textContent = label;
  if (onClick) btn.addEventListener("click", onClick);
  actionsEl.appendChild(btn);
  return btn;
}

export function ribbonRow(groupEl: HTMLElement, label: string, inputEl: HTMLElement) {
  const row = document.createElement("div");
  row.className = "ribbon-row";
  groupEl.appendChild(row);

  const l = document.createElement("label");
  l.textContent = label;
  row.appendChild(l);
  row.appendChild(inputEl);
  return row;
}

