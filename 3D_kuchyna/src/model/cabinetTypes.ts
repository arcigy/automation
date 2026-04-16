export type MaterialParams = {
  bodyKey: string; // later: pricing lookup key
  frontKey: string; // later: pricing lookup key
  drawerKey: string; // later: pricing lookup key
  bodyColor: string; // "#RRGGBB"
  frontColor: string; // "#RRGGBB"
  drawerColor: string; // "#RRGGBB"
};

type ShelfLayoutParams = {
  shelfCount: number; // compartments
  shelfThickness: number; // mm
  shelfAutoFit: boolean;
  shelfGaps: number[]; // mm (count = shelfCount)
  height: number; // mm
  plinthHeight: number; // mm
  boardThickness: number; // mm
};

export type DrawerLowParams = {
  type: "drawer_low";
  width: number; // mm
  height: number; // mm
  depth: number; // mm
  boardThickness: number; // mm
  backThickness: number; // mm
  plinthHeight: number; // mm
  frontGap: number; // mm (vertical gap between fronts)
  sideGap: number; // mm (left/right reveal)
  topGap: number; // mm (top reveal)
  bottomGap: number; // mm (bottom reveal above plinth)
  drawerBoxThickness: number; // mm (drawer sides/back/bottom thickness)
  drawerBoxSideHeight: number; // mm (drawer side/back panel height)
  drawerCount: number;
  drawerFrontHeights: number[]; // mm
  materials: MaterialParams;
};

export type ShelvesParams = {
  type: "shelves";
  width: number; // mm
  height: number; // mm
  depth: number; // mm
  boardThickness: number; // mm
  backThickness: number; // mm
  plinthHeight: number; // mm
  shelfCount: number; // compartments (clear spaces); internal shelves = shelfCount - 1
  shelfThickness: number; // mm
  shelfAutoFit: boolean; // when true, shelfGaps is recomputed to equal spacing
  shelfGaps: number[]; // mm clear gaps between boards (count = shelfCount)
  doorDouble: boolean; // false = single door, true = double door
  doorOpen: boolean; // simple preview state
  hingeCountPerDoor: number; // usually 2 or 3
  materials: MaterialParams;
};

export type CornerShelfLowerParams = {
  type: "corner_shelf_lower";
  lengthX: number; // mm (run length in X)
  lengthZ: number; // mm (run length in Z)
  depth: number; // mm (common depth for both runs)
  height: number; // mm
  boardThickness: number; // mm
  backThickness: number; // mm
  plinthHeight: number; // mm
  shelfCount: number; // compartments
  shelfThickness: number; // mm
  shelfAutoFit: boolean;
  shelfGaps: number[]; // mm (count = shelfCount)
  doorDouble: boolean; // false = only one face has door, true = both faces have doors
  doorOpen: boolean;
  hingeCountPerDoor: number; // 2 or 3
  materials: MaterialParams;
};

export type ModuleParams = DrawerLowParams | ShelvesParams | CornerShelfLowerParams;

export function makeDefaultDrawerLowParams(): DrawerLowParams {
  const base: DrawerLowParams = {
    type: "drawer_low",
    width: 800,
    height: 720,
    depth: 560,
    boardThickness: 18,
    backThickness: 8,
    plinthHeight: 100,
    frontGap: 2,
    sideGap: 2,
    topGap: 2,
    bottomGap: 2,
    drawerBoxThickness: 13,
    drawerBoxSideHeight: 110,
    drawerCount: 3,
    drawerFrontHeights: [],
    materials: {
      bodyKey: "carcass_default",
      frontKey: "front_default",
      drawerKey: "drawer_default",
      bodyColor: "#b8bcc7",
      frontColor: "#3a7bd5",
      drawerColor: "#e1a45a"
    }
  };
  base.drawerFrontHeights = computeEqualDrawerFrontHeights(base);
  return base;
}

export function makeDefaultShelvesParams(): ShelvesParams {
  const base: ShelvesParams = {
    type: "shelves",
    width: 800,
    height: 720,
    depth: 560,
    boardThickness: 18,
    backThickness: 8,
    plinthHeight: 100,
    shelfCount: 4,
    shelfThickness: 18,
    shelfAutoFit: true,
    shelfGaps: [],
    doorDouble: true,
    doorOpen: false,
    hingeCountPerDoor: 3,
    materials: {
      bodyKey: "carcass_default",
      frontKey: "front_unused",
      drawerKey: "drawer_unused",
      bodyColor: "#b8bcc7",
      frontColor: "#3a7bd5",
      drawerColor: "#e1a45a"
    }
  };
  base.shelfGaps = computeEqualShelfGaps(base);
  return base;
}

