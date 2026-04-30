# SYT Marketplace

A production-ready classifieds marketplace web app — buyers and sellers post listings,
search/filter the feed, save favorites, and chat in real time.

**Stack:** React 18 + TypeScript (Vite) · Node.js + Express · MongoDB (Mongoose) · Socket.IO · JWT auth

---

## Folder structure

```
SYT/
├── backend/
│   ├── src/
│   │   ├── config/             # env loader, db connection
│   │   ├── controllers/        # HTTP handlers (thin)
│   │   ├── services/           # business logic
│   │   ├── repositories/       # data access (Mongoose)
│   │   ├── models/             # Mongoose schemas
│   │   ├── routes/             # express routers
│   │   ├── middleware/         # auth, validate, errors, rate limit, upload
│   │   ├── validators/         # express-validator chains
│   │   ├── sockets/            # Socket.IO chat handlers
│   │   ├── utils/              # AppError, jwt, asyncHandler, response
│   │   ├── app.js              # express app
│   │   └── server.js           # http + socket bootstrap
│   ├── seed/seed.js
│   ├── uploads/                # local file storage
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/         # Button, Input, Loader, PrivateRoute
│   │   │   ├── layout/         # Navbar, Layout
│   │   │   └── listings/       # ListingCard, Grid, Filters, ImageUploader
│   │   ├── pages/              # Home, Login, Register, ListingDetails,
│   │   │                       # PostAd, Profile, Chat, MyListings,
│   │   │                       # Favorites, AdminDashboard, NotFound
│   │   ├── services/           # axios client, REST + socket clients
│   │   ├── store/              # Redux Toolkit (auth, ui)
│   │   ├── hooks/              # useAuth, useDebounce
│   │   ├── types/              # shared TypeScript types
│   │   ├── utils/              # formatters
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## Quick start

### Option A — Docker (recommended)

```bash
cp backend/.env.example backend/.env
# edit JWT secrets in backend/.env

docker compose up --build

# in another terminal, seed sample data:
docker compose exec backend npm run seed
```

- Frontend: http://localhost
- Backend API: http://localhost:5000/api/v1
- MongoDB: mongodb://localhost:27017/syt_marketplace

### Option B — Local dev

```bash
# 1. Backend
cd backend
cp .env.example .env
npm install
npm run seed       # one-time, populates DB
npm run dev        # http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev        # http://localhost:5173
```

Vite dev server proxies `/api`, `/static`, and `/socket.io` to the backend, so the
frontend runs at `http://localhost:5173` with no CORS quirks.

### Demo credentials (after seeding)

| Role  | Email                | Password     |
| ----- | -------------------- | ------------ |
| Admin | admin@syt.local      | admin1234    |
| User  | aisha@example.com    | password123  |
| User  | rahul@example.com    | password123  |
| User  | priya@example.com    | password123  |

---

## Architecture notes

- **Layered backend.** Routes → controllers → services → repositories → models. Controllers stay thin; services own business rules and orchestrate repositories. Repositories are the only layer that touches Mongoose, which keeps testing and refactoring easy.
- **JWT + refresh token rotation.** `/auth/login` returns short-lived access (15 min) and long-lived refresh (30 d) tokens. Refresh tokens are stored on the user document, rotated on every refresh, and can be revoked individually (`/auth/logout`) or all at once (`/auth/logout-all`).
- **Frontend interceptor** transparently refreshes expired access tokens once per request, retries the original call, and falls back to a global `auth:logout` event on failure.
- **Pluggable storage.** `services/storageService.js` exposes `fromMulter()` and `delete()`. Default driver writes to local disk and is served via `/static/*`. Switch `STORAGE_DRIVER=s3` and add the AWS keys to wire S3 (the class shape is ready).
- **Real-time chat.** Socket.IO is authenticated with the same JWT. Each user joins `user:<id>` plus a per-conversation room; the server emits `chat:message` to the conversation room and `chat:notify` to recipients' user rooms so their unread count refreshes regardless of which page they're on.
- **Search.** Listings have a Mongo text index over `title`, `description`, and `location`. Combined with status, category, price-range, location regex, and sort filters, all paginated.
- **Security baseline.** `helmet`, `cors` (allow-list), `express-mongo-sanitize`, `hpp`, request rate limiting, request body size cap, password hashing with `bcryptjs`, JWT-based auth, role guard middleware.

