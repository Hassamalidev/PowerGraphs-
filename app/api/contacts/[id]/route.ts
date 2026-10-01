import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, parseBody, safely } from "@/lib/http";
import { contactSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

const NOT_FOUND = "We couldn't find that contact. It may have been deleted.";

export function PUT(req: Request, ctx: Ctx) {
  return safely(async () => {
    const { id } = await ctx.params;
    const body = await parseBody(req, contactSchema);
    if (!body.ok) return body.response;
    if (!(await prisma.contact.findUnique({ where: { id } }))) return jsonError(NOT_FOUND, 404);

    const email = body.data.email.toLowerCase();
    const sameEmail = await prisma.contact.findUnique({ where: { email } });
    if (sameEmail && sameEmail.id !== id) return jsonError("A contact with that email address already exists.", 409);

    const contact = await prisma.contact.update({ where: { id }, data: { ...body.data, email } });
    return NextResponse.json({ contact });
  });
}

export function DELETE(_req: Request, ctx: Ctx) {
  return safely(async () => {
    const { id } = await ctx.params;
    if (!(await prisma.contact.findUnique({ where: { id } }))) return jsonError(NOT_FOUND, 404);
    await prisma.contact.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
