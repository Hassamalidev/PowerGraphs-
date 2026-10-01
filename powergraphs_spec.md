# PowerGraphs.com — Project Specification (Prototype v1)

> **Instructions for Claude Code**
> Read this entire file before writing any code. Build the project milestone by milestone (see **Section 14**). After each milestone, make sure the app runs with no errors, then commit. Wherever this document is silent or unclear, choose the simplest reasonable option and write it down in `ASSUMPTIONS.md` so the developer can review it. Do not invent data values. All data must come from the U.S. Census Bureau (or the committed seed snapshot described in Section 8.6).

---

## 1. Project summary

PowerGraphs.com is a simple web app that lets **non-technical business users** turn government economic data into clean, presentation-ready line charts for **management meetings**.

A user can:

1. Pick 1 to 3 economic datasets from dropdown menus.
2. See them on a single line chart.
3. Read a **label box with an arrow pointing to each line** (instead of a traditional legend).
4. Choose the date range with a **two-handle slider**.
5. Switch between **monthly** and **quarterly** views.
6. Pick simple **statistics** (summary, trend line / simple regression) that appear as plain-English sentences in a text box above the chart.
7. Write their own **notes** in a text box below the chart.
8. **Print** the chart, **download** it as PDF/PNG, **email** it to saved contacts, or **add it to a report package** that combines several charts into one PDF for a management meeting.

**First prototype data source:** U.S. Census Bureau — *New Home Sales* (the "New Residential Sales" program), from the Census "Business and Industry: Time Series / Trend Charts" page: https://www.census.gov/econ/currentdata/

**Future:** PowerGraphs will later become part of a larger site, **PowerBanks.com**. The app must be built so it can be moved under that site later without a rewrite (see Section 13.3). More datasets will be added later, so data sources must be **config-driven** (see Section 9).

The client expects many revisions. Keep components small, well named, and easy to change.

---

## 2. Target users and design principles

The users are **not technical and not statisticians**. Every design decision should follow these rules:

- **No jargon on screen.** Say "trend line", not "OLS regression". Say "New homes sold (yearly pace)", not "SOLD TOTAL SAAR". Technical terms may appear only inside "?" help tips, with a one-sentence plain explanation.
- **Never show an empty screen.** On first load, the chart already shows *New homes sold (yearly pace)*, the last 5 years, monthly, with the plain summary statistics.
- **Big and clear.** Minimum body text 16px. Buttons and dropdowns at least 44px tall. High contrast.
- **Every control has a visible text label** (not icon-only).
- **Forgiving.** A "Reset chart" button restores the default view. Errors are written in plain English with what to do next (e.g., "We couldn't reach the Census website. Showing the saved copy from Sept 28, 2026.").
- **Limit choices.** Maximum 3 datasets per chart. Maximum 5 custom notes per chart.
- **Print-friendly.** Lines must be distinguishable in black-and-white printing (different line styles as well as colors).

**Series colors and line styles** (color-blind friendly):

| Dataset slot | Color | Line style |
|---|---|---|
| Dataset 1 | `#1F5FAD` (blue) | solid, 2.5px |
| Dataset 2 | `#D9541E` (orange) | dashed, 2.5px |
| Dataset 3 | `#2E8B57` (green) | dotted, 2.5px |

---

## 3. Tech stack

Use these unless there is a strong reason not to (record any change in `ASSUMPTIONS.md`):

| Purpose | Choice | Why |
|---|---|---|
| Framework | **Next.js (latest stable, App Router) + TypeScript (strict)** | Frontend + backend API routes in one project |
| Styling | **Tailwind CSS** | Fast, consistent styling |
| Charts | **Apache ECharts** (`echarts` + `echarts-for-react`) | Built-in two-handle `dataZoom` slider, `graphic` elements for arrow labels that are included in image export, good performance |
| Statistics | **simple-statistics** | Linear regression, R², correlation, mean, etc. |
| Dates | **date-fns** | Month/quarter math and formatting |
| Database | **Prisma + SQLite** for prototype | Zero setup. Must be switchable to PostgreSQL by changing the Prisma provider |
| PDF | **jsPDF** (client-side) | Build PDFs from chart images + text |
| Email | **Nodemailer** (SMTP) | Works with any provider (Gmail, Outlook, SendGrid, Resend SMTP, etc.) |
| Validation | **Zod** | Validate API inputs |
| Drag and drop | **@dnd-kit** | Reordering charts in a report |
| Tests | **Vitest** | Unit tests for data parsing, aggregation, statistics |

All calls to the Census API happen **on the server** (Next.js API routes). The API key must never be sent to the browser.

---

## 4. Main screen layout (the "Chart Builder")

