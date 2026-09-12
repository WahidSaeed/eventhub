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

`MONGO_URI` is set by supervisord inside the container and does not need to be
correct in the env file you pass in.

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

39 tests cover signup and login, session cookies, role enforcement, listing
filters, event validation, RSVP capacity, duplicate RSVPs, waitlist promotion on
cancellation, and concurrent bookings for the last place. They run against an in-memory MongoDB that
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
| `PORT` | no | Port Express listens on. Defaults to 3000. |
| `MONGO_URI` | no | Mongo connection string. Supervisord sets this in the container. |
| `JWT_SECRET` | **yes** | Signs session tokens. The server refuses to start without it. Use a long random string. |
| `GOOGLE_MAPS_API_KEY` | no | Server-side key for the Geocoding API. Kept secret, never sent to the browser. |
| `GOOGLE_MAPS_BROWSER_KEY` | no | Client-side key for the Maps JS API, served to the browser by `/api/config`. |
| `SENDGRID_API_KEY` | no | Sends RSVP confirmation emails. |
| `SENDGRID_FROM_EMAIL` | no | Verified sender address for those emails. |
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
| GET | `/api/events` | Public | List events. `?category=&date=&search=&past=true` |
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

The interface follows `design-mockup-v3.html`, a printed festival programme rather
than a dashboard. Events are one column, grouped by day, numbered continuously,
with a dotted leader joining each name to its start time and price. The palette is
paper, ink and a single teal accent used only for interactive or informational
moments. Type is Archivo for headings and controls, Source Serif 4 for body copy.

Tokens live in `frontend/src/assets/main.css` as CSS custom properties and are
mirrored into `frontend/tailwind.config.js`, so change them in both places. Motion
is off by default; the one exception is the RSVP confirmation, which respects
`prefers-reduced-motion`.

Category filtering and search sit in the rail under the masthead as borderless
underline controls, rather than in a boxed filter panel, so the listing keeps
reading as a printed page. Account links sit in the masthead corner to keep that
rail to one line.

Below 640px the dotted leader is hidden, the time and price stack under the event
name, and the vertical edition marker is dropped so its 68px gutter returns to
content.

### Two decisions where the plan and the mockup disagreed

The mockup was treated as the authority in both cases, since section 10 defines
done as matching it.

- **Tracked-out ALL-CAPS labels.** Section 4 bans them, but the mockup uses them
  for the teal row tag and the vertical edition marker. The mockup won, so that
  rule is deliberately overridden in those two places only.
- **Price.** The mockup shows a price on every row but the section 2 schema has no
  such field, so `price` was added to the Event model, the create and update
  routes, the admin form and the seed data.

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
docs/        The approved design mockup and the original build plan
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
