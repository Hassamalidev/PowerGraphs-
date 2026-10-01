import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, parseBody, safely } from "@/lib/http";
import { CHART_NOT_FOUND, REPORT_NOT_FOUND, touchReport } from "@/lib/reports/server";
import { reportItemSchema } from "@/lib/validation";

/** Add a saved chart to the end of a report. */
export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return safely(async () => {
    const { id } = await ctx.params;
    const body = await parseBody(req, reportItemSchema);
    if (!body.ok) return body.response;

    const report = await prisma.report.findUnique({ where: { id }, include: { items: true } });
    if (!report) return jsonError(REPORT_NOT_FOUND, 404);
    if (!(await prisma.savedChart.findUnique({ where: { id: body.data.chartId } }))) return jsonError(CHART_NOT_FOUND, 404);

    const position = report.items.reduce((max, item) => Math.max(max, item.position), -1) + 1;
    const item = await prisma.reportItem.create({ data: { reportId: id, chartId: body.data.chartId, position } });
    await touchReport(id);
    return NextResponse.json({ item: { id: item.id, position }, chartCount: report.items.length + 1, title: report.title }, { status: 201 });
  });
}
