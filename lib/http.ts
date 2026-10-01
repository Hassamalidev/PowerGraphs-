import { NextResponse } from "next/server";
import type { z } from "zod";

/** Every API error is `{ error: "<plain English message>" }` with a proper status code. */
export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

type Parsed<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/** Read and validate a JSON request body. */
export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<Parsed<z.infer<S>>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, response: jsonError("We couldn't read that request. Please try again.") };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    // Schemas carry plain-English messages; fall back to a generic one otherwise.
    const message = first?.message && !/^Invalid|^Too|^Expected|^Required/i.test(first.message)
      ? first.message
      : "Some of the information sent was missing or not valid. Please check and try again.";
    return { ok: false, response: jsonError(message) };
  }
  return { ok: true, data: result.data };
}

/** Wrap a handler so unexpected failures still return the standard error shape. */
export async function safely(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    console.error("[api]", err);
    return jsonError("Something went wrong on our side. Please try again.", 500);
  }
}
