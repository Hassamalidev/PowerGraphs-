import { jsPDF } from "jspdf";
import { formatIsoDate, formatLongDate, safeFileName } from "@/lib/format";
import { COLORS, SITE_DOMAIN, SITE_NAME } from "@/lib/theme";

/** Everything needed to put one chart on a page. */
export type ChartPage = {
  title: string;
  topText: string; // statistics sentences
  bottomText: string; // meeting notes
  image: string; // PNG data URL of the chart, including arrow labels and notes
  sourceLine: string; // "Source: U.S. Census Bureau, … Data as of …."
};

export type PdfFile = { blob: Blob; filename: string; base64: string };

// US Letter, landscape, 0.5 inch margins (in points: 72 per inch).
export const PAGE = { width: 792, height: 612, margin: 36 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;

type Rgb = [number, number, number];
const hex = (color: string): Rgb => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) as Rgb;
const INK = hex(COLORS.text);
const MUTED = hex(COLORS.muted);
const BRAND = hex(COLORS.brand);

/** The built-in PDF fonts only cover Western characters; swap the few others we use. */
export function pdfSafe(text: string): string {
  return text
    .replace(/−/g, "-") // minus sign
    .replace(/[→➜]/g, "->")
    .replace(/[^\x09\x0A\x20-\x7E -ÿ–—‘’“”•…]/g, "?");
}

export function newLandscapeDoc(): jsPDF {
  return new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
}

/** Wrap text to the page width, keeping at most `maxLines` lines (ending with "…" if cut). */
function wrap(doc: jsPDF, text: string, maxLines: number): string[] {
  const lines = pdfSafe(text)
    .split("\n")
    .flatMap((paragraph) => (paragraph.trim() === "" ? [""] : (doc.splitTextToSize(paragraph, CONTENT_WIDTH) as string[])));
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S{0,3}$/, "") + "…";
  return kept;
}

export function drawHeader(doc: jsPDF, date: Date) {
  const y = PAGE.margin + 9;
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...BRAND);
  doc.text(SITE_NAME, PAGE.margin, y);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  doc.text(formatLongDate(date), PAGE.width - PAGE.margin, y, { align: "right" });
}

export function drawFooter(doc: jsPDF, left: string, pageLabel?: string) {
  const y = PAGE.height - PAGE.margin;
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
  if (left) doc.text(pdfSafe(left), PAGE.margin, y);
  if (pageLabel) doc.text(pageLabel, PAGE.width / 2, y, { align: "center" });
  doc.text(`Created with ${SITE_DOMAIN}`, PAGE.width - PAGE.margin, y, { align: "right" });
}

/**
 * Draw one chart page onto the current page of the document:
 * wordmark + date, title, statistics text, chart image, meeting notes, footer.
 */
export function drawChartPage(doc: jsPDF, page: ChartPage, date: Date, pageLabel?: string) {
  drawHeader(doc, date);
  let y = PAGE.margin + 36;

  doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(...INK);
  const titleLines = wrap(doc, page.title, 2);
  doc.text(titleLines, PAGE.margin, y);
  y += titleLines.length * 20;

  if (page.topText.trim()) {
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...INK);
    const lines = wrap(doc, page.topText, 9);
    doc.text(lines, PAGE.margin, y, { lineHeightFactor: 1.3 });
    y += lines.length * 9.5 * 1.3 + 4;
  }

  // Work out the space the notes need at the bottom, then give the chart the rest.
  const footerTop = PAGE.height - PAGE.margin - 14;
  doc.setFont("helvetica", "normal").setFontSize(9.5);
  const noteLines = page.bottomText.trim() ? wrap(doc, page.bottomText, 7) : [];
  const notesHeight = noteLines.length ? noteLines.length * 9.5 * 1.3 + 18 : 0;

  const available = { top: y, height: footerTop - notesHeight - y };
  const props = doc.getImageProperties(page.image);
  const scale = Math.min(CONTENT_WIDTH / props.width, available.height / props.height);
  const width = props.width * scale;
  const height = props.height * scale;
  doc.addImage(page.image, "PNG", PAGE.margin + (CONTENT_WIDTH - width) / 2, available.top, width, height, undefined, "FAST");

  if (noteLines.length) {
    let ny = available.top + height + 14;
    doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...INK);
    doc.text("Notes", PAGE.margin, ny);
    ny += 12;
    doc.setFont("helvetica", "normal");
    doc.text(noteLines, PAGE.margin, ny, { lineHeightFactor: 1.3 });
  }

  drawFooter(doc, page.sourceLine, pageLabel);
}

export function toPdfFile(doc: jsPDF, filename: string): PdfFile {
  const dataUri = doc.output("datauristring");
  return { blob: doc.output("blob"), filename, base64: dataUri.slice(dataUri.indexOf(",") + 1) };
}

export function chartFileBase(title: string, date: Date): string {
  return safeFileName(`${SITE_NAME} - ${title} - ${formatIsoDate(date)}`);
}

/** A one-page PDF of a single chart (same layout as the print view). */
export function buildChartPdf(page: ChartPage, date = new Date()): PdfFile {
  const doc = newLandscapeDoc();
  doc.setProperties({ title: pdfSafe(page.title), creator: SITE_DOMAIN });
  drawChartPage(doc, page, date);
  return toPdfFile(doc, `${chartFileBase(page.title, date)}.pdf`);
}
