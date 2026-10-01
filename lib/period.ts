// A "period" is a month ("2026-08") or a quarter ("2026-Q3").

export type View = "monthly" | "quarterly";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function isQuarter(period: string): boolean {
  return period.includes("Q");
}

export function isValidPeriod(period: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period) || /^\d{4}-Q[1-4]$/.test(period);
}

function split(period: string): { year: number; n: number } {
  const [y, rest] = period.split("-");
  return { year: Number(y), n: Number(rest.replace("Q", "")) };
}

export function makeMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** "2026-08" → "Aug 2026"; "2026-Q3" → "Q3 2026". */
export function periodLabel(period: string): string {
  const { year, n } = split(period);
  return isQuarter(period) ? `Q${n} ${year}` : `${MONTH_NAMES[n - 1]} ${year}`;
}

export function monthToQuarter(month: string): string {
  const { year, n } = split(month);
  return `${year}-Q${Math.ceil(n / 3)}`;
}

export function quarterMonths(quarter: string): [string, string, string] {
  const { year, n } = split(quarter);
  const first = (n - 1) * 3 + 1;
  return [makeMonth(year, first), makeMonth(year, first + 1), makeMonth(year, first + 2)];
}

/** Move a period forward (or back, with a negative count) by whole periods. */
export function shiftPeriod(period: string, count: number): string {
  const { year, n } = split(period);
  const size = isQuarter(period) ? 4 : 12;
  const total = year * size + (n - 1) + count;
  const y = Math.floor(total / size);
  const k = (total % size) + 1;
  return isQuarter(period) ? `${y}-Q${k}` : makeMonth(y, k);
}

/** The same period one year earlier. */
export function yearEarlier(period: string): string {
  return shiftPeriod(period, isQuarter(period) ? -4 : -12);
}

/** Convert a period to the other view. `edge` picks the first or last month of a quarter. */
export function convertPeriod(period: string, view: View, edge: "start" | "end"): string {
  if (view === "quarterly") return isQuarter(period) ? period : monthToQuarter(period);
  if (!isQuarter(period)) return period;
  const months = quarterMonths(period);
  return edge === "start" ? months[0] : months[2];
}

/** Normalize Census time values ("2024-03", "2024-3", "Mar-2024") to "YYYY-MM". */
export function normalizeMonth(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{1,2})$/.exec(s);
  if (m) {
    const month = Number(m[2]);
    return month >= 1 && month <= 12 ? makeMonth(Number(m[1]), month) : null;
  }
  m = /^([A-Za-z]{3})-?(\d{4})$/.exec(s);
  if (m) {
    const idx = MONTH_NAMES.findIndex((n) => n.toLowerCase() === m![1].toLowerCase());
    return idx >= 0 ? makeMonth(Number(m[2]), idx + 1) : null;
  }
  return null;
}
