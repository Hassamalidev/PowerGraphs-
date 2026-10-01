import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, parseBody, safely } from "@/lib/http";
import { REPORT_NOT_FOUND, touchReport } from "@/lib/reports/server";
import { reportOrderSchema } from "@/lib/validation";

/** Save a new order for the charts in a report. */
export function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return safely(async () => {
    const { id } = await ctx.params;
    const body = await parseBody(req, reportOrderSchema);
    if (!body.ok) return body.response;

    const report = await prisma.report.findUnique({ where: { id }, include: { items: true } });
    if (!report) return jsonError(REPORT_NOT_FOUND, 404);

    const current = new Set(report.items.map((i) => i.id));
    const wanted = body.data.itemIds;
    if (wanted.length !== current.size || new Set(wanted).size !== wanted.length || !wanted.every((itemId) => current.has(itemId))) {
      return jsonError("The report changed while you were reordering it. Please refresh the page and try again.", 409);
    }

    await prisma.$transaction(wanted.map((itemId, position) => prisma.reportItem.update({ where: { id: itemId }, data: { position } })));
    await touchReport(id);
    return NextResponse.json({ ok: true });
  });
}
