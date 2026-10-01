import { format as formatDate } from "date-fns";
import type { Unit } from "@/lib/datasets/catalog";

const INT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Plain value as used in sentences: `676,000`, `$414,500`, `8.5 months`. */
export function formatValue(value: number, unit: Unit): string {
  if (unit === "dollars") return `${value < 0 ? "-" : ""}$${INT.format(Math.abs(Math.round(value)))}`;
  if (unit === "months") return `${value.toFixed(1)} months`;
  return INT.format(Math.round(value));
}

/** Value with its unit spelled out, as used in the arrow label box. */
export function formatValueWithUnit(value: number, unit: Unit): string {
  if (unit === "homes_per_year") return `${formatValue(value, unit)} per year`;
  if (unit === "homes") return `${formatValue(value, unit)} homes`;
  return formatValue(value, unit);
}

function trimZeros(text: string): string {
  return text.includes(".") ? text.replace(/\.?0+$/, "") : text;
}

/** Compact form for chart axes: `676K`, `$415K`, `1.2M`, `8.5`. */
export function formatCompact(value: number, unit: Unit): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const prefix = unit === "dollars" ? "$" : "";
  if (unit === "months") return trimZeros(value.toFixed(1));
  if (abs >= 1_000_000) return `${sign}${prefix}${trimZeros((abs / 1_000_000).toFixed(1))}M`;
  if (abs >= 1_000) return `${sign}${prefix}${trimZeros((abs / 1_000).toFixed(abs < 10_000 ? 1 : 0))}K`;
  return `${sign}${prefix}${INT.format(Math.round(abs))}`;
}

/** Round to 2 significant figures for "about ..." wording. */
function roundApprox(value: number): number {
  if (value === 0) return 0;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(value))) - 1);
  return Math.round(value / magnitude) * magnitude;
}

/** A rounded amount for "about 52,000" style wording. Always positive. */
export function formatApprox(value: number, unit: Unit): string {
  const abs = Math.abs(value);
  if (unit === "months") {
    const digits = abs < 0.095 ? 2 : 1;
    return `${abs.toFixed(digits)} months`;
  }
  const rounded = abs >= 100 ? roundApprox(abs) : Math.round(abs);
  return formatValue(rounded, unit);
}

/** `3.1%` — no sign; sentences use the words up/down instead. */
export function formatPercent(pct: number): string {
  return `${Math.abs(pct).toFixed(1)}%`;
}

/** Signed percent for chart labels in "% change" mode: `+3.1%`, `-2.4%`, `0.0%`. */
export function formatSignedPercent(pct: number): string {
  const text = Math.abs(pct).toFixed(1);
  if (text === "0.0") return "0.0%";
  return `${pct > 0 ? "+" : "-"}${text}%`;
}

/** "up 3.1%", "down 2.4%", or "unchanged" when the change rounds to 0.0%. */
export function changeWords(pct: number): string {
  const text = Math.abs(pct).toFixed(1);
  if (text === "0.0") return "unchanged";
  return `${pct > 0 ? "up" : "down"} ${text}%`;
}

function toDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  // A bare "YYYY-MM-DD" is a calendar date; keep it in local time so it doesn't shift a day.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(input);
}

/** `October 1, 2026` — long form used in reports. */
export function formatLongDate(input: string | Date): string {
  return formatDate(toDate(input), "MMMM d, yyyy");
}

/** `Oct 1, 2026` */
export function formatShortDate(input: string | Date): string {
  return formatDate(toDate(input), "MMM d, yyyy");
}

/** `2026-10-01` — used in file names. */
export function formatIsoDate(input: string | Date): string {
  return formatDate(toDate(input), "yyyy-MM-dd");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Remove characters that are not allowed in file names. */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);
}
