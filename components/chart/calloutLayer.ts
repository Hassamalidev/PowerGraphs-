// Arrow labels and notes, drawn with ECharts `graphic` elements so they are
// part of the canvas and therefore appear in printed, PDF, and image exports.
//
// This file is pure layout + element building. PowerChart feeds it pixel
// positions and applies the result to the chart.

import { COLORS, FONT_FAMILY } from "@/lib/theme";

export type Point = [number, number];
export type Rect = { x: number; y: number; w: number; h: number };

export type CalloutSpec = {
  /** Unique: "label:<datasetId>" or "note:<noteId>". */
  id: string;
  kind: "label" | "note";
  color: string;
  /** Bold first line (dataset labels only). */
  title?: string;
  /** Second line of a label, or the text of a note. */
  text: string;
  /** Pixel position the arrow points at. */
  anchor: Point;
  /** Saved position as a percent of the plot area; null = place automatically. */
  pos: { x: number; y: number } | null;
  /** A clickable line at the bottom, e.g. "Reset to latest". */
  link?: string;
  /** Show the edit/delete buttons (a hovered note). */
  tools?: boolean;
};

type TextLine = { text: string; y: number; size: number; bold: boolean; color: string; isLink: boolean };

export type CalloutBox = CalloutSpec & { box: Rect; lines: TextLine[] };

export type Measure = (text: string, size: number, bold: boolean) => number;

const PAD_X = 10;
const PAD_Y = 7;
const NOTE_MAX_TEXT_WIDTH = 200;
const BOX_GAP = 8; // minimum space between two boxes
const LINE_GAP = 10; // minimum space between a box and a data line
const ARROW_STANDOFF = 8; // the arrow tip stops short so the data point stays visible
const HEAD_LENGTH = 10;
const HEAD_HALF_WIDTH = 4.5;
const Z = 100;

export function createMeasure(): Measure {
  const ctx = document.createElement("canvas").getContext("2d");
  return (text, size, bold) => {
    if (!ctx) return text.length * size * 0.55;
    ctx.font = `${bold ? 700 : 400} ${size}px ${FONT_FAMILY}`;
    return ctx.measureText(text).width;
  };
}

