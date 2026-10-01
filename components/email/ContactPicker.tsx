"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { groupsOf, peopleCount, type Contact } from "@/components/contacts/useContacts";

type Props = {
  label: string;
  contacts: Contact[] | null;
  /** Selected email addresses. */
  value: string[];
  onChange: (emails: string[]) => void;
};

/**
 * "Send to" dropdown: tick people one by one, or tick a group (e.g.
 * "Management team (5 people)") to select all its members.
 */
export function ContactPicker({ label, contacts, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const list = contacts ?? [];
  const groups = groupsOf(list);
  const selected = new Set(value);
  const known = list.filter((c) => selected.has(c.email));

  const toggle = (emails: string[], on: boolean) => {
    const next = new Set(value);
    for (const email of emails) {
      if (on) next.add(email);
      else next.delete(email);
    }
    onChange([...next]);
  };

  const summary =
    contacts === null
      ? "Loading contacts…"
      : known.length === 0
        ? "Choose contacts"
        : known.length <= 2
          ? known.map((c) => c.name).join(", ")
          : `${peopleCount(known.length)} selected`;

  return (
    <div ref={rootRef} className="relative max-w-md">
      <div id={labelId} className="mb-1 font-semibold">
        {label}
      </div>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-labelledby={labelId}
        aria-describedby={`${labelId}-summary`}
        onClick={() => setOpen((o) => !o)}
        className="field flex items-center justify-between gap-2 text-left"
      >
        <span id={`${labelId}-summary`} className={`truncate ${known.length ? "" : "text-muted"}`}>
          {summary}
        </span>
        <span aria-hidden className="text-muted">
          ▼
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-labelledby={labelId}
          className="absolute left-0 z-30 mt-1 max-h-80 w-full min-w-[18rem] overflow-y-auto rounded-lg border-[1.5px] border-line bg-surface p-2 shadow-xl"
        >
          {list.length === 0 ? (
            <p className="p-2">
              You have no saved contacts yet.{" "}
              <Link href="/contacts" className="font-semibold text-brand underline">
                Add contacts
              </Link>
            </p>
          ) : (
            <>
              {groups.length > 0 && <div className="px-2 pb-1 pt-2 text-sm font-bold uppercase tracking-wide text-muted">Groups</div>}
              {groups.map((g) => {
                const all = g.emails.every((e) => selected.has(e));
                return (
                  <label key={`g:${g.name}`} className="flex min-h-11 cursor-pointer items-center gap-3 rounded px-2 hover:bg-brand-soft">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[var(--brand)]"
                      checked={all}
                      onChange={(e) => toggle(g.emails, e.target.checked)}
                    />
                    <span className="font-semibold">
                      {g.name} ({peopleCount(g.emails.length)})
                    </span>
                  </label>
                );
              })}
              <div className="px-2 pb-1 pt-2 text-sm font-bold uppercase tracking-wide text-muted">People</div>
              {list.map((c) => (
                <label key={c.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded px-2 hover:bg-brand-soft">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[var(--brand)]"
                    checked={selected.has(c.email)}
                    onChange={(e) => toggle([c.email], e.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold">{c.name}</span>
                    <span className="block truncate text-sm text-muted">{c.email}</span>
                  </span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