This layout is taken directly from the client's hand-drawn sketch. Top to bottom:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ PowerGraphs                         [Report (2 charts)] [Contacts] [Reset] │
├────────────────────────────────────────────────────────────────────────────┤
│ (A) Dataset 1 [New homes sold (yearly pace) ▼]                              │
│     Dataset 2 [+ Add a dataset ▼]   Dataset 3 [+ Add a dataset ▼]           │
│ (B) Statistics [Plain summary ▼]                                            │
│ ┌──────────────────────── (C) TOP TEXT BOX ──────────────────────────────┐ │
│ │ Plain-English statistics sentences (auto-generated, editable)          │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│  Chart title (auto-generated, click to edit)                [+ Add a note] │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│ H│  ┌─────────────────────┐                                  ●          │  │
│ o│  │ New homes sold      │                          ___/‾‾‾            │  │
│ m│  │ 676,000/yr · Aug 26 │─────────►      __/‾‾\__/                    │  │
│ e│  └─────────────────────┘          __/‾‾                              │  │
│ s│                         (D) arrow label, no legend                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│        (E) [■]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[■]                              │
│            From [Jan 2021 ▼]   To [Aug 2026 ▼]                              │
│        (F) View:  (● Monthly)  ( Quarterly)                                 │
│ ┌──────────────────────── (G) BOTTOM TEXT BOX ───────────────────────────┐ │
│ │ Your notes for the meeting...                                          │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│ (H) Send to [Choose contacts ▼]                                             │
│     [Print]  [Download PDF]  [Download image]  [Email]  [Add to report]     │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 How the client's sketch maps to features

| Note written on the sketch | Feature in this spec |
|---|---|
| "Drop down list available data sets" (arrow to Y-axis) | (A) Dataset dropdowns — Section 5.1 |
| "Amount Value" (Y-axis label) | Y-axis shows the unit of the dataset, e.g. "Homes per year" — Section 5.2 |
| "Drop down: Basic statistics of simple regression" | (B) Statistics dropdown — Section 5.7 |
| "Maybe multiple regression" | Shown as a disabled "coming later" option — Section 5.7 |
| Top "text box" | (C) Statistics text box — Section 5.7 |
| "Data Name / Value" box with arrow to the line | (D) Arrow labels instead of a legend — Section 5.3 |
| "This is sliding to the right" | The label follows the latest visible data point as the range changes, and can be dragged — Section 5.3 |
| "2 sliding indicators for relevant range of data" | (E) Two-handle range slider — Section 5.5 |
| "Time: Month or Qtr" | (F) Monthly / Quarterly toggle — Section 5.6 |
| Bottom "text box" | (G) Notes box — Section 5.8 |
| "Drop down list Email Contacts" | (H) Contacts dropdown + Email — Sections 5.9 and 7 |
| Orange writing at the top of the page | Not a feature. Ignore. |

### 4.2 Other pages

- `/` — Chart Builder (above)
- `/reports` — list of saved report packages
- `/reports/[id]` — build, reorder, preview, and export one report
- `/contacts` — manage email contacts
- `/login` — only if `APP_PASSWORD` is set (Section 13.2)

### 4.3 Responsiveness

Designed for desktop/laptop first (1280px wide). Must work on tablet (768px+). On phones, show everything stacked; dragging labels can be disabled on touch screens below 640px.

---

## 5. Feature details (Chart Builder)

### 5.1 (A) Dataset dropdowns

- Three dropdown slots: **Dataset 1** (always filled), **Dataset 2** and **Dataset 3** (optional, default "+ Add a dataset").
- Each optional slot has a small "Remove" (×) button once filled.
- Dropdown options come from the dataset catalog (Section 9), grouped by topic (e.g., "Home sales", "Prices", "Homes for sale", "By region"). Each option shows a plain name and a one-line description underneath in smaller grey text.
- The same dataset cannot be picked twice.
- **Unit rule:** a chart can show at most **2 different units** (one left axis, one right axis). If the user picks a third dataset with a third different unit, show a friendly message: *"These three datasets use different measurements. Turn on 'Compare as % change' to show all three together."* with a button that turns on that mode (Section 5.2).

### 5.2 The chart

- Line chart, one line per dataset, colors and line styles from Section 2.
- A dot marks the **last visible data point** on each line.
- **X-axis:** dates. Monthly labels like `Jan 2024`; quarterly labels like `Q1 2024`. Let ECharts thin out labels so they never overlap.
- **Y-axis (left):** unit label of Dataset 1, e.g., "Homes per year", "Dollars", "Months". Numbers use thousands separators (`676,000`), dollars use `$` (`$414,500`). Axis may use compact form (`600K`, `$400K`) to save space.
- **Y-axis (right):** appears only when a dataset uses a different unit than Dataset 1. Its label is that unit.
- **"Compare as % change" toggle** (small switch above the chart, off by default): converts every line to percent change from the first visible point (first point = 0%). One shared axis labeled "% change since <start date>". Useful for comparing datasets with different units.
- **Hover tooltip:** vertical guide line; tooltip shows the date and the value of every dataset at that date, formatted with units.
- **Chart title:** auto-generated, e.g., "New homes sold (yearly pace), Jan 2021 – Aug 2026, monthly". The user can click to edit it. Once edited, it stays as typed until "Reset chart".
- **No legend component anywhere.** Arrow labels replace it.
- A small source line under the chart: *"Source: U.S. Census Bureau, New Residential Sales. Data as of <date>."*

### 5.3 (D) Arrow labels (replaces the legend) — most important design feature

Each dataset on the chart automatically gets one **label box** inside the plot area with an **arrow pointing to its line**.

**Contents of the box:**
- Line 1: dataset plain name (e.g., "New homes sold"), bold, 14px.
- Line 2: value + unit + date at the anchor point (e.g., "676,000 per year · Aug 2026"), 13px.
- Box: white background, 1.5px border in the series color, 6px rounded corners, small padding.

