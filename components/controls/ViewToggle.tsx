"use client";

import type { View } from "@/lib/period";

const OPTIONS: { value: View; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

/** Monthly / Quarterly switch. */
export function ViewToggle({ value, onChange }: { value: View; onChange: (view: View) => void }) {
  return (
    <fieldset className="flex flex-wrap items-center gap-3">
      <legend className="float-left mr-3 font-semibold">View:</legend>
      <div className="inline-flex overflow-hidden rounded-lg border-[1.5px] border-line">
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex min-h-11 cursor-pointer items-center gap-2 px-4 font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-brand ${
              value === opt.value ? "bg-brand text-white" : "bg-surface text-ink hover:bg-brand-soft"
            }`}
          >
            <input
              type="radio"
              name="view"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="h-4 w-4 accent-white"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
