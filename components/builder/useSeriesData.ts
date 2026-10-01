"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { View } from "@/lib/period";
import type { SeriesResponse } from "@/lib/series/types";

const key = (id: string, view: View) => `${id}|${view}`;

// Shared across the page so switching back to a dataset or view is instant.
const requests = new Map<string, Promise<SeriesResponse>>();

function load(id: string, view: View): Promise<SeriesResponse> {
  const k = key(id, view);
  let request = requests.get(k);
  if (!request) {
    request = api<SeriesResponse>(`/api/series/${encodeURIComponent(id)}?view=${view}`);
    requests.set(k, request);
    request.catch(() => requests.delete(k)); // let a failed request be retried
  }
  return request;
}

/** Loads the series for the selected datasets in the current view. */
export function useSeriesData(ids: string[], view: View) {
  const [loaded, setLoaded] = useState<Record<string, SeriesResponse>>({});
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const idsKey = ids.join(",");

  useEffect(() => {
    let cancelled = false;
    setError(null);
    for (const id of idsKey.split(",").filter(Boolean)) {
      load(id, view)
        .then((res) => {
          if (!cancelled) setLoaded((prev) => (prev[key(id, view)] ? prev : { ...prev, [key(id, view)]: res }));
        })
        .catch((err) => {
          if (!cancelled) setError(errorMessage(err));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [idsKey, view, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const series = ids.map((id) => loaded[key(id, view)]);
  const ready = series.every(Boolean);
  return { series: ready ? (series as SeriesResponse[]) : null, error: ready ? null : error, retry };
}