**Anchor point (where the arrow points):**
- Default: the **last visible data point** of that line.
- When the user moves the range slider or switches monthly/quarterly, the anchor automatically moves to the new last visible point and the value in the box updates. This is the "sliding to the right" behavior from the sketch.
- The user can **click any point on that line** to move the anchor there (the value updates to that date). A small "Reset to latest" link appears in the box when the anchor is not the latest point.

**Box position:**
- Initial position: placed automatically in empty space inside the plot (preferring the upper-left area), not covering its own line. Boxes for different datasets must not overlap (stack them with a gap).
- The user can **drag the box** anywhere inside the plot area. The arrow always stays connected: it starts from the nearest edge of the box and ends with an arrowhead on the anchor point.
- Store the box position as an offset relative to the plot area (percent of width/height) so it survives resizing.

**Implementation note:** Build the labels with ECharts `graphic` elements (group of rect + text, plus a line/bezier with an arrowhead), positioned using `chart.convertToPixel()`. Recalculate on `datazoom`, `finished`, and resize events. Use `draggable: true` and update the arrow in `ondrag`. This guarantees the labels appear in printed, PDF, and image exports (HTML overlays would not).

### 5.4 Custom notes on the chart ("+ Add a note")

The client wants text boxes with arrows inside the graph, so users can also add their own notes:

1. User clicks "+ Add a note".
2. Instruction appears: "Click on a line where you want the arrow to point."
3. User clicks a data point; a small input appears; user types the note (max 120 characters) and presses Enter.
4. A callout box (grey border, white background) with an arrow to that point appears. It behaves like the dataset labels: draggable, arrow stays attached.
5. Hovering a note shows a small "×" to delete and a pencil to edit.
6. Maximum 5 notes per chart. Notes are anchored to a specific date; if that date is outside the visible range, the note is hidden (not deleted).

### 5.5 (E) Two-handle range slider

- Use ECharts `dataZoom` type `slider` placed directly under the X-axis, with two square handles (matches the sketch).
- Below the slider, two dropdowns **From [month/quarter ▼]** and **To [month/quarter ▼]** stay in sync with the handles (for users who find dragging hard).
- Also add quick buttons: **1 year · 5 years · 10 years · All**.
- Default range: last 5 years up to the latest available data point.
- In quarterly view the handles snap to whole quarters.
- Everything that depends on the visible range updates live (debounced ~150ms): arrow labels, statistics text, trend line, chart title.

### 5.6 (F) Monthly / Quarterly toggle

- Two-option toggle: **Monthly** (default) and **Quarterly**.
- Switching keeps the same date span (e.g., Jan 2021–Aug 2026 becomes Q1 2021–Q2 2026).
- Quarterly values are computed on the server using each dataset's aggregation rule from the catalog (Section 9):
  - `average` — mean of the 3 months (used for rates and ratios).
  - `sum` — total of the 3 months (used for actual counts that are not annualized).
  - `last` — value of the last month of the quarter (used for end-of-month stock, like homes for sale).
  - If the Census API provides **official quarterly values** for a series, use those instead of computing.
- **Only complete quarters are shown.** If the latest quarter has only 1 or 2 months, leave it out and show a small note under the chart: *"Q3 2026 not shown yet — only 2 of 3 months are available."*
- If a value was computed (not official), the tooltip says "Quarterly average of monthly values" (or "sum" / "end of quarter").

### 5.7 (B) Statistics dropdown and (C) top text box

**Dropdown options:**

| Option | Available when | What it does |
|---|---|---|
| **Plain summary** (default) | always | Writes summary sentences for each dataset |
| **Trend line** | always | Adds a dashed trend line per dataset + trend sentences |
| **How two datasets move together** | 2+ datasets | Correlation + simple regression of Dataset 1 on Dataset 2 |
| **Multiple regression — coming later** | disabled | Greyed out with tooltip "Coming in a future version" |
| **Hide statistics** | always | Hides the top text box |

All statistics use **only the visible range** and the **current view** (monthly or quarterly). Exact formulas and sentence templates are in **Section 10**.

**Top text box behavior:**
- Shows the auto-generated plain-English sentences.
- The user can click and edit the text (plain textarea is fine).
- Once edited, the text stops updating automatically and a small notice appears: *"You edited this text. [Update with latest numbers]"* — clicking it regenerates the text (with a confirm, since it overwrites edits).
- Included in print, PDF, email, and reports.

### 5.8 (G) Bottom text box — meeting notes

- Large textarea, placeholder: *"Add your notes for the meeting (optional)"*.
- Max 1,000 characters, with a character counter.
- Included in print, PDF, email, and reports, under the chart.

### 5.9 (H) Action bar

| Button | Action |
|---|---|
| **Print** | Opens the print layout (Section 5.10) and calls `window.print()` |
| **Download PDF** | Generates a one-page PDF (same layout as print) |
| **Download image** | PNG of the chart only, 2× resolution, includes arrow labels and notes |
| **Send to [contacts ▼]** + **Email** | Multi-select dropdown of saved contacts and groups; Email opens the email window pre-filled (Section 7) |
| **Add to report** | Saves a snapshot of this chart into a report package (Section 6) |

**Reset chart** (in the header): restores defaults after a confirm dialog.

