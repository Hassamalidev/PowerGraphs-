"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_NAME } from "@/lib/theme";

/** The top bar: wordmark on the left, page links and actions on the right. */
export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="screen-only border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="text-2xl font-extrabold tracking-tight text-brand">
          {SITE_NAME}
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-2">
          {children}
        </nav>
      </div>
    </header>
  );
}

/** A header link styled like a button. */
export function HeaderLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center rounded-lg border-[1.5px] border-line bg-surface px-4 font-semibold hover:border-muted hover:bg-brand-soft"
    >
      {children}
    </Link>
  );
}
