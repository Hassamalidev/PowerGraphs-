import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, parseBody, safely } from "@/lib/http";
import { CHART_NOT_FOUND, toChartDto } from "@/lib/reports/server";
import { savedChartSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export function GET(_req: Request, ctx: Ctx) {
  return safely(async () => {
    const { id } = await ctx.params;
    const chart = await prisma.savedChart.findUnique({ where: { id } });
    if (!chart) return jsonError(CHART_NOT_FOUND, 404);
    return NextResponse.json({ chart: toChartDto(chart) });
  });
}

export function PUT(req: Request, ctx: Ctx) {
  return safely(async () => {
    const { id } = await ctx.params;
    const body = await parseBody(req, savedChartSchema);
    if (!body.ok) return body.response;
    const existing = await prisma.savedChart.findUnique({ where: { id }, include: { items: true } });
    if (!existing) return jsonError(CHART_NOT_FOUND, 404);

    const { config, dataAsOf, ...rest } = body.data;
    const chart = await prisma.savedChart.update({
      where: { id },
      data: { ...rest, config: JSON.stringify(config), dataAsOf: new Date(dataAsOf) },
    });
    // The reports holding this chart have changed too.
    await prisma.report.updateMany({
      where: { id: { in: existing.items.map((i) => i.reportId) } },
      data: { updatedAt: new Date() },
    });
    return NextResponse.json({ chart: toChartDto(chart) });
  });
}

export function DELETE(_req: Request, ctx: Ctx) {
  return safely(async () => {
    const { id } = await ctx.params;
    if (!(await prisma.savedChart.findUnique({ where: { id } }))) return jsonError(CHART_NOT_FOUND, 404);
    await prisma.savedChart.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
