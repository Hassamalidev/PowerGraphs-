import type { Metadata } from "next";
import { DatasetsManager } from "@/components/datasets/DatasetsManager";
import { AppHeader } from "@/components/layout/AppHeader";

export const metadata: Metadata = { title: "Datasets" };

export default function DatasetsPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6">
        <DatasetsManager />
      </main>
    </>
  );
}
