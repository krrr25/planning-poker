# Planning Poker — v1 implementation, local test, later plan

Internal sprint estimation app. Facilitators (BA / PO / SM) create a room; the team joins with a link and votes.

**Repo:** `F:\Karthik\Projects\planning-poker`  
**Old idea repo (untouched):** `F:\Karthik\Projects\scrumpoker`

### Angular folder layout

```
src/app/
  app.component.ts|html|scss
  app.config.ts
  app.routes.ts
  routes/                 # screens wired in the router (not pages/)
    landing/
    admin-login/
    admin-dashboard/
    room/
  components/             # shared UI only
    poker-card/
    table-card/
  models/
  services/               # room, auth, azure
  utils/                  # estimate, work-item label, api-error
  interceptors/
```

Route screens live under `routes/`. Reusable widgets live under `components/`. There is no `pages/` folder.

---

## 1. What we implemented (v1)

### Stack

| Layer | Choice |
|---|---|
| UI | Angular 22, Tailwind CSS v4, zoneless + signals |
| API | Node.js + Express, cookie session for admins |
| Live updates | HTTP polling every 1.5s (no WebSockets) |
| Database | MongoDB Atlas (not inside Cloud Run / not local install) |
| Hosting target later | Cloud Run + Atlas + scale-to-zero friendly REST |

### Who can do what

| Person | How they enter | What they can do |
|---|---|---|
| Admin (BA / PO / SM) | `/admin` email + password | Create room (with ADO project), reset form, list live rooms, copy link, optional work item load, Start voting, Reveal, Revote, Next story, +1 hour |
| Voter | Room URL or home page code | Enter display name, vote only after Start |

Voters have **no login**. “Joined” means they typed a name in that room.

The first admin is **seeded once** from `ADMIN_EMAIL` / `ADMIN_PASSWORD` when the `admins` collection is empty. Login after that compares against **MongoDB** (hashed password), not the env secret. Extra admins are added with `server/scripts/add-admin.js`.

### Screens

- `/` — join with room code (no Create button)
- `/admin` — facilitator sign-in
- `/admin/rooms` — create room (name + Azure DevOps project), **Reset** form, list of that admin’s rooms still within TTL
- `/room/:code` — room name, optional work item panel, join overlay, table, hand cards, facilitator toolbar

### Azure DevOps work items (shipped)

Server module: `server/src/services/azure-devops.js` — fetches work items via REST using `ADO_ORG`, `ADO_PAT`, and room `azureProject`.

| Step | Who | What happens |
|---|---|---|
| Create room | Admin | Picks **Azure DevOps project** from dropdown (`ADO_PROJECTS` env). **Reset** clears name, project, errors, and success panel. |
| Load work item | Admin | Enters numeric ID → **Load** (disabled when empty). Server calls `GET …/_apis/wit/workitems/{id}?api-version=7.1`. |
| On screen | Everyone | **{WorkItemType} #{id}: {title}** as a clickable link to `_workitems/edit/{id}` (e.g. `User Story #12345: Implement OAuth2`). |
| Fetch fails | Admin | Generic error (e.g. `Request failed (502). Try again.`) — **does not block** Start voting or the rest of the ceremony. |
| After load | Admin | ID input row hides; only the work item panel shows until **Next story**. |

Fields mapped from Azure DevOps:

| ADO field | Stored / shown |
|---|---|
| `id` | `workItemId` |
| `fields.System.WorkItemType` | `workItemType` (Bug, User Story, Spike, …) |
| `fields.System.Title` | `title` |
| Built URL | `url` (human edit link, not the API `url` in the JSON body) |

### Room rules

- Random 6-character room code (shareable `/room/k7m2xq`)
- Expires after **3 hours** (`ROOM_TTL_HOURS`); Atlas TTL index deletes the document
- Several pods can each have a live room at the same time
- Facilitator picks an **Azure DevOps project** when creating a room (when `ADO_PROJECTS` is configured)
- Facilitator can **optionally** load a work item by ID — ceremony continues even if fetch fails or is skipped
- Everyone sees **{type} #{id}: {title}** as a clickable link when a work item is loaded
- Cards stay **disabled** until the admin clicks **Start voting**
- During voting, admin sees **who has not voted**
- Voter can change their card until Reveal
- Reveal shows every name + point, plus numeric **average**
- If people are still pending, Reveal asks to confirm
- **Revote** clears votes and keeps the same work item (same story, vote again)
- **Next story** clears votes **and** the current work item — facilitator loads the next ID manually (any order)
- **+1 hour** extends expiry
- Duplicate display names in the same room are blocked
- Refresh: voter token stays in `localStorage`; admin cookie stays; host can rejoin without “name taken”
- Voter can **Leave table**; facilitator can **Remove** a leftover seat

### Deck

Hours (7h = 1 working day): `7, 14, 21, 28, 35, 42, 49`