---

## API reference

Base URL: `http://localhost:5000/api/v1` (override via `API_PREFIX`).

All responses follow:

```json
{ "success": true, "message": "OK", "data": { ... }, "meta": { "page": 1, "pages": 3, "total": 30, "limit": 12 } }
```

Errors:

```json
{ "success": false, "message": "Validation failed", "details": [{ "path": "email", "message": "Valid email required" }] }
```

### Auth

| Method | Path                | Auth | Body / Query                                                       | Description |
| ------ | ------------------- | ---- | ------------------------------------------------------------------ | ----------- |
| POST   | `/auth/register`    | —    | `{ name, email, password, phone?, location? }`                     | Create user, returns tokens |
| POST   | `/auth/login`       | —    | `{ email, password }`                                              | Returns `{ user, accessToken, refreshToken }` |
| POST   | `/auth/refresh`     | —    | `{ refreshToken }`                                                 | Rotates and returns a new pair |
| POST   | `/auth/logout`      | Bearer | `{ refreshToken }`                                              | Revokes that refresh token |
| POST   | `/auth/logout-all`  | Bearer | —                                                                | Revokes every refresh token |
| GET    | `/auth/me`          | Bearer | —                                                                | Current user |

### Users

| Method | Path                  | Auth   | Description |
| ------ | --------------------- | ------ | ----------- |
| GET    | `/users/me`           | Bearer | Full profile |
| PATCH  | `/users/me`           | Bearer | Update name/phone/location/avatar |
| POST   | `/users/me/password`  | Bearer | `{ currentPassword, newPassword }` |
| GET    | `/users/:id`          | —      | Public profile |

### Listings

| Method | Path                     | Auth     | Description |
| ------ | ------------------------ | -------- | ----------- |
| GET    | `/listings`              | optional | Public feed. Query: `q`, `category`, `location`, `minPrice`, `maxPrice`, `sort` (`latest`, `price_asc`, `price_desc`, `popular`), `page`, `limit` |
| GET    | `/listings/mine`         | Bearer   | My listings (any status). Optional `?status=draft` |
| GET    | `/listings/:id`          | optional | Increments views, adds `isFavorite` if logged in |
| GET    | `/listings/:id/similar`  | —        | Same-category recommendations |
| POST   | `/listings`              | Bearer   | Create listing |
| PATCH  | `/listings/:id`          | Bearer   | Update (owner or admin) |
| DELETE | `/listings/:id`          | Bearer   | Delete + cleanup images |
| POST   | `/listings/:id/boost`    | Bearer   | Toggle "boosted" flag (mock) |

Create listing body:

```json
{
  "title": "Sony WH-1000XM5",
  "description": "Wireless ANC headphones, used <3 months. With case.",
  "category": "<categoryId>",
  "price": 22000,
  "currency": "INR",
  "condition": "used",
  "location": "Bengaluru",
  "status": "published",
  "images": [{ "url": "http://localhost:5000/static/abc.jpg", "key": "abc.jpg" }]
}
```

### Categories

| Method | Path             | Auth  | Description |
| ------ | ---------------- | ----- | ----------- |
| GET    | `/categories`    | —     | List, sorted |
| POST   | `/categories`    | Admin | `{ name, slug, icon?, parent?, order? }` |
| PATCH  | `/categories/:id`| Admin | Update fields |
| DELETE | `/categories/:id`| Admin | Delete |

