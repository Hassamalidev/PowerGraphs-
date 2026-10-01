import { BASE_PATH } from "@/lib/theme";

/** Prefix an app path with the base path (for running under a sub-path later). */
export function appUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const OFFLINE_MESSAGE = "We couldn't reach the server. Please check your internet connection and try again.";

/** Call one of this app's API routes. Throws ApiError with a plain-English message. */
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(appUrl(path), {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(OFFLINE_MESSAGE, 0);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body
  }
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error ?? "Something went wrong. Please try again.";
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}
