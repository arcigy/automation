import type { ModuleParams } from "../model/cabinetTypes";
import { buildDrawerLow } from "./buildDrawerLow";
import { buildCornerShelfLower } from "./buildCornerShelfLower";
import { buildShelves } from "./buildShelves";

export function buildModule(p: ModuleParams) {
  const root =
    p.type === "drawer_low" ? buildDrawerLow(p) : p.type === "corner_shelf_lower" ? buildCornerShelfLower(p) : buildShelves(p);

  root.traverse((obj) => {
    const mesh = obj as any;
    if (!mesh || !mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  return root;
}
