import { CATALOG, DEFAULT_DATASET_ID, getDataset, type Unit } from "@/lib/datasets/catalog";
import { convertPeriod, isQuarter, isValidPeriod, periodLabel, shiftPeriod, type View } from "@/lib/period";
import type { StatsMode } from "@/lib/stats/sentences";
import { MAX_DATASETS, MAX_NOTES } from "@/lib/theme";
import type { ChartConfig, LabelState, NoteState, Pos } from "./config";

export type Range = { from: string; to: string };

/** Everything the Chart Builder keeps about the chart being built. */
export type BuilderState = {
  datasets: string[]; // catalog ids, in slot order (slot 1 is always filled)
  view: View;
  range: Range | null; // null = the default range (last 5 years)
  statsMode: StatsMode;
  percentChangeMode: boolean;
  title: string; // used only when titleEdited
  titleEdited: boolean;
  topText: string; // used only when topTextEdited
  topTextEdited: boolean;
  bottomText: string;
  labels: LabelState[];
  notes: NoteState[];
};

export const DEFAULT_STATE: BuilderState = {
  datasets: [DEFAULT_DATASET_ID],
  view: "monthly",
  range: null,
  statsMode: "summary",
  percentChangeMode: false,
  title: "",
  titleEdited: false,
  topText: "",
  topTextEdited: false,
  bottomText: "",
  labels: [],
  notes: [],
};

export type Action =
  | { type: "load"; state: BuilderState }
  | { type: "reset" }
  | { type: "setDataset"; slot: number; id: string | null }
  | { type: "setView"; view: View }
  | { type: "setRange"; range: Range | null }
  | { type: "setStatsMode"; mode: StatsMode }
  | { type: "setPercentMode"; on: boolean }
  | { type: "setTitle"; title: string }
  | { type: "resetTitle" }
  | { type: "setTopText"; text: string }
  | { type: "regenerateTopText" }
  | { type: "setBottomText"; text: string }
  | { type: "setLabel"; datasetId: string; patch: Partial<Pick<LabelState, "anchorDate" | "pos">> }
  | { type: "addNote"; note: NoteState }
  | { type: "updateNote"; id: string; patch: Partial<Pick<NoteState, "text" | "pos">> }
  | { type: "removeNote"; id: string };

/** Number of different measurement units among the given datasets. */
export function distinctUnits(ids: string[]): Unit[] {
  const units: Unit[] = [];
  for (const id of ids) {
    const unit = getDataset(id)?.unit;
    if (unit && !units.includes(unit)) units.push(unit);
  }
  return units;
}

/** A chart can show at most 2 units (left and right axis) unless "% change" mode is on. */
export function needsPercentMode(ids: string[]): boolean {
  return distinctUnits(ids).length > 2;
}

function withDatasets(state: BuilderState, datasets: string[]): BuilderState {
  return {
    ...state,
    datasets,
    labels: state.labels.filter((l) => datasets.includes(l.datasetId)),
    notes: state.notes.filter((n) => datasets.includes(n.datasetId)),
    statsMode: state.statsMode === "relationship" && datasets.length < 2 ? "summary" : state.statsMode,
  };
}

export function reducer(state: BuilderState, action: Action): BuilderState {
  switch (action.type) {
    case "load":
      return action.state;
    case "reset":
      return DEFAULT_STATE;
    case "setDataset": {
      const datasets = [...state.datasets];
      if (action.id === null) {
        if (action.slot === 0 || action.slot >= datasets.length) return state;
        datasets.splice(action.slot, 1);
      } else {
        if (!getDataset(action.id) || datasets.includes(action.id)) return state;
        if (action.slot < datasets.length) datasets[action.slot] = action.id;
        else if (datasets.length < MAX_DATASETS) datasets.push(action.id);
        else return state;
      }
      const next = withDatasets(state, datasets);
      // More than 2 units can only be shown as % change.
      return needsPercentMode(datasets) ? { ...next, percentChangeMode: true } : next;
    }
    case "setView": {
      if (action.view === state.view) return state;
      return {
        ...state,
        view: action.view,
        // Keep the same date span: Jan 2021–Aug 2026 ⇄ Q1 2021–Q3 2026 (clamped to available data later).
        range: state.range && {
          from: convertPeriod(state.range.from, action.view, "start"),
          to: convertPeriod(state.range.to, action.view, "end"),
        },
        // Anchors are dates in the old view; labels go back to "latest", notes move to the matching period.
        labels: state.labels.map((l) => ({ ...l, anchorDate: null })),
        notes: state.notes.map((n) => ({ ...n, anchorDate: convertPeriod(n.anchorDate, action.view, "end") })),
      };
    }
    case "setRange":
      return { ...state, range: action.range };
    case "setStatsMode":
      if (action.mode === "relationship" && state.datasets.length < 2) return state;
      return { ...state, statsMode: action.mode };
    case "setPercentMode":
      if (!action.on && needsPercentMode(state.datasets)) return state;
      return { ...state, percentChangeMode: action.on };
    case "setTitle":
      return { ...state, title: action.title, titleEdited: true };
    case "resetTitle":
      return { ...state, title: "", titleEdited: false };
    case "setTopText":
      return { ...state, topText: action.text, topTextEdited: true };
    case "regenerateTopText":
      return { ...state, topText: "", topTextEdited: false };
    case "setBottomText":
      return { ...state, bottomText: action.text };
    case "setLabel": {
      const existing = state.labels.find((l) => l.datasetId === action.datasetId);
      const updated: LabelState = { datasetId: action.datasetId, anchorDate: null, pos: null, ...existing, ...action.patch };
      return { ...state, labels: [...state.labels.filter((l) => l.datasetId !== action.datasetId), updated] };
    }
    case "addNote":
      if (state.notes.length >= MAX_NOTES) return state;
      return { ...state, notes: [...state.notes, action.note] };
    case "updateNote":
      return { ...state, notes: state.notes.map((n) => (n.id === action.id ? { ...n, ...action.patch } : n)) };
    case "removeNote":
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id) };
  }
}