**Chart state in the URL:** keep the current state in the query string (datasets, view, range, stats option, % change mode) so refreshing the page doesn't lose work and a link can be shared. Text boxes, label positions, and notes may be kept in `sessionStorage` or in the database once saved.

### 5.10 Print / PDF layout (single chart)

- US Letter, **landscape**, 0.5-inch margins.
- Top: "PowerGraphs" wordmark (small) on the left, today's date on the right.
- Chart title (large).
- Top text box content (statistics).
- Chart image (full width), including arrow labels and notes.
- Bottom text box content (meeting notes), if not empty.
- Footer: source line + "Created with PowerGraphs.com".
- No buttons, dropdowns, or sliders in print output.
- PDF filename: `PowerGraphs - <chart title> - <YYYY-MM-DD>.pdf`.

---

## 6. Report package (combine charts for a management meeting)

### 6.1 Adding a chart

- "Add to report" opens a small window:
  - **Choose a report:** dropdown of existing reports, or "Create a new report" (default name: *"Management meeting report – <Month D, YYYY>"*).
  - Button: **Add**.
- The app saves a **snapshot**: full chart config, both text boxes, label/note positions, a PNG image of the chart (2×), and the "data as of" date.
- Confirmation toast: *"Added to 'Management meeting report – Oct 1, 2026' (3 charts)."*
- Header shows a "Report (N charts)" link to the most recently used report.

### 6.2 Report page (`/reports/[id]`)

