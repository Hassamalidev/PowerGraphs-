import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { ReportEditor } from "@/components/reports/ReportEditor";

export const metadata: Metadata = { title: "Report" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <AppHeader />
      <ReportEditor reportId={id} />
    </>
  );
}