// ---------- Range helpers ----------

export type ResolvedRange = { startIndex: number; endIndex: number; from: string; to: string };

/** Periods in N years for the kind of period given. */
function periodsPerYear(period: string): number {
  return isQuarter(period) ? 4 : 12;
}

/** The range that starts `years` before the latest date. */
export function lastYearsRange(dates: string[], years: number): Range | null {
  if (dates.length === 0) return null;
  const to = dates[dates.length - 1];
  return { from: shiftPeriod(to, -years * periodsPerYear(to)), to };
}

/**
 * Turn the stored range into positions on the date axis, clamped to the data
 * that exists. A null range means the default: the last 5 years.
 */
export function resolveRange(range: Range | null, dates: string[]): ResolvedRange | null {
  if (dates.length === 0) return null;
  const wanted = range ?? lastYearsRange(dates, 5)!;
  let startIndex = dates.findIndex((d) => d >= wanted.from);
  let endIndex = -1;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i] <= wanted.to) {
      endIndex = i;
      break;
    }
  }
  if (startIndex === -1) startIndex = dates.length - 1;
  if (endIndex === -1) endIndex = 0;
  if (startIndex > endIndex) [startIndex, endIndex] = [endIndex, startIndex];
  return { startIndex, endIndex, from: dates[startIndex], to: dates[endIndex] };
}

// ---------- Titles ----------

export function autoTitle(datasetIds: string[], range: Range | null, view: View): string {
  const names = datasetIds.map((id) => getDataset(id)?.name).filter(Boolean) as string[];
  const subject = names.length <= 1 ? (names[0] ?? "Chart") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  if (!range) return subject;
  return `${subject}, ${periodLabel(range.from)} – ${periodLabel(range.to)}, ${view}`;
}

// ---------- URL state ----------

/** The part of the state kept in the query string, so a refresh or shared link restores the chart. */
export function stateToQuery(state: BuilderState): string {
  const params = new URLSearchParams();
  params.set("d", state.datasets.join(","));
  if (state.view !== "monthly") params.set("view", state.view);
  if (state.range) {
    params.set("from", state.range.from);
    params.set("to", state.range.to);
  }
  if (state.statsMode !== "summary") params.set("stats", state.statsMode);
  if (state.percentChangeMode) params.set("pct", "1");
  return params.toString();
}

const STATS_MODES: StatsMode[] = ["summary", "trend", "relationship", "none"];

/** Read chart state from a query string. Anything missing or invalid falls back to the default. */
export function queryToState(search: string): Partial<BuilderState> | null {
  const params = new URLSearchParams(search);
  if (!params.has("d")) return null;

  const ids: string[] = [];
  for (const id of (params.get("d") ?? "").split(",")) {
    if (CATALOG.some((d) => d.id === id) && !ids.includes(id) && ids.length < MAX_DATASETS) ids.push(id);
  }
  const datasets = ids.length ? ids : [DEFAULT_DATASET_ID];

  const view: View = params.get("view") === "quarterly" ? "quarterly" : "monthly";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const quarterly = view === "quarterly";
  const rangeOk =
    isValidPeriod(from) && isValidPeriod(to) && isQuarter(from) === quarterly && isQuarter(to) === quarterly && from <= to;

  let statsMode = (STATS_MODES.find((m) => m === params.get("stats")) ?? "summary") as StatsMode;
  if (statsMode === "relationship" && datasets.length < 2) statsMode = "summary";

  return {
    datasets,
    view,
    range: rangeOk ? { from, to } : null,
    statsMode,
    percentChangeMode: params.get("pct") === "1" || needsPercentMode(datasets),
  };
}

// ---------- Saved charts ----------

export function stateToConfig(state: BuilderState, resolved: Range, title: string): ChartConfig {
  return {
    datasets: state.datasets,
    view: state.view,
    range: { from: resolved.from, to: resolved.to },
    statsMode: state.statsMode,
    percentChangeMode: state.percentChangeMode,
    title,
    titleEdited: state.titleEdited,
    topTextEdited: state.topTextEdited,
    labels: state.labels,
    notes: state.notes,
  };
}

export function configToState(config: ChartConfig, topText: string, bottomText: string): BuilderState {
  const datasets = config.datasets.filter((id) => getDataset(id));
  return {
    datasets: datasets.length ? datasets : [DEFAULT_DATASET_ID],
    view: config.view,
    range: config.range,
    statsMode: config.statsMode,
    percentChangeMode: config.percentChangeMode,
    title: config.title,
    titleEdited: config.titleEdited,
    topText,
    topTextEdited: config.topTextEdited,
    bottomText,
    labels: config.labels,
    notes: config.notes,
  };
}

export type { LabelState, NoteState, Pos };
