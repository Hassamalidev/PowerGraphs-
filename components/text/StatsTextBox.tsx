"use client";

import { useId } from "react";

type Props = {
  text: string;
  edited: boolean;
  onChange: (text: string) => void;
  /** Throw away the user's edits and write the sentences again from the latest numbers. */
  onRegenerate: () => void;
};

/** The top text box: plain-English statistics, written automatically and editable. */
export function StatsTextBox({ text, edited, onChange, onRegenerate }: Props) {
  const id = useId();
  const rows = Math.min(12, Math.max(3, text.split("\n").length + Math.ceil(text.length / 130)));
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-semibold">
        What the numbers say <span className="font-normal text-muted">(written for you — click to edit)</span>
      </label>
      <textarea
        id={id}
        className="field"
        rows={rows}
        maxLength={5000}
        value={text}
        onChange={(e) => onChange(e.target.value)}
      />
      {edited && (
        <p className="mt-1 text-sm text-muted">
          You edited this text.{" "}
          <button type="button" onClick={onRegenerate} className="min-h-9 rounded px-1 font-semibold text-brand underline">
            Update with latest numbers
          </button>
        </p>
      )}
    </div>
  );
}
