# MotoYa — Best Practices & Architecture Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Folder Conventions](#folder-conventions)
3. [Code Standards](#code-standards)
4. [Error Handling](#error-handling)
5. [Validations](#validations)
6. [Security & Auth](#security--auth)
7. [Database & Migrations](#database--migrations)
8. [Testing](#testing)
9. [Environment Variables](#environment-variables)
10. [Logging](#logging)
11. [Frontend Best Practices](#frontend-best-practices)
12. [Backend Best Practices](#backend-best-practices)
13. [Mobile Best Practices](#mobile-best-practices)
14. [How to Run](#how-to-run)
15. [How to Test](#how-to-test)

---

## Architecture Overview

MotoYa follows a monorepo layout with three independent workspaces:

```
NicaYa/
├── backend/    Node.js + Express + TypeScript + PostgreSQL + Prisma + Socket.io
├── mobile/     React Native (Expo) — universal client/rider app
├── admin/      React + Vite + TypeScript + TailwindCSS admin panel
```

**Communication patterns:**
- REST API over HTTPS for all CRUD operations
- Socket.io (WebSocket with fallback) for real-time trip updates
- JWT (access + refresh tokens) for stateless auth

**Principle of separation:**
- Each workspace has its own `package.json`, `.env`, and build pipeline
- The backend is the single source of truth for business logic
- Mobile and admin are pure consumers of the API

---

## Folder Conventions

### Backend
```
src/
├── controllers/   One controller per resource. No business logic — only request/response shaping
├── services/      All business logic, DB calls, external integrations
├── routes/        Express Router definitions. Thin wiring: route → middleware → controller
├── middleware/     Auth, role guards, error handler, request logger
├── validators/    Zod schemas for request body/params/query validation
├── utils/         Pure helpers: JWT, hashing, response factory, logger
├── sockets/       Socket.io event handlers
├── types/         Shared TypeScript types and enums
```

### Admin
```
src/
├── api/           Axios instances and endpoint functions (no fetch calls in components)
├── components/    Reusable UI components (Button, Card, Table, Badge, Modal)
├── pages/         One folder per route. Each page owns its data fetching
├── hooks/         Custom React hooks (useAuth, usePagination, useToast)
├── types/         TypeScript interfaces mirroring backend models
├── utils/         Date formatting, currency formatting, etc.
```

### Mobile
```
app/
├── (auth)/        Unauthenticated screens (login, register)
├── (client)/      Client-role tab navigator screens
├── (rider)/       Rider-role tab navigator screens
components/        Shared UI components
hooks/             useAuth, useLocation, useSocket, useTrip
services/          api.ts (Axios), socket.ts (Socket.io client)
utils/             storage, formatting, permissions
constants/         Colors, sizes, endpoints
```

---

## Code Standards

### TypeScript
- `strict: true` in all `tsconfig.json` files
- No `any` — use `unknown` and type-narrow instead
- Prefer interfaces over type aliases for objects
- Use `readonly` for properties that should not be mutated
- Export types from a central `types/index.ts` in each workspace

### Naming
- Files: `kebab-case.ts` (e.g., `trip.service.ts`)
- Classes/Interfaces/Types: `PascalCase`
- Variables/functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Database fields: `camelCase` (Prisma default)
- REST routes: `kebab-case` (e.g., `/api/active-trips`)

### Imports
- Always use absolute imports (via `tsconfig.json` `paths` or `baseUrl`)
- Group: 1) Node built-ins, 2) third-party, 3) internal — separated by blank lines

### Git
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`
- Feature branches: `feature/TICKET-description`
- Never commit `.env` — only `.env.example`

---

## Error Handling

### API response shape
Every endpoint returns a consistent envelope:
```json
{ "success": true,  "data": { ... } }
{ "success": false, "error": "Human-readable message", "code": "OPTIONAL_CODE" }
```

### Backend
- A centralized `error.middleware.ts` catches all errors
- Custom `AppError` class carries `statusCode` and `message`
- Zod validation errors are converted to 400 with field-level details
- Never expose stack traces in production (`NODE_ENV !== 'development'`)
- All async route handlers are wrapped with `asyncHandler` to avoid try/catch boilerplate

### Mobile
- Axios interceptor converts errors to typed `ApiError` objects
- Each screen shows an inline error state (not alert dialogs) for non-critical errors
- Network errors show a retry button

### Admin
- Axios interceptor handles 401 → triggers token refresh or redirects to `/login`
- Toast notifications for user-facing errors (react-hot-toast or sonner)

---

## Validations

- Use **Zod** for all input validation (backend and admin forms via `@hookform/resolvers/zod`)
- Validate at the route level before hitting the controller
- Client-side validation is UI-only; server always re-validates
- Validate env vars at startup with Zod (`src/config.ts`) — fail fast if required vars are missing

---

## Security & Auth

### JWT Strategy
- **Access token**: short-lived (15 minutes), signed with `JWT_SECRET`
- **Refresh token**: long-lived (30 days), signed with `JWT_REFRESH_SECRET`, stored in DB
- Never store tokens in `localStorage` in the admin panel — use `httpOnly` cookies or memory + silent refresh
- Mobile stores refresh token in `SecureStore` (Expo), access token in memory

### Password
- Bcrypt with `saltRounds = 12`
- Never log or return `passwordHash`

### Middleware layering (backend)
```
route → authenticateJWT → requireRole([...]) → validate(schema) → controller
```

### CORS
- Explicit `origin` allowlist (no `*` in production)
- Allowed origins: admin panel URL + mobile deep-link scheme

### Subscription Guard
- Riders with `subscriptionStatus !== 'ACTIVE'` receive `403 SUBSCRIPTION_REQUIRED` on all `/api/trips/*` write operations

### Rate limiting
- `express-rate-limit` on auth routes: 10 requests / 15 min per IP

---

## Database & Migrations

### Prisma workflow
```bash
# Create a migration
npx prisma migrate dev --name describe_change

# Apply to production
npx prisma migrate deploy

# Seed
npx prisma db seed

# Prisma Studio (GUI)
npx prisma studio
```

### Rules
- Never modify existing migration files
- Always run `prisma generate` after schema changes
- Use `prisma migrate dev` in development, `prisma migrate deploy` in CI/production
- Seed data lives in `prisma/seed.ts` and is idempotent (`upsert` over `create`)

### Naming
- Table names: plural snake_case (Prisma maps by default)
- Indexes: on all foreign keys and frequently queried fields (`lat/lng`, `status`, `createdAt`)

---

## Testing

### Backend (Jest + Supertest)
- Unit tests for services and utils (`*.spec.ts` co-located or in `__tests__/`)
- Integration tests for routes using Supertest against a test database
- Use `DATABASE_URL_TEST` env var for isolated test DB
- Seed test DB in `beforeAll`, clean in `afterAll`
- Target: > 80% coverage on services and controllers

### Mobile (Jest + React Native Testing Library)
- Unit test pure utils and hooks
- Component tests with `@testing-library/react-native`
- Mock Expo modules with jest preset

### Admin (Vitest + Testing Library)
- Component tests with `@testing-library/react`
- Mock Axios with `msw` (Mock Service Worker)

---

## Environment Variables

### Backend `.env`
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Access token signing secret |
| `JWT_REFRESH_SECRET` | Refresh token signing secret |
| `PORT` | HTTP server port (default 3000) |
| `NODE_ENV` | `development` / `production` / `test` |
| `FRONTEND_URL` | Admin panel origin for CORS |

### Admin `.env`
| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend API base URL |

### Mobile `.env` (via `app.config.ts`)
| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Backend API base URL |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps key |

### Rules
- Load with `dotenv` (backend) / Vite built-in (admin) / `expo-constants` (mobile)
- Validate all required vars at startup — throw if missing
- Never commit `.env`; always commit `.env.example` with placeholder values

---

## Logging

- Use a structured logger (e.g., `pino` or `winston`) in the backend — not `console.log`
- Log levels: `error`, `warn`, `info`, `debug`
- Include: `requestId`, `userId`, `method`, `path`, `statusCode`, `durationMs`
- In production, log to stdout in JSON format (for log aggregators like Datadog / CloudWatch)
- Never log sensitive data: passwords, tokens, PII

---

## Frontend Best Practices (Admin)

- State management: React Query (`@tanstack/react-query`) for server state; local `useState` for UI state — no Redux
- Never fetch data directly in components; always through custom hooks or React Query
- All forms use `react-hook-form` + Zod resolver
- Tables support pagination, sorting, and filter state in URL params
- Accessible: all interactive elements have `aria-label` or visible labels; keyboard-navigable

---

## Backend Best Practices

- Controllers are thin: validate → call service → return response
- Services handle all DB logic and business rules
- Avoid N+1 queries: use Prisma `include` / `select` judiciously
- Use database transactions for multi-step writes
- Pagination: all list endpoints accept `page` (default 1) and `limit` (default 20, max 100)
- Never expose internal IDs in URLs where UUIDs can be used instead

---

## Mobile Best Practices

- Request location permission before showing map; handle denial gracefully
- Debounce location updates: send to server at most every 5 seconds when a trip is active
- Offline state: show a banner if network is unavailable; queue non-critical actions
- Large touch targets: minimum 48x48 dp for all interactive elements
- Avoid heavy computation on the JS thread; use `InteractionManager` for post-animation work
- Images: lazy-load with `expo-image`; cache with proper headers

---

## How to Run

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Expo CLI (`npm install -g expo-cli`)

### 1. Start PostgreSQL
```bash
docker compose up -d db
```

### 2. Backend
```bash
cd backend
cp .env.example .env   # fill in values
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

### 3. Admin Panel
```bash
cd admin
cp .env.example .env   # fill VITE_API_BASE_URL
npm install
npm run dev
```

### 4. Mobile
```bash
cd mobile
npm install
npx expo start
# Scan QR with Expo Go app
```

---

## How to Test

### Backend
```bash
cd backend
npm test              # all tests
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

### Admin
```bash
cd admin
npm test
```

### Mobile
```bash
cd mobile
npm test
```
