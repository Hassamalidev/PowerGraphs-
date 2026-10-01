import { formatIsoDate, formatLongDate, safeFileName } from "@/lib/format";
import { COLORS, SITE_DOMAIN, SITE_NAME } from "@/lib/theme";
import { drawChartPage, drawFooter, newLandscapeDoc, PAGE, pdfSafe, toPdfFile, type ChartPage, type PdfFile } from "./chartPdf";

export type ReportCover = {
  title: string;
  meetingDate: string | null; // YYYY-MM-DD
  preparedBy: string;
  intro: string;
};

type Rgb = [number, number, number];
const hex = (color: string): Rgb => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) as Rgb;

export function reportFileName(title: string, date = new Date()): string {
  return `${safeFileName(`${title} - ${formatIsoDate(date)}`)}.pdf`;
}

export function pageLabel(page: number, total: number): string {
  return `Page ${page} of ${total}`;
}

/**
 * The report PDF: a cover page (title, meeting date, prepared by,
 * introduction, list of charts), then one chart per page, with page numbers.
 */
export function buildReportPdf(cover: ReportCover, charts: ChartPage[], date = new Date()): PdfFile {
  const doc = newLandscapeDoc();
  doc.setProperties({ title: pdfSafe(cover.title), creator: SITE_DOMAIN });
  const total = charts.length + 1;
  const width = PAGE.width - PAGE.margin * 2;
  const ink = hex(COLORS.text);
  const muted = hex(COLORS.muted);

  // ----- Cover -----
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...hex(COLORS.brand));
  doc.text(SITE_NAME, PAGE.margin, PAGE.margin + 10);

  let y = 130;
  doc.setFontSize(28).setTextColor(...ink);
  const titleLines = doc.splitTextToSize(pdfSafe(cover.title), width) as string[];
  doc.text(titleLines.slice(0, 3), PAGE.margin, y);
  y += Math.min(3, titleLines.length) * 33 + 6;

  doc.setFont("helvetica", "normal").setFontSize(13).setTextColor(...muted);
  if (cover.meetingDate) {
    doc.text(`Meeting date: ${formatLongDate(cover.meetingDate)}`, PAGE.margin, y);
    y += 19;
  }
  if (cover.preparedBy.trim()) {
    doc.text(pdfSafe(`Prepared by: ${cover.preparedBy.trim()}`), PAGE.margin, y);
    y += 19;
  }
  y += 10;

  const contentsLines = charts.length + 2;
  if (cover.intro.trim()) {
    doc.setFontSize(11).setTextColor(...ink);
    // Leave room below for the list of charts.
    const room = PAGE.height - PAGE.margin - 30 - y - contentsLines * 16;
    const maxLines = Math.max(2, Math.floor(room / 15));
    let lines = pdfSafe(cover.intro)
      .split("\n")
      .flatMap((p) => (p.trim() ? (doc.splitTextToSize(p, width) as string[]) : [""]));
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] += "…";
    }
    doc.text(lines, PAGE.margin, y, { lineHeightFactor: 1.35 });
    y += lines.length * 15 + 14;
  }

  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...ink);
  doc.text("In this report", PAGE.margin, y);
  y += 18;
  doc.setFont("helvetica", "normal").setFontSize(11);
  charts.forEach((chart, i) => {
    if (y > PAGE.height - PAGE.margin - 24) return; // a very long list is cut rather than overflowing the page
    const pageText = `Page ${i + 2}`;
    const title = doc.splitTextToSize(pdfSafe(`${i + 1}.  ${chart.title}`), width - 70)[0] as string;
    doc.text(title, PAGE.margin, y);
    doc.setTextColor(...muted);
    doc.text(pageText, PAGE.width - PAGE.margin, y, { align: "right" });
    doc.setTextColor(...ink);
    y += 16;
  });

  drawFooter(doc, "", pageLabel(1, total));

  // ----- One chart per page -----
  charts.forEach((chart, i) => {
    doc.addPage("letter", "landscape");
    drawChartPage(doc, chart, date, pageLabel(i + 2, total));
  });

  return toPdfFile(doc, reportFileName(cover.title, date));
}
