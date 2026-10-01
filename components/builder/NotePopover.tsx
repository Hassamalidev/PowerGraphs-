"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { MAX_NOTE_LENGTH } from "@/lib/theme";

type Props = {
  /** Pixel position inside the chart area where the small window appears. */
  x: number;
  y: number;
  initialText: string;
  heading: string;
  onSave: (text: string) => void;
  onCancel: () => void;
};

const WIDTH = 300;

/** The small input for typing a note on the chart. Enter saves, Escape cancels. */
export function NotePopover({ x, y, initialText, heading, onSave, onCancel }: Props) {
  const [text, setText] = useState(initialText);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(x);

  useEffect(() => {
    inputRef.current?.focus();
    // Keep the window inside the chart area.
    const parentWidth = rootRef.current?.parentElement?.clientWidth ?? 0;
    setLeft(Math.max(0, Math.min(x, parentWidth - WIDTH)));
  }, [x]);

  const save = () => {
    const value = text.trim();
    if (value) onSave(value);
    else onCancel();
  };

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={heading}
      style={{ left, top: Math.max(0, y), width: WIDTH }}
      className="absolute z-20 rounded-lg border-[1.5px] border-line bg-surface p-3 shadow-xl"
    >
      <label htmlFor="note-text" className="mb-1 block font-semibold">
        {heading}
      </label>
      <input
        id="note-text"
        ref={inputRef}
        className="field"
        value={text}
        maxLength={MAX_NOTE_LENGTH}
        placeholder="Type your note, then press Enter"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          else if (e.key === "Escape") onCancel();
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm text-muted">
          {text.length} of {MAX_NOTE_LENGTH} characters
        </span>
        <span className="flex gap-2">
          <Button small onClick={onCancel}>
            Cancel
          </Button>
          <Button small variant="primary" onClick={save}>
            Save note
          </Button>
        </span>
      </div>
    </div>
  );
}
