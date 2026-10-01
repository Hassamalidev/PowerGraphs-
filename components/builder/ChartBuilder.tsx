"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { PowerChart, type PointClick, type PowerChartHandle } from "@/components/chart/PowerChart";
import { RangeControls } from "@/components/chart/RangeControls";
import { lastVisibleIndex, type TrendLine } from "@/components/chart/chartModel";
import { DatasetPicker } from "@/components/controls/DatasetPicker";
import { ViewToggle } from "@/components/controls/ViewToggle";
import { AppHeader } from "@/components/layout/AppHeader";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { HelpTip } from "@/components/ui/HelpTip";
import { autoTitle, needsPercentMode } from "@/lib/chart/state";
import { formatShortDate } from "@/lib/format";
import { MAX_NOTES } from "@/lib/theme";
import { EditableTitle } from "./EditableTitle";
import { NotePopover } from "./NotePopover";
import { useBuilderState } from "./useBuilderState";
import { useChartData } from "./useChartData";

const NO_TRENDS: TrendLine[] = [];

/** What the "add / edit a note" flow is doing right now. */
type NoteFlow =
  | null
  | { step: "picking" }
  | { step: "new"; datasetId: string; date: string; x: number; y: number }
  | { step: "edit"; id: string; x: number; y: number };

