"use client";

import { useId } from "react";
import { MAX_MEETING_NOTES } from "@/lib/theme";

/** The bottom text box: the user's own notes for the meeting. */
export function NotesTextBox({ text, onChange }: { text: string; onChange: (text: string) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-semibold">
        Your notes for the meeting
      </label>
      <textarea
        id={id}
        className="field"
        rows={4}
        maxLength={MAX_MEETING_NOTES}
        placeholder="Add your notes for the meeting (optional)"
        value={text}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="mt-1 text-right text-sm text-muted" aria-live="polite">
        {text.length.toLocaleString("en-US")} of {MAX_MEETING_NOTES.toLocaleString("en-US")} characters
      </p>
    </div>
  );
}
