# Build Plan: EventHub (The Running Order)
### For Claude Code — build the full project in a single Docker container

This file is the instruction set for Claude Code to build, wire up, and containerize the entire application end-to-end. Follow the phases in order. Each phase should be a working, testable checkpoint before moving to the next.

---

## 0. What you're building

**The Running Order** — an event planning platform. Admins create/manage events; users browse, filter, and RSVP. Google Maps shows venue locations; SendGrid sends RSVP confirmations.

**Everything runs in one Docker container:**
- Node.js/Express backend (API + serves the built frontend as static files)
- MongoDB running as a background process inside the same container (via supervisord)
- Vue.js frontend, built at image-build time and served by Express — no separate frontend server, no docker-compose, one exposed port.

If at any point running Mongo and Node as two processes in one container becomes painful, the fallback is to swap MongoDB for SQLite (via `better-sqlite3` or Prisma) to remove the second process entirely — flag this to the user as a tradeoff rather than deciding silently.

---

## 1. Repository layout

```
eventhub/
├── backend/
│   ├── config/db.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── eventController.js
│   │   ├── rsvpController.js
│   │   └── userController.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   └── roleMiddleware.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Event.js
│   │   └── RSVP.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── eventRoutes.js
│   │   ├── rsvpRoutes.js
│   │   └── userRoutes.js
│   ├── services/
│   │   ├── emailService.js       # SendGrid
│   │   └── geocodeService.js     # Google Maps Geocoding
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   │   └── main.css          # Tailwind layers + design tokens (see §4)
│   │   ├── components/
│   │   │   ├── NavBar.vue
│   │   │   ├── RunningOrderRow.vue   # the listing row (§4)
│   │   │   ├── DayGroup.vue
│   │   │   ├── EventMap.vue
│   │   │   └── RsvpForm.vue
│   │   ├── views/
│   │   │   ├── HomeView.vue
│   │   │   ├── LoginView.vue
│   │   │   ├── SignupView.vue
│   │   │   ├── EventDetailView.vue
│   │   │   ├── DashboardView.vue
│   │   │   └── AdminPanelView.vue
│   │   ├── store/
│   │   │   ├── auth.js
│   │   │   └── events.js
│   │   ├── router/index.js
│   │   ├── services/api.js
│   │   ├── App.vue
│   │   └── main.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── package.json
├── docker/
│   └── supervisord.conf
├── Dockerfile
├── .dockerignore
└── README.md
```

---

## 2. Database schema (MongoDB / Mongoose)

**User**
```js
{
  name: String,
  email: { type: String, required: true, unique: true },
  passwordHash: String,
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  createdAt: Date
}
```

**Event**
```js
{
  title: String,
  description: String,
  category: String,               // music, food, conference, community...
  date: Date,
  startTime: String,
  endTime: String,
  venueName: String,
  address: String,
  location: { lat: Number, lng: Number },   // from Geocoding API
  capacity: Number,
  createdBy: { type: ObjectId, ref: 'User' },
  createdAt: Date
}
```

**RSVP**
```js
{
  event: { type: ObjectId, ref: 'Event' },
  user: { type: ObjectId, ref: 'User' },
  status: { type: String, enum: ['confirmed', 'waitlisted', 'cancelled'] },
  guestsCount: Number,
  createdAt: Date
}
```

---

## 3. API routes

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | Public | Register |
| POST | `/api/auth/login` | Public | Login, returns JWT (httpOnly cookie) |
| GET | `/api/events` | Public | List events, `?category=&date=&search=` |
| GET | `/api/events/:id` | Public | Event detail |
| POST | `/api/events` | Admin | Create event (runs geocode on address) |
| PUT | `/api/events/:id` | Admin | Update event |
| DELETE | `/api/events/:id` | Admin | Delete event |
| POST | `/api/events/:id/rsvp` | User | RSVP (confirmed/waitlisted by capacity) |
| DELETE | `/api/rsvps/:id` | User | Cancel RSVP |
| GET | `/api/users/me/dashboard` | User | Own RSVPs |
| PUT | `/api/users/me` | User | Update profile |
| GET | `/api/admin/reports` | Admin | Aggregate stats |

---

## 4. Design system (apply consistently across every view)

The approved direction is **"The Running Order"** — a printed festival-program aesthetic, not a SaaS dashboard look. Do not deviate into rounded-card grids, stock photography, or generic hero sections. Reference mockup: `design-mockup-v3.html` (already approved by the user).

**Tokens** — add these as CSS custom properties in `frontend/src/assets/main.css`, and register them as Tailwind theme colors in `tailwind.config.js`:

```css
:root{
  --paper:#EDEAE1;
  --ink:#1B1B1B;
  --ink-soft:#4A4A46;
  --teal:#2F5D62;
  --rule:#D8D3C6;
}
```

```js
// tailwind.config.js theme.extend.colors
colors: {
  paper: '#EDEAE1',
  ink: '#1B1B1B',
  'ink-soft': '#4A4A46',
  teal: '#2F5D62',
  rule: '#D8D3C6',
}
```

**Type** — load via Google Fonts in `index.html`:
- `Archivo` (weights 500/700/800) — masthead, day headers, nav, buttons, labels
- `Source Serif 4` (weights 400/500, plus italic 400) — body copy, event names

