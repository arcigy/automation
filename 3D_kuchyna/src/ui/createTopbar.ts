type ToolButtonArgs = {
  title: string;
  iconSvg: string;
  onClick?: () => void;
};

type PanelButtonArgs = ToolButtonArgs & {
  buildPanel: (panelEl: HTMLElement, close: () => void) => void;
};

export function createTopbar(container: HTMLElement) {
  container.innerHTML = "";
  container.style.position = "relative";

  const row = document.createElement("div");
  row.className = "topbar";
  container.appendChild(row);

  const panelsHost = document.createElement("div");
  panelsHost.className = "topbar-panels-host";
  container.appendChild(panelsHost);

  let openPanelEl: HTMLDivElement | null = null;
  let openOwnerBtn: HTMLButtonElement | null = null;

  const closePanels = () => {
    if (openPanelEl) openPanelEl.hidden = true;
    if (openOwnerBtn) openOwnerBtn.classList.remove("active");
    openPanelEl = null;
    openOwnerBtn = null;
  };

  const onDocPointerDown = (ev: PointerEvent) => {
    if (!openPanelEl) return;
    const t = ev.target as Node | null;
    if (!t) return;
    if (openPanelEl.contains(t)) return;
    if (openOwnerBtn && openOwnerBtn.contains(t)) return;
    closePanels();
  };

  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") closePanels();
  };

  window.addEventListener("pointerdown", onDocPointerDown);
  window.addEventListener("keydown", onKeyDown);

  const addGroup = (title?: string) => {
    const g = document.createElement("div");
    g.className = "topbar-group";
    row.appendChild(g);

    if (title) {
      const t = document.createElement("div");
      t.className = "topbar-group-title";
      t.textContent = title;
      g.appendChild(t);
    }

    const tools = document.createElement("div");
    tools.className = "topbar-tools";
    g.appendChild(tools);
    return tools;
  };

  const toolButton = (toolsEl: HTMLElement, args: ToolButtonArgs) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tool-btn";
    btn.title = args.title;
    btn.setAttribute("aria-label", args.title);

    const icon = document.createElement("div");
    icon.className = "tool-icon";
    icon.innerHTML = args.iconSvg;
    btn.appendChild(icon);

    if (args.onClick) btn.addEventListener("click", args.onClick);
    toolsEl.appendChild(btn);
    return btn;
  };

  const panelButton = (toolsEl: HTMLElement, args: PanelButtonArgs) => {
    const panel = document.createElement("div");
    panel.className = "topbar-panel";
    panel.hidden = true;
    panelsHost.appendChild(panel);

    const btn = toolButton(toolsEl, {
      title: args.title,
      iconSvg: args.iconSvg,
      onClick: () => {
        if (openPanelEl === panel) {
          closePanels();
          return;
        }

        closePanels();
        panel.innerHTML = "";
        args.buildPanel(panel, closePanels);
        panel.hidden = false;
        btn.classList.add("active");
        openPanelEl = panel;
        openOwnerBtn = btn;

        const b = btn.getBoundingClientRect();
        const c = container.getBoundingClientRect();
        const left = Math.max(8, Math.min(c.width - 320, b.left - c.left));
        panel.style.left = `${left}px`;
      }
    });

    return { btn, panel };
  };

  return { addGroup, toolButton, panelButton, closePanels };
}

