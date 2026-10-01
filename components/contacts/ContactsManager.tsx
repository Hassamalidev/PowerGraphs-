"use client";

import { useId, useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useUi } from "@/components/ui/UiProvider";
import { api, errorMessage } from "@/lib/api";
import { groupsOf, useContacts, type Contact } from "./useContacts";

type Draft = { id: string | null; name: string; email: string; group: string };

const EMPTY: Draft = { id: null, name: "", email: "", group: "" };

/** The Contacts page: a table of people to email, with add, edit, and delete. */
export function ContactsManager() {
  const { contacts, error, reload } = useContacts();
  const ui = useUi();
  const [draft, setDraft] = useState<Draft | null>(null);

  const remove = async (contact: Contact) => {
    const ok = await ui.confirm({
      title: "Delete this contact?",
      message: `${contact.name} (${contact.email}) will be removed from your contacts.`,
      confirmLabel: "Delete contact",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/contacts/${contact.id}`, { method: "DELETE" });
      ui.toast(`Deleted ${contact.name}.`);
    } catch (err) {
      ui.toast(errorMessage(err), "error");
    }
    await reload();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted">People you email charts and reports to. Give several people the same group name to pick them all at once.</p>
        </div>
        <Button variant="primary" onClick={() => setDraft(EMPTY)}>
          + Add a contact
        </Button>
      </div>

      {error && <Banner kind="error">We couldn&apos;t load your contacts. {error}</Banner>}

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        {contacts === null && !error ? (
          <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-label="Loading contacts">
            <div className="skeleton h-10" />
            <div className="skeleton h-10" />
            <div className="skeleton h-10" />
          </div>
        ) : contacts && contacts.length === 0 ? (
          <p className="p-6 text-center">
            You have no contacts yet. Choose <span className="font-semibold">+ Add a contact</span> to add the first one.
          </p>
        ) : (
          <table className="w-full text-left">
            <thead className="border-b border-line bg-page">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                <th scope="col" className="px-4 py-3 font-semibold">Email</th>
                <th scope="col" className="px-4 py-3 font-semibold">Group</th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {contacts?.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="px-4 py-3 break-all">{c.email}</td>
                  <td className="px-4 py-3">{c.group ?? <span className="text-muted">—</span>}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      <Button small onClick={() => setDraft({ id: c.id, name: c.name, email: c.email, group: c.group ?? "" })}>
                        Edit
                      </Button>
                      <Button small variant="danger" onClick={() => remove(c)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {draft && (
        <ContactForm
          draft={draft}
          groups={groupsOf(contacts ?? []).map((g) => g.name)}
          onClose={() => setDraft(null)}
          onSaved={async (name) => {
            setDraft(null);
            ui.toast(`Saved ${name}.`);
            await reload();
          }}
        />
      )}
    </div>
  );
}

type FormProps = {
  draft: Draft;
  groups: string[];
  onClose: () => void;
  onSaved: (name: string) => void;
};

function ContactForm({ draft, groups, onClose, onSaved }: FormProps) {
  const [form, setForm] = useState(draft);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ids = { name: useId(), email: useId(), group: useId(), groups: useId() };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = { name: form.name, email: form.email.trim(), group: form.group.trim() || null };
      if (form.id) await api(`/api/contacts/${form.id}`, { method: "PUT", body });
      else await api("/api/contacts", { method: "POST", body });
      onSaved(form.name.trim());
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Dialog
      title={form.id ? "Edit contact" : "Add a contact"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save contact"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div>
          <label htmlFor={ids.name} className="mb-1 block font-semibold">
            Name
          </label>
          <input id={ids.name} data-autofocus className="field" value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label htmlFor={ids.email} className="mb-1 block font-semibold">
            Email
          </label>
          <input
            id={ids.email}
            type="email"
            className="field"
            placeholder="name@company.com"
            value={form.email}
            maxLength={200}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor={ids.group} className="mb-1 block font-semibold">
            Group <span className="font-normal text-muted">(optional, e.g. Management team)</span>
          </label>
          <input
            id={ids.group}
            className="field"
            list={ids.groups}
            value={form.group}
            maxLength={60}
            onChange={(e) => setForm({ ...form, group: e.target.value })}
          />
          <datalist id={ids.groups}>
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
        {error && <Banner kind="error">{error}</Banner>}
        {/* Lets Enter submit the form. */}
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>
          Save
        </button>
      </form>
    </Dialog>
  );
}