### Favorites

| Method | Path                       | Auth   | Description |
| ------ | -------------------------- | ------ | ----------- |
| GET    | `/favorites`               | Bearer | Paginated saved listings |
| POST   | `/favorites/:listingId`    | Bearer | Save (idempotent) |
| DELETE | `/favorites/:listingId`    | Bearer | Remove |

### Messages

| Method | Path                                          | Auth   | Description |
| ------ | --------------------------------------------- | ------ | ----------- |
| GET    | `/messages/conversations`                     | Bearer | List my conversations (with last message + unread) |
| POST   | `/messages/conversations`                     | Bearer | Start (or send into existing) — `{ listingId, message }` |
| GET    | `/messages/conversations/:id`                 | Bearer | Paginated messages, marks read |
| POST   | `/messages/conversations/:id/messages`        | Bearer | Send `{ body }` |
| POST   | `/messages/conversations/:id/read`            | Bearer | Mark all read |

### Uploads

| Method | Path                | Auth   | Body                              |
| ------ | ------------------- | ------ | --------------------------------- |
| POST   | `/uploads/images`   | Bearer | `multipart/form-data`, field `images[]`, max 10 files, 5 MB each |

Returns `{ images: [{ url, key }] }`. URLs are served at `/static/<key>`.

### Admin

| Method | Path                                  | Auth  | Description |
| ------ | ------------------------------------- | ----- | ----------- |
| GET    | `/admin/stats`                        | Admin | counts (users, listings, published, disabled) |
| GET    | `/admin/users`                        | Admin | Paginated; query `q` searches name/email |
| PATCH  | `/admin/users/:id`                    | Admin | `{ disabled: true|false }` |
| PATCH  | `/admin/listings/:id/status`          | Admin | `{ status: "draft"|"published"|"sold"|"disabled" }` |

### Health

`GET /health` → `{ status: "ok", uptime: <seconds> }`

---

## Real-time events (Socket.IO)

Connect with `auth: { token: <accessToken> }`. Events are scoped per user (`user:<id>`) and per conversation (`conversation:<id>`).

| Direction      | Event             | Payload                                        |
| -------------- | ----------------- | ---------------------------------------------- |
| client → server| `chat:join`       | `{ conversationId }` ack `{ ok }`              |
| client → server| `chat:leave`      | `{ conversationId }`                           |
| client → server| `chat:typing`     | `{ conversationId, isTyping }`                 |
| client → server| `chat:send`       | `{ conversationId, body }` ack `{ ok, message }` |
| client → server| `chat:read`       | `{ conversationId }`                           |
| server → client| `chat:message`    | `{ message }` (in conversation room)           |
| server → client| `chat:notify`     | `{ conversationId, message }` (in user room)   |
| server → client| `chat:typing`     | `{ userId, isTyping }`                         |
| server → client| `chat:read`       | `{ conversationId, userId }`                   |

---

## Database design

### `users`
| field          | type     | notes                        |
| -------------- | -------- | ---------------------------- |
| name           | string   | required                     |
| email          | string   | unique, indexed              |
| password       | string   | bcrypt hashed, `select:false`|
| phone, location, avatar | string |                       |
| role           | enum     | `user` or `admin`            |
| disabled       | bool     | admin can flip               |
| refreshTokens  | string[] | issued + active tokens, `select:false` |

### `listings`
| field        | type      | notes                                  |
| ------------ | --------- | -------------------------------------- |
| seller       | ObjectId  | ref User, indexed                      |
| title        | string    | required                               |
| description  | string    | required                               |
| category     | ObjectId  | ref Category, indexed                  |
| price        | number    | indexed                                |
| currency     | string    | default INR                            |
| condition    | enum      | new / used / refurbished               |
| location     | string    | indexed                                |
| images       | [{url,key}] |                                      |
| status       | enum      | draft / published / sold / disabled    |
| boosted      | bool      | mock premium flag                      |
| boostExpiresAt | date    |                                        |
| views        | number    |                                        |
| (indexes)    | text on title+description+location, compound on status+createdAt, category+price |

