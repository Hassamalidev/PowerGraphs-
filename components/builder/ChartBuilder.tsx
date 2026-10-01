"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ActionBar, type ActionName } from "@/components/actions/ActionBar";
import { PowerChart, type PointClick, type PowerChartHandle } from "@/components/chart/PowerChart";
import { RangeControls } from "@/components/chart/RangeControls";
import { lastVisibleIndex } from "@/components/chart/chartModel";
import { useContacts } from "@/components/contacts/useContacts";
import { DatasetPicker } from "@/components/controls/DatasetPicker";
import { StatsPicker } from "@/components/controls/StatsPicker";
import { ViewToggle } from "@/components/controls/ViewToggle";
import { ContactPicker } from "@/components/email/ContactPicker";
import { EmailDialog } from "@/components/email/EmailDialog";
import { AppHeader } from "@/components/layout/AppHeader";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { HelpTip } from "@/components/ui/HelpTip";
import { useUi } from "@/components/ui/UiProvider";
import { AddToReportDialog } from "@/components/reports/AddToReportDialog";
import { PrintChartPage } from "@/components/print/PrintChartPage";
import { NotesTextBox } from "@/components/text/NotesTextBox";
import { StatsTextBox } from "@/components/text/StatsTextBox";
import { api, errorMessage } from "@/lib/api";
import { autoTitle, needsPercentMode, stateToConfig } from "@/lib/chart/state";
import { addChartToReport, chartCountText, snapshotBody } from "@/lib/reports/client";
import { downloadBlob, downloadUrl } from "@/lib/download";
import { formatShortDate } from "@/lib/format";
import { buildChartPdf, chartFileBase, type ChartPage } from "@/lib/pdf/chartPdf";
import { MAX_NOTES, SITE_NAME } from "@/lib/theme";
import { EditableTitle } from "./EditableTitle";
import { NotePopover } from "./NotePopover";
import { useBuilderState } from "./useBuilderState";
import { useChartData } from "./useChartData";
import { useChartStats } from "./useChartStats";

/** What the "add / edit a note" flow is doing right now. */
type NoteFlow =
  | null
  | { step: "picking" }
  | { step: "new"; datasetId: string; date: string; x: number; y: number }
  | { step: "edit"; id: string; x: number; y: number };

