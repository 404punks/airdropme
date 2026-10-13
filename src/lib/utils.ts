import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatWhen(value: string | null | undefined): string {
  if (!value) return "Not fetched";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not fetched";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date) + " UTC";
}

export function shortKey(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function metricLabel(status: string, value: number | null): string {
  if (status === "unavailable") return "Unavailable";
  if (status === "incomplete") return "Incomplete";
  if (status === "demo") return value == null ? "DEMO" : `${formatNumber(value)} · DEMO`;
  if (value == null) return "Unavailable";
  return formatNumber(value);
}

export function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${guarded.replaceAll('"', '""')}"`;
}
