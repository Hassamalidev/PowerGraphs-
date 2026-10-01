import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, parseBody, safely } from "@/lib/http";
import { deleteOrphanCharts, loadReport, REPORT_NOT_FOUND, toReportDto } from "@/lib/reports/server";
import { reportUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export function GET(_req: Request, ctx: Ctx) {
  return safely(async () => {
    const { id } = await ctx.params;
    const report = await loadReport(id);
    if (!report) return jsonError(REPORT_NOT_FOUND, 404);
    return NextResponse.json({ report: toReportDto(report) });
  });
}

export function PUT(req: Request, ctx: Ctx) {
  return safely(async () => {
    const { id } = await ctx.params;
    const body = await parseBody(req, reportUpdateSchema);
    if (!body.ok) return body.response;
    if (!(await prisma.report.findUnique({ where: { id } }))) return jsonError(REPORT_NOT_FOUND, 404);

    const { title, meetingDate, preparedBy, intro } = body.data;
    await prisma.report.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(meetingDate !== undefined ? { meetingDate: meetingDate ? new Date(meetingDate) : null } : {}),
        ...(preparedBy !== undefined ? { preparedBy: preparedBy || null } : {}),
        ...(intro !== undefined ? { intro: intro || null } : {}),
      },
    });
    const report = await loadReport(id);
    return NextResponse.json({ report: toReportDto(report!) });
  });
}

export function DELETE(_req: Request, ctx: Ctx) {
  return safely(async () => {
    const { id } = await ctx.params;
    const report = await prisma.report.findUnique({ where: { id }, include: { items: true } });
    if (!report) return jsonError(REPORT_NOT_FOUND, 404);
    await prisma.report.delete({ where: { id } }); // items are removed with it
    await deleteOrphanCharts(report.items.map((i) => i.chartId));
    return NextResponse.json({ ok: true });
  });
}
