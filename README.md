# No-Degree Tech Career Roadmap

A two-person web app that maps out realistic, degree-free routes into tech careers — what to
learn, what to certify, what to build, what it costs, and roughly how long each takes. Built for
someone coming from retail or warehouse work with no CS degree and, at first, no PC.

The tone is deliberately unhyped. Every path states the honest catch, salary figures are
entry-level rather than the median an ad would quote, and the phone-accessible steps are called
out explicitly so the first month of progress does not depend on owning a computer.

---

## Quick start

```bash
npm install

# Terminal 1 — API on :4000
npm run dev:server

# Terminal 2 — Vite dev server on :5173 (proxies /api to :4000)
npm run dev:client
```

Then open http://localhost:5173 and sign in.

**Requires Node 22.5 or newer.** The server uses the built-in `node:sqlite` module, so there is no
native database dependency to compile — no `better-sqlite3`, no build toolchain on the host. On
Node 22 that module sits behind `--experimental-sqlite`, which the npm scripts already pass; the
flag is still accepted (and unnecessary) on Node 23.4+ where the module is stable. Verified on
Node 22.22.

### Seeded accounts

Two accounts are created on first run — there is no public signup, because this is a two-person
tool.

| User | Email | Password |
|------|-------|----------|
| Eric | `ERIC_EMAIL` or `eric@roadmap.local` | `ERIC_PASSWORD` (default `change-me-eric`) |
| Matt | `MATT_EMAIL` or `matt@roadmap.local` | `MATT_PASSWORD` (default `change-me-matt`) |

Set the password variables before deploying anywhere reachable. The server logs a warning if it
seeds an account with a default password while `NODE_ENV=production`.

### Production build

```bash
npm run build      # builds the client into client/dist
npm start          # serves the API and the built client from one origin on :4000
```

Serving both from one origin keeps the session cookie first-party, which means no CORS
configuration and no third-party-cookie problems on mobile Safari.

---

## Tests

```bash
npm test           # 16 API tests via node:test — auth, progress, badges, quiz, sharing, portfolio
```

The suite also validates the seed content itself: every path has steps, every step has resources,
every resource carries a `lastVerified` date, and every `nextPaths` reference resolves to a real
path.

---

## What's in it

**Content** — 11 career paths, ~90 steps, each with real resources, current prices, and honest
timelines:

IT Support / Help Desk · QA / Software Testing · IT Project Coordination · Technical / Business
Analyst · Data Analytics · Networking / Systems Administration · UX / UI Design · Cloud / DevOps ·
Cybersecurity · Database Administration · Software Engineering

Paths are ordered by how reachable the first job actually is, not by how exciting they sound.

**Features**

| Area | What it does |
|------|--------------|
| Path selector | Grid of all 11 paths, sortable by study time, cost, salary ceiling, or phone-friendliness |
| Roadmap view | Vertical step tracker with expandable cards, per-step status, notes, hours, and spend |
| Filters | "No PC needed yet", "Free only", "Under 3 months", "Required only" — dim or hide non-matching steps |
| Comparison | 2–3 paths side by side across 14 rows, saveable |
| Recommender quiz | 8 questions; constraint flags (phone-only, $0 budget) penalise paths that would not actually work |
| Weekly schedule | Remaining steps paced against your available hours, with target dates |
| Budget view | Every paid item, what you've spent, and six concrete ways to pay less |
| No-PC view | Every step doable from a phone or a library computer, plus how to get a cheap machine |
| Pivot map | Interactive graph of how the paths connect, so switching doesn't feel permanent |
| Interview prep | Per-path questions tied to the real first-job titles, with what the interviewer is checking |
| Resume export | Bullets generated only from steps you actually completed |
| Public portfolio | Shareable page at `/p/<slug>` listing completed certs, projects, and badges |
| Print view | Clean printable roadmap with URLs spelled out — meant to be worked through on paper |
| Shared dashboard | Opt-in, both ways, for accountability between the two accounts |
| Badges & milestones | 19 badges and a celebration when a path crosses 25 / 50 / 75 / 100% |
| Dark mode | System / light / dark, persisted per user |
| Offline | Cached roadmap readable with no connection; progress queues and syncs on reconnect |
| Nudge | Dashboard reminder if nothing has been logged in N days (in-app only, nothing is emailed) |

Everything works on both desktop and mobile. No feature is exclusive to either.

---

## Architecture

```
├── server/                  Express 5 + node:sqlite
│   ├── data/paths/*.json    One file per career path — the actual content
│   ├── data/quiz.json       Recommender questions, weights, constraint penalties
│   ├── data/badges.json     Badge catalogue (rules are data, not code)
│   └── src/
│       ├── content.js       Loads + validates seed content, computes per-path totals
│       ├── db.js            Schema and connection
│       ├── auth.js          scrypt password hashing, cookie sessions
│       ├── progress.js      Per-step progress, notes, hours, auto-summed cost
│       ├── badges.js        Badge evaluation and milestone detection
│       └── routes/          auth · progress · social (sharing, quiz, portfolio)
└── client/                  React 19 + Vite
    ├── public/sw.js         Service worker: cache-first shell, network-first content
    └── src/
        ├── lib/store.jsx    App state, optimistic updates, offline outbox
        ├── lib/api.js       Fetch wrapper + localStorage cache/queue
        └── pages/           One file per view
```

