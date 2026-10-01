"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useContacts } from "@/components/contacts/useContacts";
import { ContactPicker } from "@/components/email/ContactPicker";
import { EmailDialog } from "@/components/email/EmailDialog";
import { PrintChartPage } from "@/components/print/PrintChartPage";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useUi } from "@/components/ui/UiProvider";
import { api, errorMessage } from "@/lib/api";
import { downloadBlob } from "@/lib/download";
import { formatLongDate } from "@/lib/format";
import { buildReportPdf, pageLabel } from "@/lib/pdf/reportPdf";
import { chartCountText, forgetReport, rememberReport, REPORT_CHANGED_EVENT, savedChartToPage, type ReportDto } from "@/lib/reports/client";
import { MAX_INTRO, SITE_DOMAIN, SITE_NAME } from "@/lib/theme";

type Item = ReportDto["items"][number];
type Fields = Pick<ReportDto, "title" | "meetingDate" | "preparedBy" | "intro">;

/** The report page: details, the list of charts (reorder, edit, remove), and export actions. */
export function ReportEditor({ reportId }: { reportId: string }) {
  const ui = useUi();
  const [report, setReport] = useState<ReportDto | null>(null);
  const [loadError, setLoadError] = useState<{ message: string; missing: boolean } | null>(null);
  const [fields, setFields] = useState<Fields>({ title: "", meetingDate: null, preparedBy: "", intro: "" });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [sendTo, setSendTo] = useState<string[]>([]);
  const { contacts, reload: reloadContacts } = useContacts();
  const ids = { title: useId(), date: useId(), by: useId(), intro: useId() };

  useEffect(() => {
    let cancelled = false;
    api<{ report: ReportDto }>(`/api/reports/${reportId}`)
      .then(({ report: loaded }) => {
        if (cancelled) return;
        setReport(loaded);
        setFields({ title: loaded.title, meetingDate: loaded.meetingDate, preparedBy: loaded.preparedBy, intro: loaded.intro });
        rememberReport(loaded.id);
      })
      .catch((err) => {
        if (cancelled) return;
        const missing = (err as { status?: number }).status === 404;
        if (missing) forgetReport(reportId);
        setLoadError({ message: errorMessage(err), missing });
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);

  /** Save one field when the user leaves it (only if it changed). */
  const saveField = async <K extends keyof Fields>(name: K) => {
    if (!report || fields[name] === report[name]) return;
    if (name === "title" && !fields.title.trim()) {
      setFields((f) => ({ ...f, title: report.title }));
      ui.toast("A report needs a title, so the old one was kept.", "error");
      return;
    }
    setSaveState("saving");
    try {
      const res = await api<{ report: ReportDto }>(`/api/reports/${report.id}`, { method: "PUT", body: { [name]: fields[name] } });
      setReport((r) => (r ? { ...r, ...res.report, items: r.items } : r));
      setSaveState("saved");
    } catch (err) {
      setSaveState("idle");
      ui.toast(errorMessage(err), "error");
    }
  };

  const saveOrder = async (items: Item[]) => {
    if (!report) return;
    const before = report.items;
    setReport({ ...report, items });
    try {
      await api(`/api/reports/${report.id}/items/order`, { method: "PUT", body: { itemIds: items.map((i) => i.id) } });
    } catch (err) {
      setReport((r) => (r ? { ...r, items: before } : r));
      ui.toast(errorMessage(err), "error");
    }
  };

  const move = (index: number, step: -1 | 1) => {
    if (!report) return;
    const target = index + step;
    if (target < 0 || target >= report.items.length) return;
    void saveOrder(arrayMove(report.items, index, target));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    if (!report || !event.over || event.active.id === event.over.id) return;
    const from = report.items.findIndex((i) => i.id === event.active.id);
    const to = report.items.findIndex((i) => i.id === event.over!.id);
    if (from >= 0 && to >= 0) void saveOrder(arrayMove(report.items, from, to));
  };

  const remove = async (item: Item) => {
    if (!report) return;
    const ok = await ui.confirm({
      title: "Remove this chart?",
      message: `"${item.chart.title}" will be removed from this report.`,
      confirmLabel: "Remove chart",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/reports/${report.id}/items/${item.id}`, { method: "DELETE" });
      setReport((r) => (r ? { ...r, items: r.items.filter((i) => i.id !== item.id) } : r));
      window.dispatchEvent(new Event(REPORT_CHANGED_EVENT));
      ui.toast("Chart removed from the report.");
    } catch (err) {
      ui.toast(errorMessage(err), "error");
    }
  };

  const pages = useMemo(() => report?.items.map((i) => savedChartToPage(i.chart)) ?? [], [report]);
  const cover = useMemo(
    () => ({ title: fields.title.trim() || report?.title || "Report", meetingDate: fields.meetingDate, preparedBy: fields.preparedBy, intro: fields.intro }),
    [fields, report],
  );
  const makePdf = useCallback(async () => buildReportPdf(cover, pages), [cover, pages]);

  const withPdf = (use: (pdf: ReturnType<typeof buildReportPdf>) => void) => {
    try {
      use(buildReportPdf(cover, pages));
    } catch (err) {
      ui.toast(`We couldn't create the PDF. ${errorMessage(err)}`, "error");
    }
  };

  if (loadError) {
    return (
      <main className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6">
        <Banner kind="error">
          <p className="mb-3 font-semibold">{loadError.missing ? loadError.message : `We couldn't open this report. ${loadError.message}`}</p>
          <Link href="/reports" className="font-semibold underline">
            Go to all reports
          </Link>
        </Banner>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-5 sm:px-6" aria-busy="true" aria-label="Loading the report">
        <div className="skeleton h-10 w-1/2" />
        <div className="skeleton h-40" />
        <div className="skeleton h-28" />
      </main>
    );
  }

  const empty = report.items.length === 0;
  const total = pages.length + 1;
  const today = new Date();

  return (
    <>
      <main className="screen-only mx-auto flex max-w-[1280px] flex-col gap-5 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Report</h1>
          <p className="text-sm text-muted" aria-live="polite">
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "All changes saved." : "Changes are saved as you go."}
          </p>
        </div>

        <section aria-label="Report details" className="grid gap-4 rounded-xl border border-line bg-surface p-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor={ids.title} className="mb-1 block font-semibold">
              Report title
            </label>
            <input
              id={ids.title}
              className="field text-lg font-semibold"
              value={fields.title}
              maxLength={200}
              onChange={(e) => setFields({ ...fields, title: e.target.value })}
              onBlur={() => saveField("title")}
            />
          </div>
          <div>
            <label htmlFor={ids.date} className="mb-1 block font-semibold">
              Meeting date
            </label>
            <input
              id={ids.date}
              type="date"
              className="field"
              value={fields.meetingDate ?? ""}
              onChange={(e) => setFields({ ...fields, meetingDate: e.target.value || null })}
              onBlur={() => saveField("meetingDate")}
            />
          </div>
          <div>
            <label htmlFor={ids.by} className="mb-1 block font-semibold">
              Prepared by
            </label>
            <input
              id={ids.by}
              className="field"
              value={fields.preparedBy}
              maxLength={120}
              onChange={(e) => setFields({ ...fields, preparedBy: e.target.value })}
              onBlur={() => saveField("preparedBy")}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor={ids.intro} className="mb-1 block font-semibold">
              Introduction <span className="font-normal text-muted">(optional — shown on the cover page)</span>
            </label>
            <textarea
              id={ids.intro}
              className="field"
              rows={4}
              value={fields.intro}
              maxLength={MAX_INTRO}
              onChange={(e) => setFields({ ...fields, intro: e.target.value })}
              onBlur={() => saveField("intro")}
            />
            <p className="mt-1 text-right text-sm text-muted">
              {fields.intro.length.toLocaleString("en-US")} of {MAX_INTRO.toLocaleString("en-US")} characters
            </p>
          </div>
        </section>

        <section aria-label="Charts in this report" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Charts in this report ({chartCountText(report.items.length)})</h2>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-lg border-[1.5px] border-line bg-surface px-4 font-semibold hover:border-muted hover:bg-brand-soft"
            >
              + Build another chart
            </Link>
          </div>

          {empty ? (
            <div className="rounded-xl border border-dashed border-line bg-surface p-6 text-center">
              This report has no charts yet. Go to the <Link href="/" className="font-semibold text-brand underline">Chart builder</Link>,
              make a chart, and choose <span className="font-semibold">Add to report</span>.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={report.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <ol className="flex flex-col gap-3">
                  {report.items.map((item, index) => (
                    <ChartCard
                      key={item.id}
                      item={item}
                      index={index}
                      count={report.items.length}
                      reportId={report.id}
                      onMove={move}
                      onRemove={remove}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}
        </section>

        <section aria-label="Share this report" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
          <ContactPicker label="Send to" contacts={contacts} value={sendTo} onChange={setSendTo} />
          <div className="flex flex-wrap gap-3">
            <Button disabled={empty} onClick={() => withPdf((pdf) => setPreviewUrl(URL.createObjectURL(pdf.blob)))}>
              Preview
            </Button>
            <Button disabled={empty} onClick={() => window.print()}>
              Print
            </Button>
            <Button disabled={empty} onClick={() => withPdf((pdf) => downloadBlob(pdf.blob, pdf.filename))}>
              Download PDF
            </Button>
            <Button variant="primary" disabled={empty} onClick={() => setEmailOpen(true)}>
              Email report
            </Button>
          </div>
          {empty && <p className="text-muted">Add at least one chart to preview, print, download, or email this report.</p>}
        </section>
      </main>

      {previewUrl && (
        <Dialog title="Preview of the report PDF" wide onClose={() => setPreviewUrl(null)}>
          <iframe src={previewUrl} title="Report PDF preview" className="h-[70vh] w-full rounded border border-line" />
        </Dialog>
      )}

      {emailOpen && (
        <EmailDialog
          title="Email this report"
          subject={cover.title}
          makePdf={makePdf}
          contacts={contacts}
          initialRecipients={sendTo}
          onContactsChanged={reloadContacts}
          onClose={() => setEmailOpen(false)}
        />
      )}

      {/* Print layout: cover page, then one chart per page. */}
      <div className="print-only">
        <div className="print-page flex h-[7.4in] flex-col text-black">
          <span className="text-[13pt] font-extrabold text-brand">{SITE_NAME}</span>
          <h1 className="mt-16 text-[28pt] font-bold leading-tight">{cover.title}</h1>
          <div className="mt-3 text-[13pt] text-muted">
            {cover.meetingDate && <div>Meeting date: {formatLongDate(cover.meetingDate)}</div>}
            {cover.preparedBy.trim() && <div>Prepared by: {cover.preparedBy.trim()}</div>}
          </div>
          {cover.intro.trim() && <p className="mt-5 whitespace-pre-line text-[11pt] leading-snug">{cover.intro}</p>}
          <div className="mt-6 text-[11pt]">
            <div className="mb-1 text-[12pt] font-bold">In this report</div>
            {pages.map((p, i) => (
              <div key={report.items[i].id} className="flex justify-between gap-6">
                <span>
                  {i + 1}. {p.title}
                </span>
                <span className="shrink-0 text-muted">Page {i + 2}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto flex items-baseline justify-between text-[8pt] text-muted">
            <span />
            <span>{pageLabel(1, total)}</span>
            <span>Created with {SITE_DOMAIN}</span>
          </div>
        </div>
        {pages.map((p, i) => (
          <PrintChartPage key={report.items[i].id} page={p} date={today} pageLabel={pageLabel(i + 2, total)} />
        ))}
      </div>
    </>
  );
}

type CardProps = {
  item: Item;
  index: number;
  count: number;
  reportId: string;
  onMove: (index: number, step: -1 | 1) => void;
  onRemove: (item: Item) => void;
};

/** One chart in the report: thumbnail, title, first line of the statistics, and its actions. */
function ChartCard({ item, index, count, reportId, onMove, onRemove }: CardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const firstLine = item.chart.topText.split("\n").find((l) => l.trim()) ?? "";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-3 ${isDragging ? "relative z-10 shadow-xl" : ""}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder: ${item.chart.title}`}
        className="flex min-h-11 cursor-grab touch-none flex-col items-center justify-center rounded-lg border-[1.5px] border-line px-2 text-sm font-semibold text-muted hover:bg-brand-soft active:cursor-grabbing"
      >
        <span aria-hidden className="text-lg leading-none">
          ⠿
        </span>
        Drag
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element -- a stored snapshot of the chart */}
      <img
        src={`data:image/png;base64,${item.chart.imagePng}`}
        alt=""
        className="h-24 w-44 shrink-0 rounded border border-line bg-white object-contain"
      />

      <div className="min-w-[12rem] flex-1">
        <div className="text-sm font-semibold text-muted">
          Chart {index + 1} of {count} · page {index + 2} in the PDF
        </div>
        <div className="font-bold">{item.chart.title}</div>
        {firstLine && <p className="line-clamp-2 text-sm text-muted">{firstLine}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button small disabled={index === 0} onClick={() => onMove(index, -1)}>
          ↑ Move up
        </Button>
        <Button small disabled={index === count - 1} onClick={() => onMove(index, 1)}>
          ↓ Move down
        </Button>
        {item.chart.config ? (
          <Link
            href={`/?edit=${item.chart.id}&report=${reportId}`}
            className="inline-flex min-h-9 items-center rounded-lg border-[1.5px] border-line bg-surface px-3 text-sm font-semibold hover:border-muted hover:bg-brand-soft"
          >
            Edit
          </Link>
        ) : null}
        <Button small variant="danger" onClick={() => onRemove(item)}>
          Remove
        </Button>
      </div>
    </li>
  );
}
