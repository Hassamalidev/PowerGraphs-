"use client";

import { useId } from "react";
import { isQuarter } from "@/lib/period";

type Props = {
  dates: string[];
  labels: string[];
  startIndex: number;
  endIndex: number;
  onChange: (startIndex: number, endIndex: number) => void;
};

const QUICK: { label: string; years: number | null }[] = [
  { label: "1 year", years: 1 },
  { label: "5 years", years: 5 },
  { label: "10 years", years: 10 },
  { label: "All", years: null },
];

/** From/To dropdowns and quick range buttons, kept in sync with the slider. */
export function RangeControls({ dates, labels, startIndex, endIndex, onChange }: Props) {
  const fromId = useId();
  const toId = useId();
  const last = dates.length - 1;
  const perYear = dates.length && isQuarter(dates[0]) ? 4 : 12;

  const quickStart = (years: number | null) => (years === null ? 0 : Math.max(0, last - years * perYear));
  const isActive = (years: number | null) => endIndex === last && startIndex === quickStart(years);

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={fromId} className="mb-1 block font-semibold">
            From
          </label>
          <select
            id={fromId}
            className="field !w-auto min-w-36"
            value={startIndex}
            onChange={(e) => onChange(Number(e.target.value), endIndex)}
          >
            {labels.map((label, i) =>
              i <= endIndex ? (
                <option key={dates[i]} value={i}>
                  {label}
                </option>
              ) : null,
            )}
          </select>
        </div>
        <div>
          <label htmlFor={toId} className="mb-1 block font-semibold">
            To
          </label>
          <select
            id={toId}
            className="field !w-auto min-w-36"
            value={endIndex}
            onChange={(e) => onChange(startIndex, Number(e.target.value))}
          >
            {labels.map((label, i) =>
              i >= startIndex ? (
                <option key={dates[i]} value={i}>
                  {label}
                </option>
              ) : null,
            )}
          </select>
        </div>
      </div>

      <div role="group" aria-label="Quick date ranges" className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Show the last:</span>
        {QUICK.map((q) => (
          <button
            key={q.label}
            type="button"
            aria-pressed={isActive(q.years)}
            onClick={() => onChange(quickStart(q.years), last)}
            className={`min-h-11 rounded-lg border-[1.5px] px-4 font-semibold ${
              isActive(q.years) ? "border-brand bg-brand text-white" : "border-line bg-surface hover:border-muted hover:bg-brand-soft"
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>
    </div>
  );
}
