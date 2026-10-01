# PowerGraphs

Turn U.S. Census Bureau economic data into clean, presentation-ready line charts
for management meetings. See `powergraphs_spec.md` for the full specification and
`ASSUMPTIONS.md` for decisions made while building.

## Quick start

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run db:push           # creates the SQLite database
npm run dev               # http://localhost:3000
```

More setup details are added as the milestones are completed.
