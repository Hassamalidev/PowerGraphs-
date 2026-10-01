import { NextResponse } from "next/server";
import { AUTH_COOKIE, AUTH_MAX_AGE_SECONDS, authToken, safeEqual } from "@/lib/auth";
import { jsonError, parseBody, safely } from "@/lib/http";
import { loginSchema } from "@/lib/validation";

export function POST(req: Request) {
  return safely(async () => {
    const password = process.env.APP_PASSWORD;
    if (!password) return NextResponse.json({ ok: true }); // the site isn't password protected

    const body = await parseBody(req, loginSchema);
    if (!body.ok) return body.response;
    if (!safeEqual(body.data.password, password)) {
      return jsonError("That password isn't right. Please try again.", 401);
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE, await authToken(password), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && new URL(req.url).protocol === "https:",
      maxAge: AUTH_MAX_AGE_SECONDS,
      path: process.env.NEXT_PUBLIC_BASE_PATH || "/",
    });
    return res;
  });
}
