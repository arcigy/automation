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

## Blender pipeline (scene → JSON → .blend)

This project can export the current Three.js scene into a stable JSON format and import it headless into Blender to generate a `.blend` (optionally with a quick preview render for AI context).

### Install Blender

- Install Blender from the official website.
- Either put `blender` into your `PATH`, or set `BLENDER_PATH` to the Blender executable path.

Examples:

```bash
# Windows (PowerShell)
$env:BLENDER_PATH="C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe"

# macOS / Linux
export BLENDER_PATH="/Applications/Blender.app/Contents/MacOS/Blender"
```

### Local backend worker (required)

Blender is executed only by a local backend worker (Node/TS), not by the frontend.

Start both the worker and the Vite dev server:

```bash
npm run dev:local
```

Worker listens on `http://127.0.0.1:5191` and Vite proxies `/api/*` + `/exports/*` to it.

### 1) Export scene JSON + Blender render from the app

 - Run the app + worker: `npm run dev:local`
- Click `Export scene JSON (Blender)` in the sidebar:
  - runs Blender locally (headless) and shows a preview render directly in the sidebar
  - Blender is required (set `BLENDER_PATH` or add `blender` to `PATH`)

### 2) Convert JSON → .blend (and optional preview render)

Install new dev deps once:

```bash
npm install
```

Run Blender headless import:

```bash
# .blend only
npm run blender:from-json -- --json "C:\\path\\to\\scene.blender.v1.json" --blend exports\\scene.blend

# .blend + preview PNG (Cycles, low samples)
npm run blender:from-json -- --json "C:\\path\\to\\scene.blender.v1.json" --blend exports\\scene.blend --preview exports\\preview.png
```

Outputs (defaults / recommended):

- `exports/scene.json` (normalized JSON written by the runner)
- `exports/scene.blend`
- `exports/preview.png` (only if `--preview` is provided)

### Current limits

- Imports only `Mesh` objects with `BufferGeometry`.
- Uses only a minimal PBR material (Principled BSDF) with scalar parameters (no textures).
- Imports only the first material if a mesh has multiple materials.
- If normals/UVs are missing in Three.js, Blender will recalc normals and UVs will be skipped.
- Lighting in Blender is intentionally minimal: `SUN` + optional HDRI world (no extra lights).

## BLENDER_PATH + command details

Where to set `BLENDER_PATH`:

- Windows (PowerShell): `$env:BLENDER_PATH="C:\\Program Files\\Blender Foundation\\Blender 4.x\\blender.exe"`
- Or set it as a system/user environment variable in Windows settings.

Exact command executed by the backend worker:

```text
BLENDER_PATH(or blender) --background --python scripts/blender/import_scene.py -- exports/scene.json exports/scene.blend exports/preview.png
```

If Blender is not found, the backend returns HTTP 500 with a clear error (no fallback).

## Next recommended step

Add a second module type (e.g. 1-door base cabinet) and a tiny “type switch” that swaps builders based on `type`.
