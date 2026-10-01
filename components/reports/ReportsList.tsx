"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { useUi } from "@/components/ui/UiProvider";
import { api, errorMessage } from "@/lib/api";
import { formatLongDate, formatShortDate } from "@/lib/format";
import { chartCountText, defaultReportTitle, forgetReport, rememberReport, type ReportSummaryDto } from "@/lib/reports/client";

/** The list of saved report packages. */
export function ReportsList() {
  const [reports, setReports] = useState<ReportSummaryDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const ui = useUi();
  const router = useRouter();

  const reload = useCallback(async () => {
    try {
      setReports((await api<{ reports: ReportSummaryDto[] }>("/api/reports")).reports);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = async () => {
    setCreating(true);
    try {
      const { report } = await api<{ report: ReportSummaryDto }>("/api/reports", { method: "POST", body: { title: defaultReportTitle() } });
      rememberReport(report.id);
      router.push(`/reports/${report.id}`);
    } catch (err) {
      ui.toast(errorMessage(err), "error");
      setCreating(false);
    }
  };

  const remove = async (report: ReportSummaryDto) => {
    const ok = await ui.confirm({
      title: "Delete this report?",
      message: `"${report.title}" and its ${chartCountText(report.chartCount)} will be deleted. This can't be undone.`,
      confirmLabel: "Delete report",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/reports/${report.id}`, { method: "DELETE" });
      forgetReport(report.id);
      ui.toast(`Deleted "${report.title}".`);
    } catch (err) {
      ui.toast(errorMessage(err), "error");
    }
    await reload();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted">A report combines several charts into one PDF for a management meeting.</p>
        </div>
        <Button variant="primary" disabled={creating} onClick={create}>
          {creating ? "Creating…" : "+ New report"}
        </Button>
      </div>

      {error && <Banner kind="error">We couldn&apos;t load your reports. {error}</Banner>}

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        {reports === null && !error ? (
          <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-label="Loading reports">
            <div className="skeleton h-10" />
            <div className="skeleton h-10" />
          </div>
        ) : reports && reports.length === 0 ? (
          <p className="p-6 text-center">
            You have no reports yet. Build a chart and choose <span className="font-semibold">Add to report</span>, or start with{" "}
            <span className="font-semibold">+ New report</span>.
          </p>
        ) : (
          <table className="w-full text-left">
            <thead className="border-b border-line bg-page">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Title</th>
                <th scope="col" className="px-4 py-3 font-semibold">Meeting date</th>
                <th scope="col" className="px-4 py-3 font-semibold">Charts</th>
                <th scope="col" className="px-4 py-3 font-semibold">Last updated</th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {reports?.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-semibold">
                    <Link href={`/reports/${r.id}`} className="text-brand underline">
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.meetingDate ? formatLongDate(r.meetingDate) : <span className="text-muted">Not set</span>}</td>
                  <td className="px-4 py-3">{r.chartCount}</td>
                  <td className="px-4 py-3">{formatShortDate(r.updatedAt)}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/reports/${r.id}`}
                        className="inline-flex min-h-9 items-center rounded-lg border-[1.5px] border-line bg-surface px-3 text-sm font-semibold hover:border-muted hover:bg-brand-soft"
                      >
                        Open
                      </Link>
                      <Button small variant="danger" onClick={() => remove(r)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
