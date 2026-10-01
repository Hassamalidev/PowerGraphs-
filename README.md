# PowerGraphs

Turn U.S. Census Bureau economic data into clean, presentation-ready line charts
for management meetings. Pick up to three datasets, read plain-English
statistics, add notes, then print, download, email, or combine charts into a
report PDF.

- Full specification: `powergraphs_spec.md`
- Decisions made while building, and things to confirm: `ASSUMPTIONS.md`
- The real Census codes behind each dataset: `docs/census-ressales-codes.md`

## Setup

You need Node.js 20 or newer.

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run db:push           # creates the SQLite database (prisma/dev.db)
npm run dev               # http://localhost:3000
```

The app works straight away with no keys: it reads the Census data file, and if
Census can't be reached it shows the saved copy in `data/seed/ressales.json`
with a yellow banner.

| Command | What it does |
|---|---|
| `npm run dev` | Start the app for development |
| `npm run build` / `npm start` | Build and run for production |
| `npm test` | Run the unit tests (parsing, aggregation, statistics, cache fallback) |
| `npm run typecheck` | Check TypeScript |
| `npm run explore` | Step 0: list every real Census series → `docs/census-ressales-codes.md` |
| `npm run seed` | Refresh the offline copy → `data/seed/ressales.json` (commit the result) |

## Census API key

1. Request a free key at https://api.census.gov/data/key_signup.html (it arrives by email).
2. Put it in `.env` as `CENSUS_API_KEY=...` and restart the app.
3. Run `npm run explore` once. It reports what the API returns, which confirms the
   API path works (see `ASSUMPTIONS.md`, item 1 — this path has not been run yet).

The key is only used on the server and is never sent to the browser. Without a
key the app uses the Census "Download Data Sets" file, which holds the same data.

Data is fetched from Census at most once every 12 hours and kept in the
`SeriesCache` table.

## Email (SMTP)

Fill these in `.env` with the details from your email provider (Gmail, Outlook,
SendGrid, Resend, …), then restart:

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASS=your-password
EMAIL_FROM="PowerGraphs <reports@powergraphs.com>"
```

Port 465 uses TLS from the start; any other port (usually 587) upgrades with
STARTTLS. Without these settings, development mode writes each email to the
server console instead of sending it, and the email window says so. Every
attempt is recorded in the `EmailLog` table.

## Password protection (optional)

Set `APP_PASSWORD=...` in `.env` to require one shared password for the whole
site. A correct password is remembered for 30 days. Leave it empty for an open site.

## Adding a new dataset

Everything is in `lib/datasets/catalog.ts`. For another New Home Sales series:

1. Find its codes in `docs/census-ressales-codes.md`.
2. Add an entry to `CATALOG` with a plain `name`, `description`, and `helpText`
   (no jargon), its `unit`, `scale` (1000 when Census reports thousands), and the
   `quarterly` rule: `average` for rates and ratios, `sum` for counts, `last`
   for end-of-month stock.
3. Run `npm run seed` and commit the updated seed file.

For a different Census survey (e.g. Construction Spending): add its program
code to the `program` type in the catalog and add entries that use it — the
fetcher in `lib/census/client.ts` already takes the program name. A source
outside Census needs a new fetcher that returns the same `{ date, value }` points.
A new kind of measurement also needs a `Unit` and its formatting in `lib/format.ts`.

## Deploying

The prototype uses SQLite, so it needs a host with a **persistent disk**
(Railway, Render, or a small VPS):

1. Set the environment variables from `.env.example`, with `DATABASE_URL`
   pointing at a file on the persistent disk (e.g. `file:/data/powergraphs.db`).
2. Build: `npm install && npx prisma db push && npm run build`. Start: `npm start`.
3. Point the powergraphs.com domain at it when the client is ready.

To deploy on Vercel (no persistent disk) switch to PostgreSQL (e.g. Neon): in
`prisma/schema.prisma` change `provider = "sqlite"` to `"postgresql"`, set
`DATABASE_URL` to the Postgres connection string, and run `npx prisma db push`.

### Running inside PowerBanks.com later

Set `NEXT_PUBLIC_BASE_PATH=/powergraphs` (and rebuild) to serve the app under a
sub-path. Brand name, colors, and fonts come only from `lib/theme.ts` and
`NEXT_PUBLIC_SITE_NAME`. The chart (`components/chart/`) does not depend on the
page around it and can be reused in another app.

## Where things are

```
app/                  pages and API routes
components/chart/     PowerChart (ECharts), arrow labels + notes, range controls
components/builder/   the Chart Builder screen and its state
components/reports/   report page, report list, "Add to report"
components/email/     email window and the "Send to" picker
lib/datasets/         the dataset catalog
lib/census/           fetching and parsing Census data
lib/series/           cache, seed fallback, monthly → quarterly
lib/stats/            summary, trend line, relationship, sentences
lib/pdf/              chart PDF and report PDF
tests/                unit tests
```
