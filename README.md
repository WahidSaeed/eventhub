# The Running Order

An event planning platform. Admins publish a programme of events; visitors browse
it, filter it, and reserve places. Google Maps places each venue, SendGrid sends
the RSVP confirmation.

The whole application runs in **one Docker container**: Express serves the API and
the built Vue frontend, and MongoDB runs alongside it under supervisord. One
exposed port, no docker-compose.

## Prerequisites

- Docker, for the containerised run
- Node.js 20 or newer and a local MongoDB, for running outside Docker

## Quick start with Docker

```bash
cp backend/.env.example backend/.env   # then edit it, see below
docker build -t eventhub .
docker run -p 3000:3000 --env-file backend/.env eventhub
```

The app is then at http://localhost:3000 and the API at http://localhost:3000/api/events.

`MONGO_URI` and `PORT` are set by supervisord inside the container, so the
values in the env file you pass in are ignored there. Node always listens on
3000 in the container, even with `PORT=3100` left in `.env` for local development.

To keep the database between runs, mount a volume:

```bash
docker run -p 3000:3000 --env-file backend/.env -v eventhub-data:/data/db eventhub
```

### Creating the first admin

Signup always produces a regular user, so the first admin is created by the seed
script inside the running container:

```bash
docker exec -it <container-id> node scripts/seed.js
```

That creates `admin@runningorder.test` with password `changeme123` plus the six
Berlin events from the design mockup, then prints them. Sign in and change the password immediately.
Use `--admin-only` to skip the sample events, or set `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD` to choose your own credentials. The script is safe to
re-run: existing records are left alone.

## Running locally without Docker

Two terminals, with MongoDB already running on port 27017.

```bash
# Terminal 1
cd backend
cp .env.example .env        # set JWT_SECRET at minimum
npm install
npm run seed                # first admin and sample events
npm run dev

# Terminal 2
cd frontend
npm install
npm run dev                 # http://localhost:5173, proxies /api to the backend
```

The Vite dev server proxies `/api` to `http://localhost:3100`, so set `PORT=3100`
in `backend/.env` for local development, or change the proxy target in
`frontend/vite.config.js` to match your port.

## Tests

```bash
cd backend
npm test
```

46 tests cover signup and login, session cookies, role enforcement, listing
filters, pagination, event validation, RSVP capacity, duplicate RSVPs, waitlist
promotion on cancellation, and concurrent bookings for the last place. They run against an in-memory MongoDB that
`mongodb-memory-server` downloads on first use, so no database needs to be
running. To use a real server instead, set `TEST_MONGO_URI`; its database name
must contain `test`, because the suite wipes it.

The harness clears the SendGrid and Google keys before loading the app, so a
test run never sends mail or spends geocoding quota, even with a populated
`.env`.

## Environment variables

Set in `backend/.env`. See `backend/.env.example`.

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | no | Port Express listens on. Defaults to 3000. Supervisord fixes it at 3000 in the container. |
| `MONGO_URI` | no | Mongo connection string. Supervisord sets this in the container. |
| `JWT_SECRET` | **yes** | Signs session tokens. The server refuses to start without it. Use a long random string. |
| `GOOGLE_MAPS_API_KEY` | no | Server-side key for the Geocoding API. Kept secret, never sent to the browser. |
| `GOOGLE_MAPS_BROWSER_KEY` | no | Client-side key for the Maps JS API, served to the browser by `/api/config`. |
| `SENDGRID_API_KEY` | no | Sends RSVP confirmation emails. |
| `SENDGRID_FROM_EMAIL` | no | Verified sender address for those emails. |
| `APP_URL` | no | Public address of the app, for example `https://events.example.com`. Adds a View event button to confirmation emails. |
| `NODE_ENV` | no | Set to `production` in deployment. Also makes session cookies secure-only. |
| `AUTH_RATE_LIMIT_MAX` | no | Sign-in and signup attempts allowed per IP per 15 minutes. Defaults to 20. |

The two Google keys are deliberately separate. The geocoding key stays on the
server and should be restricted by API. The browser key is public by nature and
must be restricted by HTTP referrer to your own domain. Do not use one
unrestricted key for both.

Every optional integration degrades quietly. With no Maps key the detail page says
the venue is not on the map; with no SendGrid key the RSVP still succeeds and the
email is skipped.

## API

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | Public | Register, returns a session cookie |
| POST | `/api/auth/login` | Public | Sign in, returns a session cookie |
| POST | `/api/auth/logout` | User | Clear the session |
| GET | `/api/auth/me` | Public | Current user, or null |
| GET | `/api/events` | Public | List events. `?category=&date=&search=&past=true&order=asc\|desc&page=&limit=` |
| GET | `/api/events/:id` | Public | Event detail, including your own RSVP when signed in |
| POST | `/api/events` | Admin | Create an event, geocoding the address |
| PUT | `/api/events/:id` | Admin | Update an event, re-geocoding only if the address changed |
| DELETE | `/api/events/:id` | Admin | Delete an event and its RSVPs |
| POST | `/api/events/:id/rsvp` | User | Reserve places, confirmed or waitlisted by capacity |
| DELETE | `/api/rsvps/:id` | User | Cancel an RSVP, promoting the waitlist |
| GET | `/api/users/me/dashboard` | User | Your upcoming and past RSVPs |
| PUT | `/api/users/me` | User | Update your name, email or password |
| GET | `/api/admin/reports` | Admin | Aggregate statistics |
| GET | `/api/config` | Public | Browser Maps key for the frontend |
| GET | `/api/health` | Public | Liveness check |