- Editable fields: **Report title**, **Meeting date** (date picker), **Prepared by** (text), **Introduction** (optional textarea, max 1,500 characters).
- List of chart cards: thumbnail, title, first line of the statistics text.
- Each card has: **drag handle** (reorder), **Move up / Move down** buttons (for users who don't drag), **Edit** (opens the chart in the Chart Builder; the save button reads "Update in report"), **Remove** (with confirm).
- Actions: **Preview**, **Print**, **Download PDF**, **Email report**.

### 6.3 Report PDF layout

1. **Cover page:** report title, meeting date, prepared by, introduction text, list of chart titles (table of contents), "Created with PowerGraphs.com".
2. **One chart per page** (landscape, same layout as Section 5.10).
3. Page numbers in the footer ("Page 2 of 6").
- Filename: `<Report title> - <YYYY-MM-DD>.pdf`.

### 6.4 Report list (`/reports`)

Table of reports: title, meeting date, number of charts, last updated, with Open and Delete buttons. "New report" button.

---

## 7. Contacts and email

### 7.1 Contacts page (`/contacts`)

- Table with **Name**, **Email**, **Group** (free text, e.g., "Management team").
- Add / edit / delete (delete has confirm). Email must be valid and unique.
- In every "Send to" dropdown, contacts are listed by name, and each **group** appears as one option (e.g., "Management team (5 people)") that selects all its members.

### 7.2 Email window

Opened from the Chart Builder ("Email") or the report page ("Email report"):

- **To:** multi-select (contacts + groups), pre-filled with whatever was selected in "Send to". The user can also type a new email address, with a checkbox "Save to contacts".
- **Subject:** pre-filled — chart: `PowerGraphs: <chart title>`; report: `<report title>`.
- **Message:** pre-filled, editable: *"Hello, please find the attached chart(s) for our meeting. — Sent from PowerGraphs.com"*.
- **Attachment:** the PDF is generated automatically and shown as an attachment chip (name + size).
- **Send** button. Then a clear result: *"Sent to 4 people."* or *"The email couldn't be sent. Please check the email settings or try again."*

### 7.3 Email backend

- `POST /api/email` receives recipients, subject, message, PDF (base64), filename. Validate with Zod (max 50 recipients, max 10 MB attachment).
- Send with Nodemailer using SMTP settings from environment variables (Section 13.2).
- If SMTP is not configured, do not crash: return a clear error, and in development mode log the email to the console instead of sending.
- Record every send attempt in the `EmailLog` table.

---

## 8. Data source: Census Bureau — New Home Sales

### 8.1 Background

The client sent https://www.census.gov/econ/currentdata/ ("Business and Industry: Time Series / Trend Charts"). That page lists many Census surveys; **New Home Sales** is the one to use for this prototype. Other surveys on that page (Construction Spending, New Residential Construction, Monthly Retail Trade, etc.) will likely be added later, so the data layer must be generic (Section 9).

### 8.2 API endpoint

Census Economic Indicators Time Series (EITS) API, New Home Sales program:

```
Base:   https://api.census.gov/data/timeseries/eits/ressales
Example:
https://api.census.gov/data/timeseries/eits/ressales?get=cell_value,data_type_code,category_code,seasonally_adj,error_data,time_slot_id,geo_level_code&for=us:*&time=from+2000&key=YOUR_KEY
```

- Variables documentation: https://api.census.gov/data/timeseries/eits/ressales/variables.html
- Examples: https://api.census.gov/data/timeseries/eits/ressales/examples.html
- Free API key: request at https://api.census.gov/data/key_signup.html and store in `CENSUS_API_KEY`. (The API works without a key for light use, but always send the key when it's set.)
- The `time` predicate accepts a year (`2024`), a month (`2024-03`), or a range (`from 2000`, `from 2015-01 to 2020-12`). Verify the exact range syntax in Step 0.

### 8.3 Response format and parsing rules

- The response is JSON: an **array of arrays**; the **first row is the column headers**; every value is a **string**.
- Convert each row into an object using the header row.
- **Keep only rows where `error_data` is `"no"`.** Rows with `"yes"` are sampling-error measures, not actual values.
- Parse `cell_value` to a number. If it is not a number (e.g., `(NA)`, `(S)`, `(X)`, empty), skip the point.
- The `time` field is the period, e.g. `"2024-03"`. Normalize to `YYYY-MM`.
- Sort ascending by date. Remove duplicates (keep one value per series per date).
- Apply the catalog's `scale` multiplier (e.g., values reported in thousands → ×1000) — confirm units in Step 0.

### 8.4 Step 0 — explore the real codes before building (required)

The exact `category_code` / `data_type_code` / `geo_level_code` values must be confirmed from the live API. Write `scripts/explore-census.ts` that:

1. Fetches all New Home Sales rows from 2020 onward (and the units/descriptions if available).
2. Prints a table of every distinct combination of `category_code`, `data_type_code`, `seasonally_adj`, `geo_level_code`, with the row count and the 3 most recent values.
3. Saves the output to `docs/census-ressales-codes.md` for the developer to read.

Then fill in the catalog (Section 9) with the **confirmed** codes. Known from Census data: category `FORSALE` with data type `MONSUP` = "Months' Supply at Current Sales Rate". Other codes in Section 9 are **expected** values and must be verified.

Also check the Census downloadable dataset format (the "Download Data Sets" link on the currentdata page, https://www.census.gov/econ_datasets/) as a fallback source of the same data, and note in `docs/` whether official quarterly values exist for prices.

### 8.5 Caching

- Server fetches each series from Census at most once every **12 hours**; store the normalized result in the `SeriesCache` table with `fetchedAt`.
- New Home Sales is released once a month and recent months are revised, so always replace the whole cached series on refresh (don't append).
- If the Census API fails (timeout 10s, non-200, or invalid JSON): serve the cached copy and show a yellow banner: *"We couldn't reach the Census website. Showing the saved copy from <date>."*

### 8.6 Seed snapshot (offline fallback)

- Write `scripts/refresh-seed.ts` that downloads all catalog series and saves `data/seed/ressales.json`.
- Commit this file. If there's no cache and the API is unreachable, the app uses the seed and shows the same banner with the seed date. This ensures the demo always works.

---

## 9. Dataset catalog (config-driven)

All datasets are defined in one file: `lib/datasets/catalog.ts`. Adding a dataset later should only require adding an entry here (and, for a new source, a new fetcher).

```ts
type DatasetDef = {
  id: string;                 // stable id used in URLs, e.g. "new_homes_sold_rate"
  name: string;               // plain name shown in dropdown and label box
  shortName: string;          // used inside the arrow label box
  description: string;        // one-line plain description under the dropdown option
  helpText: string;           // shown in "?" tip
  group: string;              // dropdown group, e.g. "Home sales"
  source: { provider: "census-eits"; program: "ressales";
            category_code: string; data_type_code: string;
            seasonally_adj: "yes" | "no"; geo_level_code: string };
  unit: "homes_per_year" | "homes" | "dollars" | "months";
  unitLabel: string;          // Y-axis label, e.g. "Homes per year"
  scale: number;              // multiplier applied to raw values (e.g. 1000)
  frequency: "monthly";
  quarterly: "average" | "sum" | "last" | "official";
  sourceLabel: string;        // "U.S. Census Bureau, New Residential Sales"
};
```

**v1 catalog** (codes marked † must be confirmed in Step 0):

| id | Plain name | category † | data type † | Seas. adj. | Geo † | Unit | Quarterly |
|---|---|---|---|---|---|---|---|
| `new_homes_sold_rate` | New homes sold (yearly pace) | SOLD | TOTAL | yes | US | homes per year | average |
| `new_homes_sold_count` | New homes sold (actual number that month) | SOLD | TOTAL | no | US | homes | sum |
| `homes_for_sale` | New homes for sale (end of month) | FORSALE | TOTAL | yes | US | homes | last |
| `months_supply` | Months' supply of new homes | FORSALE | MONSUP | yes | US | months | average |
| `median_price` | Median price of new homes sold | SOLD | MEDIAN | no | US | dollars | official if available, else average |
| `average_price` | Average price of new homes sold | SOLD | AVERAGE | no | US | dollars | official if available, else average |
| `sold_northeast` | New homes sold — Northeast (yearly pace) | SOLD | TOTAL | yes | NE | homes per year | average |
| `sold_midwest` | New homes sold — Midwest (yearly pace) | SOLD | TOTAL | yes | MW | homes per year | average |
| `sold_south` | New homes sold — South (yearly pace) | SOLD | TOTAL | yes | SO | homes per year | average |
| `sold_west` | New homes sold — West (yearly pace) | SOLD | TOTAL | yes | WE | homes per year | average |

If any of these combinations does not exist in the API, remove it from the catalog and note it in `ASSUMPTIONS.md`. If Step 0 reveals other useful series, add them.

**Help text examples (plain English):**
- Yearly pace: *"How many new homes would be sold in a full year if sales kept going at this month's speed. Adjusted for normal seasonal ups and downs."*
- Months' supply: *"How many months it would take to sell all new homes currently for sale, at the current sales speed."*
- Median price: *"The middle price — half of new homes sold for more, half for less."*

---

## 10. Statistics — exact definitions and sentence templates

Put all statistics in `lib/stats/` as pure functions with unit tests. Use the **visible range** and **current view** (monthly or quarterly). "Period" means month or quarter depending on the view.

### 10.1 Plain summary (per dataset)

Calculate:
- **Latest value** and its date.
- **Change from previous period** (absolute and %).
- **Change from a year earlier** (12 months back or 4 quarters back), if available in the data (may be outside the visible range — that's fine).
- **Change over the selected range** (first visible → last visible, absolute and %).
- **Highest** and **lowest** values in range, with dates.
- **Average** over the range.

Template (example numbers only):
> **New homes sold (yearly pace):** 676,000 in Aug 2026 — up 3.1% from Jul 2026 and down 2.4% from Aug 2025. Over Jan 2021 – Aug 2026 it went from 993,000 to 676,000 (down 31.9%). Highest: 993,000 (Jan 2021). Lowest: 588,000 (Jul 2022). Average: 690,000.

Use "up", "down", or "unchanged" (if the change rounds to 0.0%). Percentages to 1 decimal. Values formatted with units.

### 10.2 Trend line (simple regression over time)

- Fit `value = a + b × t` with ordinary least squares, where `t` = time in years from the first visible point (monthly step = 1/12, quarterly step = 1/4).
- **Slope** `b` = change per year. **R²** = how well the line fits.
- Fit wording: R² ≥ 0.7 → "follows the trend closely"; 0.4–0.69 → "follows the trend moderately"; < 0.4 → "jumps around a lot, so the trend is weak".
- Draw a dashed trend line in the same color as the dataset (thinner, 50% opacity), labeled "Trend" at its right end.
- Need at least 6 points; otherwise: *"Not enough data in this range to show a trend. Try a longer range."*

Template:
> **New homes sold (yearly pace)** has been falling by about 52,000 per year over Jan 2021 – Aug 2026. The data follows the trend moderately (R² = 0.55).

### 10.3 How two datasets move together (correlation + simple regression)

- Align Dataset 1 and Dataset 2 by date (only dates where both have values). Need at least 8 shared points.
- **Correlation** (Pearson r). Strength wording: |r| ≥ 0.7 strong; 0.4–0.69 moderate; < 0.4 weak. Direction: positive → "move in the same direction"; negative → "move in opposite directions".
- **Simple regression** of Dataset 1 (Y) on Dataset 2 (X): `Y = a + b × X`. Explain `b` in units.
- Always add the sentence: *"This shows how they move together; it does not prove one causes the other."*
- If a 3rd dataset is present, also report correlation of Dataset 1 with Dataset 3 (no multiple regression in v1).

Template:
> **New homes sold** and **Median price** have a moderate tendency to move in opposite directions (correlation −0.52). On average, when the median price is $10,000 higher, the yearly pace of sales is about 18,000 lower. This shows how they move together; it does not prove one causes the other.

### 10.4 Multiple regression

**Not in v1.** Shown as a disabled dropdown option ("coming later"). Keep `lib/stats/` structured so it can be added (e.g., Dataset 1 explained by Datasets 2 and 3).

### 10.5 Number formatting rules (`lib/format.ts`)

- Homes: `676,000`; compact axis `676K`.
- Dollars: `$414,500`; compact axis `$415K`.
- Months: `8.5 months`.
- Percent: `3.1%`, with sign words in sentences ("up 3.1%").
- Dates: monthly `Aug 2026`, quarterly `Q3 2026`; long form in reports `October 1, 2026`.
- Never show float artifacts — always round.

---

## 11. Data model (Prisma)

SQLite for the prototype. SQLite has no native JSON column in all Prisma versions, so store JSON as `String` and parse/validate with Zod.

```prisma
model Contact {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  group     String?
  createdAt DateTime @default(now())
}

model SavedChart {
  id         String   @id @default(cuid())
  title      String
  config     String   // JSON: ChartConfig (see 11.1)
  topText    String
  bottomText String
  imagePng   String   // base64 PNG snapshot (2x)
  dataAsOf   DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  items      ReportItem[]
}

model Report {
  id          String   @id @default(cuid())
  title       String
  meetingDate DateTime?
  preparedBy  String?
  intro       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  items       ReportItem[]
}

model ReportItem {
  id       String     @id @default(cuid())
  reportId String
  chartId  String
  position Int
  report   Report     @relation(fields: [reportId], references: [id], onDelete: Cascade)
  chart    SavedChart @relation(fields: [chartId], references: [id], onDelete: Cascade)
}

model SeriesCache {
  seriesId  String   @id
  payload   String   // JSON: normalized points + meta
  fetchedAt DateTime
}

model EmailLog {
  id             String   @id @default(cuid())
  recipients     String   // comma-separated
  subject        String
  attachmentName String?
  status         String   // "sent" | "failed" | "logged-dev"
  error          String?
  createdAt      DateTime @default(now())
}
```

### 11.1 ChartConfig shape

```ts
type ChartConfig = {
  datasets: string[];                       // 1–3 catalog ids, in slot order
  view: "monthly" | "quarterly";
  range: { from: string; to: string };      // "YYYY-MM" or "YYYY-Q1"
  statsMode: "summary" | "trend" | "relationship" | "none";
  percentChangeMode: boolean;
  title: string; titleEdited: boolean;
  topTextEdited: boolean;
  labels: { datasetId: string; anchorDate: string | null; // null = latest visible
            pos: { x: number; y: number } }[];          // percent of plot area
  notes: { id: string; datasetId: string; anchorDate: string;
           text: string; pos: { x: number; y: number } }[];
};
```

---

## 12. API routes

| Method + route | Purpose |
|---|---|
| `GET /api/datasets` | Returns the catalog (without internal source codes) |
| `GET /api/series/[id]?view=monthly\|quarterly` | Normalized series: `{ points: [{ date, label, value }], meta: { unit, unitLabel, sourceLabel, dataAsOf, isFallback, fallbackDate?, incompleteQuarterNote? } }` |
| `GET/POST /api/contacts`, `PUT/DELETE /api/contacts/[id]` | Contacts CRUD |
| `GET/POST /api/charts`, `GET/PUT/DELETE /api/charts/[id]` | Saved chart snapshots |
| `GET/POST /api/reports`, `GET/PUT/DELETE /api/reports/[id]` | Reports |
| `POST /api/reports/[id]/items`, `PUT /api/reports/[id]/items/order`, `DELETE /api/reports/[id]/items/[itemId]` | Add, reorder, remove charts in a report |
| `POST /api/email` | Send email with PDF attachment |

All inputs validated with Zod. All errors return `{ error: "<plain English message>" }` with a proper status code.

---

## 13. Project setup

### 13.1 Folder structure

```
/app
  page.tsx                    # Chart Builder
  reports/page.tsx
  reports/[id]/page.tsx
  contacts/page.tsx
  login/page.tsx
  api/...                     # routes from Section 12
/components
  chart/PowerChart.tsx        # ECharts wrapper
  chart/calloutLayer.ts       # arrow labels + notes (ECharts graphic)
  chart/RangeControls.tsx     # From/To dropdowns + quick range buttons
  controls/DatasetPicker.tsx
  controls/StatsPicker.tsx
  controls/ViewToggle.tsx
  text/StatsTextBox.tsx
  text/NotesTextBox.tsx
  actions/ActionBar.tsx
  email/EmailDialog.tsx
  reports/...
  ui/...                      # buttons, dialogs, toasts, help tips
/lib
  datasets/catalog.ts
  census/client.ts            # fetch + retry + timeout
  census/parse.ts             # array-of-arrays → points
  series/aggregate.ts         # monthly → quarterly
  series/cache.ts
  stats/summary.ts  stats/trend.ts  stats/relationship.ts  stats/sentences.ts
  format.ts
  pdf/chartPdf.ts  pdf/reportPdf.ts
  email.ts
  theme.ts                    # colors, fonts, brand name in one place
/prisma/schema.prisma
/data/seed/ressales.json
/scripts/explore-census.ts
/scripts/refresh-seed.ts
/docs/census-ressales-codes.md
ASSUMPTIONS.md
README.md
```

### 13.2 Environment variables (`.env.example`)

```
CENSUS_API_KEY=
DATABASE_URL="file:./dev.db"

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM="PowerGraphs <reports@powergraphs.com>"

APP_PASSWORD=                 # optional: if set, the whole site requires this password
NEXT_PUBLIC_SITE_NAME=PowerGraphs
NEXT_PUBLIC_BASE_PATH=        # empty now; later e.g. "/powergraphs" inside PowerBanks.com
```

`APP_PASSWORD`: if set, Next.js middleware redirects to `/login`; correct password sets an httpOnly cookie for 30 days. This protects the prototype on a public URL without building user accounts.

### 13.3 Ready for PowerBanks.com later

- Brand name, colors, and fonts come only from `lib/theme.ts` and `NEXT_PUBLIC_SITE_NAME`.
- Support `NEXT_PUBLIC_BASE_PATH` (Next.js `basePath`) so the app can run under a sub-path of PowerBanks.com.
- No hard-coded absolute URLs.
- Keep chart components independent of page layout so they can be reused in another app.

### 13.4 Deployment

- Prototype: deploy to a host with a persistent disk for SQLite (e.g., Railway, Render, or a small VPS), or switch Prisma to PostgreSQL (e.g., Neon) to deploy on Vercel. Document the chosen option in README.
- Point the domain powergraphs.com to the deployment when the client is ready.

---

## 14. Milestones (build in this order)

Each milestone must run without errors, pass its tests, and be committed before starting the next.

**M0 — Setup and data exploration**
- Create the Next.js + TypeScript + Tailwind + Prisma project, `.env.example`, README.
- Run Step 0 (Section 8.4); write `docs/census-ressales-codes.md`; finalize the catalog with confirmed codes.
- Create the seed snapshot (Section 8.6).
- ✅ Done when: the codes doc exists, the catalog uses confirmed codes, the seed file is committed.

**M1 — Data layer + basic chart**
- `/api/series/[id]` with parsing, caching, quarterly aggregation, fallback banner.
- Chart Builder with Dataset 1 dropdown, line chart, two-handle slider + From/To dropdowns + quick range buttons, Monthly/Quarterly toggle.
- Unit tests: parsing (including `error_data` filtering and non-numeric values), aggregation (average/sum/last, partial quarter excluded).
- ✅ Done when: the default chart loads real data, the slider and toggle work, tests pass.

**M2 — Multiple datasets + arrow labels**
- Datasets 2 and 3, right axis for a second unit, unit rule message, "Compare as % change" mode.
- Arrow labels (Section 5.3) with auto-follow, click-to-anchor, drag, no overlap. No legend.
- Custom notes (Section 5.4).
- Editable chart title, hover tooltip, source line.
- ✅ Done when: 3 datasets display with correct axes, each has a working arrow label, notes can be added/dragged/deleted, labels appear in the exported PNG.

**M3 — Statistics + text boxes**
- Statistics dropdown, all calculations and sentences from Section 10, trend lines.
- Top text box (auto + editable + "update" notice), bottom notes box.
- Chart state in URL; Reset chart.
- Unit tests for every statistic with known datasets.
- ✅ Done when: sentences update live with the slider, tests pass, refresh keeps the chart.

**M4 — Print, PDF, image**
- Print layout, Download PDF, Download image (Section 5.10).
- ✅ Done when: printed/PDF output matches the layout, includes labels, notes, both text boxes, and the source line; no controls visible.

**M5 — Contacts + email**
- Contacts page, groups, "Send to" dropdown, Email dialog, `/api/email`, `EmailLog`.
- ✅ Done when: an email with the PDF attached arrives via configured SMTP; without SMTP, dev mode logs it and the UI shows a clear message.

**M6 — Report package**
- Add to report, report page (fields, reorder by drag and by buttons, edit, remove), report PDF with cover + page numbers, print, email report, report list.
- ✅ Done when: a 3-chart report can be built, reordered, exported as one PDF, and emailed.

**M7 — Polish and handover**
- "?" help tips with plain text from the catalog, loading skeletons, friendly error states, tablet layout, keyboard access for all controls, optional `APP_PASSWORD`, `NEXT_PUBLIC_BASE_PATH`.
- README: setup steps, how to get a Census API key, SMTP setup, how to add a new dataset, how to deploy.
- ✅ Done when: the manual QA checklist (Section 14.1) passes.

### 14.1 Manual QA checklist

- [ ] First load shows a chart with real data, no empty screen.
- [ ] Every dropdown, button, and toggle has a visible text label.
- [ ] Moving the slider updates labels, statistics text, title, and trend line.
- [ ] Quarterly view never shows an incomplete quarter and shows the note instead.
- [ ] Each line has an arrow label; there is no legend anywhere.
- [ ] Labels and notes can be dragged; arrows stay attached; they appear in print, PDF, and image.
- [ ] Three datasets with mixed units produce the friendly message and % change option.
- [ ] Editing the top text box stops auto-updates; "Update with latest numbers" works.
- [ ] Print and PDF look correct in black and white (line styles differ).
- [ ] Email arrives with the correct PDF; failures show plain-English messages.
- [ ] Report PDF has a cover page, charts in the chosen order, and page numbers.
- [ ] With the internet off (or Census down), the app still works using cache/seed and shows the yellow banner.
- [ ] No console errors; no API key visible in browser network requests.

---

## 15. Out of scope for v1 (do not build yet)

- User accounts, roles, or sign-up (only the optional single password).
- Multiple regression (shown as "coming later").
- Data sources other than Census New Home Sales (but the catalog/fetcher design must make them easy to add).
- Scheduled or automatic emails.
- Integration with PowerBanks.com (only make it possible — Section 13.3).
- Payments, analytics, CSV upload of user data.

---

## 16. Open questions for the client (defaults already chosen)

The app is built with these defaults so work isn't blocked. The developer should confirm them with the client:

| # | Question | Default used in v1 |
|---|---|---|
| 1 | "This is sliding to the right" — should the label follow the newest data point, or should users drag it? | Both: it follows the latest visible point automatically and can also be dragged or re-anchored |
| 2 | Should email be sent directly from the site, or is "download PDF and attach it yourself" enough? | Sent directly from the site via SMTP |
| 3 | Which New Home Sales measures should be in the dropdown? | All series in the Section 9 catalog |
| 4 | Do users need their own logins? | No; optional single site password |
| 5 | Branding: logo, colors, fonts for PowerGraphs? | Text wordmark "PowerGraphs", neutral blue theme |
| 6 | Paper size for print/PDF? | US Letter, landscape |
| 7 | Which statistics matter most for the meetings? | Summary, trend line, two-dataset relationship |
| 8 | Is the orange writing at the top of the sketch meant to be a feature? | Treated as unrelated and ignored |

---

## 17. Glossary (for help tips and developer understanding)

- **Seasonally adjusted:** numbers corrected for normal patterns that repeat every year (e.g., more homes sell in spring), so months can be compared fairly.
- **Yearly pace (seasonally adjusted annual rate):** what the yearly total would be if this month's pace continued for 12 months.
- **Months' supply:** months needed to sell all homes currently for sale at the current sales pace.
- **Median price:** the middle price; half sold for more, half for less.
- **Trend line (simple regression):** the straight line that best fits the data, showing the general direction.
- **R²:** a number from 0 to 1 showing how closely the data follows the trend line (closer to 1 = closer).
- **Correlation:** a number from −1 to 1 showing whether two datasets move together (+) or in opposite directions (−).
