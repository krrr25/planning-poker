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
  services/
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
| Admin (BA / PO / SM) | `/admin` email + password | Create room, list their live rooms, copy link, Start voting, Reveal, Next/Reset, +1 hour |
| Voter | Room URL or home page code | Enter display name, vote only after Start |

Voters have **no login**. “Joined” means they typed a name in that room.

The first admin is **seeded once** from `ADMIN_EMAIL` / `ADMIN_PASSWORD` when the `admins` collection is empty. Login after that compares against **MongoDB** (hashed password), not the env secret. Extra admins are added with `server/scripts/add-admin.js`.

### Screens

- `/` — join with room code (no Create button)
- `/admin` — facilitator sign-in
- `/admin/rooms` — create room + list of that admin’s rooms still within TTL
- `/room/:code` — room name, join overlay, table, hand cards, facilitator toolbar

### Room rules

- Random 6-character room code (shareable `/room/k7m2xq`)
- Expires after **3 hours** (`ROOM_TTL_HOURS`); Atlas TTL index deletes the document
- Several pods can each have a live room at the same time
- **No story / bug title** in v1 — call the ticket out in the meeting, then vote
- Cards stay **disabled** until the admin clicks **Start voting**
- During voting, admin sees **who has not voted**
- Voter can change their card until Reveal
- Reveal shows every name + point, plus numeric **average**
- If people are still pending, Reveal asks to confirm
- **Next / Reset** clears votes and locks cards again
- **+1 hour** extends expiry
- Duplicate display names in the same room are blocked
- Refresh: voter token stays in `localStorage`; admin cookie stays; host can rejoin without “name taken”

### Deck

`0, 1, 2, 3, 5, 8, 13, 21, ?, ☕`

### UX shipped

- Dark planning-room layout (Outfit + Fraunces, gold accent)
- Create-room success panel with copy link
- Vote: card lifts and **3D flips** to the value
- Waiting / disabled: greyed hand, no vote
- Yet-to-vote: **pulse** on that person’s table card
- Reveal: table cards **flip in sequence**
- Reset: hand cards flip back to the pattern side

### API (all under `/api`)

| Method | Path | Who |
|---|---|---|
| POST | `/auth/login` | Admin |
| POST | `/auth/logout` | Admin |
| GET | `/auth/me` | Admin |
| POST | `/rooms` | Admin — create |
| GET | `/rooms` | Admin — their live rooms |
| GET | `/rooms/:code` | Anyone — current board (votes hidden until reveal) |
| POST | `/rooms/:code/join` | Anyone (admin auto-joins as host) |
| POST | `/rooms/:code/start` | Admin |
| POST | `/rooms/:code/vote` | Joined participant |
| POST | `/rooms/:code/reveal` | Admin |
| POST | `/rooms/:code/reset` | Admin |
| POST | `/rooms/:code/extend` | Admin |

### What v1 does **not** include

Chat, story title, Jira/Azure boards, Google/Microsoft SSO, spectator mode, public room directory, WebSockets, installing Mongo on the API host.

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
3. Create **Sprint 24 - Product team**.
4. Copy link appears; **Copy link** works.
5. Room shows under **Your live rooms**.
6. Open the room — you should skip the name overlay (joined as host).
7. Cards are **disabled**. Status: waiting for facilitator.
8. Click **Start voting** — hand cards enable.
9. Click **+1 hour** — expiry moves forward (check dashboard or header time).
10. Sign out → `/admin` again. `/admin/rooms` without a cookie redirects to login.

### Voter path

11. Incognito: open the copied `/room/xxxxxx`.
12. Overlay shows the **room name**. Enter `Karthik` → Join.
13. Before Start (or after Reset): cards disabled.
14. After Start: pick `5` — card flips and lifts.
15. Change to `8` — still allowed until Reveal.
16. Second incognito: join as `Rahul`. Duplicate `Karthik` must fail.
17. Admin board: Rahul **Yet to vote** (pulse). After Rahul votes, both show Voted; values still hidden.

### Reveal and reset

18. Admin Reveal with someone pending → confirm dialog, then all names + points, flip animation, average if numeric.
19. **Next / Reset** → cards lock, votes cleared, table face-down again.
20. Refresh voter tab — still in the room, same name.
21. Refresh admin tab — still facilitator, toolbar visible.

### Expiry and isolation

22. Expired / fake code (`/room/zzzzzz`) → expired or not-found message.
23. Optional: set `ROOM_TTL_HOURS=0.05` (~3 minutes), restart API, confirm the room dies.
24. Create a second room as the same admin — both can be live; voters only see the link they opened.

### Seed / security sanity

25. Restart API — you can still log in; a second admin is **not** created from env.
26. Confirm `server/.env` is not committed (see `.gitignore`).
27. Home page has **no** Create room — only code + Facilitator sign in.

---

## 4. Feature plan (later)

Build these only after the v1 ceremony feels right in a real sprint.

### Next (small, high value)

| Feature | Why |
|---|---|
| Story / ticket title on the board | So people know what they are pointing without the call |
| Several titled rounds in one room | Same 3-hour room, Next story keeps a short history |
| Confirm + skip “coffee / ?” in average | Cleaner math |
| Mobile polish | People join from phones in the room |
| “Add admin” on the dashboard | Avoid running the script each time |
| Change admin password | After first seed |

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
| Jira / Azure DevOps import | Paste the key in the title first |
| Chat / discussion board | Discussion stays in Teams/Zoom for v1 |
| WebSockets / Firestore live push | Polling is enough for 10–20 people |
| Public marketing landing | This is an internal tool |
| Full user accounts for every voter | Display name is enough |

### Cloud deploy (when local is stable)

1. Secrets in GCP Secret Manager: `MONGODB_URI`, `JWT_SECRET`, first-admin seed (used only if Atlas is empty).
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
