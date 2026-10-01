import { NextResponse } from "next/server";
import { listAvailable } from "@/lib/datasets/available";
import { allDefs, censusFile } from "@/lib/datasets/server";
import { jsonError, safely } from "@/lib/http";

/** Census series that could be added as new datasets (without their internal codes). */
export function GET() {
  return safely(async () => {
    let file;
    try {
      file = await censusFile();
    } catch {
      return jsonError("We couldn't reach the Census website to see what else is available. Please try again in a few minutes.", 503);
    }
    const defs = await allDefs();
    const available = listAvailable(file, defs.map((d) => d.source)).map(({ source: _source, ...rest }) => rest);
    return NextResponse.json({ available });
  });
}
