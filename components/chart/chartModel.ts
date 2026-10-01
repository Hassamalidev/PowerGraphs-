import type { Unit } from "@/lib/datasets/catalog";
import { formatCompact, formatSignedPercent, formatValueWithUnit } from "@/lib/format";
import { COLORS, FONT_FAMILY, type LineStyle } from "@/lib/theme";

/** One dataset as the chart draws it. `values` lines up with the chart's `dates`. */
export type ChartSeries = {
  id: string;
  name: string;
  shortName: string;
  unit: Unit;
  unitLabel: string;
  color: string;
  lineStyle: LineStyle;
  width: number;
  values: (number | null)[];
  /** e.g. "Quarterly average of monthly values" — shown in the tooltip. */
  quarterlyMethod?: string;
};

export type TrendLine = { seriesId: string; values: (number | null)[] };

export type ChartModelInput = {
  dates: string[];
  labels: string[]; // "Jan 2024" / "Q1 2024", one per date
  series: ChartSeries[];
  startIndex: number;
  endIndex: number;
  percentMode: boolean;
  trends: TrendLine[];
};

// Fixed plot margins so the label layer knows exactly where the plot area is.
export const GRID = { left: 84, top: 28, bottom: 104 };
export const SLIDER = { height: 34, bottom: 16 };
/** Pixels to cut off the bottom of an exported image so the slider isn't in it. */
export const EXPORT_CROP_BOTTOM = 62;

export function gridRight(hasRightAxis: boolean, hasTrend: boolean): number {
  if (hasRightAxis) return 88;
  return hasTrend ? 64 : 36;
}

/** Index of the first / last point with a value inside the visible range. */
export function firstVisibleIndex(values: (number | null)[], start: number, end: number): number {
  for (let i = start; i <= end; i++) if (values[i] != null) return i;
  return -1;
}

export function lastVisibleIndex(values: (number | null)[], start: number, end: number): number {
  for (let i = end; i >= start; i--) if (values[i] != null) return i;
  return -1;
}

/** In "% change" mode every line is shown as percent change from its first visible point. */
export function percentBase(values: (number | null)[], start: number, end: number): number | null {
  const i = firstVisibleIndex(values, start, end);
  const base = i >= 0 ? values[i] : null;
  return base ? base : null; // a base of 0 can't be used
}

export function toDisplay(value: number | null, base: number | null, percentMode: boolean): number | null {
  if (value == null) return null;
  if (!percentMode) return value;
  if (base == null) return null;
  return Math.round(((value - base) / Math.abs(base)) * 100 * 100) / 100;
}

/** Which y-axis each series uses: 0 = left (unit of Dataset 1), 1 = right (the other unit). */
export function axisIndexes(series: ChartSeries[], percentMode: boolean): number[] {
  if (percentMode || series.length === 0) return series.map(() => 0);
  const leftUnit = series[0].unit;
  return series.map((s) => (s.unit === leftUnit ? 0 : 1));
}

const AXIS_TEXT = { color: COLORS.text, fontSize: 13, fontFamily: FONT_FAMILY };
// A square handle, as in the client's sketch.
const SQUARE_HANDLE = "path://M-10,-10 L10,-10 L10,10 L-10,10 Z";
const TREND_DASH = [7, 5];

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const TREND_PREFIX = "trend:";

