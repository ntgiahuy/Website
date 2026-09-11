import { normalizeProject } from "./calc";
import type { SlabProject } from "./types";

export const SHOP_SAN_KIND = "giahuy-shop-san";
export const SHOP_SAN_FILENAME = "[Giahuy.net]-shop_san.json";

export interface ShopSanFile {
  kind: typeof SHOP_SAN_KIND;
  version: 1;
  savedAt: string;
  project: SlabProject;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function looksLikeProject(value: unknown): value is SlabProject {
  if (!isRecord(value)) return false;
  if (!isRecord(value.info)) return false;
  if (!Array.isArray(value.zones)) return false;
  return typeof value.planWidth === "number" && typeof value.planHeight === "number";
}

export function serializeProjectFile(project: SlabProject): string {
  const file: ShopSanFile = {
    kind: SHOP_SAN_KIND,
    version: 1,
    savedAt: new Date().toISOString(),
    project,
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function parseProjectFile(raw: unknown): SlabProject {
  if (!isRecord(raw)) {
    throw new Error("File không phải JSON dự án shop sàn.");
  }
  if (raw.kind === SHOP_SAN_KIND && looksLikeProject(raw.project)) {
    return normalizeProject(raw.project);
  }
  if (looksLikeProject(raw)) {
    return normalizeProject(raw);
  }
  throw new Error("File không đúng định dạng shop thép sàn (giahuy-shop-san).");
}
