"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { configToState, DEFAULT_STATE, queryToState, reducer, stateToQuery, type BuilderState } from "@/lib/chart/state";
import type { SavedChartDto } from "@/lib/reports/client";

/** Set when the builder was opened from a report's "Edit" button. */
export type EditTarget = { chartId: string; reportId: string | null };

const STORAGE_KEY = "powergraphs:chart";
/** Query parameters that aren't chart state and must survive URL updates. */
const KEEP_PARAMS = ["edit", "report"];

function readSession(): BuilderState | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BuilderState>;
    if (!Array.isArray(parsed.datasets) || parsed.datasets.length === 0) return null;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return null; // storage blocked or corrupted — start fresh
  }
}

function writeSession(state: BuilderState) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked — the URL still holds the main state
  }
}

/** The state to start with: the link's chart, plus this tab's unsaved texts/labels when they belong to it. */
function initialState(): BuilderState {
  const fromUrl = queryToState(window.location.search);
  const stored = readSession();
  if (!fromUrl) return stored ?? DEFAULT_STATE;
  const sameChart = stored && stored.datasets.join(",") === fromUrl.datasets?.join(",") && stored.view === fromUrl.view;
  return { ...DEFAULT_STATE, ...(sameChart ? stored : {}), ...fromUrl };
}

/**
 * Chart Builder state. The main settings live in the URL (so a refresh or a
 * shared link restores the chart); texts, label positions, and notes are kept
 * in sessionStorage.
 */
export function useBuilderState() {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chartId = params.get("edit");
    if (!chartId) {
      dispatch({ type: "load", state: initialState() });
      setHydrated(true);
      return;
    }
    // Editing a chart from a report: start from the saved snapshot, not from this tab's last chart.
    let cancelled = false;
    api<{ chart: SavedChartDto }>(`/api/charts/${encodeURIComponent(chartId)}`)
      .then(({ chart }) => {
        if (cancelled) return;
        if (!chart.config) throw new Error("This saved chart can't be opened for editing any more.");
        dispatch({ type: "load", state: configToState(chart.config, chart.topText, chart.bottomText) });
        setEditing({ chartId, reportId: params.get("report") });
      })
      .catch((err) => {
        if (cancelled) return;
        setEditError(errorMessage(err));
        dispatch({ type: "load", state: initialState() });
      })
      .finally(() => !cancelled && setHydrated(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const current = new URLSearchParams(window.location.search);
    const next = new URLSearchParams(stateToQuery(state));
    if (editing) {
      for (const name of KEEP_PARAMS) {
        const value = current.get(name);
        if (value) next.set(name, value);
      }
    }
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${next.toString()}`);
    // A chart being edited for a report shouldn't replace this tab's own work in progress.
    if (!editing) writeSession(state);
  }, [state, hydrated, editing]);

  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  /** Leave "editing a report chart" mode and carry on as a normal new chart. */
  const stopEditing = useCallback(() => setEditing(null), []);

  return { state, dispatch, hydrated, reset, editing, editError, stopEditing };
}
