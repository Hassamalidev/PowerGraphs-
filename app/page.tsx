import { SITE_NAME } from "@/lib/theme";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-brand">{SITE_NAME}</h1>
      <p className="mt-2">The Chart Builder is being set up.</p>
    </main>
  );
}
