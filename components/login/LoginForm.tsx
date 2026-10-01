"use client";

import { useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { api, appUrl, errorMessage } from "@/lib/api";

/** Where to go after signing in: only paths inside this site are allowed. */
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next") ?? "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/** The single-password sign-in form (only used when APP_PASSWORD is set). */
export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/login", { method: "POST", body: { password } });
      window.location.assign(appUrl(nextPath()));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
      <h1 className="text-xl font-bold">Please enter the password</h1>
      <div>
        <label htmlFor="password" className="mb-1 block font-semibold">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          className="field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <Banner kind="error">{error}</Banner>}
      <Button type="submit" variant="primary" disabled={busy || !password}>
        {busy ? "Checking…" : "Sign in"}
      </Button>
    </form>
  );
}
