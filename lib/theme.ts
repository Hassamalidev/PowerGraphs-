// Brand name, colors, and fonts live here only, so the app can be re-skinned
// (e.g. when it moves under PowerBanks.com) without touching components.

export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "PowerGraphs";
export const SITE_DOMAIN = "PowerGraphs.com";

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const FONT_FAMILY =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const COLORS = {
  brand: "#1F5FAD",
  brandDark: "#174A88",
  brandSoft: "#E8F0FA",
  text: "#1A1F2B",
  muted: "#5B6472",
  border: "#C9D1DC",
  surface: "#FFFFFF",
  page: "#F4F6F9",
  danger: "#B42318",
  warnBg: "#FFF4CC",
  warnBorder: "#E0B100",
  note: "#6B7280",
} as const;

export type LineStyle = "solid" | "dashed" | "dotted";

// One entry per dataset slot. Styles differ as well as colors so lines can be
// told apart in black-and-white printing.
export const SERIES_STYLES: { color: string; lineStyle: LineStyle; width: number }[] = [
  { color: "#1F5FAD", lineStyle: "solid", width: 2.5 },
  { color: "#D9541E", lineStyle: "dashed", width: 2.5 },
  { color: "#2E8B57", lineStyle: "dotted", width: 2.5 },
];

export const MAX_DATASETS = 3;
export const MAX_NOTES = 5;
export const MAX_NOTE_LENGTH = 120;
export const MAX_MEETING_NOTES = 1000;
export const MAX_INTRO = 1500;

/** CSS variables consumed by app/globals.css. */
export function themeCssVars(): Record<string, string> {
  return {
    "--brand": COLORS.brand,
    "--brand-dark": COLORS.brandDark,
    "--brand-soft": COLORS.brandSoft,
    "--ink": COLORS.text,
    "--muted": COLORS.muted,
    "--line": COLORS.border,
    "--surface": COLORS.surface,
    "--page": COLORS.page,
    "--danger": COLORS.danger,
    "--warn-bg": COLORS.warnBg,
    "--warn-border": COLORS.warnBorder,
    "--font-app": FONT_FAMILY,
  };
}
