"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

export type ActionName = "print" | "pdf" | "image" | "email" | "report";

type Props = {
  /** The action currently running, if any (its button shows "Working…"). */
  busy: ActionName | null;
  disabled?: boolean;
  onPrint: () => void;
  onDownloadPdf: () => void;
  onDownloadImage: () => void;
  onEmail?: () => void;
  onAddToReport?: () => void;
  /** Label of the report button: "Add to report" or "Update in report". */
  reportLabel?: string;
  /** The "Send to" contact picker, shown above the buttons. */
  sendTo?: ReactNode;
};

/** The row of actions under the chart. Every button has a text label. */
export function ActionBar({ busy, disabled, onPrint, onDownloadPdf, onDownloadImage, onEmail, onAddToReport, reportLabel, sendTo }: Props) {
  const off = disabled || busy !== null;
  const label = (name: ActionName, text: string) => (busy === name ? "Working…" : text);
  return (
    <section aria-label="Share this chart" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
      {sendTo}
      <div className="flex flex-wrap gap-3">
        <Button disabled={off} onClick={onPrint}>
          {label("print", "Print")}
        </Button>
        <Button disabled={off} onClick={onDownloadPdf}>
          {label("pdf", "Download PDF")}
        </Button>
        <Button disabled={off} onClick={onDownloadImage}>
          {label("image", "Download image")}
        </Button>
        {onEmail && (
          <Button disabled={off} onClick={onEmail}>
            {label("email", "Email")}
          </Button>
        )}
        {onAddToReport && (
          <Button variant="primary" disabled={off} onClick={onAddToReport}>
            {label("report", reportLabel ?? "Add to report")}
          </Button>
        )}
      </div>
    </section>
  );
}
