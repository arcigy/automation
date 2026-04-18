export type MaterialParams = {
  bodyKey: string; // later: pricing lookup key
  frontKey: string; // later: pricing lookup key
  drawerKey: string; // later: pricing lookup key
  bodyName?: string; // optional human-readable name (e.g. "Egger U999 ST2 18mm")
  frontName?: string;
  drawerName?: string;
  bodyColor: string; // "#RRGGBB"
  frontColor: string; // "#RRGGBB"
  drawerColor: string; // "#RRGGBB"
  bodyPbr?: {
    id: "wood_veneer_oak_7760_1k";
    rotationDeg?: 0 | 90 | 180 | 270;
    tintColor?: string;
    tintStrength?: number;
  };
  frontPbr?: {
    id: "wood_veneer_oak_7760_1k";
    rotationDeg?: 0 | 90 | 180 | 270;
    tintColor?: string;
    tintStrength?: number;
  };
  drawerPbr?: {
    id: "wood_veneer_oak_7760_1k";
    rotationDeg?: 0 | 90 | 180 | 270;
    tintColor?: string;
    tintStrength?: number;
  };
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
  plinthSetbackMm: number; // mm (kickboard setback from cabinet front)
  frontGap: number; // mm (vertical gap between fronts)
  sideGap: number; // mm (left/right reveal)
  topGap: number; // mm (top reveal)
  bottomGap: number; // mm (bottom reveal above plinth)
  sideClearanceMm: number; // mm (hardware clearance per side)
  frontThicknessMm: number; // mm (front thickness can differ from carcass)
  frontStackPreset: "equal" | "top_small" | "manual";
  topFrontHeightMm: number; // mm (used when frontStackPreset=top_small)
  handleType: "none" | "bar" | "knob" | "cup" | "gola";
  handlePositionMm: number; // mm from top edge of each front
  handleLengthMm: number; // mm
  handleSizeMm: number; // mm
  handleProjectionMm: number; // mm
  drawerBoxThickness: number; // mm (drawer sides/back/bottom thickness)
  drawerBoxSideHeight: number; // mm (drawer side/back panel height)
  drawerCount: number;
  drawerFrontHeights: number[]; // mm
  materials: MaterialParams;
};

export type NestedDrawerLowParams = {
  type: "nested_drawer_low";
  width: number; // mm
  height: number; // mm
  depth: number; // mm
  boardThickness: number; // mm
  backThickness: number; // mm
  plinthHeight: number; // mm
  plinthSetbackMm: number; // mm
  frontGap: number; // mm
  sideGap: number; // mm
  topGap: number; // mm
  bottomGap: number; // mm
  sideClearanceMm: number; // mm
  frontThicknessMm: number; // mm
  frontStackPreset: "equal" | "top_small" | "manual";
  topFrontHeightMm: number; // mm
  handleType: "none" | "bar" | "knob" | "cup" | "gola";
  handlePositionMm: number; // mm
  handleLengthMm: number; // mm
  handleSizeMm: number; // mm
  handleProjectionMm: number; // mm
  drawerBoxThickness: number; // mm
  drawerBoxSideHeight: number; // mm

  drawerCount: number;
  drawerFrontHeights: number[]; // mm

  innerDrawerDepth: number; // mm
  innerDrawerSideHeight: number; // mm

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
  plinthSetbackMm: number; // mm (kickboard setback from cabinet front)
  wallMounted: boolean; // true = no legs/kickboard

  // Door/front sizing (same semantics as drawer_low reveals)
  frontGap: number; // mm (center gap between doors when doorDouble=true)
  sideGap: number; // mm (left/right reveal)
  topGap: number; // mm (top reveal)
  bottomGap: number; // mm (bottom reveal above plinth)
  frontThicknessMm: number; // mm

  // Handles (same contract as drawer_low)
  handleType: "none" | "bar" | "knob" | "cup" | "gola";
  handlePositionMm: number; // mm from top edge of each door
  handleLengthMm: number; // mm
  handleSizeMm: number; // mm
  handleProjectionMm: number; // mm

  shelfCount: number; // compartments (clear spaces); internal shelves = shelfCount - 1
  shelfThickness: number; // mm
  shelfAutoFit: boolean; // when true, shelfGaps is recomputed to equal spacing
  shelfGaps: number[]; // mm clear gaps between boards (count = shelfCount)
  doorDouble: boolean; // false = single door, true = double door
  doorOpen: boolean; // simple preview state
  hingeSide: "left" | "right"; // used when doorDouble=false
  hingeCountPerDoor: number; // usually 2 or 3
  hingeTopOffsetMm: number; // mm from top edge of door to top hinge center
  hingeBottomOffsetMm: number; // mm from bottom edge of door to bottom hinge center
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
  plinthSetbackMm: number; // mm (kickboard setback from cabinet front)
  shelfCount: number; // compartments
  shelfThickness: number; // mm
  shelfAutoFit: boolean;
  shelfGaps: number[]; // mm (count = shelfCount)
  doorDouble: boolean; // false = only one face has door, true = both faces have doors
  doorOpen: boolean;
  // Hinge side (which edge is hinged) on each face:
  // - Z face spans along X => "left/right" makes sense
  // - X face spans along Z => still use "left/right" (mapped to start/end Z in geometry)
  hingeSideFrontZ: "left" | "right";
  hingeSideFrontX: "left" | "right";
  hingeCountPerDoor: number; // 2 or 3
  hingeTopOffsetMm: number; // mm from top edge of door to top hinge center
  hingeBottomOffsetMm: number; // mm from bottom edge of door to bottom hinge center
  materials: MaterialParams;
};

export type FridgeTallParams = {
  type: "fridge_tall";
  width: number; // mm
  height: number; // mm
  depth: number; // mm
  boardThickness: number; // mm
  backThickness: number; // mm
  plinthHeight: number; // mm
  plinthSetbackMm: number; // mm

  frontGap: number; // mm
  sideGap: number; // mm
  topGap: number; // mm
  bottomGap: number; // mm
  frontThicknessMm: number; // mm
  drawerCount: number; // 0..6
  drawerFrontHeights: number[]; // mm (count=drawerCount)

  handleType: "none" | "bar" | "knob" | "cup" | "gola";
  handlePositionMm: number; // mm
  handleLengthMm: number; // mm
  handleSizeMm: number; // mm
  handleProjectionMm: number; // mm

  fridgeWidthMm: number; // mm
  fridgeHeightMm: number; // mm
  fridgeDepthMm: number; // mm
  fridgeSideClearanceMm: number;
  fridgeTopClearanceMm: number;
  fridgeBottomClearanceMm: number;

  gapAboveDrawersMm: number; // mm

  freezerDoorHeightMm: number; // mm
  fridgeDoorGapMm: number; // mm
  doorHandleOffsetFromSplitMm: number; // mm

  materials: MaterialParams;
};

export type FlapShelvesLowParams = {
  type: "flap_shelves_low";
  width: number; // mm
  height: number; // mm
  depth: number; // mm
  boardThickness: number; // mm
  backThickness: number; // mm
  plinthHeight: number; // mm
  plinthSetbackMm: number; // mm (kickboard setback from cabinet front)
  wallMounted: boolean; // true = no legs/kickboard
  // Reveal around the front flap (same semantics as drawer_low reveals)
  sideGap: number; // mm
  topGap: number; // mm
  bottomGap: number; // mm
  // Kept for "drawer_low-like" parameter parity, even though flap is a single front.
  frontGap: number; // mm

  // Door/flap preview state
  flapOpen: boolean;
  flapHinge: "bottom" | "top";
  hingeCount: number;
  hingeInsetFromSideMm: number; // mm

  // Shelf layout (same as shelves)
  shelfCount: number; // compartments (clear spaces); internal shelves = shelfCount - 1
  shelfThickness: number; // mm
  shelfAutoFit: boolean;
  shelfGaps: number[]; // mm (count = shelfCount)

  materials: MaterialParams;
};

