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
11. **playwright-core** (dev only) was used to check the app in a real browser
    while building. It is not needed to run the app and can be removed.

## Chart Builder

12. **Default range** is the 5 years ending at the latest data point, inclusive
    (e.g. Aug 2021 – Aug 2026, 61 monthly points).
13. **Y-axes do not start at zero**; they fit the visible data so changes are
    easy to see. Confirm the client is happy with this.
14. **Statistics always use the real values**, also when "Compare as % change" is on.
15. **Unit rule:** picking a dataset that would bring a third kind of
    measurement shows the message and does not add the dataset until "Compare as
    % change" is turned on. While three measurements are on the chart the
    switch stays on. "Homes" and "homes per year" count as different measurements.
16. **Label positions:** `pos` may be `null`, meaning "place automatically"; once a
    box is dragged its position is stored as a percent of the plot area.
    Automatic boxes avoid the lines when there is room; on a very busy chart
    they may sit over a line, and can be dragged.
17. **Clicking a line** moves that dataset's label to the clicked point. If that
    point later falls outside the selected dates, the label goes back to the
    latest point. Switching Monthly/Quarterly also sends labels back to the
    latest point; notes move to the matching quarter (or its last month).
18. **Adding a note without a mouse:** the "+ Add a note" bar also offers Line
    and Date dropdowns, so it works from the keyboard.
19. **Relationship sentence:** the step used for the second dataset ("when Median
    price is $20,000 higher…") is a round number near its typical variation in
    the selected range, so it changes with the data. Names are used as written
    in the catalog.
20. **"About" amounts** in sentences are rounded to 2 significant figures.
21. **Top text box** is plain text, so dataset names are not bold as in the spec's examples.
22. **The dataset catalog is bundled into the page** (Census codes are public, not
    secret). `/api/datasets` still returns it without the codes, as specified.
23. **Unsaved work** (texts, label positions, notes) is kept per browser tab in
    `sessionStorage`; the main settings are in the URL. Opening the builder with
    no settings in the URL restores the tab's last chart.
24. **Dragging labels** is turned off only on touch screens narrower than 640px.

## Print, PDF, email, reports

25. The chart picture in exports is the on-screen chart at 2× resolution with the
    slider cut off, so its shape follows the browser window width.
26. Long statistics text or notes are cut (with "…") in the PDF so the page never
    overflows: 9 lines of statistics, 7 lines of notes.
27. PDFs use the built-in Helvetica font, which only covers Western characters.
    The minus sign is written as a hyphen; other unsupported characters become "?".
28. **Email:** all recipients are placed in the "To" line. A typed address saved
    to contacts uses the part before "@" as the name. In production without SMTP
    settings the send fails with a plain message; in development it is logged.
29. **The SMTP path was checked against a local test mail server**, not a real
    provider — no SMTP account was available. Please send one real email after
    filling in the SMTP settings.
30. **Chart snapshots live only inside reports.** Removing a chart from a report
    (or deleting the report) deletes its snapshot. Editing from a report replaces
    that snapshot ("Update in report").
31. Report fields save when you leave the field. The report PDF file name uses
    today's date. "Report (N charts)" in the header points at the report used
    last in this browser.
32. **Password:** the cookie holds a hash of `APP_PASSWORD`, so changing the
    password signs everyone out.
