import type {
  Economy2Layer,
  PlanBeam,
  RebarZone,
  SectionCut,
  Simple2Layer,
  SlabInfo,
  SlabProject,
} from "./types";
import { uid } from "./utils";

export function defaultInfo(): SlabInfo {
  return {
    name: "Sàn S1",
    thickness: 100,
    quantity: 1,
    cover: 25,
    beamNamePrefix: "D",
    textHeight: 250,
    beamSizeX: "220x500",
    beamSizeY: "220x400",
    lowSlabDrop: 200,
    concreteGrade: "B25",
    steelGrade: "CB400-V",
    drawingScale: 100,
  };
}

export function defaultSimple2(): Simple2Layer {
  return {
    bottomSpec: "10a150",
    bottomHook: 200,
    topSpec: "10a150",
    topHook: 200,
    textHeight: 150,
  };
}

export function defaultEconomy2(): Economy2Layer {
  return {
    bottomSpec: "10a200",
    bottomHook: 60,
    topSpec: "10a150",
    topHook: 60,
    structuralSpec: "6a150",
    structuralHook: 50,
    distToCenter: 4,
    textHeight: 150,
    hatAlongShort: true,
  };
}

function sampleBeams(): PlanBeam[] {
  const W = 6000;
  const H = 4500;
  const prefix = "D";
  const beams: PlanBeam[] = [];
  // Dầm Y (song song trục Y) — kích thước X
  [0, W / 2, W].forEach((axis, i) => {
    beams.push({
      id: uid("beam"),
      name: `${prefix}${i + 1}`,
      size: "220x500",
      direction: "Y",
      axis,
      start: 0,
      end: H,
      offset: 110,
    });
  });
  // Dầm X (song song trục X) — kích thước Y
  [0, H].forEach((axis, i) => {
    beams.push({
      id: uid("beam"),
      name: `${prefix}${i + 4}`,
      size: "220x400",
      direction: "X",
      axis,
      start: 0,
      end: W,
      offset: 110,
    });
  });
  return beams;
}

function sampleZones(): RebarZone[] {
  const cover = 50;
  const pad = 110;
  return [
    {
      id: uid("zone"),
      mark: "MC 1-1",
      layer: "bottom",
      direction: "X",
      dia: 10,
      spacing: 150,
      leftHook: 60,
      rightHook: 60,
      x1: pad,
      y1: pad,
      x2: 6000 - pad,
      y2: 4500 - pad,
      cover,
      showSpacing: true,
      spacingSymbol: "a",
      note: "Lớp dưới phương X",
    },
    {
      id: uid("zone"),
      mark: "MC 2-2",
      layer: "bottom",
      direction: "Y",
      dia: 10,
      spacing: 150,
      leftHook: 60,
      rightHook: 60,
      x1: pad,
      y1: pad,
      x2: 6000 - pad,
      y2: 4500 - pad,
      cover,
      showSpacing: true,
      spacingSymbol: "a",
      note: "Lớp dưới phương Y",
    },
    {
      id: uid("zone"),
      mark: "MT 1-1",
      layer: "top",
      direction: "X",
      dia: 10,
      spacing: 150,
      leftHook: 60,
      rightHook: 60,
      x1: pad,
      y1: pad,
      x2: 3000,
      y2: 4500 - pad,
      cover,
      showSpacing: true,
      spacingSymbol: "a",
      note: "Lớp trên phương X (mũ)",
    },
  ];
}

function sampleSections(): SectionCut[] {
  return [
    {
      id: uid("sec"),
      name: "1",
      textHeight: 150,
      direction: "X",
      at: 2250,
      from: 0,
      to: 6000,
    },
  ];
}

/** Sàn mẫu S1: 6.0 × 4.5 m, dày 100, thép 10a150. */
export function createSampleS1(): SlabProject {
  return {
    info: defaultInfo(),
    planWidth: 6000,
    planHeight: 4500,
    beams: sampleBeams(),
    openings: [],
    lowSlabs: [],
    zones: sampleZones(),
    simple2: defaultSimple2(),
    economy2: defaultEconomy2(),
    sections: sampleSections(),
    layoutPreset: "simple2",
    show3d: false,
  };
}

export function createEmptyProject(): SlabProject {
  return createSampleS1();
}
