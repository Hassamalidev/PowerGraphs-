import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, safely } from "@/lib/http";
import { deleteOrphanCharts, touchReport } from "@/lib/reports/server";

/** Remove one chart from a report. */
export function DELETE(_req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  return safely(async () => {
    const { id, itemId } = await ctx.params;
    const item = await prisma.reportItem.findUnique({ where: { id: itemId } });
    if (!item || item.reportId !== id) return jsonError("That chart is no longer in this report.", 404);

    await prisma.reportItem.delete({ where: { id: itemId } });
    await deleteOrphanCharts([item.chartId]);

    // Close the gap so positions stay 0, 1, 2, …
    const rest = await prisma.reportItem.findMany({ where: { reportId: id }, orderBy: { position: "asc" } });
    await prisma.$transaction(rest.map((r, position) => prisma.reportItem.update({ where: { id: r.id }, data: { position } })));
    await touchReport(id);
    return NextResponse.json({ ok: true, chartCount: rest.length });
  });
}