### UX shipped

- Dark planning-room layout (Outfit + Fraunces, gold accent)
- Compact buttons (slightly shorter height, subtle borders on gold / ghost / danger)
- Create-room: project dropdown (dark theme), **Create room** + **Reset**
- Room: **Work item:** `[ID]` **Load** + gold **Optional — Fetch Work Item** badge; Load disabled when ID empty
- Create-room success panel with copy link
- Vote: card lifts and **3D flips** to the value
- Waiting / disabled: greyed hand, no vote
- Yet-to-vote: **pulse** on that person’s table card
- Reveal: table cards **flip in sequence**
- Revote / next story: hand cards flip back to the pattern side
- Work item panel: gold highlight with clickable **{type} #{id}: {title}**

### API (all under `/api`)

| Method | Path | Who |
|---|---|---|
| POST | `/auth/login` | Admin |
| POST | `/auth/logout` | Admin |
| GET | `/auth/me` | Admin |
| POST | `/rooms` | Admin — create (optional `azureProject`) |
| GET | `/rooms` | Admin — their live rooms |
| GET | `/rooms/:code` | Anyone — current board (votes hidden until reveal) |
| POST | `/rooms/:code/join` | Anyone (admin auto-joins as host) |
| POST | `/rooms/:code/story` | Admin — load work item by ID from Azure DevOps |
| POST | `/rooms/:code/start` | Admin |
| POST | `/rooms/:code/vote` | Joined participant |
| POST | `/rooms/:code/reveal` | Admin |
| POST | `/rooms/:code/revote` | Admin — clear votes, keep work item |
| POST | `/rooms/:code/next` | Admin — clear votes and work item |
| POST | `/rooms/:code/reset` | Admin — legacy alias (clear votes only) |
| POST | `/rooms/:code/extend` | Admin |
| POST | `/rooms/:code/leave` | Joined participant |
| POST | `/rooms/:code/remove` | Admin — remove a leftover seat |
| GET | `/azure/projects` | Admin — configured project list |

### Azure DevOps env (server)

| Variable | Secret? | Purpose |
|---|---|---|
| `ADO_ORG` | Optional in GSM | Organization name in `dev.azure.com/{org}/...` |
| `ADO_PAT` | **Yes** | Personal access token (Work Items Read) |
| `ADO_PROJECTS` | Optional in GSM | Comma-separated projects for the create-room dropdown |

On Cloud Run, reference secrets as env vars with the same names, e.g. `--set-secrets=ADO_PAT=ADO_PAT:latest`.

### What v1 does **not** include

Chat, Google/Microsoft SSO, spectator mode, public room directory, WebSockets, installing Mongo on the API host, coffee/abstain vote cards, per-user break status, in-app screen sharing.

---

## 2. Run locally now

**Need**

- Node.js 22.22.1 or newer (CLI officially wants 22.22.3; `npm install` relaxes that check)
- MongoDB Atlas connection string (free M0 is enough)
- Two terminals

### 2.1 Env

```bat
cd F:\Karthik\Projects\planning-poker
copy server\.env.example server\.env
```

Edit `server\.env`:

```
PORT=3000
CLIENT_ORIGIN=http://localhost:4200
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/planning-poker-dev
JWT_SECRET=a-long-random-string
ADMIN_EMAIL=po@company.com
ADMIN_PASSWORD=ChangeMe!234
ADMIN_NAME=Product Owner
ROOM_TTL_HOURS=3

# Azure DevOps — optional locally; required in production for work item loading
ADO_ORG=OrgName
ADO_PAT=your-personal-access-token
ADO_PROJECTS=Project1,Project2,Project3
```

Use a **dev** database name (`planning-poker-dev`) so local tests do not wipe production later.

In Atlas → Network Access, allow your IP (or `0.0.0.0/0` for a private internal tool).

### 2.2 Start API

```bat
cd F:\Karthik\Projects\planning-poker\server
npm install
npm start
```

First start with an empty `admins` collection creates `ADMIN_EMAIL`. Later starts do not overwrite that password.

### 2.3 Start UI

```bat
cd F:\Karthik\Projects\planning-poker
npm install
npm start
```

Open `http://localhost:4200`.

### 2.4 Add another admin (optional)

```bat
cd F:\Karthik\Projects\planning-poker\server
node scripts/add-admin.js --email ba@company.com --password "StrongPass!" --name "Anita"
```

This writes a row in Atlas. No new Cloud Run secret.

---

## 3. What to test now

Use **two browsers**: normal window = admin, private/incognito = voter.

### Admin path