export function makeDefaultCornerShelfLowerParams(): CornerShelfLowerParams {
  const base: CornerShelfLowerParams = {
    type: "corner_shelf_lower",
    lengthX: 1000,
    lengthZ: 1000,
    depth: 560,
    height: 720,
    boardThickness: 18,
    backThickness: 8,
    plinthHeight: 100,
    shelfCount: 4,
    shelfThickness: 18,
    shelfAutoFit: true,
    shelfGaps: [],
    doorDouble: true,
    doorOpen: false,
    hingeCountPerDoor: 3,
    materials: {
      bodyKey: "carcass_default",
      frontKey: "front_default",
      drawerKey: "drawer_unused",
      bodyColor: "#b8bcc7",
      frontColor: "#3a7bd5",
      drawerColor: "#e1a45a"
    }
  };
  base.shelfGaps = computeEqualShelfGaps(base);
  return base;
}

export function validateModule(p: ModuleParams): string[] {
  if (p.type === "drawer_low") return validateDrawerLow(p);
  if (p.type === "shelves") return validateShelves(p);
  if (p.type === "corner_shelf_lower") return validateCornerShelfLower(p);
  return ["Unknown module type."];
}

export function validateDrawerLow(p: DrawerLowParams): string[] {
  const errors: string[] = [];

  positiveNumber(errors, "width", p.width, 200);
  positiveNumber(errors, "height", p.height, 200);
  positiveNumber(errors, "depth", p.depth, 200);
  positiveNumber(errors, "boardThickness", p.boardThickness, 5);
  positiveNumber(errors, "backThickness", p.backThickness, 3);
  positiveNumber(errors, "plinthHeight", p.plinthHeight, 0);
  positiveNumber(errors, "frontGap", p.frontGap, 0);
  positiveNumber(errors, "sideGap", p.sideGap, 0);
  positiveNumber(errors, "topGap", p.topGap, 0);
  positiveNumber(errors, "bottomGap", p.bottomGap, 0);
  positiveNumber(errors, "drawerBoxThickness", p.drawerBoxThickness, 5);
  positiveNumber(errors, "drawerBoxSideHeight", p.drawerBoxSideHeight, 30);

  if (!Number.isInteger(p.drawerCount) || p.drawerCount < 1 || p.drawerCount > 8) {
    errors.push("drawerCount must be an integer between 1 and 8.");
  }

  if (!Array.isArray(p.drawerFrontHeights) || p.drawerFrontHeights.some((n) => typeof n !== "number")) {
    errors.push("drawerFrontHeights must be an array of numbers.");
  } else {
    if (p.drawerFrontHeights.length !== p.drawerCount) {
      errors.push("drawerFrontHeights count must match drawerCount.");
    }
    if (p.drawerFrontHeights.some((h) => !Number.isFinite(h) || h <= 20)) {
      errors.push("drawerFrontHeights values must be > 20.");
    }
  }

  const internalWidth = p.width - 2 * p.boardThickness;
  if (internalWidth <= 50) errors.push("Width too small for boardThickness (internal width <= 50mm).");

  const openingHeight = p.height - p.plinthHeight;
  if (openingHeight <= 80) errors.push("height - plinthHeight must be > 80mm.");

  const requiredFrontStack =
    p.topGap +
    p.bottomGap +
    p.drawerFrontHeights.reduce((a, b) => a + b, 0) +
    Math.max(0, p.drawerCount - 1) * p.frontGap;
  if (requiredFrontStack > openingHeight) {
    errors.push(
      `Drawer fronts do not fit: need ${Math.round(requiredFrontStack)}mm, have ${Math.round(openingHeight)}mm.`
    );
  }

  if (p.backThickness >= p.depth) errors.push("backThickness must be smaller than depth.");
  if (p.drawerBoxThickness >= p.boardThickness) errors.push("drawerBoxThickness should be smaller than boardThickness.");

  const minFront = p.drawerFrontHeights.length > 0 ? Math.min(...p.drawerFrontHeights) : 0;
  const drawerClearTopBottomMm = Math.max(6, p.frontGap * 2);
  const maxDrawerSideHeight = minFront - drawerClearTopBottomMm;
  if (minFront > 0 && p.drawerBoxSideHeight > maxDrawerSideHeight) {
    errors.push(`drawerBoxSideHeight too big: max ${Math.round(maxDrawerSideHeight)}mm for current drawer fronts.`);
  }

  validateMaterials(errors, p.materials);
  return errors;
}