**Layout rules**
- No rounded-corner card grids. Events render as a single-column, day-grouped **listing** with dotted leader lines connecting name → time/price (see `.row`, `.leader` in the mockup).
- Numbered entries are fine — the content is a genuine chronological sequence.
- No stock photography on the homepage/listing. If an event image is needed on the detail page, keep it small and documentary, not a hero banner.
- One accent color (`--teal`) used only for interactive/informational moments (links, tags, active nav) — never as decoration.
- **No em-dashes, no middle-dot separators, no `→` arrows appended to links/buttons, no tracked-out ALL-CAPS eyebrow labels.**
- Motion: none by default. If adding any, it must be a single deliberate moment (e.g. RSVP confirmation), never hover effects scattered across every element.

**Component mapping from mockup → Vue components**
- `.masthead` + `.subbar` → `NavBar.vue`
- `.day` block → `DayGroup.vue`, receiving a date and its events
- `.row` → `RunningOrderRow.vue`, props: event object
- `.vol-marker` → static element in `NavBar.vue` or `HomeView.vue`, not repeated on every page

Build `AdminPanelView.vue` and `DashboardView.vue` in the same visual language (paper background, Archivo headers, teal accent, hairline rules) — do not switch to a different "admin dashboard" template style.

---

## 5. Dockerfile (single container, multi-stage)

```dockerfile
# ---- Stage 1: build frontend ----
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: backend + mongo + supervisor ----
FROM node:20-slim
RUN apt-get update && apt-get install -y \
    gnupg curl supervisor \
    && curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] http://repo.mongodb.org/apt/debian bullseye/mongodb-org/7.0 main" > /etc/apt/sources.list.d/mongodb-org-7.0.list \
    && apt-get update && apt-get install -y mongodb-org \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /data/db

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./

# Built frontend served as static files by Express
COPY --from=frontend-build /app/frontend/dist ./public

COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 3000
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
```

## 6. supervisord.conf

```ini
[supervisord]
nodaemon=true

[program:mongod]
command=mongod --dbpath /data/db --bind_ip 127.0.0.1
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:node]
command=node server.js
directory=/app/backend
autostart=true
autorestart=true
environment=MONGO_URI="mongodb://127.0.0.1:27017/eventhub"
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

`server.js` must serve the frontend build for any non-`/api` route:
```js
app.use(express.static(path.join(__dirname, 'public')));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
```

## 7. Environment variables (`backend/.env.example`)

```
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/eventhub
JWT_SECRET=replace_with_a_long_random_string
GOOGLE_MAPS_API_KEY=
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
NODE_ENV=production
```

`GOOGLE_MAPS_API_KEY` is needed twice: server-side (Geocoding, kept secret) and a **separate, HTTP-referrer-restricted** client-side key injected into the frontend build for the Maps JS API. Do not reuse the same unrestricted key on the client.

---

## 8. Build order (do these phases in sequence, verify each before moving on)

1. **Backend skeleton** — Express app, MongoDB connection via Mongoose, `User` model, JWT signup/login, bcrypt hashing, auth middleware. Test with curl/Postman before touching the frontend.
2. **Event CRUD** — model + admin-protected routes. Add `geocodeService.js` so creating an event resolves `address` → `{lat,lng}`.
3. **Public event routes** — listing with `category`/`date`/`search` query filtering.
4. **RSVP logic** — model + routes, capacity check → `confirmed` vs `waitlisted`.
5. **Frontend scaffold** — Vite + Vue 3 + Vue Router + Pinia + Tailwind, wire up design tokens and fonts from §4 first, before building any view.
6. **Auth views** — Login/Signup, Pinia auth store, route guards for admin/user.
7. **Home/listing view** — `NavBar`, `DayGroup`, `RunningOrderRow`, matching the approved mockup exactly. This is the highest-visibility screen — don't drift from the design system here.
8. **Event detail view** — includes `EventMap.vue` (Google Maps JS API) and RSVP form.
9. **User dashboard** — past/upcoming RSVPs, profile update, same visual language.
10. **Admin panel** — event CRUD UI, reports/analytics, same visual language (no template-switch to a generic admin theme).
11. **SendGrid integration** — RSVP confirmation email on `POST /api/events/:id/rsvp`.
12. **Responsive pass** — Tailwind breakpoints (`sm:`/`md:`/`lg:`), verify the listing layout collapses sensibly on mobile (stack `.col-end` under `.col-main` rather than shrinking the leader line to nothing).
13. **Dockerize** — write `Dockerfile`, `docker/supervisord.conf`, `.dockerignore` (exclude `node_modules`, `.env`, `dist`). Build and run locally:
    ```
    docker build -t eventhub .
    docker run -p 3000:3000 --env-file backend/.env eventhub
    ```
    Confirm `http://localhost:3000` serves the app and `/api/events` responds.
14. **README** — setup/run instructions, prerequisites, env var list, Docker build/run commands, deployment notes.

---

## 9. Security checklist (verify before calling it done)

- [ ] Passwords hashed with bcrypt, never stored/logged in plaintext
- [ ] JWT in httpOnly cookie, not localStorage
- [ ] Admin routes behind role middleware
- [ ] Input validation (`express-validator`) on all write routes
- [ ] `.env` in `.dockerignore` and `.gitignore` — never baked into the image
- [ ] CORS restricted to the app's own origin (frontend and backend share one origin here, so this can be strict)
- [ ] Rate limiting on `/api/auth/*`

---

## 10. Definition of done

- `docker build` succeeds from a clean checkout with no manual steps beyond providing `.env`
- `docker run` starts Mongo + Express together and the app is reachable on one port
- Sign up, log in, browse/filter events, RSVP, cancel RSVP, and admin CRUD all work end-to-end
- Homepage visually matches the approved "Running Order" mockup — no reversion to a generic card-grid layout
- No em-dashes, middle-dot separators, or arrow-suffixed links anywhere in the UI copy