export type SwingShelvesLowParams = {
  type: "swing_shelves_low";
  width: number; // mm
  height: number; // mm
  depth: number; // mm
  boardThickness: number; // mm
  backThickness: number; // mm
  plinthHeight: number; // mm
  plinthSetbackMm: number; // mm (kickboard setback from cabinet front)
  wallMounted: boolean; // true = no legs/kickboard

  // Reveal around the front doors (same semantics as drawer_low reveals)
  sideGap: number; // mm
  topGap: number; // mm
  bottomGap: number; // mm
  // Kept for "drawer_low-like" parameter parity; used as the center gap between doors when doorDouble=true.
  frontGap: number; // mm

  // Door preview state
  doorDouble: boolean; // false = single door, true = double door
  doorOpen: boolean;
  hingeSide: "left" | "right"; // used when doorDouble=false
  hingeCountPerDoor: number;
  hingeTopOffsetMm: number; // mm
  hingeBottomOffsetMm: number; // mm

  // Shelf layout
  shelfCount: number; // compartments (clear spaces); internal shelves = shelfCount - 1
  shelfThickness: number; // mm
  shelfAutoFit: boolean;
  shelfGaps: number[]; // mm (count = shelfCount)

  materials: MaterialParams;
};

export type TopDrawersDoorsLowParams = {
  type: "top_drawers_doors_low";
  width: number; // mm
  height: number; // mm
  depth: number; // mm
  boardThickness: number; // mm
  backThickness: number; // mm
  plinthHeight: number; // mm
  plinthSetbackMm: number; // mm (kickboard setback from cabinet front)
  wallMounted: boolean; // true = no legs/kickboard

  // Front layout
  topDrawerCount: number; // typically 3
  bottomDoorCount: number; // typically 3
  columnGapMm: number; // mm gap between columns (drawer/door fronts)
  rowGapMm: number; // mm gap between top drawer row and bottom door row
  topDrawerFrontHeightMm: number; // mm

  // Reveals and front thickness
  sideGap: number; // mm (left/right reveal)
  topGap: number; // mm (top reveal above top drawers)
  bottomGap: number; // mm (bottom reveal above plinth)
  frontThicknessMm: number; // mm

  // Door preview state
  doorOpen: boolean;
  hingeSide: "left" | "right";
  hingeCountPerDoor: number;
  hingeTopOffsetMm: number; // mm
  hingeBottomOffsetMm: number; // mm

  // Handles (same contract as drawer_low)
  handleType: "none" | "bar" | "knob" | "cup" | "gola";
  handlePositionMm: number; // mm from top edge of each front (drawer/door)
  handleLengthMm: number; // mm
  handleSizeMm: number; // mm
  handleProjectionMm: number; // mm

  // Drawer hardware (for the top drawers)
  sideClearanceMm: number; // mm (hardware clearance per side)
  drawerBoxThickness: number; // mm (metal side/back thickness)
  drawerBoxSideHeight: number; // mm (metal side/back height)

  // Shelves behind doors (per column)
  shelfCount: number; // compartments (clear spaces); internal shelves = shelfCount - 1
  shelfThickness: number; // mm
  shelfAutoFit: boolean;
  shelfGaps: number[]; // mm (count = shelfCount)

  materials: MaterialParams;
};

export type OvenBaseLowParams = {
  type: "oven_base_low";
  width: number; // mm
  height: number; // mm
  depth: number; // mm
  boardThickness: number; // mm
  backThickness: number; // mm
  plinthHeight: number; // mm
  plinthSetbackMm: number; // mm (kickboard setback from cabinet front)
  wallMounted: boolean; // true = no legs/kickboard

  // Bottom drawer (typical under-oven drawer)
  drawerEnabled: boolean;
  drawerFrontHeightMm: number; // mm
  drawerGapAboveMm: number; // mm
  sideGap: number; // mm (left/right reveal)
  bottomGap: number; // mm (reveal above plinth)
  frontThicknessMm: number; // mm

  // Handles (same contract as drawer_low)
  handleType: "none" | "bar" | "knob" | "cup" | "gola";
  handlePositionMm: number; // mm
  handleLengthMm: number; // mm
  handleSizeMm: number; // mm
  handleProjectionMm: number; // mm

  // Drawer hardware (modern: metal sides/back)
  sideClearanceMm: number; // mm
  drawerBoxThickness: number; // mm
  drawerBoxSideHeight: number; // mm
  drawerBoxDepthMm: number; // mm

  // Oven appliance sizing + clearances
  ovenWidthMm: number; // mm
  ovenHeightMm: number; // mm
  ovenDepthMm: number; // mm
  ovenSideClearanceMm: number; // mm
  ovenTopClearanceMm: number; // mm
  ovenBottomClearanceMm: number; // mm

  materials: MaterialParams;
};

export type MicrowaveOvenTallParams = {
  type: "microwave_oven_tall";
  width: number; // mm
  height: number; // mm
  depth: number; // mm
  boardThickness: number; // mm
  backThickness: number; // mm
  plinthHeight: number; // mm
  plinthSetbackMm: number; // mm

  // Bottom drawers (typical: 2)
  frontGap: number; // mm (vertical gap between drawer fronts)
  sideGap: number; // mm (left/right reveal)
  topGap: number; // mm (reveal above top door)
  bottomGap: number; // mm (bottom reveal above plinth)
  frontThicknessMm: number; // mm
  drawerCount: number;
  drawerFrontHeights: number[]; // mm (count=drawerCount)

  // Handles (same contract as drawer_low)
  handleType: "none" | "bar" | "knob" | "cup" | "gola";
  handlePositionMm: number; // mm
  handleLengthMm: number; // mm
  handleSizeMm: number; // mm
  handleProjectionMm: number; // mm

  // Appliance niches (fit + dummy visuals)
  ovenWidthMm: number; // niche width (mm)
  ovenHeightMm: number; // niche height (mm)
  ovenDepthMm: number; // niche depth (mm)
  ovenSideClearanceMm: number;
  ovenTopClearanceMm: number;
  ovenBottomClearanceMm: number;

  microwaveWidthMm: number; // niche width (mm)
  microwaveHeightMm: number; // niche height (mm)
  microwaveDepthMm: number; // niche depth (mm)
  microwaveSideClearanceMm: number;
  microwaveTopClearanceMm: number;
  microwaveBottomClearanceMm: number;

  // Vertical spacing
  gapAboveDrawersMm: number; // mm
  gapBetweenAppliancesMm: number; // mm

  // Top cabinet (fills the rest so there is no empty void)
  topShelfCount: number; // compartments
  topShelfThickness: number; // mm
  topFlapOpen: boolean;
  topHingeCount: number; // count along the top edge
  topHingeInsetFromSideMm: number; // mm

  materials: MaterialParams;
};

export type ModuleParams =
  | DrawerLowParams
  | NestedDrawerLowParams
  | ShelvesParams
  | CornerShelfLowerParams
  | FridgeTallParams
  | FlapShelvesLowParams
  | SwingShelvesLowParams
  | OvenBaseLowParams
  | MicrowaveOvenTallParams
  | TopDrawersDoorsLowParams;

