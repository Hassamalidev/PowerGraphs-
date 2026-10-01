import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, safely } from "@/lib/http";

/** Remove a dataset the user added. Built-in datasets can't be removed. */
export function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return safely(async () => {
    const { id } = await ctx.params;
    if (!(await prisma.customDataset.findUnique({ where: { id } }))) {
      return jsonError("We couldn't find that dataset. It may already have been removed.", 404);
    }
    await prisma.customDataset.delete({ where: { id } });
    await prisma.seriesCache.deleteMany({ where: { seriesId: id } });
    return NextResponse.json({ ok: true });
  });
}