export function validateShelves(p: ShelvesParams): string[] {
  const errors: string[] = [];

  positiveNumber(errors, "width", p.width, 200);
  positiveNumber(errors, "height", p.height, 200);
  positiveNumber(errors, "depth", p.depth, 200);
  positiveNumber(errors, "boardThickness", p.boardThickness, 5);
  positiveNumber(errors, "backThickness", p.backThickness, 3);
  positiveNumber(errors, "plinthHeight", p.plinthHeight, 0);
  positiveNumber(errors, "shelfThickness", p.shelfThickness, 5);
  if (!Number.isInteger(p.hingeCountPerDoor) || (p.hingeCountPerDoor !== 2 && p.hingeCountPerDoor !== 3)) {
    errors.push("hingeCountPerDoor must be 2 or 3.");
  }

  if (!Number.isInteger(p.shelfCount) || p.shelfCount < 1 || p.shelfCount > 11) {
    errors.push("shelfCount must be an integer between 1 and 11.");
  }

  if (p.shelfThickness > p.boardThickness) {
    errors.push("shelfThickness should be <= boardThickness.");
  }

  const shelfCount = Math.max(1, Math.round(p.shelfCount));
  const internalShelfCount = Math.max(0, shelfCount - 1);
  const gapCount = shelfCount;
  if (!Array.isArray(p.shelfGaps) || p.shelfGaps.some((n) => typeof n !== "number")) {
    errors.push("shelfGaps must be an array of numbers.");
  } else if (p.shelfAutoFit !== true) {
    if (p.shelfGaps.length !== gapCount) {
      errors.push("shelfGaps count must match shelfCount when shelfAutoFit=false.");
    }
  }

  // Validate gaps fit inside inner height (only when manual).
  if (p.shelfAutoFit !== true && Array.isArray(p.shelfGaps)) {
    const gaps = p.shelfGaps.slice(0, gapCount);
    if (gaps.some((g) => !Number.isFinite(g) || g < 0)) errors.push("shelfGaps values must be >= 0.");

    const openingHeight = p.height - p.plinthHeight;
    const innerHeight = openingHeight - 2 * p.boardThickness; // mm
    const used = internalShelfCount * p.shelfThickness + gaps.reduce((a, b) => a + b, 0);
    if (used > innerHeight + 0.001) {
      errors.push(`Shelves do not fit: need ${Math.round(used)}mm, have ${Math.round(innerHeight)}mm (inner height).`);
    }
  }

  if (p.backThickness >= p.depth) errors.push("backThickness must be smaller than depth.");
  validateMaterials(errors, p.materials);
  return errors;
}

export function computeEqualDrawerFrontHeights(p: DrawerLowParams): number[] {
  const drawerCount = Math.max(1, Math.round(p.drawerCount));
  const openingHeight = p.height - p.plinthHeight;
  const available = openingHeight - p.topGap - p.bottomGap - Math.max(0, drawerCount - 1) * p.frontGap;

  if (!Number.isFinite(available) || available <= 0) {
    return Array.from({ length: drawerCount }, () => 200);
  }

  const base = Math.floor(available / drawerCount);
  const remainder = Math.round(available - base * drawerCount);

  const out: number[] = [];
  for (let i = 0; i < drawerCount; i++) out.push(base + (i < remainder ? 1 : 0));
  return out;
}

export function validateCornerShelfLower(p: CornerShelfLowerParams): string[] {
  const errors: string[] = [];

  positiveNumber(errors, "lengthX", p.lengthX, 400);
  positiveNumber(errors, "lengthZ", p.lengthZ, 400);
  positiveNumber(errors, "depth", p.depth, 300);
  positiveNumber(errors, "height", p.height, 200);
  positiveNumber(errors, "boardThickness", p.boardThickness, 5);
  positiveNumber(errors, "backThickness", p.backThickness, 3);
  positiveNumber(errors, "plinthHeight", p.plinthHeight, 0);
  positiveNumber(errors, "shelfThickness", p.shelfThickness, 5);

  if (!Number.isInteger(p.hingeCountPerDoor) || (p.hingeCountPerDoor !== 2 && p.hingeCountPerDoor !== 3)) {
    errors.push("hingeCountPerDoor must be 2 or 3.");
  }

  if (p.shelfThickness > p.boardThickness) errors.push("shelfThickness should be <= boardThickness.");
  if (p.backThickness >= p.depth) errors.push("backThickness must be smaller than depth.");

  validateShelfLayout(errors, p);
  validateMaterials(errors, p.materials);
  return errors;
}