export function makeDefaultDrawerLowParams(): DrawerLowParams {
  const base: DrawerLowParams = {
    type: "drawer_low",
    width: 800,
    height: 720,
    depth: 560,
    boardThickness: 18,
    backThickness: 8,
    plinthHeight: 100,
    plinthSetbackMm: 60,
    frontGap: 2,
    sideGap: 2,
    topGap: 2,
    bottomGap: 2,
    sideClearanceMm: 13,
    frontThicknessMm: 19,
    frontStackPreset: "equal",
    topFrontHeightMm: 160,
    handleType: "none",
    handlePositionMm: 60,
    handleLengthMm: 160,
    handleSizeMm: 12,
    handleProjectionMm: 14,
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
      drawerColor: "#e1a45a",
      bodyPbr: { id: "wood_veneer_oak_7760_1k", rotationDeg: 0, tintStrength: 0 }
    }
  };
  base.drawerFrontHeights = computeEqualDrawerFrontHeights(base);
  return base;
}

export function makeDefaultNestedDrawerLowParams(): NestedDrawerLowParams {
  const base: NestedDrawerLowParams = {
    type: "nested_drawer_low",
    width: 800,
    height: 720,
    depth: 560,
    boardThickness: 18,
    backThickness: 8,
    plinthHeight: 100,
    plinthSetbackMm: 60,
    frontGap: 2,
    sideGap: 2,
    topGap: 2,
    bottomGap: 2,
    sideClearanceMm: 13,
    frontThicknessMm: 19,
    frontStackPreset: "equal",
    topFrontHeightMm: 160,
    handleType: "none",
    handlePositionMm: 60,
    handleLengthMm: 160,
    handleSizeMm: 12,
    handleProjectionMm: 14,
    drawerBoxThickness: 13,
    drawerBoxSideHeight: 110,
    drawerCount: 3,
    drawerFrontHeights: [],
    innerDrawerDepth: 250,
    innerDrawerSideHeight: 55,
    materials: {
      bodyKey: "carcass_default",
      frontKey: "front_default",
      drawerKey: "drawer_default",
      bodyColor: "#b8bcc7",
      frontColor: "#3a7bd5",
      drawerColor: "#e1a45a",
      bodyPbr: { id: "wood_veneer_oak_7760_1k", rotationDeg: 0, tintStrength: 0 }
    }
  };
  base.drawerFrontHeights = computeEqualNestedDrawerFrontHeights(base);
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
    plinthSetbackMm: 60,
    wallMounted: false,
    frontGap: 2,
    sideGap: 2,
    topGap: 2,
    bottomGap: 2,
    frontThicknessMm: 19,
    handleType: "none",
    handlePositionMm: 60,
    handleLengthMm: 160,
    handleSizeMm: 12,
    handleProjectionMm: 14,
    shelfCount: 4,
    shelfThickness: 18,
    shelfAutoFit: true,
    shelfGaps: [],
    doorDouble: true,
    doorOpen: false,
    hingeCountPerDoor: 3,
    hingeSide: "left",
    hingeTopOffsetMm: 110,
    hingeBottomOffsetMm: 110,
    materials: {
      bodyKey: "carcass_default",
      frontKey: "front_default",
      drawerKey: "drawer_unused",
      bodyColor: "#b8bcc7",
      frontColor: "#3a7bd5",
      drawerColor: "#e1a45a",
      bodyPbr: { id: "wood_veneer_oak_7760_1k", rotationDeg: 0, tintStrength: 0 }
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
    plinthSetbackMm: 60,
    shelfCount: 4,
    shelfThickness: 18,
    shelfAutoFit: true,
    shelfGaps: [],
    doorDouble: true,
    doorOpen: false,
    hingeCountPerDoor: 3,
    hingeSideFrontZ: "right",
    hingeSideFrontX: "right",
    hingeTopOffsetMm: 110,
    hingeBottomOffsetMm: 110,
    materials: {
      bodyKey: "carcass_default",
      frontKey: "front_default",
      drawerKey: "drawer_unused",
      bodyColor: "#b8bcc7",
      frontColor: "#3a7bd5",
      drawerColor: "#e1a45a",
      bodyPbr: { id: "wood_veneer_oak_7760_1k", rotationDeg: 0, tintStrength: 0 }
    }
  };
  base.shelfGaps = computeEqualShelfGaps(base);
  return base;
}

export function makeDefaultFridgeTallParams(): FridgeTallParams {
  const boardT = 18;
  const plinthH = 0;
  const fridgeH = 1770;
  const topClear = 5;
  const bottomClear = 5;
  const height = plinthH + 2 * boardT + fridgeH + topClear + bottomClear;

  const base: FridgeTallParams = {
    type: "fridge_tall",
    width: 600,
    height,
    depth: 600,
    boardThickness: boardT,
    backThickness: 8,
    plinthHeight: plinthH,
    plinthSetbackMm: 0,

    frontGap: 2,
    sideGap: 2,
    topGap: 2,
    bottomGap: 2,
    frontThicknessMm: 19,
    drawerCount: 0,
    drawerFrontHeights: [],

    handleType: "bar",
    handlePositionMm: 60,
    handleLengthMm: 160,
    handleSizeMm: 12,
    handleProjectionMm: 14,

    fridgeWidthMm: 560,
    fridgeHeightMm: fridgeH,
    fridgeDepthMm: 550,
    fridgeSideClearanceMm: 2,
    fridgeTopClearanceMm: topClear,
    fridgeBottomClearanceMm: bottomClear,

    gapAboveDrawersMm: 10,

    freezerDoorHeightMm: 700,
    fridgeDoorGapMm: 2,
    doorHandleOffsetFromSplitMm: 45,

    materials: {
      bodyKey: "carcass_default",
      frontKey: "front_default",
      drawerKey: "drawer_unused",
      bodyColor: "#b8bcc7",
      frontColor: "#3a7bd5",
      drawerColor: "#e1a45a",
      bodyPbr: { id: "wood_veneer_oak_7760_1k", rotationDeg: 0, tintStrength: 0 }
    }
  };

  return base;
}

export function makeDefaultFlapShelvesLowParams(): FlapShelvesLowParams {
  const base: FlapShelvesLowParams = {
    type: "flap_shelves_low",
    width: 800,
    height: 720,
    depth: 560,
    boardThickness: 18,
    backThickness: 8,
    plinthHeight: 0,
    plinthSetbackMm: 60,
    wallMounted: true,
    frontGap: 2,
    sideGap: 2,
    topGap: 2,
    bottomGap: 2,
    flapOpen: false,
    flapHinge: "top",
    hingeCount: 2,
    hingeInsetFromSideMm: 120,
    shelfCount: 4,
    shelfThickness: 18,
    shelfAutoFit: true,
    shelfGaps: [],
    materials: {
      bodyKey: "carcass_default",
      frontKey: "front_default",
      drawerKey: "drawer_default",
      bodyColor: "#b8bcc7",
      frontColor: "#3a7bd5",
      drawerColor: "#e1a45a"
    }
  };
  base.shelfGaps = computeEqualShelfGaps(base);
  return base;
}

export function makeDefaultSwingShelvesLowParams(): SwingShelvesLowParams {
  const base: SwingShelvesLowParams = {
    type: "swing_shelves_low",
    width: 800,
    height: 720,
    depth: 560,
    boardThickness: 18,
    backThickness: 8,
    plinthHeight: 0,
    plinthSetbackMm: 60,
    wallMounted: true,
    frontGap: 2,
    sideGap: 2,
    topGap: 2,
    bottomGap: 2,
    doorDouble: true,
    doorOpen: false,
    hingeCountPerDoor: 3,
    hingeSide: "left",
    hingeTopOffsetMm: 110,
    hingeBottomOffsetMm: 110,
    shelfCount: 4,
    shelfThickness: 18,
    shelfAutoFit: true,
    shelfGaps: [],
    materials: {
      bodyKey: "carcass_default",
      frontKey: "front_default",
      drawerKey: "drawer_default",
      bodyColor: "#b8bcc7",
      frontColor: "#3a7bd5",
      drawerColor: "#e1a45a"
    }
  };
  base.shelfGaps = computeEqualShelfGaps(base);
  return base;
}

