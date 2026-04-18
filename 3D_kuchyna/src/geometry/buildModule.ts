import type { ModuleParams } from "../model/cabinetTypes";
import { buildDrawerLow } from "./buildDrawerLow";
import { buildCornerShelfLower } from "./buildCornerShelfLower";
import { buildShelves } from "./buildShelves";
import { buildFridgeTall } from "./buildFridgeTall";
import { buildNestedDrawerLow } from "./buildNestedDrawerLow";
import { buildFlapShelvesLow } from "./buildFlapShelvesLow";
import { buildSwingShelvesLow } from "./buildSwingShelvesLow";
import { buildOvenBaseLow } from "./buildOvenBaseLow";
import { buildMicrowaveOvenTall } from "./buildMicrowaveOvenTall";
import { buildTopDrawersDoorsLow } from "./buildTopDrawersDoorsLow";

export function buildModule(p: ModuleParams) {
  let root;
  switch (p.type) {
    case "drawer_low":
      root = buildDrawerLow(p);
      break;
    case "nested_drawer_low":
      root = buildNestedDrawerLow(p);
      break;
    case "shelves":
      root = buildShelves(p);
      break;
    case "corner_shelf_lower":
      root = buildCornerShelfLower(p);
      break;
    case "fridge_tall":
      root = buildFridgeTall(p);
      break;
    case "flap_shelves_low":
      root = buildFlapShelvesLow(p);
      break;
    case "swing_shelves_low":
      root = buildSwingShelvesLow(p);
      break;
    case "oven_base_low":
      root = buildOvenBaseLow(p);
      break;
    case "microwave_oven_tall":
      root = buildMicrowaveOvenTall(p);
      break;
    case "top_drawers_doors_low":
      root = buildTopDrawersDoorsLow(p);
      break;
    default:
      root = buildShelves(p as any);
  }

  root.traverse((obj) => {
    const mesh = obj as any;
    if (!mesh || !mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  return root;
}
