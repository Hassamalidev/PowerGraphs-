import { api } from "@/lib/api";
import { setCustomDatasets, type PublicDataset } from "./catalog";

let loading: Promise<void> | null = null;

/**
 * Load the datasets the user added, so the dropdowns and saved charts know
 * about them. Safe to call many times; a failure just leaves the built-in list.
 */
export function loadCustomDatasets(force = false): Promise<void> {
  if (!loading || force) {
    loading = api<{ datasets: PublicDataset[] }>("/api/datasets")
      .then((res) => setCustomDatasets(res.datasets.filter((d) => d.custom)))
      .catch(() => {
        loading = null; // try again next time
      });
  }
  return loading;
}
