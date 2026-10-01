import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, parseBody, safely } from "@/lib/http";
import { contactSchema } from "@/lib/validation";

export function GET() {
  return safely(async () => {
    const contacts = await prisma.contact.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ contacts });
  });
}

export function POST(req: Request) {
  return safely(async () => {
    const body = await parseBody(req, contactSchema);
    if (!body.ok) return body.response;
    const email = body.data.email.toLowerCase();
    if (await prisma.contact.findUnique({ where: { email } })) {
      return jsonError("A contact with that email address already exists.", 409);
    }
    const contact = await prisma.contact.create({ data: { ...body.data, email } });
    return NextResponse.json({ contact }, { status: 201 });
  });
}
