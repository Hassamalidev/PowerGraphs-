"use client";

import { useEffect, useId, useRef, useState } from "react";
import { peopleCount, type Contact } from "@/components/contacts/useContacts";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { api, errorMessage } from "@/lib/api";
import { formatFileSize } from "@/lib/format";
import type { PdfFile } from "@/lib/pdf/chartPdf";
import { SITE_DOMAIN } from "@/lib/theme";
import { ContactPicker } from "./ContactPicker";

type Props = {
  title: string; // "Email this chart" / "Email this report"
  subject: string;
  /** Builds the PDF to attach. Called once when the window opens. */
  makePdf: () => Promise<PdfFile>;
  contacts: Contact[] | null;
  initialRecipients: string[];
  /** Called after a new address was saved to contacts. */
  onContactsChanged: () => void;
  onClose: () => void;
};

const DEFAULT_MESSAGE = `Hello, please find the attached chart(s) for our meeting. — Sent from ${SITE_DOMAIN}`;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Result = { kind: "success" | "warning" | "error"; text: string };

/** The email window: who to send to, subject, message, and the PDF attachment. */
export function EmailDialog({ title, subject: initialSubject, makePdf, contacts, initialRecipients, onContactsChanged, onClose }: Props) {
  const [recipients, setRecipients] = useState(initialRecipients);
  const [extra, setExtra] = useState("");
  const [saveExtra, setSaveExtra] = useState(false);
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [pdf, setPdf] = useState<PdfFile | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const ids = { extra: useId(), subject: useId(), message: useId() };

  const makePdfRef = useRef(makePdf);
  useEffect(() => {
    let cancelled = false;
    makePdfRef
      .current()
      .then((file) => !cancelled && setPdf(file))
      .catch((err) => !cancelled && setPdfError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  const extraEmail = extra.trim().toLowerCase();
  const extraValid = extraEmail === "" || EMAIL_PATTERN.test(extraEmail);
  const all = [...new Set([...recipients, ...(extraEmail && extraValid ? [extraEmail] : [])])];
  const canSend = pdf !== null && all.length > 0 && extraValid && subject.trim() !== "" && !sending;

  const send = async () => {
    if (!pdf || !canSend) return;
    setSending(true);
    setResult(null);
    try {
      const res = await api<{ count: number; devLogged: boolean }>("/api/email", {
        method: "POST",
        body: { recipients: all, subject: subject.trim(), message, pdfBase64: pdf.base64, filename: pdf.filename },
      });
      setResult(
        res.devLogged
          ? {
              kind: "warning",
              text: "Email isn't set up yet, so nothing was actually sent. (Development mode: the email was written to the server log instead.)",
            }
          : { kind: "success", text: `Sent to ${peopleCount(res.count)}.` },
      );

      if (saveExtra && extraEmail && !contacts?.some((c) => c.email === extraEmail)) {
        try {
          await api("/api/contacts", { method: "POST", body: { name: extraEmail.split("@")[0], email: extraEmail, group: null } });
          onContactsChanged();
        } catch {
          // The email itself went out; a failed save shouldn't look like a failed send.
        }
      }
    } catch (err) {
      setResult({ kind: "error", text: errorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{result?.kind === "success" ? "Done" : "Cancel"}</Button>
          <Button variant="primary" disabled={!canSend} onClick={send}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ContactPicker label="To" contacts={contacts} value={recipients} onChange={setRecipients} />

        <div>
          <label htmlFor={ids.extra} className="mb-1 block font-semibold">
            Or type an email address
          </label>
          <input
            id={ids.extra}
            type="email"
            className="field"
            placeholder="name@company.com"
            value={extra}
            aria-invalid={!extraValid}
            onChange={(e) => setExtra(e.target.value)}
          />
          {!extraValid && <p className="mt-1 text-sm text-danger">That doesn&apos;t look like a full email address.</p>}
          {extraEmail && extraValid && (
            <label className="mt-2 flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--brand)]"
                checked={saveExtra}
                onChange={(e) => setSaveExtra(e.target.checked)}
              />
              Save to contacts
            </label>
          )}
        </div>

        <p className="text-sm text-muted" aria-live="polite">
          {all.length === 0 ? "No one selected yet." : `This will go to ${peopleCount(all.length)}.`}
        </p>

        <div>
          <label htmlFor={ids.subject} className="mb-1 block font-semibold">
            Subject
          </label>
          <input id={ids.subject} className="field" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
        </div>

        <div>
          <label htmlFor={ids.message} className="mb-1 block font-semibold">
            Message
          </label>
          <textarea id={ids.message} className="field" rows={4} value={message} maxLength={5000} onChange={(e) => setMessage(e.target.value)} />
        </div>

        <div>
          <div className="mb-1 font-semibold">Attachment</div>
          {pdfError ? (
            <Banner kind="error">We couldn&apos;t create the PDF. {pdfError}</Banner>
          ) : pdf ? (
            <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-brand-soft px-3 py-1.5 text-sm">
              <span className="rounded bg-danger px-1.5 py-0.5 text-xs font-bold text-white">PDF</span>
              <span className="truncate">{pdf.filename}</span>
              <span className="shrink-0 text-muted">{formatFileSize(pdf.blob.size)}</span>
            </span>
          ) : (
            <span className="text-muted">Preparing the PDF…</span>
          )}
        </div>

        {result && (
          <Banner kind={result.kind}>
            <span className="font-semibold">{result.text}</span>
          </Banner>
        )}
      </div>
    </Dialog>
  );
}
