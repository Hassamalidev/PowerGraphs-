import type { Metadata } from "next";
import { LoginForm } from "@/components/login/LoginForm";
import { SITE_NAME } from "@/lib/theme";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center text-3xl font-extrabold tracking-tight text-brand">{SITE_NAME}</div>
      <LoginForm />
    </main>
  );
}
