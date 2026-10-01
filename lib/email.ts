import nodemailer from "nodemailer";

// Server-only: reads the SMTP settings from environment variables.

export type OutgoingEmail = {
  recipients: string[];
  subject: string;
  message: string;
  pdfBase64: string;
  filename: string;
};

export type SendResult = { status: "sent" | "logged-dev" };

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("SMTP is not configured");
  }
}

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

/**
 * Send an email with a PDF attached.
 * Without SMTP settings: in development the email is written to the server
 * console instead; in production EmailNotConfiguredError is thrown.
 */
export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV === "production") throw new EmailNotConfiguredError();
    console.log(
      [
        "──────── Email (not sent: SMTP is not configured) ────────",
        `To:         ${email.recipients.join(", ")}`,
        `Subject:    ${email.subject}`,
        `Attachment: ${email.filename} (${Math.round((email.pdfBase64.length * 3) / 4 / 1024)} KB)`,
        "",
        email.message,
        "──────────────────────────────────────────────────────────",
      ].join("\n"),
    );
    return { status: "logged-dev" };
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = TLS from the start; 587 upgrades with STARTTLS
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });

  await transport.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: email.recipients,
    subject: email.subject,
    text: email.message,
    attachments: [{ filename: email.filename, content: email.pdfBase64, encoding: "base64", contentType: "application/pdf" }],
  });
  return { status: "sent" };
}
