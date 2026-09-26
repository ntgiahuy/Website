import type {
  Economy2Layer,
  PlanBeam,
  RebarZone,
  SectionCut,
  Simple2Layer,
  SlabInfo,
  SlabProject,
} from "./types";
import { applyAxesToProject, defaultAxesX, defaultAxesY } from "./grid";
import { uid } from "./utils";

export function defaultInfo(): SlabInfo {
  return {
    name: "Sàn S1",
    thickness: 100,
    quantity: 1,
    cover: 25,
    beamNamePrefix: "D",
    textHeight: 250,
    beamCountX: 3,
    beamCountY: 2,
    beamH: 500,
    beamB: 220,
    beamB1: 110,
    beamSizeX: "220x500",
    beamSizeY: "220x500",
    lowSlabDrop: 200,
    concreteGrade: "B25",
    steelGrade: "CB400-V",
    drawingScale: 100,
    floorElevationM: 8.05,
    showDistRange: true,
  };
}

export function defaultSimple2(): Simple2Layer {
  return {
    bottomSpec: "10a150",
    bottomHook: 100,
    topSpec: "10a150",
    topHook: 100,
    textHeight: 150,
  };
}

export function defaultEconomy2(): Economy2Layer {
  return {
    bottomSpec: "10a200",
    bottomHook: 100,
    topSpec: "10a150",
    topHook: 100,
    structuralSpec: "6a150",
    structuralHook: 80,
    distToCenter: 4,
    textHeight: 150,
    hatAlongShort: true,
  };
}

function sampleBeams(): PlanBeam[] {
  const W = 6000;
  const H = 4500;
  const prefix = "D";
  const size = "220x500";
  const bw = 220;
  const beams: PlanBeam[] = [];
  // Dầm trên trục X (chạy theo phương Y): biên B1=0/B, giữa B/2
  [0, W / 2, W].forEach((axis, i, arr) => {
    const offset = i === 0 ? 0 : i === arr.length - 1 ? bw : Math.round(bw / 2);
    beams.push({
      id: uid("beam"),
      name: `${prefix}${i + 1}`,
      size,
      direction: "Y",
      axis,
      start: 0,
      end: H,
      offset,
    });
  });
  // Dầm trên trục Y (chạy theo phương X)
  [0, H].forEach((axis, i, arr) => {
    const offset = i === 0 ? 0 : i === arr.length - 1 ? bw : Math.round(bw / 2);
    beams.push({
      id: uid("beam"),
      name: `${prefix}${i + 4}`,
      size,
      direction: "X",
      axis,
      start: 0,
      end: W,
      offset,
    });
  });
  return beams;
}

function sampleZones(): RebarZone[] {
  const cover = defaultInfo().cover;
  const pad = 110;
  return [
    {
      id: uid("zone"),
      mark: "MC 1-1",
      layer: "bottom",
      direction: "X",
      dia: 10,
      spacing: 150,
      leftHook: 100,
      rightHook: 100,
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
      mark: "MT 1-1",
      layer: "top",
      direction: "X",
      dia: 10,
      spacing: 150,
      leftHook: 100,
      rightHook: 100,
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
  const beams = sampleBeams();
  const seen = new Set<string>();
  const beamTypes = beams
    .filter((b) => {
      const k = b.name.trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((b) => ({
      id: uid("bt"),
      name: b.name,
      size: b.size,
      offset: b.offset,
    }));
  return applyAxesToProject({
    info: defaultInfo(),
    planWidth: 6000,
    planHeight: 4500,
    axesX: defaultAxesX(6000),
    axesY: defaultAxesY(4500),
    beams,
    beamTypes,
    openings: [],
    lowSlabs: [],
    zones: sampleZones(),
    simple2: defaultSimple2(),
    economy2: defaultEconomy2(),
    sections: sampleSections(),
    layoutPreset: "simple2",
    show3d: false,
  });
}

export function createEmptyProject(): SlabProject {
  return createSampleS1();
}
