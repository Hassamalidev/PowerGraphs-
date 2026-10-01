import { NextResponse } from "next/server";
import { z } from "zod";
import { computedQuarterlyRule, getDataset } from "@/lib/datasets/catalog";
import { jsonError, safely } from "@/lib/http";
import { periodLabel } from "@/lib/period";
import { quarterlyMethodText, toQuarterly } from "@/lib/series/aggregate";
import { getMonthlySeries } from "@/lib/series/cache";
import type { SeriesResponse } from "@/lib/series/types";

const viewSchema = z.enum(["monthly", "quarterly"]).default("monthly");

export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return safely(async () => {
    const { id } = await ctx.params;
    const def = getDataset(id);
    if (!def) return jsonError("We don't have a dataset with that name.", 404);

    const view = viewSchema.safeParse(new URL(req.url).searchParams.get("view") ?? undefined);
    if (!view.success) return jsonError('The view must be "monthly" or "quarterly".');

    const series = await getMonthlySeries(def);
    if (!series) {
      return jsonError("We couldn't load this dataset right now. Please try again in a few minutes.", 503);
    }

    let points = series.points;
    let incompleteQuarterNote: string | undefined;
    let quarterlyMethod: string | undefined;
    if (view.data === "quarterly") {
      // Census publishes no official quarterly values for this program
      // (see docs/census-ressales-codes.md), so quarters are always computed.
      const rule = computedQuarterlyRule(def);
      const quarterly = toQuarterly(series.points, rule);
      points = quarterly.points;
      incompleteQuarterNote = quarterly.incompleteQuarterNote;
      quarterlyMethod = quarterlyMethodText(rule);
    }

    const body: SeriesResponse = {
      points: points.map((p) => ({ date: p.date, label: periodLabel(p.date), value: p.value })),
      meta: {
        unit: def.unit,
        unitLabel: def.unitLabel,
        sourceLabel: def.sourceLabel,
        dataAsOf: series.dataAsOf,
        isFallback: series.isFallback,
        fallbackDate: series.fallbackDate,
        incompleteQuarterNote,
        quarterlyMethod,
      },
    };
    return NextResponse.json(body);
  });
}
