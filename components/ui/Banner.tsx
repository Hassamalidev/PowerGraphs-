import type { ReactNode } from "react";

type Kind = "warning" | "error" | "success";

const STYLES: Record<Kind, string> = {
  warning: "border-warn-border bg-warn-bg text-ink",
  error: "border-danger bg-red-50 text-danger",
  success: "border-green-700 bg-green-50 text-green-900",
};

/** A notice in plain English: yellow (e.g. "showing a saved copy"), red error, or green success. */
export function Banner({ kind = "warning", children }: { kind?: Kind; children: ReactNode }) {
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-lg border-[1.5px] px-4 py-3 ${STYLES[kind]}`}>
      {children}
    </div>
  );
}
