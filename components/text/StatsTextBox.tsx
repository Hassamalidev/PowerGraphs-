"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { StatBlock, StatBlocks, Tone } from "@/lib/stats/blocks";
import { SERIES_STYLES } from "@/lib/theme";

type Props = {
  /** The statistics as plain sentences (what print, PDF, and email use). */
  text: string;
  /** The same statistics as cards, shown while the text hasn't been edited. */
  stats: StatBlocks;
  edited: boolean;
  onChange: (text: string) => void;
  /** Throw away the user's edits and write the statistics again from the latest numbers. */
  onRegenerate: () => void;
};

const CHIP: Record<Tone, { style: string; mark: string }> = {
  up: { style: "border-green-700 bg-green-50 text-green-900", mark: "▲" },
  down: { style: "border-danger bg-red-50 text-danger", mark: "▼" },
  flat: { style: "border-line bg-page text-ink", mark: "●" },
  neutral: { style: "border-line bg-page text-ink", mark: "" },
};

/** A short sample of the dataset's line, tying the card to its line on the chart. */
function LineMark({ slot }: { slot: number }) {
  const s = SERIES_STYLES[slot] ?? SERIES_STYLES[0];
  const dash = s.lineStyle === "dashed" ? "7 4" : s.lineStyle === "dotted" ? "2 4" : undefined;
  return (
    <svg width="30" height="10" aria-hidden className="shrink-0">
      <line x1="1" y1="5" x2="29" y2="5" stroke={s.color} strokeWidth={3} strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  );
}

function Card({ block }: { block: StatBlock }) {
  const color = block.slot != null ? (SERIES_STYLES[block.slot] ?? SERIES_STYLES[0]).color : undefined;
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-page p-4" style={color ? { borderTop: `4px solid ${color}` } : undefined}>
      <h3 className="flex items-center gap-2 font-semibold leading-snug">
        {block.slot != null && <LineMark slot={block.slot} />}
        <span>{block.title}</span>
      </h3>

      <p>
        <span className="text-2xl font-bold leading-tight">{block.headline}</span>
        {block.headlineNote && <span className="ml-2 text-muted">{block.headlineNote}</span>}
      </p>

      {block.chips.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {block.chips.map((chip) => (
            <li key={chip.text} className={`rounded-full border px-3 py-1 text-sm font-semibold ${CHIP[chip.tone].style}`}>
              {CHIP[chip.tone].mark && (
                <span aria-hidden className="mr-1.5 text-xs">
                  {CHIP[chip.tone].mark}
                </span>
              )}
              {chip.text}
            </li>
          ))}
        </ul>
      )}

      {block.sentence && <p>{block.sentence}</p>}

      {block.facts.length > 0 && (
        <dl className="mt-auto grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-line pt-3 text-sm">
          {block.facts.map((fact) => (
            <div key={fact.label} className="contents">
              <dt className="text-muted">{fact.label}</dt>
              <dd className="text-right font-semibold">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

/**
 * The top box: "What the numbers say". Shown as easy-to-scan cards; "Edit
 * text" switches to a text box so the user can write their own wording.
 */
export function StatsTextBox({ text, stats, edited, onChange, onRegenerate }: Props) {
  const [editing, setEditing] = useState(false);
  const id = useId();
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) areaRef.current?.focus();
  }, [editing]);

  const columns = stats.blocks.length >= 3 ? "lg:grid-cols-3 md:grid-cols-2" : stats.blocks.length === 2 ? "md:grid-cols-2" : "";

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-heading`} className="text-lg font-bold">
          What the numbers say
        </h2>
        {editing ? (
          <Button small variant="primary" onClick={() => setEditing(false)}>
            Done editing
          </Button>
        ) : (
          <Button small onClick={() => setEditing(true)}>
            Edit text
          </Button>
        )}
      </div>

      {editing ? (
        <div>
          <label htmlFor={id} className="mb-1 block text-sm text-muted">
            This wording is what appears on printed pages, PDFs, emails, and reports.
          </label>
          <textarea
            id={id}
            ref={areaRef}
            className="field"
            rows={Math.min(14, Math.max(4, text.split("\n").length + Math.ceil(text.length / 130)))}
            maxLength={5000}
            value={text}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      ) : edited ? (
        // The user's own wording replaces the cards.
        <p className="whitespace-pre-line rounded-xl border border-line border-l-4 border-l-brand bg-surface p-4 text-lg leading-relaxed">
          {text.trim() || <span className="text-muted">(You cleared the text.)</span>}
        </p>
      ) : stats.blocks.length > 0 ? (
        <>
          <div className={`grid gap-4 ${columns}`}>
            {stats.blocks.map((block) => (
              <Card key={`${block.slot ?? "pair"}-${block.title}`} block={block} />
            ))}
          </div>
          {stats.footnote && <p className="text-sm text-muted">{stats.footnote}</p>}
        </>
      ) : (
        <p className="whitespace-pre-line rounded-xl border border-line bg-surface p-4">{text}</p>
      )}

      {edited && (
        <p className="text-sm text-muted">
          You edited this text, so it no longer updates by itself.{" "}
          <button type="button" onClick={onRegenerate} className="min-h-9 rounded px-1 font-semibold text-brand underline">
            Update with latest numbers
          </button>
        </p>
      )}
    </section>
  );
}
