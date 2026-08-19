# Planning Poker

Internal sprint estimation tool. Facilitators (BA / PO / SM) create a room; the team joins with a link and votes **in hours** (7 hours = 1 working day).

Full write-up (what shipped, local test checklist, later features): [docs/v1-implementation-and-plan.md](docs/v1-implementation-and-plan.md).

## Local setup

**Need:** Node.js 22.22.1 or newer, and a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) connection string.

1. Copy env and set your Atlas URI plus the first admin (**email, password, and name are all required**):

```bash
copy server\.env.example server\.env
```

In `server\.env` set `MONGODB_URI`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME`.

2. Install and run (two terminals):

```bash
cd F:\Karthik\Projects\planning-poker\server
npm install
npm start
```

```bash
cd F:\Karthik\Projects\planning-poker
npm install
npm start
```

3. Open `http://localhost:4200/admin` and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.
4. Create a room, copy the link, open it in a private window as a voter.

The first API start creates the admin **only if** the `admins` collection is empty. Extra admins:

```bash
cd server
node scripts/add-admin.js --email ba@company.com --password "StrongPass!" --name "Anita"
```

## How it works

- `/` — join with a room code and display name
- `/admin` — facilitator login, create rooms, list live rooms
- `/room/:code` — vote board
- Rooms expire after **3 hours**
- Cards stay disabled until the facilitator starts voting
- Deck is **hours**, not story points: `7, 14, 21, 28, 35, 42, 49` (7h = 1 day)
- Voters can **Leave table**; the facilitator can **Remove** a leftover seat
- No story title in v1 — call out the ticket in the meeting, then vote

