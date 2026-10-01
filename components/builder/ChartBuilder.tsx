"use client";

import { useCallback, useMemo } from "react";
import { PowerChart } from "@/components/chart/PowerChart";
import { RangeControls } from "@/components/chart/RangeControls";
import type { TrendLine } from "@/components/chart/chartModel";
import { DatasetPicker } from "@/components/controls/DatasetPicker";
import { ViewToggle } from "@/components/controls/ViewToggle";
import { AppHeader } from "@/components/layout/AppHeader";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { autoTitle } from "@/lib/chart/state";
import { formatShortDate } from "@/lib/format";
import { useBuilderState } from "./useBuilderState";
import { useChartData } from "./useChartData";

const NO_TRENDS: TrendLine[] = [];

/** The main screen: pick datasets, see the chart, choose the range and view. */
export function ChartBuilder() {
  const { state, dispatch, hydrated, reset } = useBuilderState();
  const { data, resolved, error, retry } = useChartData(state);

  const handleRange = useCallback(
    (startIndex: number, endIndex: number) => {
      if (!data) return;
      dispatch({ type: "setRange", range: { from: data.dates[startIndex], to: data.dates[endIndex] } });
    },
    [data, dispatch],
  );

  const meta = data?.responses[0]?.meta;
  const fallback = data?.responses.find((r) => r.meta.isFallback)?.meta;
  const incompleteNote = data?.responses.find((r) => r.meta.incompleteQuarterNote)?.meta.incompleteQuarterNote;
  const title = useMemo(
    () => (state.titleEdited ? state.title : autoTitle(state.datasets, resolved, state.view)),
    [state.titleEdited, state.title, state.datasets, state.view, resolved],
  );

  return (
    <>
      <AppHeader>
        <Button onClick={reset}>Reset chart</Button>
      </AppHeader>

      <main className="screen-only mx-auto flex max-w-[1280px] flex-col gap-5 px-4 py-5 sm:px-6">
        {fallback && (
          <Banner>
            We couldn&apos;t reach the Census website. Showing the saved copy from{" "}
            {formatShortDate(fallback.fallbackDate ?? fallback.dataAsOf)}.
          </Banner>
        )}

        <section aria-label="Choose data" className="rounded-xl border border-line bg-surface p-4">
          <DatasetPicker
            selected={state.datasets}
            onChange={(slot, id) => dispatch({ type: "setDataset", slot, id })}
            slots={1}
          />
        </section>

        <section aria-label="Chart" className="rounded-xl border border-line bg-surface p-4">
          {error ? (
            <Banner kind="error">
              <p className="font-semibold">We couldn&apos;t load the chart data.</p>
              <p className="mb-3">{error}</p>
              <Button onClick={retry}>Try again</Button>
            </Banner>
          ) : !hydrated || !data || !resolved ? (
            <div aria-busy="true" aria-label="Loading the chart">
              <div className="skeleton mb-3 h-8 w-2/3" />
              <div className="skeleton h-[480px] w-full" />
            </div>
          ) : (
            <>
              <h1 className="mb-2 text-xl font-bold sm:text-2xl">{title}</h1>
              <PowerChart
                dates={data.dates}
                labels={data.labels}
                series={data.series}
                startIndex={resolved.startIndex}
                endIndex={resolved.endIndex}
                percentMode={false}
                trends={NO_TRENDS}
                onRangeChange={handleRange}
              />
              <div className="mt-2 flex flex-col gap-4">
                <RangeControls
                  dates={data.dates}
                  labels={data.labels}
                  startIndex={resolved.startIndex}
                  endIndex={resolved.endIndex}
                  onChange={handleRange}
                />
                <ViewToggle value={state.view} onChange={(view) => dispatch({ type: "setView", view })} />
                {incompleteNote && <p className="text-muted">{incompleteNote}</p>}
                {meta && (
                  <p className="text-sm text-muted">
                    Source: {meta.sourceLabel}. Data as of {formatShortDate(meta.dataAsOf)}.
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}
