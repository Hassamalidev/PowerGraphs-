"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SITE_NAME } from "@/lib/theme";

const LINK_STYLE =
  "inline-flex min-h-11 items-center rounded-lg border-[1.5px] px-4 font-semibold border-line bg-surface hover:border-muted hover:bg-brand-soft";

/** A header link styled like a button. The current page is highlighted. */
export function HeaderLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const current = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link href={href} aria-current={current ? "page" : undefined} className={`${LINK_STYLE} ${current ? "!border-brand !bg-brand-soft" : ""}`}>
      {children}
    </Link>
  );
}

/**
 * The top bar: wordmark on the left, page links on the right.
 * `children` are extra page-specific items (e.g. the report link, Reset chart).
 */
export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="screen-only border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="text-2xl font-extrabold tracking-tight text-brand">
          {SITE_NAME}
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-2">
          <HeaderLink href="/">Chart builder</HeaderLink>
          <HeaderLink href="/contacts">Contacts</HeaderLink>
          {children}
        </nav>
      </div>
    </header>
  );
}
