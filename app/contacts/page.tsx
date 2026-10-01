import type { Metadata } from "next";
import { ContactsManager } from "@/components/contacts/ContactsManager";
import { AppHeader } from "@/components/layout/AppHeader";

export const metadata: Metadata = { title: "Contacts" };

export default function ContactsPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6">
        <ContactsManager />
      </main>
    </>
  );
}
