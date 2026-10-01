import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { ReportsList } from "@/components/reports/ReportsList";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6">
        <ReportsList />
      </main>
    </>
  );
}
