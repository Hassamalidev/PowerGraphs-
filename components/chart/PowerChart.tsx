"use client";

import ReactECharts from "echarts-for-react";
import type { EChartsType } from "echarts";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { LabelState, NoteState, Pos } from "@/lib/chart/config";
import { formatSignedPercent, formatValueWithUnit } from "@/lib/format";
import {
  arrowElementIds,
  arrowGeometry,
  arrowShapes,
  boxToPos,
  buildGraphic,
  CALLOUT_NAME,
  createMeasure,
  layoutCallouts,
  type CalloutBox,
  type CalloutSpec,
  type Measure,
  type Point,
  type Rect,
} from "./calloutLayer";
import {
  axisIndexes,
  buildOption,
  EXPORT_CROP_BOTTOM,
  GRID,
  gridRight,
  lastVisibleIndex,
  percentBase,
  toDisplay,
  type ChartModelInput,
} from "./chartModel";

export type PowerChartHandle = {
  /** PNG of the chart at 2× resolution, with labels and notes, without the range slider. */
  getImageDataUrl: () => Promise<string>;
};

export type PointClick = {
  seriesId: string;
  index: number; // position on the date axis
  x: number; // pixel position of that data point inside the chart
  y: number;
  /** True when the click landed on (or very near) the line itself. */
  near: boolean;
};

type Props = ChartModelInput & {
  height?: number;
  /** Arrow-label settings per dataset (anchor and position). Missing = automatic. */
  seriesLabels?: LabelState[];
  notes?: NoteState[];
  /** Called (debounced) when the user moves the range slider. */
  onRangeChange?: (startIndex: number, endIndex: number) => void;
  onLabelChange?: (datasetId: string, patch: { anchorDate?: string | null; pos?: Pos | null }) => void;
  onNoteMove?: (id: string, pos: Pos) => void;
  onNoteEdit?: (id: string, at: Point) => void;
  onNoteDelete?: (id: string) => void;
  onPointClick?: (click: PointClick) => void;
};

const RANGE_DEBOUNCE_MS = 150;
const EXPORT_PIXEL_RATIO = 2;
const NEAR_LINE_PX = 10;
const HOVER_HIDE_MS = 350;
const NO_LABELS: LabelState[] = [];
const NO_NOTES: NoteState[] = [];
const OPTS = { renderer: "canvas" } as const;
const REPLACE = ["series", "yAxis"];

/** Cut the slider strip off the bottom of an exported chart image. */
function cropBottom(dataUrl: string, cssPixels: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = Math.max(1, img.height - cssPixels * EXPORT_PIXEL_RATIO);
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Could not create the chart image."));
    img.src = dataUrl;
  });
}

