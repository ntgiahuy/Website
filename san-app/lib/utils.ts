import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function roundTo(value: number, step = 50) {
  return Math.round(value / step) * step;
}

export function formatMm(n: number) {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n));
}

export function formatKg(n: number) {
  return n.toFixed(1);
}

export function formatM(n: number) {
  return n.toFixed(1);
}
