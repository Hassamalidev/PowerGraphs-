"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  title: string;
  edited: boolean;
  onChange: (title: string) => void;
  /** Go back to the automatic title. */
  onReset: () => void;
};

/** The chart title. Click it (or press Enter on it) to type your own. */
export function EditableTitle({ title, edited, onChange, onReset }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const start = () => {
    setDraft(title);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const text = draft.trim();
    if (text && text !== title) onChange(text);
  };

  if (editing) {
    return (
      <div>
        <label htmlFor="chart-title" className="mb-1 block text-sm font-semibold text-muted">
          Chart title (press Enter to save)
        </label>
        <input
          id="chart-title"
          ref={inputRef}
          className="field text-xl font-bold"
          value={draft}
          maxLength={200}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <h1 className="min-w-0 text-xl font-bold sm:text-2xl">
        <button
          type="button"
          onClick={start}
          title="Click to edit the title"
          className="rounded text-left hover:bg-brand-soft"
        >
          {title}
        </button>
      </h1>
      <button type="button" onClick={start} className="min-h-9 rounded px-2 text-sm font-semibold text-brand underline">
        Edit title
      </button>
      {edited && (
        <button type="button" onClick={onReset} className="min-h-9 rounded px-2 text-sm font-semibold text-brand underline">
          Use automatic title
        </button>
      )}
    </div>
  );
}
