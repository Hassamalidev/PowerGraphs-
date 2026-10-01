# Assumptions and decisions

Choices made where the specification was silent, unclear, or turned out not to
match the real Census data. Please review these with the client.

## Data source

1. **The Census API now needs a key.** The spec says the API "works without a key
   for light use". On 1 Oct 2026 it does not: a request without a key gets an HTML
   "Missing Key" page. No key was available while building, so:
   - The app has **two fetchers** for the same data. With `CENSUS_API_KEY` set it
     uses the EITS API; without one (or if the API call fails) it reads the Census
     **Download Data Sets** file
     (`https://www.census.gov/econ_getzippedfile/?programCode=RESSALES`), which
     needs no key. Both go through the same parsing rules.
   - **The API path has not been run against the live API.** It is written from the
     spec and the Census documentation. The column names and the `time=from+1963`
     range syntax still need to be verified: put a key in `.env` and run
     `npm run explore`, which reports what the API returns.
2. **Catalog codes differ from the spec's expected values** (confirmed in
   `docs/census-ressales-codes.md`):
   - Yearly pace is category `ASOLD`, not `SOLD` with seasonal adjustment.
   - Average price is data type `AVERAG`, not `AVERAGE`.
   - Northeast is geo code `NO`, not `NE`.
3. **Two datasets were added** because Step 0 showed they exist and are useful:
   "Finished new homes for sale" (`FORSALE`/`COMPED`) and "Time finished homes wait
   for a buyer" (`FORSALE`/`MMTHS`).
4. **No official quarterly values exist** for this program (every period is a
   month). Quarterly median and average prices are therefore the average of the 3
   monthly values, and the tooltip says so.
5. **"Data as of" date** is the date Census last updated the data when the source
   says so (the data file does); otherwise it is the date the app fetched it.
6. After a failed Census request the app waits 5 minutes before trying again, so
   a Census outage doesn't slow down every page load.
7. A quarter is shown only when all 3 of its months have values. The "not shown
   yet" note is given for the newest quarter only.

## Tech stack

8. **Prisma 6** is used rather than Prisma 7, because 7 needs a driver adapter and
   extra config for SQLite; 6 keeps "zero setup" and switches to PostgreSQL by
   changing the provider, as the spec asks.
9. **TypeScript 5** is pinned (npm's latest is the 7.0 native rewrite, which
   Next.js tooling does not yet rely on).
10. **fflate** was added to unzip the Census data file.