1. Go to `/admin`. Wrong password is rejected.
2. Sign in with seeded email/password → dashboard.
3. Create **Sprint 24 - Product team** (choose an Azure DevOps project if configured). Use **Reset** to clear the form and project selection.
4. Copy link appears; **Copy link** works.
5. Room shows under **Your live rooms**.
6. Open the room — you should skip the name overlay (joined as host).
7. Optional: enter a work item ID → **Load** → clickable title appears for everyone. **Load** is disabled when the field is empty.
8. **Start voting** works even if work item load failed or was skipped. Before Start, cards are disabled.
9. Click **Start voting** — hand cards enable (for voters).
10. Click **+1 hour** — expiry moves forward (check dashboard or header time).
11. Sign out → `/admin` again. `/admin/rooms` without a cookie redirects to login.

### Voter path

12. Incognito: open the copied `/room/xxxxxx`.
13. Overlay shows the **room name** (and work item if loaded). Enter `Karthik` → Join.
14. Before Start (or after Revote / Next story): cards disabled.
15. After Start: pick `14` — card flips and lifts.
16. Change to `21` — still allowed until Reveal.
17. Second incognito: join as `Rahul`. Duplicate `Karthik` must fail.
18. Admin board: Rahul **Yet to vote** (pulse). After Rahul votes, both show Voted; values still hidden.

### Reveal, revote, and next story

19. Admin Reveal with someone pending → confirm dialog, then all names + points, flip animation, average if numeric.
20. **Revote** → votes cleared, **same work item stays**, cards lock until Start again.
21. **Next story** → votes cleared, work item cleared → load a new ID (any number, not sequential).
22. Refresh voter tab — still in the room, same name.
23. Refresh admin tab — still facilitator, toolbar visible.

### Expiry and isolation

24. Expired / fake code (`/room/zzzzzz`) → expired or not-found message.
25. Optional: set `ROOM_TTL_HOURS=0.05` (~3 minutes), restart API, confirm the room dies.
26. Create a second room as the same admin — both can be live; voters only see the link they opened.

### Azure DevOps (optional)

27. With valid `ADO_*` env: load ID `12345` → title shows as **User Story #12345: …** (or Bug / Spike, etc.).
28. With invalid ID or bad PAT: generic error under the form; **Start voting** still works.
29. After successful load, ID input row is hidden until **Next story**.

### Seed / security sanity

31. Restart API — you can still log in; a second admin is **not** created from env.
32. Confirm `server/.env` is not committed (see `.gitignore`).
33. Home page has **no** Create room — only code + Facilitator sign in.

---

## 4. Pending / later

Build these after the current ceremony feels right in a real sprint.

### Next (small, high value)

| Feature | Why |
|---|---|
| Round history in one room | Same 3-hour room, list of estimated stories with averages |
| Confirm + skip “coffee / ?” in average | Cleaner math when abstain votes are added |
| Per-user break / away status | One person stepped out without pausing the room |
| Mobile polish | People join from phones in the room |
| “Add admin” on the dashboard | Avoid running the script each time |
| Change admin password | After first seed |
| Sprint backlog picker in the room | Load by ID works; picking from sprint query would be faster |

### After the team uses it weekly

| Feature | Why |
|---|---|
| Google / Microsoft login + email allowlist | No shared passwords; still only listed facilitators create rooms |
| Spectator (SM watches, does not vote) | Optional |
| Consensus highlight | Green when all numeric votes match |
| Export round (copy table / CSV) | Retro / audit |
| Room PIN | Extra lock if the URL is ever public |
| Dark/light toggle | Preference |

### Later / only if needed

| Feature | Why we waited |
|---|---|
| Chat / discussion board | Discussion stays in Teams/Zoom |
| WebSockets / Firestore live push | Polling is enough for 10–20 people |
| Public marketing landing | This is an internal tool |
| Full user accounts for every voter | Display name is enough |
| In-app screen sharing | Use Teams/Zoom for shared screens |
| Dynamic ADO project list from API | `ADO_PROJECTS` env list is enough for now |

### Cloud deploy (when local is stable)

1. Secrets in GCP Secret Manager: `MONGODB_URI`, `JWT_SECRET`, `ADO_PAT`, `ADO_ORG`, `ADO_PROJECTS`, first-admin seed (used only if Atlas is empty).
2. One Cloud Run service for the API (and later the Angular static build, or serve `dist` from the same Node process).
3. Keep Atlas M0 (or a cheap dedicated cluster). **Do not install Mongo inside Cloud Run.**
4. Prefer REST + polling so the service can scale to zero between planning sessions.
5. Put `/admin` on the same host; restrict Create to admin cookie only.

---

## 5. Mental model (seed vs login)

```
First deploy / first local start
  ADMIN_EMAIL + ADMIN_PASSWORD  →  one row in Atlas (hash)

Every later /admin login
  typed email + password  →  MongoDB only  →  httpOnly cookie
```

The database is **Atlas**, not inside Cloud Run and not inside the Angular app. Laptop and Cloud Run both connect with `MONGODB_URI`.