function wrapText(text: string, maxWidth: number, measure: Measure, size: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && measure(candidate, size, false) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

/** Work out the text lines and the size of a box. */
function measureBox(spec: CalloutSpec, measure: Measure): { w: number; h: number; lines: TextLine[] } {
  const lines: TextLine[] = [];
  let y = PAD_Y;
  let width = 0;
  const add = (text: string, size: number, bold: boolean, color: string, isLink = false) => {
    lines.push({ text, y, size, bold, color, isLink });
    width = Math.max(width, measure(text, size, bold));
    y += Math.round(size * 1.38);
  };

  if (spec.kind === "label") {
    if (spec.title) add(spec.title, 14, true, COLORS.text);
    add(spec.text, 13, false, COLORS.text);
  } else {
    for (const line of wrapText(spec.text, NOTE_MAX_TEXT_WIDTH, measure, 13)) add(line, 13, false, COLORS.text);
  }
  if (spec.link) add(spec.link, 12, false, COLORS.brand, true);

  return { w: Math.ceil(width) + PAD_X * 2, h: y + PAD_Y - 2, lines };
}

function inflate(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 };
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Does the segment p→q pass through the rectangle? (Liang–Barsky clipping.) */
export function segmentHitsRect(p: Point, q: Point, r: Rect): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const checks: [number, number][] = [
    [-dx, p[0] - r.x],
    [dx, r.x + r.w - p[0]],
    [-dy, p[1] - r.y],
    [dy, r.y + r.h - p[1]],
  ];
  for (const [pk, qk] of checks) {
    if (pk === 0) {
      if (qk < 0) return false;
    } else {
      const t = qk / pk;
      if (pk < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

function lineHitsRect(line: Point[], r: Rect): boolean {
  if (line.length === 1) return segmentHitsRect(line[0], line[0], r);
  for (let i = 1; i < line.length; i++) if (segmentHitsRect(line[i - 1], line[i], r)) return true;
  return false;
}

function clampBox(box: Rect, plot: Rect): Rect {
  return {
    ...box,
    x: Math.min(Math.max(box.x, plot.x), Math.max(plot.x, plot.x + plot.w - box.w)),
    y: Math.min(Math.max(box.y, plot.y), Math.max(plot.y, plot.y + plot.h - box.h)),
  };
}

export function posToBox(pos: { x: number; y: number }, size: { w: number; h: number }, plot: Rect): Rect {
  return clampBox({ x: plot.x + (pos.x / 100) * plot.w, y: plot.y + (pos.y / 100) * plot.h, ...size }, plot);
}

export function boxToPos(box: { x: number; y: number }, plot: Rect): { x: number; y: number } {
  const pct = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);
  return { x: pct(box.x - plot.x, plot.w), y: pct(box.y - plot.y, plot.h) };
}

/**
 * Decide where every box goes.
 * - A box the user has dragged keeps its saved position.
 * - Other boxes are placed in empty space (labels prefer the upper-left, notes
 *   prefer to sit near their point), not covering any line or other box.
 * @param lines pixel polylines of the visible data lines
 * @param previous last automatic positions (offset from the plot corner), reused while still free so boxes don't jump
 */
export function layoutCallouts(
  specs: CalloutSpec[],
  plot: Rect,
  lines: Point[][],
  measure: Measure,
  previous: Map<string, Point>,
): CalloutBox[] {
  const placed: CalloutBox[] = [];
  const isFree = (box: Rect, respectLines: boolean) => {
    if (placed.some((p) => rectsOverlap(inflate(box, BOX_GAP), p.box))) return false;
    if (!respectLines) return true;
    const guard = inflate(box, LINE_GAP);
    return !lines.some((line) => lineHitsRect(line, guard));
  };

  // Dragged boxes first, so automatic ones flow around them.
  const ordered = [...specs.filter((s) => s.pos), ...specs.filter((s) => !s.pos)];

  for (const spec of ordered) {
    const size = measureBox(spec, measure);
    let box: Rect | null = null;

    if (spec.pos) {
      box = posToBox(spec.pos, size, plot);
    } else {
      const before = previous.get(spec.id);
      if (before) {
        const candidate = clampBox({ x: plot.x + before[0], y: plot.y + before[1], ...size }, plot);
        if (isFree(candidate, true)) box = candidate;
      }
      if (!box) box = findFreeSpot(spec, size, plot, isFree);
      previous.set(spec.id, [box.x - plot.x, box.y - plot.y]);
    }

    placed.push({ ...spec, box, lines: size.lines });
  }

  // Return in the original order.
  return specs.map((s) => placed.find((p) => p.id === s.id)!);
}

function findFreeSpot(
  spec: CalloutSpec,
  size: { w: number; h: number },
  plot: Rect,
  isFree: (box: Rect, respectLines: boolean) => boolean,
): Rect {
  const margin = 10;
  const candidates: { box: Rect; score: number }[] = [];
  const maxX = plot.w - size.w - margin;
  const maxY = plot.h - size.h - margin;
  // Notes like to sit just above-left of their point; labels like the upper-left corner.
  const target: Point =
    spec.kind === "note"
      ? [spec.anchor[0] - plot.x - size.w - 30, spec.anchor[1] - plot.y - size.h - 40]
      : [margin, margin];

  for (let dy = margin; dy <= maxY; dy += 18) {
    for (let dx = margin; dx <= maxX; dx += 24) {
      const score =
        spec.kind === "note" ? Math.hypot(dx - target[0], dy - target[1]) : (dx - margin) * 0.55 + (dy - margin);
      candidates.push({ box: { x: plot.x + dx, y: plot.y + dy, ...size }, score });
    }
  }
  candidates.sort((a, b) => a.score - b.score);

  for (const c of candidates) if (isFree(c.box, true)) return c.box;
  // No empty space: at least don't cover another box.
  for (const c of candidates) if (isFree(c.box, false)) return c.box;
  return clampBox({ x: plot.x + margin, y: plot.y + margin, ...size }, plot);
}

export type Arrow = { from: Point; to: Point; head: Point[] };

/**
 * The arrow from a box to its anchor: it starts at the nearest edge of the
 * box and ends with an arrowhead at the anchor point. Null when the anchor is
 * inside or right next to the box.
 */
export function arrowGeometry(box: Rect, anchor: Point): Arrow | null {
  const from: Point = [
    Math.min(Math.max(anchor[0], box.x), box.x + box.w),
    Math.min(Math.max(anchor[1], box.y), box.y + box.h),
  ];
  const dx = anchor[0] - from[0];
  const dy = anchor[1] - from[1];
  const length = Math.hypot(dx, dy);
  if (length < ARROW_STANDOFF + HEAD_LENGTH + 2) return null;

  const ux = dx / length;
  const uy = dy / length;
  const tip: Point = [anchor[0] - ux * ARROW_STANDOFF, anchor[1] - uy * ARROW_STANDOFF];
  const base: Point = [tip[0] - ux * HEAD_LENGTH, tip[1] - uy * HEAD_LENGTH];
  return {
    from,
    to: base,
    head: [
      tip,
      [base[0] - uy * HEAD_HALF_WIDTH, base[1] + ux * HEAD_HALF_WIDTH],
      [base[0] + uy * HEAD_HALF_WIDTH, base[1] - ux * HEAD_HALF_WIDTH],
    ],
  };
}

export type CalloutHandlers = {
  onDragStart: (id: string) => void;
  /** The box is being dragged; x/y is its new top-left corner. */
  onDrag: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onLink: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onHover: (id: string | null) => void;
};

/** Element names used to recognise clicks that land on a callout. */
export const CALLOUT_NAME = "callout";

type GraphicEl = Record<string, unknown>;

// zrender calls handlers with the element as `this`.
type DragTarget = { x: number; y: number; markRedraw?: () => void };

export function arrowElementIds(prefix: string, id: string) {
  return { line: `${prefix}arrow:${id}`, head: `${prefix}head:${id}` };
}

export function arrowShapes(arrow: Arrow | null) {
  return {
    line: { shape: arrow ? { x1: arrow.from[0], y1: arrow.from[1], x2: arrow.to[0], y2: arrow.to[1] } : { x1: 0, y1: 0, x2: 0, y2: 0 }, invisible: !arrow },
    head: { shape: { points: arrow ? arrow.head : [[0, 0], [0, 0], [0, 0]] }, invisible: !arrow },
  };
}

/**
 * Build the ECharts graphic elements for the laid-out boxes.
 * @param prefix unique per layout pass, so elements never merge with stale ones
 * @returns the elements and every id created (so the next pass can remove them)
 */
export function buildGraphic(
  boxes: CalloutBox[],
  plot: Rect,
  prefix: string,
  handlers: CalloutHandlers,
  draggable: boolean,
): { elements: GraphicEl[]; ids: string[] } {
  const elements: GraphicEl[] = [];
  const ids: string[] = [];
  const push = (el: GraphicEl) => {
    elements.push(el);
    ids.push(el.id as string);
  };
  const cursor = draggable ? "move" : "default";

  for (const b of boxes) {
    const stroke = b.kind === "note" ? COLORS.note : b.color;
    const arrow = arrowGeometry(b.box, b.anchor);
    const shapes = arrowShapes(arrow);
    const arrowIds = arrowElementIds(prefix, b.id);

    push({ id: arrowIds.line, type: "line", silent: true, z: Z, z2: 0, ...shapes.line, style: { stroke, lineWidth: 1.5 } });
    push({ id: arrowIds.head, type: "polygon", silent: true, z: Z, z2: 0, ...shapes.head, style: { fill: stroke } });

    const groupId = `${prefix}box:${b.id}`;
    const child = (suffix: string, el: GraphicEl): GraphicEl => ({
      id: `${groupId}:${suffix}`,
      parentId: groupId,
      name: CALLOUT_NAME,
      z: Z,
      cursor,
      ...el,
    });

    const children: GraphicEl[] = [
      child("bg", {
        type: "rect",
        z2: 1,
        shape: { x: 0, y: 0, width: b.box.w, height: b.box.h, r: 6 },
        style: { fill: "#fff", stroke, lineWidth: 1.5, shadowBlur: 6, shadowColor: "rgba(0,0,0,0.16)", shadowOffsetY: 1 },
      }),
      ...b.lines.map((line, i) =>
        child(`t${i}`, {
          type: "text",
          z2: 2,
          x: PAD_X,
          y: line.y,
          style: {
            text: line.text,
            fill: line.color,
            fontSize: line.size,
            fontWeight: line.bold ? 700 : 400,
            fontFamily: FONT_FAMILY,
            ...(line.isLink ? { textDecoration: "underline" } : {}),
          },
          ...(line.isLink ? { cursor: "pointer", onclick: () => handlers.onLink(b.id) } : {}),
        }),
      ),
    ];

    if (b.tools) {
      // Small round buttons overlapping the top-right corner: pencil = edit, × = delete.
      const tool = (suffix: string, x: number, glyph: string, color: string, onclick: () => void): GraphicEl[] => [
        child(`${suffix}-bg`, {
          type: "circle",
          z2: 3,
          cursor: "pointer",
          shape: { cx: x, cy: 0, r: 12 },
          style: { fill: "#fff", stroke: COLORS.note, lineWidth: 1.5 },
          onclick,
        }),
        child(`${suffix}-icon`, {
          type: "text",
          z2: 4,
          cursor: "pointer",
          x,
          y: 0,
          style: { text: glyph, fill: color, fontSize: 15, fontWeight: 700, fontFamily: FONT_FAMILY, align: "center", verticalAlign: "middle" },
          onclick,
        }),
      ];
      children.push(...tool("edit", b.box.w - 34, "✎", COLORS.text, () => handlers.onEdit(b.id)));
      children.push(...tool("del", b.box.w - 6, "×", COLORS.danger, () => handlers.onDelete(b.id)));
    }

    const maxX = Math.max(plot.x, plot.x + plot.w - b.box.w);
    const maxY = Math.max(plot.y, plot.y + plot.h - b.box.h);

    push({
      id: groupId,
      type: "group",
      name: CALLOUT_NAME,
      x: b.box.x,
      y: b.box.y,
      draggable,
      ondragstart() {
        handlers.onDragStart(b.id);
      },
      ondrag(this: DragTarget) {
        // Keep the box inside the plot area.
        this.x = Math.min(Math.max(this.x, plot.x), maxX);
        this.y = Math.min(Math.max(this.y, plot.y), maxY);
        this.markRedraw?.();
        handlers.onDrag(b.id, this.x, this.y);
      },
      ondragend(this: DragTarget) {
        handlers.onDragEnd(b.id, this.x, this.y);
      },
      ...(b.kind === "note"
        ? {
            onmouseover: () => handlers.onHover(b.id),
            onmouseout: () => handlers.onHover(null),
            onclick: () => handlers.onHover(b.id), // touch screens have no hover
          }
        : {}),
    });
    for (const c of children) push(c);
  }

  return { elements, ids };
}