### Notable decisions

**Content is data, not code.** Paths, quiz weights, and badge rules all live in JSON. Adding a
twelfth path means adding one file; adding a badge means adding one object.

**Progress writes are optimistic and queued.** The UI updates immediately. If the request fails
because the network is gone, the change goes into a localStorage outbox and replays as a single
bulk request on reconnect, last-write-wins per step. Offline startup falls back to the cached
user so a valid session isn't mistaken for a signed-out one.

**Cost is auto-derived.** Completing a paid step records its price without any data entry, so the
budget view is useful by default. An explicitly entered amount always wins and is never
overwritten.

**Timestamps are server-side.** An offline replay can reorder writes but cannot rewrite when a
step was completed.

---

## Deploying

`render.yaml` (Render blueprint) and `Dockerfile` (anything else) are both in the repo.

### The one thing that will bite you

**SQLite is a file, and most hosts replace the filesystem on every deploy.** Without a mounted
disk, every deploy silently wipes all progress — which on this app means a year of someone's study
history. `DATABASE_FILE` must point inside a persistent mount.

On Render that means a **paid instance** (`starter`), because free-tier services get no disk and
also sleep after inactivity. If you want a genuinely free host, use Fly.io — its free allowance
includes a small persistent volume — or accept that a free Render instance is a demo, not a
tracker.

### Render

1. New → Blueprint → connect this repo. It reads `render.yaml`.
2. Set the secrets it marks `sync: false`: `ERIC_PASSWORD`, `MATT_PASSWORD`, and `INVITE_CODE`.
3. Deploy. `/api/health` is the health check.

### Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_FILE` | Absolute path inside the persistent mount, e.g. `/var/data/roadmap.sqlite`. The default sits inside the app directory and does not survive redeploys. |
| `ERIC_PASSWORD`, `MATT_PASSWORD` | Passwords for the two seeded accounts. If unset, the server seeds defaults and logs a warning at boot. |
| `SIGNUP_MODE` | `invite` (default), `open`, or `closed`. |
| `INVITE_CODE` | Required for `invite` mode. Without it, signup resolves to `closed` rather than open. |
| `NODE_ENV` | Set to `production`. |
| `PORT` | Supplied by the host; defaults to 4000. |

Passwords are only read when an account is first created. Changing `ERIC_PASSWORD` later does not
rotate an existing password — delete the database or add a password-change endpoint.

### Notes

The session cookie is marked `Secure` based on the *actual* request protocol, read through
`x-forwarded-proto` (the app sets `trust proxy`). So it is Secure behind a TLS-terminating host and
plain over local HTTP, instead of being unstorable when a production instance is served over HTTP.

For a split deployment (static frontend on Vercel/Netlify plus the API elsewhere) the API needs
CORS with credentials and the cookie needs `SameSite=None`; serving both from one origin — what
`npm start` does — avoids all of it.

---

## Keeping content honest

Prices and free courses change. Every resource carries a `lastVerified` month that is displayed in
the UI, and cost notes name the specific thing to re-check.

**Verified against live sources in August 2026** — the claims that cost money or send someone at a
dead exam code:

| Claim | Status |
|-------|--------|
| CompTIA June 2026 price rise: A+ ~$548 (two exams), Network+ ~$399, Security+ ~$439 | confirmed |
| A+ exam codes 220-1201 / 220-1202 | confirmed current (220-1101/1102 retired Sept 2025; current until ~Sept 2028) |
| Network+ N10-009, Security+ SY0-701 | confirmed current |
| CCNA $300 · AWS Cloud Practitioner $100 · AWS associate $150 | confirmed |
| Azure AZ-900 $99 · DP-900 $99 · AZ-104 / DP-300 $165 | confirmed |
| Coursera professional certificates $49/month | confirmed |
| Scrum.org PSM I $200 · PMI CAPM $225 member / $300 non-member · CompTIA Project+ ~$370 | confirmed |
| ISTQB Foundation | **corrected** — was estimated $200–300, is $229 in the US via ASTQB |
| Security+ SY0-801 | **added warning** — expected ~October 2026; the outgoing version normally stays bookable ~6 months, so anyone months away from sitting it should study the version they will actually take |

This pass covered exam pricing and version codes across all 11 paths. It did **not** re-open all
255 resource links one by one — free courses and community links rot more slowly and more visibly
than exam prices do. Salary ranges are judgement calls anchored to BLS data, not quoted figures.

Re-verify before recommending anyone spend money.
