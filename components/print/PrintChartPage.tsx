import { formatLongDate } from "@/lib/format";
import type { ChartPage } from "@/lib/pdf/chartPdf";
import { SITE_DOMAIN, SITE_NAME } from "@/lib/theme";

type Props = {
  page: ChartPage;
  date: Date;
  pageLabel?: string;
};

/**
 * One printed page (US Letter landscape): wordmark + date, title, statistics,
 * chart image, notes, footer. No buttons, dropdowns, or sliders.
 * Wrap it in an element with class "print-only".
 */
export function PrintChartPage({ page, date, pageLabel }: Props) {
  return (
    <div className="print-page flex h-[7.4in] flex-col text-black">
      <div className="flex items-baseline justify-between">
        <span className="text-[13pt] font-extrabold text-brand">{SITE_NAME}</span>
        <span className="text-[9pt] text-muted">{formatLongDate(date)}</span>
      </div>
      <h1 className="mt-2 text-[17pt] font-bold leading-tight">{page.title}</h1>
      {page.topText.trim() && <p className="mt-1 whitespace-pre-line text-[9.5pt] leading-snug">{page.topText}</p>}
      <div className="mt-2 flex min-h-0 flex-1 items-start justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- a data URL snapshot of the chart */}
        <img src={page.image} alt={page.title} className="max-h-full max-w-full object-contain" />
      </div>
      {page.bottomText.trim() && (
        <div className="mt-2 text-[9.5pt] leading-snug">
          <div className="font-bold">Notes</div>
          <p className="whitespace-pre-line">{page.bottomText}</p>
        </div>
      )}
      <div className="mt-2 flex items-baseline justify-between gap-4 text-[8pt] text-muted">
        <span>{page.sourceLine}</span>
        {pageLabel && <span>{pageLabel}</span>}
        <span>Created with {SITE_DOMAIN}</span>
      </div>
    </div>
  );
}
