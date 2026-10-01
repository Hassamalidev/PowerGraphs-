// Optional single-password protection for the prototype (APP_PASSWORD).
// Works in both the proxy and route handlers (Web Crypto only).

export const AUTH_COOKIE = "pg_auth";
export const AUTH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/** The cookie value for a password: a hash, so the password itself is never stored in the browser. */
export async function authToken(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`powergraphs:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compare two strings without stopping at the first difference. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