/** The main screen: pick datasets, see the chart with its arrow labels, choose the range and view. */
export function ChartBuilder() {
  const { state, dispatch, hydrated, reset } = useBuilderState();
  const { data, resolved, error, retry } = useChartData(state);
  const chartRef = useRef<PowerChartHandle>(null);
  const [noteFlow, setNoteFlow] = useState<NoteFlow>(null);
  /** A dataset the user picked that needs "% change" mode before it can be shown. */
  const [pendingDataset, setPendingDataset] = useState<{ slot: number; id: string } | null>(null);

  const handleRange = useCallback(
    (startIndex: number, endIndex: number) => {
      if (!data) return;
      dispatch({ type: "setRange", range: { from: data.dates[startIndex], to: data.dates[endIndex] } });
    },
    [data, dispatch],
  );

  const handleDataset = (slot: number, id: string | null) => {
    setPendingDataset(null);
    if (id) {
      const next = [...state.datasets];
      if (slot < next.length) next[slot] = id;
      else next.push(id);
      // A chart has two axes, so a third kind of measurement needs "% change" mode.
      if (needsPercentMode(next) && !state.percentChangeMode) {
        setPendingDataset({ slot, id });
        return;
      }
    }
    dispatch({ type: "setDataset", slot, id });
  };

  const handlePointClick = useCallback(
    (click: PointClick) => {
      if (!data || !resolved) return;
      const date = data.dates[click.index];
      if (noteFlow?.step === "picking") {
        setNoteFlow({ step: "new", datasetId: click.seriesId, date, x: click.x, y: click.y });
        return;
      }
      if (!click.near) return;
      // Clicking a line moves that dataset's label to the clicked point.
      const series = data.series.find((s) => s.id === click.seriesId);
      const latest = series ? lastVisibleIndex(series.values, resolved.startIndex, resolved.endIndex) : -1;
      dispatch({ type: "setLabel", datasetId: click.seriesId, patch: { anchorDate: click.index === latest ? null : date } });
    },
    [data, resolved, noteFlow, dispatch],
  );

  const meta = data?.responses[0]?.meta;
  const fallback = data?.responses.find((r) => r.meta.isFallback)?.meta;
  const incompleteNote = data?.responses.find((r) => r.meta.incompleteQuarterNote)?.meta.incompleteQuarterNote;
  const title = useMemo(
    () => (state.titleEdited ? state.title : autoTitle(state.datasets, resolved, state.view)),
    [state.titleEdited, state.title, state.datasets, state.view, resolved],
  );
  const percentLocked = needsPercentMode(state.datasets);
  const notesFull = state.notes.length >= MAX_NOTES;
  const editingNote = noteFlow?.step === "edit" ? state.notes.find((n) => n.id === noteFlow.id) : undefined;

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

        <section aria-label="Choose data" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
          <DatasetPicker selected={state.datasets} onChange={handleDataset} />
          {pendingDataset && (
            <Banner>
              <p className="mb-3">
                These three datasets use different measurements. Turn on &lsquo;Compare as % change&rsquo; to show all
                three together.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  onClick={() => {
                    dispatch({ type: "setPercentMode", on: true });
                    dispatch({ type: "setDataset", slot: pendingDataset.slot, id: pendingDataset.id });
                    setPendingDataset(null);
                  }}
                >
                  Turn on &lsquo;Compare as % change&rsquo;
                </Button>
                <Button onClick={() => setPendingDataset(null)}>Cancel</Button>
              </div>
            </Banner>
          )}
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
              <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <EditableTitle
                    title={title}
                    edited={state.titleEdited}
                    onChange={(text) => dispatch({ type: "setTitle", title: text })}
                    onReset={() => dispatch({ type: "resetTitle" })}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex min-h-11 items-center gap-2 font-semibold">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[var(--brand)]"
                      checked={state.percentChangeMode}
                      disabled={percentLocked}
                      onChange={(e) => dispatch({ type: "setPercentMode", on: e.target.checked })}
                    />
                    Compare as % change
                  </label>
                  <HelpTip
                    label="What does Compare as % change mean?"
                    text={
                      "Shows every line as the percent it has gone up or down since the start of the selected dates. Useful for comparing datasets that use different measurements." +
                      (percentLocked ? " It stays on while three different measurements are on the chart." : "")
                    }
                  />
                  <Button
                    disabled={notesFull || noteFlow !== null}
                    onClick={() => setNoteFlow({ step: "picking" })}
                    title={notesFull ? `A chart can have up to ${MAX_NOTES} notes.` : undefined}
                  >
                    + Add a note
                  </Button>
                </div>
              </div>

              {notesFull && <p className="mb-2 text-sm text-muted">This chart has {MAX_NOTES} notes, which is the most it can hold.</p>}

              {noteFlow?.step === "picking" && (
                <PickPointBar
                  series={data.series.map((s) => ({ id: s.id, name: s.name }))}
                  dates={data.dates.slice(resolved.startIndex, resolved.endIndex + 1)}
                  labels={data.labels.slice(resolved.startIndex, resolved.endIndex + 1)}
                  onPick={(datasetId, date) => setNoteFlow({ step: "new", datasetId, date, x: 120, y: 60 })}
                  onCancel={() => setNoteFlow(null)}
                />
              )}

              <div className="relative">
                <PowerChart
                  ref={chartRef}
                  dates={data.dates}
                  labels={data.labels}
                  series={data.series}
                  startIndex={resolved.startIndex}
                  endIndex={resolved.endIndex}
                  percentMode={state.percentChangeMode}
                  trends={NO_TRENDS}
                  seriesLabels={state.labels}
                  notes={state.notes}
                  onRangeChange={handleRange}
                  onLabelChange={(datasetId, patch) => dispatch({ type: "setLabel", datasetId, patch })}
                  onNoteMove={(id, pos) => dispatch({ type: "updateNote", id, patch: { pos } })}
                  onNoteEdit={(id, at) => setNoteFlow({ step: "edit", id, x: at[0], y: at[1] })}
                  onNoteDelete={(id) => dispatch({ type: "removeNote", id })}
                  onPointClick={handlePointClick}
                />
                {noteFlow?.step === "new" && (
                  <NotePopover
                    x={noteFlow.x + 12}
                    y={noteFlow.y + 12}
                    heading="Your note"
                    initialText=""
                    onCancel={() => setNoteFlow(null)}
                    onSave={(text) => {
                      dispatch({
                        type: "addNote",
                        note: { id: crypto.randomUUID(), datasetId: noteFlow.datasetId, anchorDate: noteFlow.date, text, pos: null },
                      });
                      setNoteFlow(null);
                    }}
                  />
                )}
                {noteFlow?.step === "edit" && editingNote && (
                  <NotePopover
                    x={noteFlow.x}
                    y={noteFlow.y}
                    heading="Edit note"
                    initialText={editingNote.text}
                    onCancel={() => setNoteFlow(null)}
                    onSave={(text) => {
                      dispatch({ type: "updateNote", id: editingNote.id, patch: { text } });
                      setNoteFlow(null);
                    }}
                  />
                )}
              </div>

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

type PickPointBarProps = {
  series: { id: string; name: string }[];
  dates: string[];
  labels: string[];
  onPick: (datasetId: string, date: string) => void;
  onCancel: () => void;
};

/** Instruction shown while choosing where a note points, with a keyboard-friendly alternative. */
function PickPointBar({ series, dates, labels, onPick, onCancel }: PickPointBarProps) {
  const [datasetId, setDatasetId] = useState(series[0]?.id ?? "");
  const [date, setDate] = useState(dates[dates.length - 1] ?? "");
  return (
    <div className="mb-3 rounded-lg border-[1.5px] border-brand bg-brand-soft px-4 py-3">
      <p className="font-semibold">Click on a line where you want the arrow to point.</p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <span className="pb-2 text-muted">Or choose the spot here:</span>
        {series.length > 1 && (
          <label className="font-semibold">
            <span className="mb-1 block text-sm">Line</span>
            <select className="field !w-auto" value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="font-semibold">
          <span className="mb-1 block text-sm">Date</span>
          <select className="field !w-auto" value={date} onChange={(e) => setDate(e.target.value)}>
            {dates.map((d, i) => (
              <option key={d} value={d}>
                {labels[i]}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={() => onPick(datasetId, date)}>Put the note here</Button>
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