### `categories`
slug-keyed, optional parent for hierarchy.

### `conversations`
| field        | type      | notes                                  |
| ------------ | --------- | -------------------------------------- |
| listing      | ObjectId  | ref Listing                            |
| participants | [ObjectId]| 2 users; unique compound index w/ listing |
| lastMessage  | ObjectId  | ref Message                            |
| lastMessageAt| date      | indexed                                |
| unread       | Map<userId, count> |                              |

### `messages`
| field         | type      | notes                                  |
| ------------- | --------- | -------------------------------------- |
| conversation  | ObjectId  | ref, indexed                           |
| sender        | ObjectId  | ref User                               |
| body          | string    | max 2000                               |
| readBy        | [ObjectId] |                                       |

### `favorites`
Compound unique index on `(user, listing)`.

---

## Sample data (after `npm run seed`)

- 4 users (1 admin) — listed above
- 10 categories: Vehicles, Electronics, Real Estate, Furniture, Fashion, Books, Sports, Jobs, Services, Pets
- 12 listings spanning categories and locations (Bengaluru, Delhi, Chennai)
- 1 favorite + 1 conversation with a starting message

Sample listing titles include _Honda Activa 6G_, _MacBook Pro 14" M2_, _2BHK Apartment for Rent — Adyar_, _Royal Enfield Classic 350_, etc., each with placeholder images via [placehold.co](https://placehold.co).

---

## Environment variables

### Backend (`backend/.env`)

```
NODE_ENV=development
PORT=5000
API_PREFIX=/api/v1
MONGODB_URI=mongodb://localhost:27017/syt_marketplace

JWT_ACCESS_SECRET=replace_me
JWT_REFRESH_SECRET=replace_me
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

CORS_ORIGINS=http://localhost:5173,http://localhost

STORAGE_DRIVER=local        # or s3
UPLOAD_DIR=uploads
PUBLIC_URL=http://localhost:5000

# only when STORAGE_DRIVER=s3
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
```

### Frontend (`frontend/.env`)

```
VITE_API_BASE=/api/v1
VITE_SOCKET_URL=
VITE_API_PROXY=http://localhost:5000
```

`VITE_SOCKET_URL=""` connects relative to the page origin (default for dev/proxy and Docker).
For a separately-hosted backend, set the absolute URL.

---

## Scripts

### Backend

```
npm run dev     # nodemon
npm start       # production
npm run seed    # wipes + reseeds DB
```

### Frontend

```
npm run dev      # vite
npm run build    # tsc + vite build → dist/
npm run preview  # serve dist/
```

---

## Curl recipes

```bash
# Register
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"test@x.com","password":"secret123"}'

# Login
TOKEN=$(curl -s -X POST http://localhost:5000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"aisha@example.com","password":"password123"}' | jq -r .data.accessToken)

# List listings
curl "http://localhost:5000/api/v1/listings?q=macbook&sort=price_desc&page=1"

# Save a favorite
curl -X POST http://localhost:5000/api/v1/favorites/<listingId> \
  -H "Authorization: Bearer $TOKEN"
```

---

## Production checklist

- [ ] Replace JWT secrets with strong random values
- [ ] Switch `STORAGE_DRIVER=s3` and inject AWS credentials via secret manager
- [ ] Put the API behind HTTPS (TLS termination at the ALB / nginx)
- [ ] Configure `CORS_ORIGINS` to the deployed frontend origin only
- [ ] Bump `RATE_LIMIT_MAX` if needed; use Redis store for multi-instance
- [ ] Add a queue/worker for image processing if you need thumbnails/resizing
- [ ] Add observability: structured logging, error tracking, uptime checks
- [ ] Backup MongoDB regularly