export function makeDefaultOvenBaseLowParams(): OvenBaseLowParams {
  const base: OvenBaseLowParams = {
    type: "oven_base_low",
    width: 600,
    height: 840,
    depth: 600,
    boardThickness: 18,
    backThickness: 8,
    plinthHeight: 0,
    plinthSetbackMm: 0,
    wallMounted: false,

    drawerEnabled: true,
    drawerFrontHeightMm: 140,
    drawerGapAboveMm: 2,
    sideGap: 2,
    bottomGap: 2,
    frontThicknessMm: 19,

    handleType: "bar",
    handlePositionMm: 60,
    handleLengthMm: 160,
    handleSizeMm: 12,
    handleProjectionMm: 14,

    sideClearanceMm: 13,
    drawerBoxThickness: 13,
    drawerBoxSideHeight: 110,
    drawerBoxDepthMm: 500,

    ovenWidthMm: 560,
    ovenHeightMm: 590,
    ovenDepthMm: 550,
    ovenSideClearanceMm: 2,
    ovenTopClearanceMm: 5,
    ovenBottomClearanceMm: 5,

    materials: {
      bodyKey: "carcass_default",
      frontKey: "front_default",
      drawerKey: "drawer_default",
      bodyColor: "#b8bcc7",
      frontColor: "#3a7bd5",
      drawerColor: "#e1a45a",
      bodyPbr: { id: "wood_veneer_oak_7760_1k", rotationDeg: 0, tintStrength: 0 }
    }
  };
  return base;
}

export function makeDefaultMicrowaveOvenTallParams(): MicrowaveOvenTallParams {
  const base: MicrowaveOvenTallParams = {
    type: "microwave_oven_tall",
    width: 600,
    height: 2200,
    depth: 600,
    boardThickness: 18,
    backThickness: 8,
    plinthHeight: 0,
    plinthSetbackMm: 0,

    frontGap: 2,
    sideGap: 2,
    topGap: 2,
    bottomGap: 2,
    frontThicknessMm: 19,
    drawerCount: 2,
    drawerFrontHeights: [200, 200],

    handleType: "bar",
    handlePositionMm: 60,
    handleLengthMm: 160,
    handleSizeMm: 12,
    handleProjectionMm: 14,

    ovenWidthMm: 560,
    ovenHeightMm: 590,
    ovenDepthMm: 550,
    ovenSideClearanceMm: 2,
    ovenTopClearanceMm: 5,
    ovenBottomClearanceMm: 5,

    microwaveWidthMm: 560,
    microwaveHeightMm: 450,
    microwaveDepthMm: 550,
    microwaveSideClearanceMm: 2,
    microwaveTopClearanceMm: 5,
    microwaveBottomClearanceMm: 5,

    gapAboveDrawersMm: 10,
    gapBetweenAppliancesMm: 0,

    topShelfCount: 3,
    topShelfThickness: 18,
    topFlapOpen: false,
    topHingeCount: 2,
    topHingeInsetFromSideMm: 80,

    materials: {
      bodyKey: "carcass_default",
      frontKey: "front_default",
      drawerKey: "drawer_unused",
      bodyColor: "#b8bcc7",
      frontColor: "#3a7bd5",
      drawerColor: "#e1a45a",
      bodyPbr: { id: "wood_veneer_oak_7760_1k", rotationDeg: 0, tintStrength: 0 }
    }
  };
  return base;
}

export function makeDefaultTopDrawersDoorsLowParams(): TopDrawersDoorsLowParams {
  const base: TopDrawersDoorsLowParams = {
    type: "top_drawers_doors_low",
    width: 1200,
    height: 720,
    depth: 560,
    boardThickness: 18,
    backThickness: 8,
    plinthHeight: 100,
    plinthSetbackMm: 60,
    wallMounted: false,

    topDrawerCount: 3,
    bottomDoorCount: 3,
    columnGapMm: 2,
    rowGapMm: 2,
    topDrawerFrontHeightMm: 160,

    sideGap: 2,
    topGap: 2,
    bottomGap: 2,
    frontThicknessMm: 19,

    doorOpen: false,
    hingeSide: "left",
    hingeCountPerDoor: 3,
    hingeTopOffsetMm: 110,
    hingeBottomOffsetMm: 110,

    handleType: "bar",
    handlePositionMm: 60,
    handleLengthMm: 160,
    handleSizeMm: 12,
    handleProjectionMm: 14,

    sideClearanceMm: 13,
    drawerBoxThickness: 13,
    drawerBoxSideHeight: 110,

    shelfCount: 2,
    shelfThickness: 18,
    shelfAutoFit: true,
    shelfGaps: [],

    materials: {
      bodyKey: "carcass_default",
      frontKey: "front_default",
      drawerKey: "drawer_default",
      bodyColor: "#b8bcc7",
      frontColor: "#f3f4f6",
      drawerColor: "#f3f4f6",
      bodyPbr: { id: "wood_veneer_oak_7760_1k", rotationDeg: 0, tintStrength: 0 }
    }
  };
  base.shelfGaps = computeEqualShelfGaps({
    ...base,
    height: Math.max(50, base.height - base.topGap - base.topDrawerFrontHeightMm - base.rowGapMm)
  });
  return base;
}

export function validateModule(p: ModuleParams): string[] {
  if (p.type === "drawer_low") return validateDrawerLow(p);
  if (p.type === "nested_drawer_low") return validateNestedDrawerLow(p);
  if (p.type === "shelves") return validateShelves(p);
  if (p.type === "corner_shelf_lower") return validateCornerShelfLower(p);
  if (p.type === "fridge_tall") return validateFridgeTall(p);
  if (p.type === "flap_shelves_low") return validateFlapShelvesLow(p);
  if (p.type === "swing_shelves_low") return validateSwingShelvesLow(p);
  if (p.type === "oven_base_low") return validateOvenBaseLow(p);
  if (p.type === "microwave_oven_tall") return validateMicrowaveOvenTall(p);
  if (p.type === "top_drawers_doors_low") return validateTopDrawersDoorsLow(p);
  return ["Unknown module type."];
}

export function normalizeModuleParams(p: ModuleParams): ModuleParams {
  if (p.type === "shelves") {
    const base = makeDefaultShelvesParams();
    const next: ShelvesParams = {
      ...base,
      ...(p as any),
      materials: { ...base.materials, ...((p as any).materials ?? {}) }
    };
    if (!Array.isArray(next.shelfGaps)) next.shelfGaps = [];
    // Ensure required keys exist (backward compatible with older saved JSON)
    if (typeof next.wallMounted !== "boolean") next.wallMounted = base.wallMounted;
    if (next.hingeSide !== "left" && next.hingeSide !== "right") next.hingeSide = base.hingeSide;
    if (next.handleType !== "none" && next.handleType !== "bar" && next.handleType !== "knob" && next.handleType !== "cup" && next.handleType !== "gola") {
      next.handleType = base.handleType;
    }
    return next;
  }

  if (p.type === "corner_shelf_lower") {
    const base = makeDefaultCornerShelfLowerParams();
    const next: CornerShelfLowerParams = {
      ...base,
      ...(p as any),
      materials: { ...base.materials, ...((p as any).materials ?? {}) }
    };
    if (!Array.isArray(next.shelfGaps)) next.shelfGaps = [];
    if (next.hingeSideFrontZ !== "left" && next.hingeSideFrontZ !== "right") next.hingeSideFrontZ = base.hingeSideFrontZ;
    if (next.hingeSideFrontX !== "left" && next.hingeSideFrontX !== "right") next.hingeSideFrontX = base.hingeSideFrontX;
    return next;
  }

  // Other modules unchanged for now
  return p;
}

