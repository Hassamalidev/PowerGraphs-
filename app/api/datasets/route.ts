import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { listAvailable } from "@/lib/datasets/available";
import { allDefs, censusFile, publicDatasets } from "@/lib/datasets/server";
import { jsonError, parseBody, safely } from "@/lib/http";

export function GET() {
  return safely(async () => NextResponse.json({ datasets: await publicDatasets() }));
}

const createSchema = z.object({
  seriesId: z.string().min(1),
  name: z.string().trim().min(3, "Please give the dataset a name (at least 3 letters).").max(80, "That name is too long (80 letters at most)."),
});

/** Add one of the available Census series as a new dataset. */
export function POST(req: Request) {
  return safely(async () => {
    const body = await parseBody(req, createSchema);
    if (!body.ok) return body.response;
    const { seriesId, name } = body.data;

    const defs = await allDefs();
    if (defs.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
      return jsonError("There is already a dataset with that name. Please choose a different name.", 409);
    }

    let file;
    try {
      file = await censusFile();
    } catch {
      return jsonError("We couldn't reach the Census website to add this dataset. Please try again in a few minutes.", 503);
    }
    const series = listAvailable(file, defs.map((d) => d.source)).find((s) => s.id === seriesId);
    if (!series) return jsonError("That dataset is no longer available to add. It may already be in your list.", 404);

    await prisma.customDataset.create({
      data: {
        id: series.id,
        name,
        description: series.censusDescription,
        program: series.source.program,
        category_code: series.source.category_code,
        data_type_code: series.source.data_type_code,
        seasonally_adj: series.source.seasonally_adj,
        geo_level_code: series.source.geo_level_code,
        unit: series.unit,
        unitLabel: series.unitLabel,
        scale: series.scale,
        quarterly: series.quarterly,
      },
    });
    return NextResponse.json({ id: series.id, name }, { status: 201 });
  });
}
