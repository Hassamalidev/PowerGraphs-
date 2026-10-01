# PowerGraphs

**Turn government economic data into charts you can put straight in front of a management meeting.**

PowerGraphs is a small web app for people who are not statisticians. You pick a
dataset from a dropdown, the chart appears, and the app tells you in plain
English what the numbers are doing. From there you can print it, save it,
email it, or bundle several charts into one report.

The first version works with the U.S. Census Bureau's **New Home Sales** data:
homes sold, prices, homes for sale, and months of supply, nationally and by
region, going back to 1963.

> This is a prototype (v1). It is built to be revised. If something here doesn't
> match how you'd like it to work, that is useful feedback, not a problem.

---

## Contents

- [What you can do with it](#what-you-can-do-with-it)
- [Getting started](#getting-started)
- [A quick tour](#a-quick-tour)
- [Settings](#settings)
- [Where the data comes from](#where-the-data-comes-from)
- [Adding more datasets](#adding-more-datasets)
- [Putting it online](#putting-it-online)
- [For developers](#for-developers)
- [Known limits](#known-limits)
- [More documentation](#more-documentation)

---

## What you can do with it

**Build a chart**

- Put up to **three datasets** on one line chart.
- Choose the dates with a two-handle slider, the From/To dropdowns, or the
  quick buttons (1 year, 5 years, 10 years, All).
- Switch between **monthly** and **quarterly** views.
- Compare datasets that use different measurements with **"Compare as % change"**.

**Read it at a glance**

- There is no legend. Each line has its own **label box with an arrow**, showing
  the latest value. Drag a box wherever you like, or click a point on the line
  to make the label point there instead.
- **"What the numbers say"** shows a card for each dataset: the latest value,
  how it changed from last month and last year, and the highest, lowest, and
  average.
- Ask for a **trend line**, or see **how two datasets move together**.
- Add up to five **notes** on the chart, each with an arrow to the point it's
  about, and write your own notes for the meeting underneath.

**Share it**

- **Print**, **download as PDF**, or **download as an image**. The labels and
  notes are part of the picture.
- **Email** the chart to saved contacts or whole groups ("Management team").
- **Build a report**: collect several charts, put them in order, add a cover
  page, and export the lot as one PDF.

Your chart is kept in the page address, so refreshing doesn't lose it and you
can send the link to someone else.

---

## Getting started

You need [Node.js](https://nodejs.org) version 20 or newer.

```bash
npm install
cp .env.example .env      # on Windows: copy .env.example .env
npm run db:push           # creates the database file
npm run dev
```

Then open **http://localhost:3000**.

That's all. You don't need any keys or accounts to try it: the chart loads with
real Census data the first time you open the page.

---

## A quick tour

| Page | What it's for |
|---|---|
| **Chart builder** (`/`) | Where you make charts. Everything above happens here. |
| **All reports** (`/reports`) | Your saved report packages. |
| **A report** (`/reports/…`) | Title, meeting date, introduction, and the charts in it. Drag to reorder, or use Move up / Move down. Preview, print, download, or email. |
| **Datasets** (`/datasets`) | Add more Census series to the dropdowns. |
| **Contacts** (`/contacts`) | The people and groups you email charts to. |

A typical session: build a chart → **Add to report** → build the next one →
open the report → put the charts in order → **Download PDF** or **Email report**.

---

## Settings

All settings live in the `.env` file. Every one of them is optional. Restart
the app after changing any of them.

| Setting | What it does |
|---|---|
| `CENSUS_API_KEY` | Use the Census API instead of the Census data file. See [below](#where-the-data-comes-from). |
| `DATABASE_URL` | Where the database lives. The default is a file in the `prisma` folder. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Lets the app send email. |
| `APP_PASSWORD` | Puts one shared password in front of the whole site. |
| `NEXT_PUBLIC_SITE_NAME` | The name shown in the header. |
| `NEXT_PUBLIC_BASE_PATH` | Run the app under a sub-path such as `/powergraphs`. |

### Email

Fill in the details from your email provider (Gmail, Outlook, SendGrid, Resend,
or any other that offers SMTP):

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASS=your-password
EMAIL_FROM="PowerGraphs <reports@powergraphs.com>"
```

Until these are filled in, nothing is actually sent. While developing, the app
writes each email to the server console instead, and the email window tells you
so. Every attempt is recorded in the `EmailLog` table.

### Password

Set `APP_PASSWORD` to keep the site private while it's on a public address.
Visitors are asked for the password once and remembered for 30 days. This is one
password for everybody; there are no user accounts in v1.

---

## Where the data comes from

All numbers come from the **U.S. Census Bureau, New Residential Sales** program.
Nothing is made up or estimated, except quarterly figures, which are worked out
from the monthly ones (and the chart says so when you hover).

The app fetches fresh data at most once every 12 hours and keeps a copy. If the
Census website can't be reached, you still get a chart: the app shows its last
saved copy with a yellow notice saying how old it is.

**About the Census API key.** Census offers the same data two ways, and the app
can use either:

- **Without a key** (the default): it downloads the Census "Download Data Sets"
  file. This is what has been used and tested so far.
- **With a key**: it uses the Census API. Request a free key at
  https://api.census.gov/data/key_signup.html, put it in `.env`, and run
  `npm run explore` once to confirm the API answers as expected. This route has
  not yet been run against the live API, because no key was available while
  building.

The key stays on the server and is never sent to the browser.

---

## Adding more datasets

**From the app.** Open **Datasets**, find the series you want (the search box
helps), choose **+ Add this dataset**, and give it a plain name. It shows up in
the chart dropdowns under "Added by you". You can remove it again on the same page.

This covers every series in the New Home Sales survey, for example homes still
under construction, or homes for sale by region.

**In code.** To make a dataset built in for everyone, add an entry to
[`lib/datasets/catalog.ts`](lib/datasets/catalog.ts):

1. Look up its codes in [`docs/census-ressales-codes.md`](docs/census-ressales-codes.md).
2. Add the entry with a plain name, a one-line description, help text, its
   unit, and how to turn months into quarters (`average` for rates and prices,
   `sum` for counts, `last` for end-of-month figures).
3. Run `npm run seed` and commit the updated offline copy.

Other Census surveys (construction spending, retail sales, and so on) are not
supported yet. They use measurements the chart doesn't handle today, such as
millions of dollars or percentages, and some are quarterly only.

---

## Putting it online

The prototype stores its data in a single database file, so it needs a host
that keeps files between restarts, such as Railway, Render, or a small server.

1. Set the values from `.env.example`. Point `DATABASE_URL` at a file on the
   host's permanent disk, for example `file:/data/powergraphs.db`.
2. Build with `npm install && npx prisma db push && npm run build`.
3. Start with `npm start`.

**Hosts without a permanent disk** (such as Vercel) need a hosted database
instead. In [`prisma/schema.prisma`](prisma/schema.prisma) change
`provider = "sqlite"` to `"postgresql"`, set `DATABASE_URL` to the connection
string, and run `npx prisma db push`.

**Moving under PowerBanks.com later.** Set `NEXT_PUBLIC_BASE_PATH=/powergraphs`
and rebuild. The name, colours, and fonts all come from
[`lib/theme.ts`](lib/theme.ts), and the chart itself doesn't depend on the page
around it, so it can be reused in another app.

---

## For developers

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app for development |
| `npm run build` then `npm start` | Build and run for production |
| `npm test` | Run the unit tests |
| `npm run typecheck` | Check the TypeScript |
| `npm run db:push` | Create or update the database tables |
| `npm run explore` | List every series Census publishes and write it to `docs/` |
| `npm run seed` | Refresh the offline copy of the data |

After pulling changes that touch `prisma/schema.prisma`, run `npm run db:push` again.

### What it's built with

Next.js (App Router) and TypeScript, Tailwind CSS, Apache ECharts for the
chart, Prisma with SQLite, jsPDF for PDFs, Nodemailer for email, Zod for
checking input, dnd-kit for reordering, and Vitest for tests.

This project uses a recent Next.js with some changed conventions. For example,
the request guard lives in `proxy.ts`, not `middleware.ts`. The guides that
match the installed version are in `node_modules/next/dist/docs/`.

### Where things are

```
app/                    pages and API routes
components/
  builder/              the Chart builder screen and its state
  chart/                the chart, arrow labels and notes, range controls
  text/                 "What the numbers say" and the meeting notes box
  reports/              report page, report list, "Add to report"
  datasets/             the Datasets page
  email/, contacts/     email window, contact picker, Contacts page
lib/
  datasets/             the dataset catalog and the "available to add" list
  census/               fetching and reading Census data
  series/               saved copies, offline fallback, months to quarters
  stats/                summary, trend line, relationship, and their wording
  pdf/                  chart PDF and report PDF
  theme.ts              name, colours, fonts
prisma/schema.prisma    database tables
data/seed/              offline copy of the data
tests/                  unit tests
```

### Tests

`npm test` covers reading Census data, turning months into quarters, every
statistic and its wording, number formatting, the offline fallback, and the
list of datasets available to add. The screens themselves were checked by hand
in a browser; there are no automated browser tests in the repository.

---

## Known limits

- **New Home Sales only.** Other Census surveys need more work first.
- **One shared password**, no individual logins.
- **Email has only been tried against a test mail server.** Send yourself one
  real email after filling in the SMTP settings.
- **The Census API route is untested**; the app has been running on the Census
  data file.
- **Datasets you add yourself have no offline copy.** If Census is down the
  first time you open one, you'll see an error instead of a chart.
- **Multiple regression** is shown as "coming later".
- On a very busy chart, a label box may sit on top of a line. Drag it clear.

---

## More documentation

- [`powergraphs_spec.md`](powergraphs_spec.md): the full specification the prototype was built from.
- [`ASSUMPTIONS.md`](ASSUMPTIONS.md): every decision made where the specification was silent, and the points to confirm with the client.
- [`docs/census-ressales-codes.md`](docs/census-ressales-codes.md): the Census codes behind each dataset.

Data source: U.S. Census Bureau, New Residential Sales.
#   P o w e r G r a p h s -  
 