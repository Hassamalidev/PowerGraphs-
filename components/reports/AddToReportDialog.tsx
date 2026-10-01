"use client";

import { useEffect, useId, useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { api, errorMessage } from "@/lib/api";
import { chartCountText, defaultReportTitle, lastReportId, type ReportSummaryDto } from "@/lib/reports/client";

const NEW = "__new__";

type Props = {
  /** Saves the chart into the chosen (or new) report. Rejects with a plain-English error. */
  onAdd: (target: { reportId: string } | { newTitle: string }) => Promise<void>;
  onClose: () => void;
};

/** The small window behind "Add to report": pick an existing report or create a new one. */
export function AddToReportDialog({ onAdd, onClose }: Props) {
  const [reports, setReports] = useState<ReportSummaryDto[] | null>(null);
  const [choice, setChoice] = useState(NEW);
  const [newTitle, setNewTitle] = useState(defaultReportTitle());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ids = { select: useId(), title: useId() };

  useEffect(() => {
    api<{ reports: ReportSummaryDto[] }>("/api/reports")
      .then((res) => {
        setReports(res.reports);
        // Default to the report used last, if it still exists.
        const last = lastReportId();
        if (last && res.reports.some((r) => r.id === last)) setChoice(last);
      })
      .catch((err) => {
        setReports([]);
        setError(errorMessage(err));
      });
  }, []);

  const add = async () => {
    if (choice === NEW && !newTitle.trim()) {
      setError("Please give the new report a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onAdd(choice === NEW ? { newTitle: newTitle.trim() } : { reportId: choice });
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Dialog
      title="Add to report"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={saving || reports === null} onClick={add}>
            {saving ? "Adding…" : "Add"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-muted">A report combines several charts into one PDF for your meeting.</p>
        <div>
          <label htmlFor={ids.select} className="mb-1 block font-semibold">
            Choose a report
          </label>
          <select id={ids.select} className="field" value={choice} disabled={reports === null} onChange={(e) => setChoice(e.target.value)}>
            <option value={NEW}>Create a new report</option>
            {reports?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} ({chartCountText(r.chartCount)})
              </option>
            ))}
          </select>
        </div>
        {choice === NEW && (
          <div>
            <label htmlFor={ids.title} className="mb-1 block font-semibold">
              Name of the new report
            </label>
            <input id={ids.title} className="field" value={newTitle} maxLength={200} onChange={(e) => setNewTitle(e.target.value)} />
          </div>
        )}
        {error && <Banner kind="error">{error}</Banner>}
      </div>
    </Dialog>
  );
}
