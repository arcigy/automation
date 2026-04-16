import type { ModuleParams } from "../model/cabinetTypes";
import { buildDrawerLow } from "./buildDrawerLow";
import { buildCornerShelfLower } from "./buildCornerShelfLower";
import { buildShelves } from "./buildShelves";

export function buildModule(p: ModuleParams) {
  if (p.type === "drawer_low") return buildDrawerLow(p);
  if (p.type === "corner_shelf_lower") return buildCornerShelfLower(p);
  return buildShelves(p);
}
