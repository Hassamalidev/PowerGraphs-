"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { DEFAULT_STATE, queryToState, reducer, stateToQuery, type BuilderState } from "@/lib/chart/state";

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

  useEffect(() => {
    dispatch({ type: "load", state: initialState() });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const current = new URLSearchParams(window.location.search);
    const next = new URLSearchParams(stateToQuery(state));
    for (const name of KEEP_PARAMS) {
      const value = current.get(name);
      if (value) next.set(name, value);
    }
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${next.toString()}`);
    writeSession(state);
  }, [state, hydrated]);

  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  return { state, dispatch, hydrated, reset };
}
