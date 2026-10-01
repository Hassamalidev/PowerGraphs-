"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type RichOption = {
  value: string;
  label: string;
  description?: string;
  group?: string;
  disabled?: boolean;
  disabledReason?: string;
};

type Props = {
  labelId: string; // id of the visible text label for this control
  options: RichOption[];
  value: string | null;
  placeholder: string;
  onChange: (value: string) => void;
};

/**
 * A dropdown whose options have a name and a one-line description, grouped by
 * topic. Keyboard: Enter/Space/arrows open it, arrows move, Enter picks, Esc closes.
 */
export function RichSelect({ labelId, options, value, placeholder, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const valueId = useId();

  const selected = options.find((o) => o.value === value) ?? null;
  const enabled = useMemo(() => options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0), [options]);

  const openList = () => {
    const current = options.findIndex((o) => o.value === value);
    setActive(current >= 0 ? current : (enabled[0] ?? -1));
    setOpen(true);
  };

  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  };

  const pick = (index: number) => {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    close();
  };

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  const move = (step: 1 | -1) => {
    if (enabled.length === 0) return;
    const pos = enabled.indexOf(active);
    const next = pos === -1 ? 0 : (pos + step + enabled.length) % enabled.length;
    setActive(enabled[next]);
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(enabled[0] ?? -1);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(enabled[enabled.length - 1] ?? -1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  let lastGroup: string | undefined;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${valueId}`}
        onClick={() => (open ? close() : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            openList();
          }
        }}
        className="field flex items-center justify-between gap-2 text-left"
      >
        <span id={valueId} className={`truncate ${selected ? "" : "text-muted"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span aria-hidden className="text-muted">
          ▼
        </span>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onKeyDown={onListKey}
          className="absolute left-0 z-30 mt-1 max-h-[26rem] w-full min-w-[20rem] overflow-y-auto rounded-lg border-[1.5px] border-line bg-surface py-1 shadow-xl outline-none"
        >
          {options.map((opt, i) => {
            const header = opt.group && opt.group !== lastGroup ? opt.group : null;
            lastGroup = opt.group;
            return (
              <li key={opt.value} role="presentation">
                {header && (
                  <div className="px-3 pb-1 pt-3 text-sm font-bold uppercase tracking-wide text-muted" role="presentation">
                    {header}
                  </div>
                )}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={opt.value === value}
                  aria-disabled={opt.disabled || undefined}
                  onMouseEnter={() => !opt.disabled && setActive(i)}
                  onClick={() => pick(i)}
                  className={`min-h-11 px-3 py-2 ${opt.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${
                    i === active ? "bg-brand-soft" : ""
                  }`}
                >
                  <div className="font-semibold">
                    {opt.label}
                    {opt.value === value && <span className="ml-2 text-sm font-normal text-brand">(selected)</span>}
                  </div>
                  <div className="text-sm text-muted">{opt.disabled && opt.disabledReason ? opt.disabledReason : opt.description}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
