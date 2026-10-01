"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";

export type Contact = { id: string; name: string; email: string; group: string | null };

export type ContactGroup = { name: string; emails: string[] };

/** Groups with their members, in alphabetical order. */
export function groupsOf(contacts: Contact[]): ContactGroup[] {
  const map = new Map<string, string[]>();
  for (const c of contacts) {
    if (!c.group) continue;
    map.set(c.group, [...(map.get(c.group) ?? []), c.email]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, emails]) => ({ name, emails }));
}

export function peopleCount(n: number): string {
  return n === 1 ? "1 person" : `${n} people`;
}

/** The saved contacts, loaded from the server. */
export function useContacts() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await api<{ contacts: Contact[] }>("/api/contacts");
      setContacts(res.contacts);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { contacts, error, reload };
}
