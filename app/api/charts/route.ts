import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody, safely } from "@/lib/http";
import { toChartDto } from "@/lib/reports/server";
import { savedChartSchema } from "@/lib/validation";

export function GET() {
  return safely(async () => {
    // The list leaves out the images, which are large.
    const charts = await prisma.savedChart.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, dataAsOf: true, updatedAt: true },
    });
    return NextResponse.json({ charts });
  });
}

export function POST(req: Request) {
  return safely(async () => {
    const body = await parseBody(req, savedChartSchema);
    if (!body.ok) return body.response;
    const { config, dataAsOf, ...rest } = body.data;
    const chart = await prisma.savedChart.create({
      data: { ...rest, config: JSON.stringify(config), dataAsOf: new Date(dataAsOf) },
    });
    return NextResponse.json({ chart: toChartDto(chart) }, { status: 201 });
  });
}
