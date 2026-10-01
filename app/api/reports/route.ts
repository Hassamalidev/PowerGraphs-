import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody, safely } from "@/lib/http";
import { toReportSummary } from "@/lib/reports/server";
import { reportCreateSchema } from "@/lib/validation";

export function GET() {
  return safely(async () => {
    const reports = await prisma.report.findMany({
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { items: true } } },
    });
    return NextResponse.json({ reports: reports.map(toReportSummary) });
  });
}

export function POST(req: Request) {
  return safely(async () => {
    const body = await parseBody(req, reportCreateSchema);
    if (!body.ok) return body.response;
    const report = await prisma.report.create({
      data: { title: body.data.title },
      include: { _count: { select: { items: true } } },
    });
    return NextResponse.json({ report: toReportSummary(report) }, { status: 201 });
  });
}