/** Dragging labels is turned off on small touch screens, where it fights with scrolling. */
function canDragCallouts(): boolean {
  return !(window.matchMedia("(max-width: 639px)").matches && "ontouchstart" in window);
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function isCallout(target: unknown): boolean {
  let el = target as { name?: string; parent?: unknown } | null | undefined;
  while (el) {
    if (el.name === CALLOUT_NAME) return true;
    el = el.parent as typeof el;
  }
  return false;
}

/**
 * The line chart with its arrow labels and notes. It knows nothing about the
 * page around it, so it can be reused elsewhere (e.g. inside PowerBanks.com).
 */
export const PowerChart = forwardRef<PowerChartHandle, Props>(function PowerChart(props, ref) {
  const { height = 480, dates, labels, series, startIndex, endIndex, percentMode, trends } = props;
  const seriesLabels = props.seriesLabels ?? NO_LABELS;
  const notes = props.notes ?? NO_NOTES;

  const chartRef = useRef<EChartsType | null>(null);
  const rangeTimer = useRef<number | undefined>(undefined);
  const hoverTimer = useRef<number | undefined>(undefined);

  // The latest props, for event handlers that outlive a render.
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  // Callout layer state (not React state: it changes on every animation frame while dragging).
  const layer = useRef({
    measure: null as Measure | null,
    version: 0,
    signature: "",
    boxes: [] as CalloutBox[],
    plot: { x: 0, y: 0, w: 0, h: 0 } as Rect,
    previousAuto: new Map<string, Point>(),
    hoveredNote: null as string | null,
    dragging: false,
  });

  const option = useMemo(
    () => buildOption({ dates, labels, series, startIndex, endIndex, percentMode, trends }),
    [dates, labels, series, startIndex, endIndex, percentMode, trends],
  );

  /** Pixel helpers for the current chart state. Null until the chart has a size. */
  const getGeometry = useCallback(() => {
    const chart = chartRef.current;
    const p = latest.current;
    if (!chart || chart.isDisposed() || p.series.length === 0) return null;

    const axes = axisIndexes(p.series, p.percentMode);
    const right = gridRight(axes.includes(1), p.trends.length > 0);
    const plot: Rect = {
      x: GRID.left,
      y: GRID.top,
      w: chart.getWidth() - GRID.left - right,
      h: chart.getHeight() - GRID.top - GRID.bottom,
    };
    if (plot.w <= 0 || plot.h <= 0) return null;

    // The slider may be mid-drag, so read the live range from the chart.
    const zoom = (chart.getOption() as { dataZoom?: { startValue?: number; endValue?: number }[] }).dataZoom?.[0];
    const start = Math.round(zoom?.startValue ?? p.startIndex);
    const end = Math.round(zoom?.endValue ?? p.endIndex);

    // Both axes are linear, so two reference pixels per axis give every position.
    const x0 = chart.convertToPixel({ xAxisIndex: 0 }, start) as number;
    const x1 = chart.convertToPixel({ xAxisIndex: 0 }, end) as number;
    const xAt = (index: number) => (end === start ? x0 : x0 + ((index - start) * (x1 - x0)) / (end - start));
    const yScale = [0, 1].map((axis) => {
      if (!axes.includes(axis)) return null;
      const a = chart.convertToPixel({ yAxisIndex: axis }, 0) as number;
      const b = chart.convertToPixel({ yAxisIndex: axis }, 1) as number;
      return { a, slope: b - a };
    });
    if ([x0, x1].some((v) => !Number.isFinite(v))) return null;

    // Values as drawn (raw, or % change from the first point of the saved range).
    const bases = p.series.map((s) => percentBase(s.values, p.startIndex, p.endIndex));
    const shown = (seriesIndex: number, index: number) => toDisplay(p.series[seriesIndex].values[index], bases[seriesIndex], p.percentMode);
    const pixel = (seriesIndex: number, index: number): Point | null => {
      const v = shown(seriesIndex, index);
      const scale = yScale[axes[seriesIndex]];
      if (v == null || !scale) return null;
      return [xAt(index), scale.a + v * scale.slope];
    };

    return { chart, p, plot, start, end, xAt, x0, x1, shown, pixel };
  }, []);

  /** Recompute where the labels and notes go and redraw them if anything moved. */
  const relayout = useCallback(
    (force = false) => {
      const state = layer.current;
      if (state.dragging) return;
      const geo = getGeometry();
      if (!geo) return;
      const { chart, p, plot, start, end, pixel, shown } = geo;
      state.measure ??= createMeasure();
      state.plot = plot;

      const specs: CalloutSpec[] = [];
      const lines: Point[][] = [];
      const step = Math.max(1, Math.ceil((end - start + 1) / 400));

      p.series.forEach((s, i) => {
        // The visible line, for keeping boxes off it.
        const line: Point[] = [];
        for (let idx = start; idx <= end; idx += step) {
          const px = pixel(i, idx);
          if (px) line.push(px);
        }
        const lastPx = pixel(i, end);
        if (lastPx && (end - start) % step !== 0) line.push(lastPx);
        if (line.length) lines.push(line);

        const latestIndex = lastVisibleIndex(s.values, start, end);
        if (latestIndex < 0) return;

        const setting = (p.seriesLabels ?? NO_LABELS).find((l) => l.datasetId === s.id);
        const wanted = setting?.anchorDate ? p.dates.indexOf(setting.anchorDate) : -1;
        const custom = wanted >= start && wanted <= end && wanted !== latestIndex && s.values[wanted] != null;
        const anchorIndex = custom ? wanted : latestIndex;
        const anchor = pixel(i, anchorIndex);
        if (!anchor) return;

        const pct = p.percentMode ? shown(i, anchorIndex) : null;
        specs.push({
          id: `label:${s.id}`,
          kind: "label",
          color: s.color,
          title: s.shortName,
          text:
            `${formatValueWithUnit(s.values[anchorIndex]!, s.unit)}` +
            (pct != null ? ` (${formatSignedPercent(pct)})` : "") +
            ` · ${p.labels[anchorIndex]}`,
          anchor,
          pos: setting?.pos ?? null,
          link: custom ? "Reset to latest" : undefined,
        });
      });

      for (const note of p.notes ?? NO_NOTES) {
        const i = p.series.findIndex((s) => s.id === note.datasetId);
        const index = p.dates.indexOf(note.anchorDate);
        // A note outside the visible range is hidden, not deleted.
        if (i < 0 || index < start || index > end) continue;
        const anchor = pixel(i, index);
        if (!anchor) continue;
        specs.push({
          id: `note:${note.id}`,
          kind: "note",
          color: p.series[i].color,
          text: note.text,
          anchor,
          pos: note.pos,
          tools: state.hoveredNote === note.id,
        });
      }

      const boxes = layoutCallouts(specs, plot, lines, state.measure, state.previousAuto);
      const signature = JSON.stringify(
        boxes.map((b) => [b.id, Math.round(b.box.x), Math.round(b.box.y), b.box.w, b.box.h, Math.round(b.anchor[0]), Math.round(b.anchor[1]), b.title, b.text, b.link, b.tools, b.color]),
      );
      state.boxes = boxes;
      if (!force && signature === state.signature) return;
      state.signature = signature;

      const componentId = `callouts-${++state.version}`;
      const prefix = "";
      const draggable = canDragCallouts();
      const built = buildGraphic(
        boxes,
        plot,
        prefix,
        {
          onDragStart: () => {
            state.dragging = true;
            chart.dispatchAction({ type: "hideTip" });
          },
          onDrag: (id, x, y) => {
            const box = state.boxes.find((b) => b.id === id);
            if (!box) return;
            const shapes = arrowShapes(arrowGeometry({ ...box.box, x, y }, box.anchor));
            const ids = arrowElementIds(prefix, id);
            chart.setOption({ graphic: [{ id: componentId, elements: [{ id: ids.line, ...shapes.line }, { id: ids.head, ...shapes.head }] }] });
          },
          onDragEnd: (id, x, y) => {
            state.dragging = false;
            const box = state.boxes.find((b) => b.id === id);
            if (box) box.box = { ...box.box, x, y };
            const pos = boxToPos({ x, y }, state.plot);
            const [kind, key] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
            if (kind === "label") latest.current.onLabelChange?.(key, { pos });
            else latest.current.onNoteMove?.(key, pos);
          },
          onLink: (id) => latest.current.onLabelChange?.(id.slice(id.indexOf(":") + 1), { anchorDate: null }),
          onEdit: (id) => {
            const box = state.boxes.find((b) => b.id === id);
            if (box) latest.current.onNoteEdit?.(id.slice(id.indexOf(":") + 1), [box.box.x, box.box.y]);
          },
          onDelete: (id) => latest.current.onNoteDelete?.(id.slice(id.indexOf(":") + 1)),
          onHover: (id) => {
            window.clearTimeout(hoverTimer.current);
            const noteId = id ? id.slice(id.indexOf(":") + 1) : null;
            const apply = () => {
              if (state.hoveredNote === noteId) return;
              state.hoveredNote = noteId;
              relayout();
            };
            // Hide after a short delay so moving between the box and its buttons doesn't flicker.
            if (noteId) apply();
            else hoverTimer.current = window.setTimeout(apply, HOVER_HIDE_MS);
          },
        },
        draggable,
      );

      // A new graphic component replaces the previous one outright, so nothing stale is left behind.
      chart.setOption({ graphic: [{ id: componentId, elements: built.elements }] }, { replaceMerge: ["graphic"] });
    },
    [getGeometry],
  );

  const handleReady = useCallback(
    (chart: EChartsType) => {
      chartRef.current = chart;
      // A brand-new chart instance has no graphic elements yet.
      layer.current.signature = "";

      chart.on("datazoom", () => {
        window.clearTimeout(rangeTimer.current);
        rangeTimer.current = window.setTimeout(() => {
          const zoom = (chart.getOption() as { dataZoom?: { startValue?: number; endValue?: number }[] }).dataZoom?.[0];
          if (zoom?.startValue == null || zoom.endValue == null) return;
          latest.current.onRangeChange?.(Math.round(zoom.startValue), Math.round(zoom.endValue));
        }, RANGE_DEBOUNCE_MS);
      });

      // Labels follow the lines after every render: slider drags, resizes, new data.
      // (Deferred a tick: "finished" can fire while ECharts is still inside setOption.)
      chart.on("finished", () => queueMicrotask(() => relayout()));

      // Clicking a line moves that label's anchor there (or, in pick mode, picks a point for a note).
      chart.getZr().on("click", (e: { offsetX: number; offsetY: number; target?: unknown }) => {
        if (isCallout(e.target)) return;
        const geo = getGeometry();
        if (!geo) return;
        const { p, plot, start, end, x0, x1, pixel } = geo;
        if (e.offsetX < plot.x - 6 || e.offsetX > plot.x + plot.w + 6 || e.offsetY < plot.y || e.offsetY > plot.y + plot.h) return;

        const index =
          end === start ? start : Math.min(end, Math.max(start, Math.round(start + ((e.offsetX - x0) * (end - start)) / (x1 - x0))));
        let best: PointClick | null = null;
        let bestDistance = Infinity;
        p.series.forEach((s, i) => {
          const px = pixel(i, index);
          if (!px) return;
          // Distance to the drawn line (the segments either side of the point), not just to the point.
          const click: Point = [e.offsetX, e.offsetY];
          let distance = Math.hypot(px[0] - click[0], px[1] - click[1]);
          for (const neighbour of [index - 1, index + 1]) {
            const other = neighbour >= start && neighbour <= end ? pixel(i, neighbour) : null;
            if (other) distance = Math.min(distance, distanceToSegment(click, px, other));
          }
          if (distance < bestDistance) {
            bestDistance = distance;
            best = { seriesId: s.id, index, x: px[0], y: px[1], near: distance <= NEAR_LINE_PX };
          }
        });
        if (best) latest.current.onPointClick?.(best);
      });

      relayout();
    },
    [getGeometry, relayout],
  );

  // After React has applied new props to the chart, lay the labels out again.
  useEffect(() => {
    relayout();
  }, [relayout, option, seriesLabels, notes]);

  useEffect(
    () => () => {
      window.clearTimeout(rangeTimer.current);
      window.clearTimeout(hoverTimer.current);
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      async getImageDataUrl() {
        const chart = chartRef.current;
        if (!chart) throw new Error("The chart is not ready yet.");
        // Exports never show the note edit/delete buttons or the slider.
        window.clearTimeout(hoverTimer.current);
        layer.current.hoveredNote = null;
        relayout();
        chart.dispatchAction({ type: "hideTip" });
        chart.setOption({ dataZoom: [{ id: "range", show: false }] });
        let url: string;
        try {
          url = chart.getDataURL({ type: "png", pixelRatio: EXPORT_PIXEL_RATIO, backgroundColor: "#fff" });
        } finally {
          chart.setOption({ dataZoom: [{ id: "range", show: true }] });
        }
        return cropBottom(url, EXPORT_CROP_BOTTOM);
      },
    }),
    [relayout],
  );

  return (
    <ReactECharts
      option={option}
      // Series and axes are replaced (not merged) so removed datasets disappear.
      replaceMerge={REPLACE}
      style={{ height, width: "100%" }}
      onChartReady={handleReady}
      opts={OPTS}
    />
  );
});
