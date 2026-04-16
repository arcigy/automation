# Parametric 3D Drawer Cabinet (Prototype)

Minimal Vite + TypeScript + Three.js app that builds **one module at a time** from a JSON object and rebuilds geometry on parameter edits.

## Install / run

```bash
npm install
npm run dev
```

Open the printed local URL.

## Models

- `drawer_low` (drawer fronts + internal drawer boxes + rails)
- `shelves` (internal shelves; no fronts/drawers/rails)
- `corner_shelf_lower` (L-shaped corner base with shelves + doors)

Switch via the **Model** dropdown in the sidebar.

## What you can edit

Right sidebar (depends on model):

- width / height / depth
- boardThickness / backThickness
- plinthHeight
- frontGap
- drawerCount / drawerFrontHeights (drawer_low)
- shelfCount / shelfThickness (shelves)

Buttons:

- Reset to defaults
- Export current JSON (also attempts to copy to clipboard)

## Notes / limitations

- Boxes only (no joinery, rails, chamfers, hardware).
- Drawer boxes are simple solid blocks with basic clearances.
- Units are mm in the UI/JSON; converted to meters for rendering.

## Next recommended step

Add a second module type (e.g. 1-door base cabinet) and a tiny “type switch” that swaps builders based on `type`.
