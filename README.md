# MotoYa — Ride-Sharing MVP for Nicaragua

> Uber Moto-style app built for the Nicaraguan market. Connects clients who need motorcycle rides with local riders.

---

## Why "MotoYa"?

**"Moto"** — mototaxi is the dominant short-distance transport in Nicaraguan cities (Managua, León, Masaya). Everyone takes motos.

**"Ya"** — colloquial Nicaraguan Spanish for "now / right away / already" (`ya vengo`, `ya voy`). It conveys immediacy and local identity.

Together: *"Moto, right now."* Simple, memorable, instantly understood by any Nicaraguan.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        MotoYa MVP                           │
├──────────────┬──────────────────────┬───────────────────────┤
│    Mobile    │      Backend API     │     Admin Panel       │
│  React Native│  Node.js + Express   │  React + Vite         │
│  Expo Router │  TypeScript          │  TypeScript           │
│  Google Maps │  Prisma + PostgreSQL │  TailwindCSS          │
│  Socket.io   │  Socket.io           │  Recharts             │
│  Client/Rider│  JWT Auth            │  React Hook Form      │
└──────────────┴──────────────────────┴───────────────────────┘
                          │
                   PostgreSQL (Docker)
```

**Data flow:**
```
Mobile App  ──REST──►  Express API  ──Prisma──►  PostgreSQL
Mobile App  ◄─WS──────  Socket.io  ◄──────────  PostgreSQL
Admin Panel ──REST──►  Express API
```

---

## Prerequisites

- **Node.js** 20+
- **Docker** & Docker Compose (for PostgreSQL)
- **Expo Go** app on your phone (for mobile)
- **npm** 9+ (included with Node 20)

Optional:
- Google Maps API key (for production maps; development works with mock provider)

---

## Project Structure

```
NicaYa/
├── backend/                 # Express REST API + Socket.io
│   ├── src/
│   │   ├── controllers/     # HTTP request handlers
│   │   ├── services/        # Business logic
│   │   ├── routes/          # Express routers
│   │   ├── middleware/       # Auth, roles, validation, errors
│   │   ├── sockets/         # Socket.io event handlers
│   │   ├── utils/           # JWT, password, response helpers
│   │   ├── validators/      # Zod schemas
│   │   └── types/           # TypeScript interfaces
│   ├── prisma/
│   │   ├── schema.prisma    # Database models
│   │   └── seed.ts          # Seed data
│   └── __tests__/           # Jest + Supertest integration tests
│
├── admin/                   # React admin panel
│   └── src/
│       ├── api/             # Axios instances and endpoints
│       ├── components/      # Reusable UI (Badge, Card, MetricCard)
│       ├── pages/           # One folder per route
│       ├── hooks/           # useAuth
│       └── utils/           # Formatting helpers
│
├── mobile/                  # Expo React Native
│   ├── app/
│   │   ├── _layout.tsx      # Root layout with auth guard
│   │   ├── auth/            # Login, Register screens
│   │   ├── client/          # Client tab navigator
│   │   └── rider/           # Rider tab navigator
│   ├── components/          # Button, Card, StatusBadge
│   ├── hooks/               # useAuth, useLocation
│   ├── services/            # API client, Socket.io
│   └── constants/           # Colors, endpoints
│
├── docker-compose.yml       # PostgreSQL containers
├── README.md
└── BEST_PRACTICES.md
```

---

## Local Setup

### Step 1 — Start the database

```bash
docker compose up -d db
```

Wait a few seconds for PostgreSQL to initialize.

### Step 2 — Backend

```bash
cd backend
cp .env.example .env
# Edit .env if needed (defaults work with docker-compose)

npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

The API will be available at `http://localhost:3000`.

### Step 3 — Admin Panel

```bash
cd admin
cp .env.example .env
npm install
npm run dev
```

Admin panel: `http://localhost:5173`

### Step 4 — Mobile App

```bash
cd mobile
npm install
npx expo start
```

- Scan the QR code with **Expo Go** (iOS/Android)
- Or press `i` for iOS simulator, `a` for Android emulator

**Important:** On a physical device, update `EXPO_PUBLIC_API_BASE_URL` in `app.json` `extra.apiBaseUrl` to your machine's local IP (e.g., `http://192.168.1.100:3000/api`).

---

## Seed Credentials

