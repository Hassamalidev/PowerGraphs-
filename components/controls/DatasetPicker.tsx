"use client";

import Link from "next/link";
import { useId } from "react";
import { allDatasets, getDataset } from "@/lib/datasets/catalog";
import { MAX_DATASETS, SERIES_STYLES } from "@/lib/theme";
import { HelpTip } from "@/components/ui/HelpTip";
import { RichSelect, type RichOption } from "./RichSelect";

type Props = {
  selected: string[]; // catalog ids, in slot order
  onChange: (slot: number, id: string | null) => void;
  /** How many slots to offer (defaults to all three). */
  slots?: number;
};

/** A short sample of the slot's line (color + style), so the dropdown matches the chart. */
function LineSample({ slot }: { slot: number }) {
  const style = SERIES_STYLES[slot];
  const dash = style.lineStyle === "dashed" ? "7 4" : style.lineStyle === "dotted" ? "2 4" : undefined;
  return (
    <svg width="34" height="10" aria-hidden className="shrink-0">
      <line x1="1" y1="5" x2="33" y2="5" stroke={style.color} strokeWidth={3} strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  );
}

function Slot({ slot, selected, onChange }: { slot: number; selected: string[]; onChange: Props["onChange"] }) {
  const labelId = useId();
  const current = selected[slot] ?? null;
  const def = current ? getDataset(current) : undefined;

  const options: RichOption[] = allDatasets().map((d) => {
    const usedElsewhere = selected.includes(d.id) && d.id !== current;
    return {
      value: d.id,
      label: d.name,
      description: d.description,
      group: d.group,
      disabled: usedElsewhere,
      disabledReason: "Already on the chart.",
    };
  });

  return (
    <div className="min-w-0">
      <div className="mb-1 flex min-h-9 items-center gap-2">
        <span id={labelId} className="font-semibold">
          Dataset {slot + 1}
        </span>
        {current && <LineSample slot={slot} />}
        {def && <HelpTip text={def.helpText} label={`What does "${def.name}" mean?`} />}
        {slot > 0 && current && (
          <button
            type="button"
            onClick={() => onChange(slot, null)}
            className="ml-auto min-h-9 rounded-lg px-2 text-sm font-semibold text-danger hover:bg-red-50"
          >
            × Remove
          </button>
        )}
      </div>
      <RichSelect
        labelId={labelId}
        options={options}
        value={current}
        placeholder="+ Add a dataset"
        onChange={(id) => onChange(slot, id)}
      />
    </div>
  );
}

/** Up to three dataset dropdowns. Dataset 1 is always filled. */
export function DatasetPicker({ selected, onChange, slots = MAX_DATASETS }: Props) {
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: slots }, (_, slot) => (
          <Slot key={slot} slot={slot} selected={selected} onChange={onChange} />
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">
        Can&apos;t find what you need?{" "}
        <Link href="/datasets" className="font-semibold text-brand underline">
          Add a new dataset
        </Link>
      </p>
    </div>
  );
}