/** The main screen: pick datasets, see the chart with its arrow labels, choose the range and view. */
export function ChartBuilder() {
  const { state, dispatch, hydrated, reset, editing, editError, stopEditing } = useBuilderState();
  const router = useRouter();
  const { data, resolved, error, retry } = useChartData(state);
  const ui = useUi();

  const statsInput = useMemo(
    () =>
      data && resolved
        ? { dates: data.dates, series: data.series, startIndex: resolved.startIndex, endIndex: resolved.endIndex, mode: state.statsMode }
        : null,
    [data, resolved, state.statsMode],
  );
  const stats = useChartStats(statsInput);
  const topText = state.topTextEdited ? state.topText : stats.text;

  const handleReset = async () => {
    const ok = await ui.confirm({
      title: "Reset chart?",
      message: "This puts the chart back to how it started. Your text, labels, and notes on this chart will be cleared.",
      confirmLabel: "Reset chart",
      danger: true,
    });
    if (ok) {
      setNoteFlow(null);
      setPendingDataset(null);
      reset();
    }
  };

  const handleRegenerate = async () => {
    const ok = await ui.confirm({
      title: "Update with latest numbers?",
      message: "This replaces what you typed with freshly written sentences.",
      confirmLabel: "Update the text",
    });
    if (ok) dispatch({ type: "regenerateTopText" });
  };
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
  const sourceLine = meta ? `Source: ${meta.sourceLabel}. Data as of ${formatShortDate(meta.dataAsOf)}.` : "";

  /** A picture of the chart plus its texts, as used by print, PDF, email, and reports. */
  const takeSnapshot = async (): Promise<ChartPage> => {
    if (!chartRef.current) throw new Error("The chart is still loading. Please try again in a moment.");
    return {
      title,
      topText: state.statsMode === "none" ? "" : topText,
      bottomText: state.bottomText,
      image: await chartRef.current.getImageDataUrl(),
      sourceLine,
    };
  };

  const [busy, setBusy] = useState<ActionName | null>(null);
  const [printPage, setPrintPage] = useState<ChartPage | null>(null);
  const { contacts, reload: reloadContacts } = useContacts();
  const [sendTo, setSendTo] = useState<string[]>([]);
  const [emailOpen, setEmailOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  /** "Add to report": save a snapshot of this chart into the chosen (or new) report. */
  const handleAddToReport = async (target: { reportId: string } | { newTitle: string }) => {
    if (!resolved || !meta) throw new Error("The chart is still loading. Please try again in a moment.");
    const page = await takeSnapshot();
    const added = await addChartToReport(target, page, stateToConfig(state, resolved, title), meta.dataAsOf);
    setReportOpen(false);
    ui.toast(`Added to '${added.title}' (${chartCountText(added.chartCount)}).`);
  };

  /** "Update in report": replace the saved snapshot with the chart as it is now, then go back to the report. */
  const handleUpdateInReport = () =>
    run("report", async () => {
      if (!editing || !resolved || !meta) return;
      const page = await takeSnapshot();
      await api(`/api/charts/${editing.chartId}`, {
        method: "PUT",
        body: snapshotBody(page, stateToConfig(state, resolved, title), meta.dataAsOf),
      });
      ui.toast("The chart was updated in the report.");
      router.push(editing.reportId ? `/reports/${editing.reportId}` : "/reports");
    });

  /** Run an export action, showing "Working…" on its button and a plain message if it fails. */
  const run = async (name: ActionName, action: () => Promise<void>) => {
    setBusy(name);
    try {
      await action();
    } catch (err) {
      ui.toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = () =>
    run("print", async () => {
      const page = await takeSnapshot();
      // The print layout must be on the page before the print window opens.
      flushSync(() => setPrintPage(page));
      await document.querySelector<HTMLImageElement>(".print-only img")?.decode?.().catch(() => undefined);
      window.print();
    });

  const handleDownloadPdf = () =>
    run("pdf", async () => {
      const pdf = buildChartPdf(await takeSnapshot());
      downloadBlob(pdf.blob, pdf.filename);
    });

  const handleDownloadImage = () =>
    run("image", async () => {
      const page = await takeSnapshot();
      downloadUrl(page.image, `${chartFileBase(page.title, new Date())}.png`);
    });

  const percentLocked = needsPercentMode(state.datasets);
  const notesFull = state.notes.length >= MAX_NOTES;
  const editingNote = noteFlow?.step === "edit" ? state.notes.find((n) => n.id === noteFlow.id) : undefined;

  return (
    <>
      <AppHeader>
        <Button onClick={handleReset}>Reset chart</Button>
      </AppHeader>

      <main className="screen-only mx-auto flex max-w-[1280px] flex-col gap-5 px-4 py-5 sm:px-6">
        {editing && (
          <Banner>
            <span className="font-semibold">You are editing a chart from a report.</span> When you&apos;re done, choose{" "}
            <span className="font-semibold">Update in report</span> at the bottom of the page.{" "}
            <Link href={editing.reportId ? `/reports/${editing.reportId}` : "/reports"} className="font-semibold underline">
              Go back without saving
            </Link>{" "}
            ·{" "}
            <button type="button" onClick={stopEditing} className="font-semibold underline">
              Keep this as a new chart instead
            </button>
          </Banner>
        )}
        {editError && <Banner kind="error">We couldn&apos;t open that chart for editing. {editError}</Banner>}
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
          <StatsPicker
            value={state.statsMode}
            datasetCount={state.datasets.length}
            onChange={(mode) => dispatch({ type: "setStatsMode", mode })}
          />
          {state.statsMode !== "none" && data && resolved && (
            <StatsTextBox
              text={topText}
              edited={state.topTextEdited}
              onChange={(text) => dispatch({ type: "setTopText", text })}
              onRegenerate={handleRegenerate}
            />
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
                  trends={stats.trends}
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
                {sourceLine && <p className="text-sm text-muted">{sourceLine}</p>}
              </div>
            </>
          )}
        </section>

        <section aria-label="Meeting notes" className="rounded-xl border border-line bg-surface p-4">
          {/* Shown once the saved chart has loaded, so typing early can't be overwritten. */}
          {hydrated ? (
            <NotesTextBox text={state.bottomText} onChange={(text) => dispatch({ type: "setBottomText", text })} />
          ) : (
            <div className="skeleton h-32" />
          )}
        </section>

        <ActionBar
          busy={busy}
          disabled={!hydrated || !data || !resolved}
          onPrint={handlePrint}
          onDownloadPdf={handleDownloadPdf}
          onDownloadImage={handleDownloadImage}
          onEmail={() => setEmailOpen(true)}
          onAddToReport={editing ? handleUpdateInReport : () => setReportOpen(true)}
          reportLabel={editing ? "Update in report" : "Add to report"}
          sendTo={<ContactPicker label="Send to" contacts={contacts} value={sendTo} onChange={setSendTo} />}
        />
      </main>

      {reportOpen && <AddToReportDialog onAdd={handleAddToReport} onClose={() => setReportOpen(false)} />}

      {emailOpen && (
        <EmailDialog
          title="Email this chart"
          subject={`${SITE_NAME}: ${title}`}
          makePdf={async () => buildChartPdf(await takeSnapshot())}
          contacts={contacts}
          initialRecipients={sendTo}
          onContactsChanged={reloadContacts}
          onClose={() => setEmailOpen(false)}
        />
      )}

      {printPage && (
        <div className="print-only">
          <PrintChartPage page={printPage} date={new Date()} />
        </div>
      )}
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
