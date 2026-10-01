import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EmailNotConfiguredError, sendEmail } from "@/lib/email";
import { jsonError, parseBody, safely } from "@/lib/http";
import { emailSchema } from "@/lib/validation";

async function log(recipients: string[], subject: string, attachmentName: string, status: string, error?: string) {
  try {
    await prisma.emailLog.create({
      data: { recipients: recipients.join(","), subject, attachmentName, status, error: error?.slice(0, 1000) },
    });
  } catch (err) {
    console.warn(`[email] could not write the email log: ${(err as Error).message}`);
  }
}

export function POST(req: Request) {
  return safely(async () => {
    const body = await parseBody(req, emailSchema);
    if (!body.ok) return body.response;
    const email = { ...body.data, recipients: [...new Set(body.data.recipients.map((r) => r.toLowerCase()))] };

    try {
      const result = await sendEmail(email);
      await log(email.recipients, email.subject, email.filename, result.status);
      return NextResponse.json({ ok: true, count: email.recipients.length, devLogged: result.status === "logged-dev" });
    } catch (err) {
      await log(email.recipients, email.subject, email.filename, "failed", (err as Error).message);
      if (err instanceof EmailNotConfiguredError) {
        return jsonError(
          "Email isn't set up on this site yet, so nothing was sent. You can download the PDF and attach it to an email yourself.",
          503,
        );
      }
      console.error("[email] send failed:", err);
      return jsonError("The email couldn't be sent. Please check the email settings or try again.", 502);
    }
  });
}