export function validateDrawerLow(p: DrawerLowParams): string[] {
  const errors: string[] = [];

  positiveNumber(errors, "width", p.width, 200);
  positiveNumber(errors, "height", p.height, 200);
  positiveNumber(errors, "depth", p.depth, 200);
  positiveNumber(errors, "boardThickness", p.boardThickness, 5);
  positiveNumber(errors, "backThickness", p.backThickness, 3);
  positiveNumber(errors, "plinthHeight", p.plinthHeight, 0);
  positiveNumber(errors, "plinthSetbackMm", p.plinthSetbackMm, 0);
  positiveNumber(errors, "frontGap", p.frontGap, 0);
  positiveNumber(errors, "sideGap", p.sideGap, 0);
  positiveNumber(errors, "topGap", p.topGap, 0);
  positiveNumber(errors, "bottomGap", p.bottomGap, 0);
  positiveNumber(errors, "sideClearanceMm", p.sideClearanceMm, 0);
  positiveNumber(errors, "frontThicknessMm", p.frontThicknessMm, 5);
  positiveNumber(errors, "topFrontHeightMm", p.topFrontHeightMm, 20);
  positiveNumber(errors, "handlePositionMm", p.handlePositionMm, 0);
  positiveNumber(errors, "handleLengthMm", p.handleLengthMm, 0);
  positiveNumber(errors, "handleSizeMm", p.handleSizeMm, 0);
  positiveNumber(errors, "handleProjectionMm", p.handleProjectionMm, 0);
  positiveNumber(errors, "drawerBoxThickness", p.drawerBoxThickness, 5);
  positiveNumber(errors, "drawerBoxSideHeight", p.drawerBoxSideHeight, 30);

  const validHandle =
    p.handleType === "none" || p.handleType === "bar" || p.handleType === "knob" || p.handleType === "cup" || p.handleType === "gola";
  if (!validHandle) errors.push("handleType must be one of: none, bar, knob, cup, gola.");

  const validPreset = p.frontStackPreset === "equal" || p.frontStackPreset === "top_small" || p.frontStackPreset === "manual";
  if (!validPreset) errors.push("frontStackPreset must be one of: equal, top_small, manual.");

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
  if (p.plinthSetbackMm > p.depth) errors.push("plinthSetbackMm must be <= depth.");

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

export function validateNestedDrawerLow(p: NestedDrawerLowParams): string[] {
  const errors: string[] = [];

  positiveNumber(errors, "width", p.width, 200);
  positiveNumber(errors, "height", p.height, 200);
  positiveNumber(errors, "depth", p.depth, 200);
  positiveNumber(errors, "boardThickness", p.boardThickness, 5);
  positiveNumber(errors, "backThickness", p.backThickness, 3);
  positiveNumber(errors, "plinthHeight", p.plinthHeight, 0);
  positiveNumber(errors, "plinthSetbackMm", p.plinthSetbackMm, 0);
  positiveNumber(errors, "frontGap", p.frontGap, 0);
  positiveNumber(errors, "sideGap", p.sideGap, 0);
  positiveNumber(errors, "topGap", p.topGap, 0);
  positiveNumber(errors, "bottomGap", p.bottomGap, 0);
  positiveNumber(errors, "sideClearanceMm", p.sideClearanceMm, 0);
  positiveNumber(errors, "frontThicknessMm", p.frontThicknessMm, 5);
  positiveNumber(errors, "topFrontHeightMm", p.topFrontHeightMm, 20);
  positiveNumber(errors, "handlePositionMm", p.handlePositionMm, 0);
  positiveNumber(errors, "handleLengthMm", p.handleLengthMm, 0);
  positiveNumber(errors, "handleSizeMm", p.handleSizeMm, 0);
  positiveNumber(errors, "handleProjectionMm", p.handleProjectionMm, 0);
  positiveNumber(errors, "drawerBoxThickness", p.drawerBoxThickness, 5);
  positiveNumber(errors, "drawerBoxSideHeight", p.drawerBoxSideHeight, 30);
  positiveNumber(errors, "innerDrawerDepth", p.innerDrawerDepth, 80);
  positiveNumber(errors, "innerDrawerSideHeight", p.innerDrawerSideHeight, 20);

  const validHandle =
    p.handleType === "none" || p.handleType === "bar" || p.handleType === "knob" || p.handleType === "cup" || p.handleType === "gola";
  if (!validHandle) errors.push("handleType must be one of: none, bar, knob, cup, gola.");

  const validPreset = p.frontStackPreset === "equal" || p.frontStackPreset === "top_small" || p.frontStackPreset === "manual";
  if (!validPreset) errors.push("frontStackPreset must be one of: equal, top_small, manual.");

  if (!Number.isInteger(p.drawerCount) || p.drawerCount < 2 || p.drawerCount > 8) {
    errors.push("drawerCount must be an integer between 2 and 8.");
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
  if (p.plinthSetbackMm > p.depth) errors.push("plinthSetbackMm must be <= depth.");

  const openingHeight = p.height - p.plinthHeight;
  if (openingHeight <= 80) errors.push("height - plinthHeight must be > 80mm.");

  const requiredFrontStack =
    p.topGap +
    p.bottomGap +
    (Array.isArray(p.drawerFrontHeights) ? p.drawerFrontHeights.reduce((a, b) => a + b, 0) : 0) +
    Math.max(0, p.drawerCount - 1) * p.frontGap;
  if (requiredFrontStack > openingHeight) {
    errors.push(`Drawer fronts do not fit: need ${Math.round(requiredFrontStack)}mm, have ${Math.round(openingHeight)}mm.`);
  }

  if (p.backThickness >= p.depth) errors.push("backThickness must be smaller than depth.");
  if (p.drawerBoxThickness >= p.boardThickness) errors.push("drawerBoxThickness should be smaller than boardThickness.");

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
  positiveNumber(errors, "plinthSetbackMm", p.plinthSetbackMm, 0);
  positiveNumber(errors, "frontGap", p.frontGap, 0);
  positiveNumber(errors, "sideGap", p.sideGap, 0);
  positiveNumber(errors, "topGap", p.topGap, 0);
  positiveNumber(errors, "bottomGap", p.bottomGap, 0);
  positiveNumber(errors, "frontThicknessMm", p.frontThicknessMm, 5);
  positiveNumber(errors, "handlePositionMm", p.handlePositionMm, 0);
  positiveNumber(errors, "handleLengthMm", p.handleLengthMm, 0);
  positiveNumber(errors, "handleSizeMm", p.handleSizeMm, 0);
  positiveNumber(errors, "handleProjectionMm", p.handleProjectionMm, 0);
  positiveNumber(errors, "shelfThickness", p.shelfThickness, 5);
  positiveNumber(errors, "hingeTopOffsetMm", p.hingeTopOffsetMm, 0);
  positiveNumber(errors, "hingeBottomOffsetMm", p.hingeBottomOffsetMm, 0);

  const hingeCount = typeof p.hingeCountPerDoor === "number" ? p.hingeCountPerDoor : Number(p.hingeCountPerDoor);
  if (!Number.isFinite(hingeCount) || !Number.isInteger(hingeCount) || hingeCount < 1 || hingeCount > 6) {
    errors.push("hingeCountPerDoor must be an integer 1..6.");
  }

  if (p.hingeSide !== "left" && p.hingeSide !== "right") errors.push('hingeSide must be "left" or "right".');

  const validHandle =
    p.handleType === "none" || p.handleType === "bar" || p.handleType === "knob" || p.handleType === "cup" || p.handleType === "gola";
  if (!validHandle) errors.push("handleType must be one of: none, bar, knob, cup, gola.");

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
  if (p.plinthSetbackMm > p.depth) errors.push("plinthSetbackMm must be <= depth.");
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

  if (p.frontStackPreset === "top_small" && drawerCount >= 2) {
    const minEach = 20;
    const top = Math.max(minEach, Math.min(p.topFrontHeightMm, Math.floor(available - (drawerCount - 1) * minEach)));
    const restAvail = Math.max(0, available - top);
    const restCount = drawerCount - 1;
    const base = restCount > 0 ? Math.floor(restAvail / restCount) : 0;
    const remainder = restCount > 0 ? Math.round(restAvail - base * restCount) : 0;

    const out: number[] = [top];
    for (let i = 0; i < restCount; i++) out.push(base + (i < remainder ? 1 : 0));
    return out;
  }

  const base = Math.floor(available / drawerCount);
  const remainder = Math.round(available - base * drawerCount);

  const out: number[] = [];
  for (let i = 0; i < drawerCount; i++) out.push(base + (i < remainder ? 1 : 0));
  return out;
}

export function computeEqualNestedDrawerFrontHeights(p: NestedDrawerLowParams): number[] {
  const drawerCount = Math.max(2, Math.round(p.drawerCount));
  const openingHeight = p.height - p.plinthHeight;
  const available = openingHeight - p.topGap - p.bottomGap - Math.max(0, drawerCount - 1) * p.frontGap;

  if (!Number.isFinite(available) || available <= 0) {
    return Array.from({ length: drawerCount }, () => 200);
  }

  if (p.frontStackPreset === "top_small" && drawerCount >= 2) {
    const minEach = 20;
    const top = Math.max(minEach, Math.min(p.topFrontHeightMm, Math.floor(available - (drawerCount - 1) * minEach)));
    const restAvail = Math.max(0, available - top);
    const restCount = drawerCount - 1;
    const base = restCount > 0 ? Math.floor(restAvail / restCount) : 0;
    const remainder = restCount > 0 ? Math.round(restAvail - base * restCount) : 0;

    const out: number[] = [top];
    for (let i = 0; i < restCount; i++) out.push(base + (i < remainder ? 1 : 0));
    return out;
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
  positiveNumber(errors, "plinthSetbackMm", p.plinthSetbackMm, 0);
  positiveNumber(errors, "shelfThickness", p.shelfThickness, 5);
  positiveNumber(errors, "hingeTopOffsetMm", p.hingeTopOffsetMm, 0);
  positiveNumber(errors, "hingeBottomOffsetMm", p.hingeBottomOffsetMm, 0);

  const hingeCount = typeof p.hingeCountPerDoor === "number" ? p.hingeCountPerDoor : Number(p.hingeCountPerDoor);
  if (!Number.isFinite(hingeCount) || !Number.isInteger(hingeCount) || hingeCount < 1 || hingeCount > 6) {
    errors.push("hingeCountPerDoor must be an integer 1..6.");
  }

  if (p.hingeSideFrontZ !== "left" && p.hingeSideFrontZ !== "right") errors.push('hingeSideFrontZ must be "left" or "right".');
  if (p.hingeSideFrontX !== "left" && p.hingeSideFrontX !== "right") errors.push('hingeSideFrontX must be "left" or "right".');

  if (p.shelfThickness > p.boardThickness) errors.push("shelfThickness should be <= boardThickness.");
  if (p.backThickness >= p.depth) errors.push("backThickness must be smaller than depth.");
  if (p.plinthSetbackMm > p.depth) errors.push("plinthSetbackMm must be <= depth.");

  validateShelfLayout(errors, p);
  validateMaterials(errors, p.materials);
  return errors;
}

export function validateFridgeTall(p: FridgeTallParams): string[] {
  const errors: string[] = [];

  positiveNumber(errors, "width", p.width, 200);
  positiveNumber(errors, "height", p.height, 400);
  positiveNumber(errors, "depth", p.depth, 200);
  positiveNumber(errors, "boardThickness", p.boardThickness, 5);
  positiveNumber(errors, "backThickness", p.backThickness, 3);
  positiveNumber(errors, "plinthHeight", p.plinthHeight, 0);
  positiveNumber(errors, "plinthSetbackMm", p.plinthSetbackMm, 0);

  positiveNumber(errors, "frontGap", p.frontGap, 0);
  positiveNumber(errors, "sideGap", p.sideGap, 0);
  positiveNumber(errors, "topGap", p.topGap, 0);
  positiveNumber(errors, "bottomGap", p.bottomGap, 0);
  positiveNumber(errors, "frontThicknessMm", p.frontThicknessMm, 5);

  if (!Number.isInteger(p.drawerCount) || p.drawerCount < 0 || p.drawerCount > 6) errors.push("drawerCount must be 0..6.");
  if (!Array.isArray(p.drawerFrontHeights) || p.drawerFrontHeights.some((n) => typeof n !== "number")) {
    errors.push("drawerFrontHeights must be an array of numbers.");
  } else if (p.drawerFrontHeights.length !== p.drawerCount) {
    errors.push("drawerFrontHeights count must match drawerCount.");
  }

  positiveNumber(errors, "handlePositionMm", p.handlePositionMm, 0);
  positiveNumber(errors, "handleLengthMm", p.handleLengthMm, 0);
  positiveNumber(errors, "handleSizeMm", p.handleSizeMm, 0);
  positiveNumber(errors, "handleProjectionMm", p.handleProjectionMm, 0);

  positiveNumber(errors, "fridgeWidthMm", p.fridgeWidthMm, 100);
  positiveNumber(errors, "fridgeHeightMm", p.fridgeHeightMm, 100);
  positiveNumber(errors, "fridgeDepthMm", p.fridgeDepthMm, 100);
  positiveNumber(errors, "fridgeSideClearanceMm", p.fridgeSideClearanceMm, 0);
  positiveNumber(errors, "fridgeTopClearanceMm", p.fridgeTopClearanceMm, 0);
  positiveNumber(errors, "fridgeBottomClearanceMm", p.fridgeBottomClearanceMm, 0);
  positiveNumber(errors, "gapAboveDrawersMm", p.gapAboveDrawersMm, 0);
  positiveNumber(errors, "freezerDoorHeightMm", p.freezerDoorHeightMm, 50);
  positiveNumber(errors, "fridgeDoorGapMm", p.fridgeDoorGapMm, 0);
  positiveNumber(errors, "doorHandleOffsetFromSplitMm", p.doorHandleOffsetFromSplitMm, 0);

  if (p.backThickness >= p.depth) errors.push("backThickness must be smaller than depth.");
  if (p.plinthSetbackMm > p.depth) errors.push("plinthSetbackMm must be <= depth.");

  const internalW = p.width - 2 * p.boardThickness;
  if (p.fridgeWidthMm + 2 * p.fridgeSideClearanceMm > internalW + 0.5) {
    errors.push("Fridge does not fit: niche width + 2*side clearance exceeds internal cabinet width.");
  }

  const drawerCount = Math.max(0, Math.min(6, Math.round(p.drawerCount)));
  const drawerHeights = Array.isArray(p.drawerFrontHeights) ? p.drawerFrontHeights.slice(0, drawerCount) : [];
  const sumDrawerHeights = drawerHeights.reduce((acc, n) => acc + (Number.isFinite(n) ? Math.max(0, n) : 0), 0);
  const sumFrontGaps = drawerCount > 0 ? Math.max(0, p.frontGap) * Math.max(0, drawerCount - 1) : 0;
  const baseStartMm = p.plinthHeight + p.boardThickness + (drawerCount > 0 ? p.bottomGap : 0);
  const afterDrawersMm =
    baseStartMm + (drawerCount > 0 ? sumDrawerHeights + sumFrontGaps + Math.max(0, p.gapAboveDrawersMm) + p.boardThickness : 0);
  const fridgeZoneMm = Math.max(0, p.fridgeHeightMm) + Math.max(0, p.fridgeTopClearanceMm) + Math.max(0, p.fridgeBottomClearanceMm);
  const requiredMinHeightMm = afterDrawersMm + fridgeZoneMm + p.boardThickness;
  if (p.height + 0.5 < requiredMinHeightMm) {
    errors.push("Cabinet height too small: fridge niche + clearances does not fit.");
  }

  validateMaterials(errors, p.materials);
  return errors;
}

export function validateFlapShelvesLow(p: FlapShelvesLowParams): string[] {
  const errors: string[] = [];

  positiveNumber(errors, "width", p.width, 200);
  positiveNumber(errors, "height", p.height, 200);
  positiveNumber(errors, "depth", p.depth, 200);
  positiveNumber(errors, "boardThickness", p.boardThickness, 5);
  positiveNumber(errors, "backThickness", p.backThickness, 3);
  positiveNumber(errors, "plinthHeight", p.plinthHeight, 0);
  positiveNumber(errors, "plinthSetbackMm", p.plinthSetbackMm, 0);

  if (typeof p.wallMounted !== "boolean") errors.push("wallMounted must be a boolean.");
  if (p.wallMounted === true && p.plinthHeight !== 0) errors.push("plinthHeight must be 0 when wallMounted=true.");

  positiveNumber(errors, "frontGap", p.frontGap, 0);
  positiveNumber(errors, "sideGap", p.sideGap, 0);
  positiveNumber(errors, "topGap", p.topGap, 0);
  positiveNumber(errors, "bottomGap", p.bottomGap, 0);
  positiveNumber(errors, "shelfThickness", p.shelfThickness, 5);

  if (!Number.isInteger(p.hingeCount) || p.hingeCount < 1 || p.hingeCount > 5) {
    errors.push("hingeCount must be an integer between 1 and 5.");
  }
  positiveNumber(errors, "hingeInsetFromSideMm", p.hingeInsetFromSideMm, 0);
  if (p.flapHinge !== "bottom" && p.flapHinge !== "top") errors.push("flapHinge must be 'bottom' or 'top'.");

  if (p.backThickness >= p.depth) errors.push("backThickness must be smaller than depth.");
  if (p.plinthSetbackMm > p.depth) errors.push("plinthSetbackMm must be <= depth.");
  if (p.shelfThickness > p.boardThickness) errors.push("shelfThickness should be <= boardThickness.");

  const openingW = p.width - 2 * p.sideGap;
  const openingH = p.height - p.plinthHeight - p.topGap - p.bottomGap;
  if (openingW <= 80) errors.push("width too small for sideGap (opening width <= 80mm).");
  if (openingH <= 80) errors.push("height too small for reveals (opening height <= 80mm).");
  if (p.hingeInsetFromSideMm > openingW / 2) errors.push("hingeInsetFromSideMm too large for current width.");

  if (!Number.isInteger(p.shelfCount) || p.shelfCount < 1 || p.shelfCount > 11) {
    errors.push("shelfCount must be an integer between 1 and 11.");
  }

  validateShelfLayout(errors, p);
  validateMaterials(errors, p.materials);
  return errors;
}

export function validateSwingShelvesLow(p: SwingShelvesLowParams): string[] {
  const errors: string[] = [];

  positiveNumber(errors, "width", p.width, 200);
  positiveNumber(errors, "height", p.height, 200);
  positiveNumber(errors, "depth", p.depth, 200);
  positiveNumber(errors, "boardThickness", p.boardThickness, 5);
  positiveNumber(errors, "backThickness", p.backThickness, 3);
  positiveNumber(errors, "plinthHeight", p.plinthHeight, 0);
  positiveNumber(errors, "plinthSetbackMm", p.plinthSetbackMm, 0);

  if (typeof p.wallMounted !== "boolean") errors.push("wallMounted must be a boolean.");
  if (p.wallMounted === true && p.plinthHeight !== 0) errors.push("plinthHeight must be 0 when wallMounted=true.");

  positiveNumber(errors, "frontGap", p.frontGap, 0);
  positiveNumber(errors, "sideGap", p.sideGap, 0);
  positiveNumber(errors, "topGap", p.topGap, 0);
  positiveNumber(errors, "bottomGap", p.bottomGap, 0);
  positiveNumber(errors, "shelfThickness", p.shelfThickness, 5);

  positiveNumber(errors, "hingeTopOffsetMm", p.hingeTopOffsetMm, 0);
  positiveNumber(errors, "hingeBottomOffsetMm", p.hingeBottomOffsetMm, 0);
  if (p.hingeSide !== "left" && p.hingeSide !== "right") errors.push("hingeSide must be 'left' or 'right'.");
  if (!Number.isInteger(p.hingeCountPerDoor) || p.hingeCountPerDoor < 1 || p.hingeCountPerDoor > 6) {
    errors.push("hingeCountPerDoor must be an integer between 1 and 6.");
  }

  if (!Number.isInteger(p.shelfCount) || p.shelfCount < 1 || p.shelfCount > 11) {
    errors.push("shelfCount must be an integer between 1 and 11.");
  }

  if (p.shelfThickness > p.boardThickness) errors.push("shelfThickness should be <= boardThickness.");
  if (p.backThickness >= p.depth) errors.push("backThickness must be smaller than depth.");
  if (p.plinthSetbackMm > p.depth) errors.push("plinthSetbackMm must be <= depth.");

  const openingW = p.width - 2 * p.sideGap;
  const openingH = p.height - p.plinthHeight - p.topGap - p.bottomGap;
  if (openingW <= 80) errors.push("width too small for sideGap (opening width <= 80mm).");
  if (openingH <= 80) errors.push("height too small for reveals (opening height <= 80mm).");

  validateShelfLayout(errors, p);
  validateMaterials(errors, p.materials);
  return errors;
}

export function validateOvenBaseLow(p: OvenBaseLowParams): string[] {
  const errors: string[] = [];

  positiveNumber(errors, "width", p.width, 200);
  positiveNumber(errors, "height", p.height, 200);
  positiveNumber(errors, "depth", p.depth, 200);
  positiveNumber(errors, "boardThickness", p.boardThickness, 5);
  positiveNumber(errors, "backThickness", p.backThickness, 3);
  positiveNumber(errors, "plinthHeight", p.plinthHeight, 0);
  positiveNumber(errors, "plinthSetbackMm", p.plinthSetbackMm, 0);

  if (typeof p.wallMounted !== "boolean") errors.push("wallMounted must be a boolean.");
  if (p.wallMounted === true && p.plinthHeight !== 0) errors.push("plinthHeight must be 0 when wallMounted=true.");
  if (typeof p.drawerEnabled !== "boolean") errors.push("drawerEnabled must be a boolean.");

  positiveNumber(errors, "drawerFrontHeightMm", p.drawerFrontHeightMm, 0);
  positiveNumber(errors, "drawerGapAboveMm", p.drawerGapAboveMm, 0);
  positiveNumber(errors, "sideGap", p.sideGap, 0);
  positiveNumber(errors, "bottomGap", p.bottomGap, 0);
  positiveNumber(errors, "frontThicknessMm", p.frontThicknessMm, 5);

  positiveNumber(errors, "handlePositionMm", p.handlePositionMm, 0);
  positiveNumber(errors, "handleLengthMm", p.handleLengthMm, 0);
  positiveNumber(errors, "handleSizeMm", p.handleSizeMm, 0);
  positiveNumber(errors, "handleProjectionMm", p.handleProjectionMm, 0);

  positiveNumber(errors, "sideClearanceMm", p.sideClearanceMm, 0);
  positiveNumber(errors, "drawerBoxThickness", p.drawerBoxThickness, 3);
  positiveNumber(errors, "drawerBoxSideHeight", p.drawerBoxSideHeight, 20);
  positiveNumber(errors, "drawerBoxDepthMm", p.drawerBoxDepthMm, 50);

  positiveNumber(errors, "ovenWidthMm", p.ovenWidthMm, 100);
  positiveNumber(errors, "ovenHeightMm", p.ovenHeightMm, 100);
  positiveNumber(errors, "ovenDepthMm", p.ovenDepthMm, 100);
  positiveNumber(errors, "ovenSideClearanceMm", p.ovenSideClearanceMm, 0);
  positiveNumber(errors, "ovenTopClearanceMm", p.ovenTopClearanceMm, 0);
  positiveNumber(errors, "ovenBottomClearanceMm", p.ovenBottomClearanceMm, 0);

  if (p.backThickness >= p.depth) errors.push("backThickness must be smaller than depth.");
  if (p.plinthSetbackMm > p.depth) errors.push("plinthSetbackMm must be <= depth.");

  validateMaterials(errors, p.materials);
  return errors;
}

export function validateMicrowaveOvenTall(p: MicrowaveOvenTallParams): string[] {
  const errors: string[] = [];

  positiveNumber(errors, "width", p.width, 200);
  positiveNumber(errors, "height", p.height, 400);
  positiveNumber(errors, "depth", p.depth, 200);
  positiveNumber(errors, "boardThickness", p.boardThickness, 5);
  positiveNumber(errors, "backThickness", p.backThickness, 3);
  positiveNumber(errors, "plinthHeight", p.plinthHeight, 0);
  positiveNumber(errors, "plinthSetbackMm", p.plinthSetbackMm, 0);

  positiveNumber(errors, "frontGap", p.frontGap, 0);
  positiveNumber(errors, "sideGap", p.sideGap, 0);
  positiveNumber(errors, "topGap", p.topGap, 0);
  positiveNumber(errors, "bottomGap", p.bottomGap, 0);
  positiveNumber(errors, "frontThicknessMm", p.frontThicknessMm, 5);

  if (!Number.isInteger(p.drawerCount) || p.drawerCount < 0 || p.drawerCount > 6) errors.push("drawerCount must be 0..6.");
  if (!Array.isArray(p.drawerFrontHeights) || p.drawerFrontHeights.some((n) => typeof n !== "number")) {
    errors.push("drawerFrontHeights must be an array of numbers.");
  } else if (p.drawerFrontHeights.length !== p.drawerCount) {
    errors.push("drawerFrontHeights count must match drawerCount.");
  }

  positiveNumber(errors, "handlePositionMm", p.handlePositionMm, 0);
  positiveNumber(errors, "handleLengthMm", p.handleLengthMm, 0);
  positiveNumber(errors, "handleSizeMm", p.handleSizeMm, 0);
  positiveNumber(errors, "handleProjectionMm", p.handleProjectionMm, 0);

  positiveNumber(errors, "ovenWidthMm", p.ovenWidthMm, 100);
  positiveNumber(errors, "ovenHeightMm", p.ovenHeightMm, 100);
  positiveNumber(errors, "ovenDepthMm", p.ovenDepthMm, 100);
  positiveNumber(errors, "microwaveWidthMm", p.microwaveWidthMm, 100);
  positiveNumber(errors, "microwaveHeightMm", p.microwaveHeightMm, 100);
  positiveNumber(errors, "microwaveDepthMm", p.microwaveDepthMm, 100);

  positiveNumber(errors, "gapAboveDrawersMm", p.gapAboveDrawersMm, 0);
  positiveNumber(errors, "gapBetweenAppliancesMm", p.gapBetweenAppliancesMm, 0);
  positiveNumber(errors, "topShelfCount", p.topShelfCount, 1);
  positiveNumber(errors, "topShelfThickness", p.topShelfThickness, 5);
  positiveNumber(errors, "topHingeCount", p.topHingeCount, 1);
  positiveNumber(errors, "topHingeInsetFromSideMm", p.topHingeInsetFromSideMm, 0);

  if (p.backThickness >= p.depth) errors.push("backThickness must be smaller than depth.");
  if (p.plinthSetbackMm > p.depth) errors.push("plinthSetbackMm must be <= depth.");

  validateMaterials(errors, p.materials);
  return errors;
}

export function validateTopDrawersDoorsLow(p: TopDrawersDoorsLowParams): string[] {
  const errors: string[] = [];

  positiveNumber(errors, "width", p.width, 200);
  positiveNumber(errors, "height", p.height, 200);
  positiveNumber(errors, "depth", p.depth, 200);
  positiveNumber(errors, "boardThickness", p.boardThickness, 5);
  positiveNumber(errors, "backThickness", p.backThickness, 3);
  positiveNumber(errors, "plinthHeight", p.plinthHeight, 0);
  positiveNumber(errors, "plinthSetbackMm", p.plinthSetbackMm, 0);

  if (typeof p.wallMounted !== "boolean") errors.push("wallMounted must be a boolean.");
  if (p.wallMounted === true && p.plinthHeight !== 0) errors.push("plinthHeight must be 0 when wallMounted=true.");

  positiveNumber(errors, "topDrawerCount", p.topDrawerCount, 1);
  positiveNumber(errors, "bottomDoorCount", p.bottomDoorCount, 1);
  positiveNumber(errors, "columnGapMm", p.columnGapMm, 0);
  positiveNumber(errors, "rowGapMm", p.rowGapMm, 0);
  positiveNumber(errors, "topDrawerFrontHeightMm", p.topDrawerFrontHeightMm, 20);

  positiveNumber(errors, "sideGap", p.sideGap, 0);
  positiveNumber(errors, "topGap", p.topGap, 0);
  positiveNumber(errors, "bottomGap", p.bottomGap, 0);
  positiveNumber(errors, "frontThicknessMm", p.frontThicknessMm, 5);

  if (p.hingeSide !== "left" && p.hingeSide !== "right") errors.push("hingeSide must be 'left' or 'right'.");
  if (!Number.isInteger(p.hingeCountPerDoor) || p.hingeCountPerDoor < 1 || p.hingeCountPerDoor > 6) {
    errors.push("hingeCountPerDoor must be an integer between 1 and 6.");
  }
  positiveNumber(errors, "hingeTopOffsetMm", p.hingeTopOffsetMm, 0);
  positiveNumber(errors, "hingeBottomOffsetMm", p.hingeBottomOffsetMm, 0);

  positiveNumber(errors, "handlePositionMm", p.handlePositionMm, 0);
  positiveNumber(errors, "handleLengthMm", p.handleLengthMm, 0);
  positiveNumber(errors, "handleSizeMm", p.handleSizeMm, 0);
  positiveNumber(errors, "handleProjectionMm", p.handleProjectionMm, 0);

  positiveNumber(errors, "sideClearanceMm", p.sideClearanceMm, 0);
  positiveNumber(errors, "drawerBoxThickness", p.drawerBoxThickness, 3);
  positiveNumber(errors, "drawerBoxSideHeight", p.drawerBoxSideHeight, 20);

  if (!Number.isInteger(p.shelfCount) || p.shelfCount < 1 || p.shelfCount > 11) {
    errors.push("shelfCount must be an integer between 1 and 11.");
  }
  positiveNumber(errors, "shelfThickness", p.shelfThickness, 5);
  validateShelfLayout(errors, p);

  if (p.backThickness >= p.depth) errors.push("backThickness must be smaller than depth.");
  if (p.plinthSetbackMm > p.depth) errors.push("plinthSetbackMm must be <= depth.");

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
  validateMaterialName(errors, "materials.bodyName", mat.bodyName);
  validateMaterialName(errors, "materials.frontName", mat.frontName);
  validateMaterialName(errors, "materials.drawerName", mat.drawerName);
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

function validateMaterialName(errors: string[], label: string, value: unknown) {
  if (value === undefined || value === null || value === "") return;
  if (typeof value !== "string") {
    errors.push(`${label} must be a string.`);
    return;
  }
  if (value.length > 120) errors.push(`${label} must be <= 120 characters.`);
}