After running `npx prisma db seed`:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@motoya.com` | `admin123` |
| Client | `maria@example.com` | `client123` |
| Client | `carlos@example.com` | `client123` |
| Client | `ana@example.com` | `client123` |
| Rider (active subscription) | `juan.rider@example.com` | `rider123` |
| Rider (pending) | `pedro.rider@example.com` | `rider123` |
| Rider (expired subscription) | `luis.rider@example.com` | `rider123` |

---

## API Documentation

Base URL: `http://localhost:3000/api`

All responses follow: `{ "success": true/false, "data": {...} | "error": "..." }`

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register client or rider |
| POST | `/auth/login` | Login → returns access + refresh tokens |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Get current user (requires Bearer token) |

**Register body:**
```json
{
  "name": "Juan",
  "email": "juan@example.com",
  "phone": "+50588000000",
  "password": "secret123",
  "role": "CLIENT"  // or "RIDER"
}
```

### Trips (requires auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/trips` | List my trips (paginated) |
| POST | `/trips` | Create trip request (client) |
| PUT | `/trips/:id/accept` | Rider accepts a trip |
| PUT | `/trips/:id/status` | Update trip status |
| POST | `/trips/:id/rate` | Rate a completed trip |

**Create trip body:**
```json
{
  "originLat": 12.1364,
  "originLng": -86.2514,
  "originAddress": "Rotonda Güegüense",
  "destLat": 12.1504,
  "destLng": -86.2694,
  "destAddress": "Metrocentro",
  "negotiatedPrice": 40
}
```

### Riders (requires auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/riders/nearby?lat=&lng=` | Get nearby available riders |
| PUT | `/riders/availability` | Toggle availability (RIDER only) |
| PUT | `/riders/location` | Update GPS location (RIDER only) |

### Admin (requires ADMIN role)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/dashboard` | Metrics + charts |
| GET | `/admin/riders` | List riders (paginated) |
| PUT | `/admin/riders/:id/approve` | Approve rider |
| PUT | `/admin/riders/:id/status` | Set rider status |
| GET | `/admin/clients` | List clients |
| GET | `/admin/trips` | List all trips |
| PUT | `/admin/trips/:id/cancel` | Cancel a trip |
| GET | `/admin/config` | Get app config |
| PUT | `/admin/config` | Update config |
| POST | `/admin/subscriptions` | Activate rider subscription |
| GET | `/admin/subscriptions` | List subscriptions |

---

## Socket.io Events

Connect to `ws://localhost:3000` with `{ auth: { token: "<accessToken>" } }`.

| Event | Direction | Payload |
|-------|-----------|---------|
| `trip:new` | Server → Client (all) | `{ trip }` |
| `trip:accepted` | Server → Client (all) | `{ trip }` |
| `trip:status_changed` | Server → Client (all) | `{ trip }` |
| `rider:location` | Client → Server | `{ lat, lng }` |
| `rider:location` | Server → Clients | `{ riderId, lat, lng }` |

---

## How to Run Tests

### Backend tests

Requires the test DB (`docker compose up -d db_test`) and a `.env` with `DATABASE_URL_TEST`.

```bash
cd backend
npm test
# or with coverage
npm run test:coverage
```

Tests cover:
- `POST /api/auth/register` — success, duplicate, validation
- `POST /api/auth/login` — success, wrong password, unknown email
- `GET /api/auth/me` — auth required
- `POST /api/trips` — create, validation, auth
- `PUT /api/trips/:id/accept` — accept flow, already accepted
- `GET /api/trips` — listing

---

## Pricing Formula

Suggested price = `C$20 base + C$5 per km`

Distance is calculated using the Haversine formula between origin and destination coordinates.

---

## Subscription Model

- Monthly fee: **C$500** (configurable via admin panel)
- Riders with `subscriptionStatus !== 'ACTIVE'` cannot:
  - Accept trip requests (403 on `/trips/:id/accept`)
  - Toggle availability to `true`
- Admin manually activates subscriptions via the admin panel

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20, Express 4, TypeScript 5 |
| ORM | Prisma 5 + PostgreSQL 15 |
| Real-time | Socket.io 4 |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Validation | Zod |
| Mobile | React Native 0.85, Expo SDK 56 |
| Routing (mobile) | Expo Router v4 |
| Maps | react-native-maps + Google Maps |
| Admin | React 19, Vite 6, TailwindCSS v4 |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Database | PostgreSQL 15 (Docker) |
| Tests | Jest, Supertest |