export function computeEqualShelfGaps(p: ShelfLayoutParams): number[] {
  const shelfCount = Math.max(1, Math.round(p.shelfCount));
  const internalShelfCount = Math.max(0, shelfCount - 1);
  const gapCount = shelfCount;

  // Inner height between bottom panel top and top panel bottom (mm).
  const openingHeight = p.height - p.plinthHeight;
  const innerHeight = openingHeight - 2 * p.boardThickness;
  const free = innerHeight - internalShelfCount * p.shelfThickness;
  if (!Number.isFinite(free) || free <= 0) {
    return Array.from({ length: gapCount }, () => 0);
  }

  const gap = free / gapCount;

  // Keep gaps identical (the user explicitly wants them equal).
  return Array.from({ length: gapCount }, () => roundMm1(gap));
}

export function computeShelfHeightsFromGaps(p: ShelfLayoutParams): number[] {
  const shelfCount = Math.max(1, Math.round(p.shelfCount));
  const internalShelfCount = Math.max(0, shelfCount - 1);
  const gapCount = shelfCount;
  const gaps = (p.shelfGaps.length === gapCount ? p.shelfGaps : computeEqualShelfGaps(p)).slice(0, gapCount);

  const heights: number[] = [];
  let cursor = gaps[0] + p.shelfThickness / 2; // center of shelf_1
  for (let i = 0; i < internalShelfCount; i++) {
    heights.push(roundMm1(cursor));
    cursor += p.shelfThickness + (gaps[i + 1] ?? 0);
  }
  return heights;
}

function roundMm1(n: number) {
  // 0.1mm keeps values stable but still "equal".
  return Math.round(n * 10) / 10;
}

function positiveNumber(errors: string[], label: string, value: unknown, min: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    errors.push(`${label} must be a number.`);
    return;
  }
  if (value < min) errors.push(`${label} must be >= ${min}.`);
}

function validateShelfLayout(errors: string[], p: ShelfLayoutParams) {
  const shelfCount = Math.max(1, Math.round(p.shelfCount));
  const internalShelfCount = Math.max(0, shelfCount - 1);
  const gapCount = shelfCount;

  if (!Array.isArray(p.shelfGaps) || p.shelfGaps.some((n) => typeof n !== "number")) {
    errors.push("shelfGaps must be an array of numbers.");
    return;
  }

  if (p.shelfAutoFit !== true && p.shelfGaps.length !== gapCount) {
    errors.push("shelfGaps count must match shelfCount when shelfAutoFit=false.");
  }

  if (p.shelfAutoFit !== true) {
    const gaps = p.shelfGaps.slice(0, gapCount);
    if (gaps.some((g) => !Number.isFinite(g) || g < 0)) errors.push("shelfGaps values must be >= 0.");

    const openingHeight = p.height - p.plinthHeight;
    const innerHeight = openingHeight - 2 * p.boardThickness; // mm
    const used = internalShelfCount * p.shelfThickness + gaps.reduce((a, b) => a + b, 0);
    if (used > innerHeight + 0.001) {
      errors.push(`Shelves do not fit: need ${Math.round(used)}mm, have ${Math.round(innerHeight)}mm (inner height).`);
    }
  }
}

function validateMaterials(errors: string[], m: unknown) {
  if (!m || typeof m !== "object") {
    errors.push("materials must be an object.");
    return;
  }

  const mat = m as Partial<MaterialParams>;
  validateMaterialKey(errors, "materials.bodyKey", mat.bodyKey);
  validateMaterialKey(errors, "materials.frontKey", mat.frontKey);
  validateMaterialKey(errors, "materials.drawerKey", mat.drawerKey);
  validateHexColor(errors, "materials.bodyColor", mat.bodyColor);
  validateHexColor(errors, "materials.frontColor", mat.frontColor);
  validateHexColor(errors, "materials.drawerColor", mat.drawerColor);
}

function validateHexColor(errors: string[], label: string, value: unknown) {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    errors.push(`${label} must be a hex color like #RRGGBB.`);
  }
}

function validateMaterialKey(errors: string[], label: string, value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${label} is required.`);
    return;
  }
  if (value.length > 80) errors.push(`${label} must be <= 80 characters.`);
}
