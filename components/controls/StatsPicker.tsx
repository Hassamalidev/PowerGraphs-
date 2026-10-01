"use client";

import { useId } from "react";
import { HelpTip } from "@/components/ui/HelpTip";
import type { StatsMode } from "@/lib/stats/sentences";

type Props = {
  value: StatsMode;
  datasetCount: number;
  onChange: (mode: StatsMode) => void;
};

const HELP =
  "Plain summary: the latest value and how it has changed. Trend line: the straight line that best fits the data, showing the general direction (statisticians call this simple regression). How two datasets move together: whether they tend to rise and fall together (correlation).";

/** The Statistics dropdown. Results appear as plain sentences in the box below it. */
export function StatsPicker({ value, datasetCount, onChange }: Props) {
  const id = useId();
  return (
    <div className="max-w-md">
      <div className="mb-1 flex min-h-9 items-center gap-2">
        <label htmlFor={id} className="font-semibold">
          Statistics
        </label>
        <HelpTip text={HELP} label="What do the statistics options mean?" />
      </div>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value as StatsMode)}>
        <option value="summary">Plain summary</option>
        <option value="trend">Trend line</option>
        <option value="relationship" disabled={datasetCount < 2}>
          How two datasets move together{datasetCount < 2 ? " (add a second dataset first)" : ""}
        </option>
        <option value="multiple" disabled title="Coming in a future version">
          Multiple regression — coming later
        </option>
        <option value="none">Hide statistics</option>
      </select>
    </div>
  );
}