### Pagination

`GET /api/events` returns every matching event unless `limit` is given, which is
what the public listing relies on. With `limit` (1 to 100) and optionally `page`
(from 1), the response gains a `pagination` block:

```json
{ "events": [...], "pagination": { "page": 2, "pages": 3, "limit": 10, "total": 23 } }
```

A page past the end is clamped to the last page rather than returning an empty
list, so the editor recovers when deleting the final entry on its last page. The
totals respect the same filters as the results. The editor lists the archive
newest first with `order=desc`, ten entries per page.

### Price

`price` is a number in the listing currency, added beyond the original schema to
match the mockup. Zero, which is also the default, renders as `Free`.

### Capacity and the waitlist

An event's `capacity` counts guests, not bookings, and `0` means no limit. An RSVP
is confirmed when the party fits in the places left and waitlisted when it does
not. Cancelling an RSVP promotes the oldest waitlisted parties that now fit, in
order. A party too large for the freed space is skipped, so it does not block
smaller parties behind it.

Places are claimed with a single conditional update on the event's
`confirmedGuests` counter, so the capacity check and the booking cannot be split
by another request. Without that, two people booking the last place at the same
moment were both confirmed. The standalone `mongod` in the container has no
replica set, which rules out multi-document transactions, hence the counter.
Events from before the counter existed are backfilled from their RSVPs on first
use.

### Dates

Event dates are calendar days stored as UTC midnight, and every part of the app
reads them in UTC. Mixing in local time put Berlin events on the previous UTC day,
so filtering by the date shown on the listing returned nothing.

## Design

The interface is a clean, card-based event app in the style of modern event
platforms such as Luma: a soft grey canvas with a faint colour wash at the top,
white rounded cards, the Inter typeface, and dark buttons with subtle hover
states. It replaces the original printed-programme direction from
`docs/design-mockup-v3.html`, which is kept in `docs/` for reference.

- **Discover** (`/`) lists events on a timeline: the date and weekday sit in a
  sticky left column joined by a dashed rail, and each event is a card with its
  time, venue, price and availability badges and a square cover. Upcoming and
  Past tabs, live search, a date picker and category chips filter the list.
- **Event page** puts a large cover, the host and attendance on the left, and
  the title, a date tile, the venue, a registration card, the description and
  the map on the right. On phones the columns stack with the cover first.
- **Your events** uses the same timeline for the visitor's own RSVPs, with
  Going or Waitlist badges and a cancel action, followed by account settings.
- **Editor** has stat cards, an event form with a live cover preview, a compact
  paginated event list with edit and delete actions, and report cards.

Events have no uploaded images, so `Cover.vue` draws each cover as a gradient
chosen from the event's category, varied per event, with the category icon on
top. Categories, their labels, icons and gradients live in
`frontend/src/utils/categories.js`.

Tokens are CSS custom properties in `frontend/src/assets/main.css`, mirrored in
`frontend/tailwind.config.js` as `canvas`, `ink`, `ink-2`, `ink-3` and `line`,
so change them in both places. Shared pieces such as `.btn`, `.card`, `.chip`,
`.tabs`, `.badge` and `.input` are defined there as Tailwind components. The
only animation is the RSVP confirmation, and it respects
`prefers-reduced-motion`.

## Security

- Passwords are hashed with bcrypt at cost 12 and never logged
- Sessions are JWTs in an httpOnly cookie, not localStorage, so page scripts cannot read them
- Cookies are `sameSite=lax` and become secure-only when `NODE_ENV=production`
- Admin routes sit behind role middleware, checked server side on every request
- All write routes validate input with express-validator
- `/api/auth/*` is rate limited to 20 attempts per 15 minutes per IP
- Login gives the same error for an unknown email and a wrong password, so the endpoint cannot be used to enumerate accounts
- CORS is only enabled outside production, for the Vite dev server. In the container the frontend and API share an origin
- `.env` is in `.dockerignore` and `.gitignore` and is never baked into the image

## Project layout

```
backend/     Express API, Mongoose models, JWT auth, SendGrid and Geocoding services
  app.js     The Express app, importable without a database or port
  server.js  Connects to MongoDB and starts listening
  tests/     node:test suite, run with npm test
docs/        The original design mockup and build plan, kept for reference
frontend/    Vue 3, Vue Router, Pinia, Tailwind, built by Vite
docker/      supervisord config running mongod and node together
Dockerfile   Multi-stage: builds the frontend, then the runtime image
```

## Deployment notes

- Provide `JWT_SECRET` as a real secret, not from a file baked into the image
- Set `NODE_ENV=production` so session cookies are secure-only, which requires serving over HTTPS
- Mount a volume at `/data/db`, otherwise the database is lost when the container is replaced
- Restrict the browser Maps key by HTTP referrer to the deployed domain before going live
- This image runs the database next to the app, which suits a single-node deployment or a course project. For anything that must survive the container or scale past one instance, point `MONGO_URI` at a managed MongoDB and drop the `mongod` program from `docker/supervisord.conf`
