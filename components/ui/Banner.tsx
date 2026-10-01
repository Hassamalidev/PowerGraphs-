import type { ReactNode } from "react";

/** Yellow notice (e.g. "showing a saved copy") or red error box, in plain English. */
export function Banner({ kind = "warning", children }: { kind?: "warning" | "error"; children: ReactNode }) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-lg border-[1.5px] px-4 py-3 ${
        kind === "error" ? "border-danger bg-red-50 text-danger" : "border-warn-border bg-warn-bg text-ink"
      }`}
    >
      {children}
    </div>
  );
}
