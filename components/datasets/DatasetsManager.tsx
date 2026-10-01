"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useUi } from "@/components/ui/UiProvider";
import { api, errorMessage } from "@/lib/api";
import type { AvailableSeries } from "@/lib/datasets/available";
import type { PublicDataset } from "@/lib/datasets/catalog";
import { loadCustomDatasets } from "@/lib/datasets/client";
import { formatValueWithUnit } from "@/lib/format";
import { periodLabel } from "@/lib/period";

type Available = Omit<AvailableSeries, "source">;

/** The Datasets page: the datasets you added, and more Census series you can add. */
export function DatasetsManager() {
  const ui = useUi();
  const [datasets, setDatasets] = useState<PublicDataset[] | null>(null);
  const [available, setAvailable] = useState<Available[] | null>(null);
  const [availableError, setAvailableError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<Available | null>(null);
  const searchId = useId();

  const reload = useCallback(async () => {
    try {
      setDatasets((await api<{ datasets: PublicDataset[] }>("/api/datasets")).datasets);
    } catch (err) {
      ui.toast(errorMessage(err), "error");
    }
    try {
      setAvailable((await api<{ available: Available[] }>("/api/datasets/available")).available);
      setAvailableError(null);
    } catch (err) {
      setAvailableError(errorMessage(err));
    }
    // Keep the Chart Builder's dropdowns in step.
    await loadCustomDatasets(true);
  }, [ui]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const custom = datasets?.filter((d) => d.custom) ?? [];
  const builtInCount = (datasets?.length ?? 0) - custom.length;

  const shown = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    return (available ?? []).filter((s) => {
      const text = `${s.suggestedName} ${s.censusDescription}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [available, search]);

  const remove = async (d: PublicDataset) => {
    const ok = await ui.confirm({
      title: "Remove this dataset?",
      message: `"${d.name}" will be taken out of the dataset dropdowns. Charts already saved in reports keep their picture. You can add it again later.`,
      confirmLabel: "Remove dataset",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/datasets/${encodeURIComponent(d.id)}`, { method: "DELETE" });
      ui.toast(`Removed "${d.name}".`);
    } catch (err) {
      ui.toast(errorMessage(err), "error");
    }
    await reload();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Datasets</h1>
        <p className="text-muted">
          Add more data from the U.S. Census Bureau&apos;s New Home Sales survey. Datasets you add appear in the dataset dropdowns of the{" "}
          <Link href="/" className="font-semibold text-brand underline">
            Chart builder
          </Link>
          , under &ldquo;Added by you&rdquo;.
        </p>
      </div>

      <section aria-labelledby="yours" className="flex flex-col gap-3">
        <h2 id="yours" className="text-xl font-bold">
          Datasets you added
        </h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          {datasets === null ? (
            <div className="p-4" aria-busy="true" aria-label="Loading datasets">
              <div className="skeleton h-10" />
            </div>
          ) : custom.length === 0 ? (
            <p className="p-5">
              You haven&apos;t added any yet. The {builtInCount} standard datasets are always available. Choose one from the list below to add more.
            </p>
          ) : (
            <table className="w-full text-left">
              <thead className="border-b border-line bg-page">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Measured in</th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {custom.map((d) => (
                  <tr key={d.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{d.name}</div>
                      <div className="text-sm text-muted">{d.description}</div>
                    </td>
                    <td className="px-4 py-3">{d.unitLabel}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/?d=${d.id}`}
                          className="inline-flex min-h-9 items-center rounded-lg border-[1.5px] border-line bg-surface px-3 text-sm font-semibold hover:border-muted hover:bg-brand-soft"
                        >
                          Show on a chart
                        </Link>
                        <Button small variant="danger" onClick={() => remove(d)}>
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section aria-labelledby="more" className="flex flex-col gap-3">
        <h2 id="more" className="text-xl font-bold">
          Add a new dataset
        </h2>
        <div className="max-w-md">
          <label htmlFor={searchId} className="mb-1 block font-semibold">
            Search the available data
          </label>
          <input
            id={searchId}
            type="search"
            className="field"
            placeholder="For example: Midwest, under construction, for sale"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {availableError ? (
          <Banner kind="error">
            <p className="mb-3">{availableError}</p>
            <Button onClick={() => void reload()}>Try again</Button>
          </Banner>
        ) : available === null ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading the available data">
            <div className="skeleton h-16" />
            <div className="skeleton h-16" />
            <div className="skeleton h-16" />
          </div>
        ) : available.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-5">You have added everything this Census survey offers.</p>
        ) : (
          <>
            <p className="text-sm text-muted" aria-live="polite">
              Showing {shown.length} of {available.length} available.
            </p>
            <ul className="flex flex-col gap-2">
              {shown.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-3">
                  <div className="min-w-[14rem] flex-1">
                    <div className="font-semibold">{s.suggestedName}</div>
                    <div className="text-sm text-muted">
                      Latest: {formatValueWithUnit(s.latestValue, s.unit)} ({periodLabel(s.lastDate)}) · Monthly since {periodLabel(s.firstDate)}
                    </div>
                  </div>
                  <Button onClick={() => setAdding(s)}>+ Add this dataset</Button>
                </li>
              ))}
            </ul>
            {shown.length === 0 && <p className="rounded-xl border border-line bg-surface p-5">Nothing matches that search. Try fewer or different words.</p>}
          </>
        )}
      </section>

      {adding && (
        <AddDialog
          series={adding}
          onClose={() => setAdding(null)}
          onAdded={async (name) => {
            setAdding(null);
            ui.toast(`Added "${name}". You can now pick it in the Chart builder.`);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function AddDialog({ series, onClose, onAdded }: { series: Available; onClose: () => void; onAdded: (name: string) => void }) {
  const [name, setName] = useState(series.suggestedName.slice(0, 80));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = useId();

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api("/api/datasets", { method: "POST", body: { seriesId: series.id, name } });
      onAdded(name.trim());
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Dialog
      title="Add this dataset"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={saving} onClick={save}>
            {saving ? "Adding…" : "Add dataset"}
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
          <label htmlFor={id} className="mb-1 block font-semibold">
            Name shown in the dropdown and on charts
          </label>
          <input id={id} data-autofocus className="field" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          <p className="mt-1 text-sm text-muted">Use plain words your team will recognise. {name.length} of 80 letters.</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="font-semibold">Census calls it</dt>
          <dd>{series.censusDescription}</dd>
          <dt className="font-semibold">Measured in</dt>
          <dd>{series.unitLabel}</dd>
          <dt className="font-semibold">Latest value</dt>
          <dd>
            {formatValueWithUnit(series.latestValue, series.unit)} ({periodLabel(series.lastDate)})
          </dd>
          <dt className="font-semibold">Quarterly view</dt>
          <dd>
            {series.quarterly === "sum"
              ? "Adds up the 3 months"
              : series.quarterly === "last"
                ? "Uses the last month of the quarter"
                : "Averages the 3 months"}
          </dd>
        </dl>
        {error && <Banner kind="error">{error}</Banner>}
      </form>
    </Dialog>
  );
}
