# SODA interviewer

Public SODA interview chatbot. **One isolated instance per client and project.** Owner: Jeff Mignon.

A guest opens a unique invite link and is interviewed. They are never asked which company, product, or service this is for — the chatbot already has the brief.

Two surfaces:

1. **Public interview** at `/i/[token]`
2. **Admin** at `/admin` — create instances, copy outreach, watch interviews, view cognitive maps, weave a cause map, download a priority spreadsheet

This is not a generic chatbot. Interviews follow Strategic Options Development and Analysis (Eden / Ackermann): action statements, means–ends arrows, laddering why/how, bipolar constructs, and a map the guest is the arbiter of.

## How instances work

| | |
|---|---|
| **Client** | The company being served (name, website, optional notes) |
| **Project** | The product, service, or situation of interest for that client |
| **Instance** | One chatbot for one client + one project. Own public URL, invitees, transcripts, cognitive maps, cause map, spreadsheet |

Tokens are unique and unguessable. `/i/[token]` may identify:

- the **instance** (generic link — each browser session can start its own interview)
- a specific **invitee** bound to that instance
- an **interview** already in progress

Other clients and projects never see this data. There is no public listing of interviews.

## Requirements

- Node.js 22+
- An AI key (Vercel AI Gateway or OpenAI)
- Postgres in production (`DATABASE_URL`)

## Environment

Copy `.env.example` to `.env.local`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres URL, or `file:./data/dev.db` for local SQLite |
| `ADMIN_PASSWORD` | Password for `/admin` (httpOnly cookie session) |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway (preferred). On Vercel, OIDC can replace this. |
| `OPENAI_API_KEY` | Used when Gateway is not set |
| `AI_MODEL` | Default `openai/gpt-4o`. Gateway-style ids (`provider/model`) |
| `APP_URL` | Origin for links printed by `npm run seed` |

Do not commit secrets. `.env*` is gitignored except `.env.example`.

## Run locally (SQLite, no Docker)

```bash
cp .env.example .env.local
# set ADMIN_PASSWORD and an AI key in .env.local
npm install
npm run seed
npm run dev
```

Open [http://localhost:3000/admin](http://localhost:3000/admin), sign in, and use the invitee link printed by the seed script.

The seed creates:

- Client: North Harbor Health
- Project: CME for busy clinicians
- Instance with audience **HCPs who need to take CME** and a CME interview goal
- Invitee (Sam Okonkwo) with a unique `/i/[token]` link

## Run locally (Postgres)

```bash
docker compose up -d
# in .env.local:
# DATABASE_URL=postgres://soda:soda@localhost:5432/soda
npm run seed
npm run dev
```

SQLite is the documented fallback when `DATABASE_URL` is unset or starts with `file:`. Production on Vercel should use Postgres (Neon, Vercel Postgres, or any `postgres://` URL). Native SQLite is not for serverless.

## Create an instance and run a demo interview

1. Sign in to `/admin`
2. Add a **client** and a **project** (or use the seed)
3. Create an **instance**. Required: situation of interest, **target audience**, and **interview goal**. These fence every question.
4. Add an **invitee** (name, email, optional LinkedIn URL)
5. Copy the unique interview link, the ready-to-send email, or the LinkedIn message
6. Open the link as the guest. The interviewer names the situation and asks a broad question. It will not ask which company this is for.
7. The sitting runs **30–40 minutes** (server clock). The guest sees remaining time, calmly. They may leave; consent beats the clock. Before 30:00 the interviewer cannot conclude unless the guest insists on stopping (`ended_early`). At 40:00 the session hard-stops and saves the map.
8. Off-goal answers do not steer the session. One acknowledgment, keep only in-goal fragments, next question back inside the fence.
9. When the interview is saved, the guest sees a confirmation only — not the admin analysis UI.
10. In admin, open the instance: transcript, cognitive map (graph + node/edge list)
11. Select completed interviews → SODA desk → “create the causal map”, then “analyze it”, then download the spreadsheet

Outreach is **copy/export only**. This app does not send email or LinkedIn messages.

## SODA interview method (guest)

- One person at a time. Map is theirs alone.
- Action statements in their language (~6–8 words, imperative). Split compounds.
- Means–ends arrows: A→B reads “A may lead to B”, not chronology. Minus at the head = A may lead to not-B (dilemma).
- Ladder why (goals) and how (options/constraints). Questions emerge from the map.
- Last stretch (~32 minutes): read back busy nodes, orphans, heads as candidate goals. They are the only arbiter. Persist by ~38. 40 is a wall.
- If asked what this is: two-dimensional notes, not “cognitive mapping.”
- Do not run domain / centrality / cluster / teardrop / priority analysis in the guest chat.

### Goal fence (load-bearing)

Admin sets **target audience** and **interview goal** on the instance. They are injected into the interviewer and never asked of the guest.

Closes: no questions outside that goal and audience — no new themes, small-talk, adjacent products, or career biography except as it serves this goal.

Opens: full SODA what/why/how inside the fence.

If the guest answers off-goal: one short acknowledgment; capture only in-goal fragments; discard the rest for questioning (it may stay on the transcript); the next question is inside the goal, laddering from the last in-goal statement — not the tangent. Every time. No “just this once.” Never lecture.

Heuristics:

1. Serve this instance’s goal, not a new theme — including when they answer off-goal.
2. Ladder why/how from their last in-goal statement, not from the tangent.
3. Off-goal answer: one beat, capture only in-goal fragments, next question back inside the fence.

Off-goal proposed questions are blocked or rewritten in code, then logged as on-goal / redirected.

### Session clock (load-bearing)

Rigid 30–40 minutes, enforced server-side from `started_at`. Remaining minutes are passed into the model every turn. Do not pad to hit 30. Stay in SODA laddering inside the goal until the floor.

The seed demo instance is CME for busy HCPs. That is an example, not the only possible instance.

## Cause map and spreadsheet (admin only)

Cause maps are woven **on this instance** after several cognitive maps. Meaning over wording. Authorship stays visible. Disagreement stays as parallel chains.

Analysis order is structural, not RICE: goal system → domain → central → cluster → hierarchical teardrops → potent options / composite tails. The product is a **portfolio**, not a single winner. On a small map the app says it is reading by eye and does not fake software metrics.

Download `.xlsx` or `.csv`.

## Deploy on Vercel

1. Import this GitHub repo
2. Set `DATABASE_URL` (Postgres), `ADMIN_PASSWORD`, and `AI_GATEWAY_API_KEY` or `OPENAI_API_KEY`
3. Optional: `AI_MODEL`, `APP_URL` (your production origin)
4. Deploy

The app is Next.js App Router (TypeScript) and uses the Vercel AI SDK for streaming chat.

## Tests

```bash
npm test
```

Covers token lookup, instance context injection (never quiz the guest for company/product), isolation across instances (including interview goals), cognitive map JSON shape, the 30–40 minute clock, and the goal fence (off-goal questions are not sent; off-goal guest stories do not steer the next question).

## Scripts

| | |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm test` | Vitest |
| `npm run seed` | Demo client + project + instance + invitee |
| `npm run lint` | ESLint |