/** Build the ECharts option. There is deliberately no `legend`: arrow labels replace it. */
export function buildOption(input: ChartModelInput) {
  const { dates, labels, series, startIndex, endIndex, percentMode, trends } = input;
  const axes = axisIndexes(series, percentMode);
  const hasRightAxis = axes.includes(1);
  const bases = series.map((s) => percentBase(s.values, startIndex, endIndex));

  const valueAxis = (unit: Unit, name: string, position: "left" | "right") => ({
    type: "value",
    position,
    scale: true,
    name,
    nameLocation: "middle",
    nameGap: position === "left" ? 62 : 66,
    nameRotate: position === "left" ? 90 : -90,
    nameTextStyle: { ...AXIS_TEXT, fontSize: 14, fontWeight: 600 },
    axisLabel: {
      ...AXIS_TEXT,
      formatter: (v: number) => (percentMode ? `${Math.round(v * 10) / 10}%` : formatCompact(v, unit)),
    },
    axisLine: { show: true, lineStyle: { color: COLORS.muted } },
    axisTick: { show: true },
    splitLine: { show: position === "left", lineStyle: { color: "#E3E7ED" } },
  });

  const yAxis = percentMode
    ? [{ ...valueAxis("homes", `% change since ${labels[startIndex] ?? ""}`, "left"), id: "y-left" }]
    : [
        { ...valueAxis(series[0]?.unit ?? "homes", series[0]?.unitLabel ?? "", "left"), id: "y-left" },
        ...(hasRightAxis
          ? [
              (() => {
                const other = series[axes.indexOf(1)];
                return { ...valueAxis(other.unit, other.unitLabel, "right"), id: "y-right" };
              })(),
            ]
          : []),
      ];

  const lineSeries = series.map((s, i) => {
    const data = s.values.map((v) => toDisplay(v, bases[i], percentMode));
    const last = lastVisibleIndex(data, startIndex, endIndex);
    return {
      id: s.id,
      name: s.name,
      type: "line",
      yAxisIndex: axes[i],
      data,
      connectNulls: false,
      symbol: "circle",
      symbolSize: 7,
      showSymbol: false,
      lineStyle: { color: s.color, width: s.width, type: s.lineStyle },
      itemStyle: { color: s.color },
      emphasis: { focus: "none", lineStyle: { width: s.width } },
      z: 3,
      // A dot marks the last visible data point.
      markPoint: {
        silent: true,
        animation: false,
        symbol: "circle",
        symbolSize: 11,
        label: { show: false },
        itemStyle: { color: s.color, borderColor: "#fff", borderWidth: 2 },
        data: last >= 0 ? [{ coord: [last, data[last]] }] : [],
      },
    };
  });

  const trendSeries = trends.flatMap((t) => {
    const i = series.findIndex((s) => s.id === t.seriesId);
    if (i < 0) return [];
    const s = series[i];
    return [
      {
        id: `${TREND_PREFIX}${s.id}`,
        name: `${s.name} trend`,
        type: "line",
        yAxisIndex: axes[i],
        data: t.values.map((v) => toDisplay(v, bases[i], percentMode)),
        symbol: "none",
        silent: true,
        lineStyle: { color: s.color, width: 1.5, type: TREND_DASH, opacity: 0.5 },
        itemStyle: { color: s.color },
        endLabel: { show: true, formatter: "Trend", color: s.color, fontSize: 12, fontFamily: FONT_FAMILY, opacity: 0.85, distance: 4 },
        z: 2,
      },
    ];
  });

  return {
    animation: false,
    textStyle: { fontFamily: FONT_FAMILY },
    grid: {
      left: GRID.left,
      right: gridRight(hasRightAxis, trends.length > 0),
      top: GRID.top,
      bottom: GRID.bottom,
      containLabel: false,
      outerBoundsMode: "none",
    },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLabel: { ...AXIS_TEXT, hideOverlap: true, margin: 12 },
      axisLine: { lineStyle: { color: COLORS.muted } },
      axisTick: { alignWithLabel: true },
    },
    yAxis,
    tooltip: {
      trigger: "axis",
      confine: true,
      axisPointer: { type: "line", lineStyle: { color: COLORS.muted, type: "solid" } },
      backgroundColor: "#fff",
      borderColor: COLORS.border,
      textStyle: { color: COLORS.text, fontSize: 14, fontFamily: FONT_FAMILY },
      formatter: (params: unknown) => {
        const items = (Array.isArray(params) ? params : [params]) as { seriesId?: string; dataIndex: number }[];
        const index = items[0]?.dataIndex;
        if (index == null) return "";
        const rows = series
          .map((s, i) => {
            const raw = s.values[index];
            if (raw == null) return "";
            const pct = percentMode ? toDisplay(raw, bases[i], true) : null;
            const value = formatValueWithUnit(raw, s.unit) + (pct != null ? ` (${formatSignedPercent(pct)})` : "");
            const method = s.quarterlyMethod
              ? `<div style="color:${COLORS.muted};font-size:12px;margin-left:18px">${escapeHtml(s.quarterlyMethod)}</div>`
              : "";
            return (
              `<div style="margin-top:6px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${s.color};margin-right:8px"></span>` +
              `${escapeHtml(s.name)}: <b>${escapeHtml(value)}</b>${method}</div>`
            );
          })
          .join("");
        return `<div style="font-weight:700">${escapeHtml(labels[index] ?? dates[index] ?? "")}</div>${rows}`;
      },
    },
    dataZoom: [
      {
        id: "range",
        type: "slider",
        xAxisIndex: 0,
        startValue: startIndex,
        endValue: endIndex,
        filterMode: "filter",
        height: SLIDER.height,
        bottom: SLIDER.bottom,
        left: GRID.left,
        right: gridRight(hasRightAxis, trends.length > 0),
        brushSelect: false,
        handleIcon: SQUARE_HANDLE,
        handleSize: "72%",
        handleStyle: { color: COLORS.brand, borderColor: COLORS.brandDark, borderWidth: 1 },
        moveHandleSize: 0,
        borderColor: COLORS.border,
        fillerColor: "rgba(31, 95, 173, 0.15)",
        dataBackground: { lineStyle: { color: COLORS.muted, opacity: 0.6 }, areaStyle: { color: COLORS.border, opacity: 0.5 } },
        selectedDataBackground: { lineStyle: { color: COLORS.brand }, areaStyle: { color: COLORS.brand, opacity: 0.25 } },
        textStyle: { ...AXIS_TEXT, fontSize: 12 },
        labelFormatter: (_index: number, text: string) => text,
        showDetail: true,
        realtime: true,
      },
    ],
    series: [...lineSeries, ...trendSeries],
  };
}
