# SYT Marketplace — Comprehensive Code Review

This is a full-codebase review of the SYT classifieds marketplace (React + TypeScript frontend, Node/Express/MongoDB backend, Socket.IO chat). It covers security, correctness, performance, maintainability, accessibility, testing, and deployment configuration, organized by area with file paths and line numbers so each item can be located quickly.

Overall impression: this is a well-structured, layered application (routes → controllers → services → repositories → models on the backend; components/pages/services/store on the frontend) with genuinely strong test coverage (~392 backend tests, ~330 frontend tests, 80% coverage gates). The issues below are meant to harden a solid foundation, not indict the architecture.

---

## Table of contents

1. [Backend — Security](#backend--security)
2. [Backend — Correctness / Bugs](#backend--correctness--bugs)
3. [Backend — Performance](#backend--performance)
4. [Backend — Code Quality / Maintainability](#backend--code-quality--maintainability)
5. [Backend — Testing Gaps](#backend--testing-gaps)
6. [Frontend — Security](#frontend--security)
7. [Frontend — Correctness / Bugs](#frontend--correctness--bugs)
8. [Frontend — Performance](#frontend--performance)
9. [Frontend — Code Quality / Maintainability](#frontend--code-quality--maintainability)
10. [Frontend — Accessibility](#frontend--accessibility)
11. [Frontend — State Management](#frontend--state-management)
12. [Deployment / Config (Docker, docker-compose, Railway)](#deployment--config)
13. [Strengths](#strengths)
14. [Suggested priority order](#suggested-priority-order)

---

## Backend — Security

### Critical

- **JWT secrets silently fall back to hardcoded dev values in production** — `backend/src/config/index.js:10-16,26-27`
  ```js
  const required = (name, fallback) => {
    const value = process.env[name] ?? fallback;
    if (value === undefined || value === '') throw new Error(`Missing env variable: ${name}`);
    return value;
  };
  ...
  accessSecret: required('JWT_ACCESS_SECRET', 'dev_access_secret_change_me'),
  refreshSecret: required('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_me'),
  ```
  `required()` only throws when *both* the env var and the fallback are empty, so it never actually enforces anything. If an operator forgets to set `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` in production, the app boots silently with the well-known string `dev_access_secret_change_me`, which is committed to a public repo. Anyone who reads this file can forge valid access/refresh tokens for any user, including admins. There's no startup check that fails fast in `NODE_ENV=production` when secrets are missing or match the default.

- **Arbitrary-extension file upload → stored content served with attacker-chosen `Content-Type`** — `backend/src/middleware/upload.js:13-16,19-26`
  ```js
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase(); // attacker-controlled
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
  ...
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const fileFilter = (_req, file, cb) => {
    if (!allowed.includes(file.mimetype)) { ... } // mimetype is also attacker-controlled
  ```
  The extension (from `originalname`) and the MIME type (from the multipart `Content-Type` part) are two independently client-supplied values, and neither is verified against actual file bytes (no magic-number sniffing). An attacker can send `Content-Type: image/png` (passes `fileFilter`) with `originalname: "evil.html"` containing an XSS payload. The file is saved as `TIMESTAMP-uuid.html` and served statically (`backend/src/app.js:45-51`, `/static`, `crossOriginResourcePolicy: cross-origin`) — `express.static` serves `.html` with `Content-Type: text/html`, giving a stored-XSS payload hosted on your own domain.
  **Fix:** derive the saved extension from the validated MIME type (whitelist mapping `image/png` → `.png`), and/or sniff real content type (e.g. the `file-type` package) rather than trusting client-sent mimetype/filename independently.

### High

- **Compound unique index on `Conversation.participants` breaks messaging once a listing has more than one interested buyer** — `backend/src/models/Conversation.js:33`
  ```js
  conversationSchema.index({ participants: 1, listing: 1 }, { unique: true });
  ```
  `participants` is an array, so this is a **multikey index** — Mongo indexes one entry per array element combined with `listing`, not one entry for the whole array. For listing `L` with seller `S`: buyer1's conversation `[buyer1, S]` produces index entries `(buyer1, L)` and `(S, L)`. Buyer2's conversation `[buyer2, S]` produces `(buyer2, L)` and **`(S, L)`** — colliding with buyer1's `(S, L)` entry, even though the participant sets differ. In practice, **the second person who ever messages a seller about the same listing gets a 500** from `messageService.startOrSend` (`backend/src/services/messageService.js:30-37` → `conversationRepository.create`), since the resulting duplicate-key error isn't caught. This is core functionality for a marketplace (multiple buyers contacting one seller about one listing) and is broken today.
  Notably, the tests already discovered this behavior without fixing it: `backend/tests/unit/repositories.test.js:389-390` explicitly notes "the unique `{ participants, listing }` index is multikey, so two conversations that both include `me` on the same listing would collide," and `backend/tests/unit/models.test.js:376-394` only tests "same participants, different listing" — never "same listing, different second participant," which is exactly the path that fails.
  **Fix:** replace the multikey array index with a normalized field (e.g. `participantsKey` = sorted, joined participant IDs) that's unique together with `listing`, or enforce uniqueness at the application level via `findOneAndUpdate` with `upsert` instead of a raw unique index on an array field.

### Medium

- **Unescaped regex from user input in listing search (ReDoS / inefficient scan)** — `backend/src/repositories/listingRepository.js:10`
  ```js
  if (location) filter.location = { $regex: location, $options: 'i' };
  ```
  `location` comes straight from `req.query.location` (validated only as `isString()`, no length cap — `backend/src/validators/listingValidators.js:45`) and is passed unescaped into `$regex` on the public, unauthenticated `GET /api/v1/listings` endpoint. Contrast with `backend/src/services/searchService.js:4,11`, which correctly `escapeRegex`s before building a `RegExp`. A crafted `location` with nested quantifiers can cause catastrophic backtracking, and even benign unanchored regexes defeat index usage, forcing a collection scan as data grows. No test covers regex metacharacters in `location`.

- **`GET /listings/mine` has no query validation** — `backend/src/routes/listingRoutes.js:14`
  ```js
  router.get('/mine', authenticate, ctrl.myListings);
  ```
  Unlike `GET /listings` (which runs through `listListingValidator, validate`), `/mine` skips validation while still funneling `req.query` through the same `parseFilters` (`backend/src/controllers/listingController.js:5-15,48-55`). `Number(q.page) || 1` accepts negative numbers (e.g. `?page=-5`), which flow into `.skip((page - 1) * limit)` (`backend/src/repositories/listingRepository.js:70`) as a negative skip — Mongo rejects negative skip, producing an unhandled 500 instead of a clean 400.

- **Category admin endpoints skip the validator-chain pattern used everywhere else** — `backend/src/controllers/categoryController.js:11-25`. `updateCategory` passes the *entire* `req.body` straight into `Category.findByIdAndUpdate(..., { runValidators: true })` with no field whitelist and no `express-validator` chain, unlike `authValidators`/`listingValidators`/`userValidators`/`messageValidators`. Admin-only access mitigates the severity, but it's the only unvalidated write path in the codebase and will bite the next contributor who adds a field.

- **`chat:typing` socket handler has no conversation-membership check** — `backend/src/sockets/chatSocket.js:26-31`
  ```js
  socket.on('chat:typing', ({ conversationId, isTyping }) => {
    socket.to(`conversation:${conversationId}`).emit('chat:typing', { userId: socket.userId, isTyping: Boolean(isTyping) });
  });
  ```
  Unlike `chat:join`, which calls `ensureParticipant` first, `chat:typing` relays to `conversation:<id>` regardless of whether the socket ever joined that room or is a participant. Any authenticated user who knows/guesses a `conversationId` can spam typing-indicator noise into other users' conversations — low impact, but a real authorization gap inconsistent with the rest of the socket surface.

### Low

- **CORS rejection surfaces as a generic 500 instead of 403** — `backend/src/app.js:27-30`. `callback(new Error(...))` isn't an `AppError`, so `errorHandler` (`backend/src/middleware/errorHandler.js:9`) defaults to 500 and leaks the blocked origin string in the message. Should throw `AppError.forbidden`.
- **`changePassword` throws an unhandled error for Google-only accounts** — `backend/src/services/userService.js:33-42`. For a Google-auth user, `password` is `undefined` (conditionally required in the schema, `backend/src/models/User.js:15-22`), and `bcrypt.compare(currentPassword, undefined)` throws, producing an opaque 500 instead of a clean 400 ("No password set for this account").

---

## Backend — Correctness / Bugs

- **Conversation multikey index bug** (see Security → High above) is primarily a correctness/functionality bug: messaging breaks for the second buyer on any listing.

- **Unread-count race condition** — `backend/src/services/messageService.js:6-18,88-101`. `incrementUnread` (`$inc: { unread.<id>: 1 }`) and `resetUnread` (`$set: { unread.<id>: 0 }`) are each atomic, but if a new message arrives concurrently with the recipient's `markRead`, the blind `$set: 0` can execute after the concurrent `$inc`, erasing the unread count for a message the recipient hasn't actually seen. Zeroing relative to the last-read message/timestamp rather than blind-setting to 0 would be safer.

- **`GET /listings/mine` unvalidated pagination can throw a 500** (cross-referenced from Security) — negative/NaN `page`/`limit` reach `.skip()`/`.limit()` unguarded.

- **Redundant duplicate query in `startOrSend`** — `backend/src/services/messageService.js:46-55`. `conversationRepository.updateById` already returns the fully populated conversation, but its result is discarded and a second `conversationRepository.findById` is issued for essentially the same document.

- **Socket `chat:send` re-fetches conversation participants that `messageService.send` already loaded** — `backend/src/sockets/chatSocket.js:33-50` does a second, separate `Conversation.findById(...).select('participants')` purely to fan out notifications, after `messageService.send` already loaded the conversation internally. Returning it from the service call would save a query per chat message.

- **`seed/seed.js` has no environment guard before destructive `deleteMany({})` calls** — `backend/seed/seed.js:181-189`. If accidentally run against a production `MONGODB_URI`, it silently wipes `User`/`Category`/`Listing`/`Favorite`/`Conversation`/`Message` and reseeds a default admin (`admin@syt.local` / `admin1234`). No `if (config.env === 'production') throw` guard exists.

---

## Backend — Performance

- **Regex-based search can't use indexes efficiently** — `backend/src/repositories/listingRepository.js:10` and `backend/src/repositories/userRepository.js:22-26` both build unanchored `$regex` filters against indexed fields; unanchored regex forces a collection/index scan instead of using the B-tree, and will degrade as the catalogue grows (the README notes seeding up to 5,000+ listings).
- **Duplicate conversation fetch per chat message** (see Correctness above) — one avoidable query per send/start.
- **Pagination clamp logic is duplicated ad hoc** (`Math.min(Number(q.limit) || N, MAX)`) across `listingController.js`, `favoriteController.js`, `messageController.js`, `adminController.js` rather than a single shared helper — not a perf bug per se, but a maintenance/perf-consistency risk (easy to forget a cap in a new endpoint).

---

## Backend — Code Quality / Maintainability

- **Layering inconsistency: `categoryController.js` talks directly to the `Category` Mongoose model**, unlike every other domain, which goes controller → service → repository → model (`backend/src/controllers/categoryController.js:1,7,14,19,28`). There's no `categoryService`/`categoryRepository` at all.
- **`adminService.js` mixes repository and direct-model access** — uses `userRepository.list` (`backend/src/services/adminService.js:8`) but bypasses the repository layer for `User.findByIdAndUpdate` (line 19) and imports `Listing` directly for `setListingStatus`/`stats` (lines 32, 38-43).
- **Duplicated `sanitize(input, allowed)` mass-assignment-guard helper**, copy-pasted verbatim in `backend/src/services/userService.js:6-9` and `backend/src/services/listingService.js:6-9`. Good instinct, should be a shared utility.
- **`S3Storage` is a non-functional stub** — `backend/src/services/storageService.js:45-51` (`fromMulter`/`delete` both `throw new Error('...install multer-s3...')`). Fine as a documented extension point, but an operator who sets `STORAGE_DRIVER=s3` expecting it to work will only discover the gap at first upload; a loud startup warning/guard would be safer.

---

## Backend — Testing Gaps

- **No test exercises two different buyers messaging the same seller about the same listing** — exactly the scenario that trips the multikey unique-index bug is explicitly avoided rather than tested (`tests/unit/models.test.js:376-394`, `tests/unit/repositories.test.js:389-392`).
- **No test for regex metacharacters in `location`/`q` filters** (the ReDoS/regex-injection surface above).
- **`GET /listings/mine` has no pagination-edge-case tests** (negative/zero page, oversized limit), consistent with it skipping the validator.
- **Google Sign-In success/link/unverified-email paths are untested** — only the "not configured" 400 path is covered (`tests/integration/auth.test.js:242-248`); `authService.loginWithGoogle`'s success branch and the "link existing local account" branch (`backend/src/services/authService.js:89-91`) have no unit test with a mocked `OAuth2Client`.
- **`tests/integration/sockets.test.js` doesn't cover the missing `chat:typing` authorization check** noted above.

---

## Frontend — Security

### Critical

- **Both access and refresh tokens are stored in `localStorage`** — `frontend/src/services/api.ts:5-20`
  ```ts
  export const TOKEN_KEY = 'syt:accessToken';
  export const REFRESH_KEY = 'syt:refreshToken';
  export const tokenStorage = {
    getAccess: () => localStorage.getItem(TOKEN_KEY),
    ...
  ```
  Storing the long-lived refresh token (not just the short-lived access token) in `localStorage` means a single stored/reflected XSS anywhere in the app — or a compromised third-party script (the app loads Google's `accounts.google.com/gsi/client` and font CDN scripts) — gives an attacker a durable, silently-renewable session, not just a short-lived one. httpOnly cookies with a CSRF-token pattern (or keeping the refresh token server-side only) would contain the blast radius substantially.

### High

- **Chat socket keeps the previous user's identity after logout/login** — `frontend/src/services/socket.ts:8-28`, `frontend/src/App.tsx:34-37`, `frontend/src/pages/Chat.tsx:74,110,120`. `reconnectSocketWithToken`/`disconnectSocket` are exported but have **zero production call sites** — only test mocks reference them. The `auth:logout` handler in `App.tsx` clears tokens/Redux state but never disconnects the socket. If user A logs out and user B logs in on the same tab, the still-open socket keeps user A's original `auth: { token }` handshake, so subsequent chat traffic continues to be attributed to user A server-side until the transport happens to drop.

### Medium-High

- **No security headers (CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) in the production Nginx config** — `frontend/nginx.conf.template:1-53`. Combined with the in-page (non-redirect) auth modal and embedded Google Sign-In button, the app is clickjackable — a malicious site can iframe it and trick a logged-in user into clicking "Post Ad," "Delete listing," or the Google button via UI redressing.

### Low

- **Unvalidated user-supplied avatar URL rendered as a raw CSS `background-image`** — set via a plain text `Input` in `frontend/src/pages/Profile.tsx:18,106`, consumed at `Navbar.tsx:61`, `ListingDetails.tsx:236`, `Chat.tsx:155`, `PublicProfile.tsx:81`. No protocol/host allow-listing, so it can be used as a low-grade tracking pixel / referrer leak against anyone who views that user's profile, listings, or chat thread.

---

## Frontend — Correctness / Bugs

- **Editing a sold/disabled listing silently republishes it** — `frontend/src/pages/PostAd.tsx:56,167-174`. The edit form only offers `published`/`draft` as `<select>` options, so a `sold`/`disabled` listing's real status is coerced to `'published'` just to populate the field:
  ```ts
  status: l.status === 'sold' || l.status === 'disabled' ? 'published' : (l.status as any),
  ```
  Editing *any* field on a sold/disabled listing and saving sends `status: 'published'` to the API, flipping a sold/disabled item back to live — a real data-corruption bug, not just a UI nit.

- **`ListingDetails` has no stale-response guard** — `frontend/src/pages/ListingDetails.tsx:31-48`. Unlike `Home.tsx` and `PublicProfile.tsx`, which use an `active` flag to ignore out-of-order responses, this effect has none. Rapid navigation between listings (e.g. via the "Similar listings" grid) can let an older `id`'s response resolve after a newer one, overwriting fresh state with stale data for a different listing.

- **Opening a conversation never marks its existing messages as read** — `frontend/src/pages/Chat.tsx:51-71`. `messageApi.markRead` exists and is unit-tested (`endpoints.test.ts:222-224`) but is **never called from `Chat.tsx`**; the only "read" signal is a socket emit that fires solely for messages arriving while the conversation is already open. Pre-existing unread messages are never marked read from the client.

- **Global unread badge only updates while the user is on the Chat page** — `frontend/src/pages/Chat.tsx` is the only place `getSocket()` is invoked (no app-level socket connection), and `bumpUnread`/`resetUnread` in `uiSlice.ts:24-29` are defined and tested but **never dispatched anywhere in application code**. `Navbar`'s badge only reflects whatever was last computed on a previous visit to `/chat`.

- **Search-highlight regex reuses a stateful `g`-flag `RegExp` across `.test()` calls** — `frontend/src/components/layout/SearchAutocomplete.tsx:24-37`. Because `re.test()` advances `re.lastIndex` when `g` is set, and the same `re` instance is reused across every `.map()` iteration, some tokens that should be highlighted render as plain text (or vice versa) depending on prior match positions — a classic `RegExp.test()` + global-flag bug.

- **Filter inputs push a new browser-history entry on every keystroke** — `frontend/src/pages/Home.tsx:64-70`, `frontend/src/components/listings/Filters.tsx:9-49`. `setParams(usp)` is called without `{ replace: true }` on every change (no local debounce on the inputs themselves), so typing "3 bedroom" into the location filter creates ~9 history entries; pressing Back steps through each keystroke instead of leaving the page.

- **`bootstrapAuth` wipes stored tokens on *any* error**, not just auth failures — `frontend/src/store/slices/authSlice.ts:21-30`. A transient network blip or 500 on `authApi.me()` unconditionally clears tokens and logs the user out, even though the session may still be valid.

- **Login/Register share a single `auth.error` field** — `frontend/src/components/auth/AuthModal.tsx:20,66`. A failed login leaves its error message visible after switching to the Register tab; nothing clears `auth.error` on `setAuthMode`.

- **Hardcoded ₹ symbol ignores the listing's actual currency** — `frontend/src/pages/ListingDetails.tsx:193-196`. The big price display strips `formatPrice`'s own currency-formatted symbol via regex and re-prepends a literal `₹`, so any non-INR listing still shows ₹ on its main price.

- **`GoogleSignInButton` re-initializes the GSI widget on nearly every parent re-render** — `frontend/src/components/auth/GoogleSignInButton.tsx:17-54`, `frontend/src/components/auth/AuthModal.tsx:196-199`. `onSuccess={close}` is a new function identity every render, and the effect depends on it, so `window.google.accounts.id.initialize()` + `renderButton()` re-run on unrelated re-renders (tab switch, error state change) without clearing prior content first.

- **`typingTimer` timeout is never cleared on unmount** — `frontend/src/pages/Chat.tsx:28,107-116`. Navigating away mid-type still fires a `chat:typing` emit ~1.5s later for a room the socket has already left.

- **`PrivateRoute` doesn't preserve the originally-requested destination** — `frontend/src/components/common/PrivateRoute.tsx:17-23`. Visiting a protected deep link while logged out redirects straight to `/` with no `state={{ from: location }}`, so after login the user lands on the homepage instead of where they were headed.

---

## Frontend — Performance

- **`ListingCard` isn't memoized** — `frontend/src/components/listings/ListingCard.tsx`, `ListingGrid.tsx:15-21`. Toggling one favorite re-renders every card in the grid (up to 12-50 items), not just the one that changed.
- **No client-side validation before uploading images** — `frontend/src/components/listings/ImageUploader.tsx:19-37`. The UI promises "JPG, PNG, WEBP up to 8MB each" but nothing enforces file type/size client-side before calling the upload API, so an oversized or wrong-type file wastes a full upload round trip before the backend rejects it.

---

## Frontend — Code Quality / Maintainability

- **Pagination `meta` typed as `any` everywhere**, despite a proper `Pagination` type already existing (`frontend/src/types/index.ts:77-82`) — every service (`listingService.ts`, `messageService.ts`, `favoriteService.ts`, `authService.ts`, `userService.ts`) declares `meta: any`, forcing manual re-casts at call sites (e.g. `Home.tsx:55`, `PublicProfile.tsx:58`: `setMeta(meta as PaginationMeta)`).
- **`searchService.ts` is dead code with an incorrect type** — `frontend/src/services/searchService.ts:4-21` is exported and tested but never used; `SearchAutocomplete.tsx:59-70` bypasses it with its own inline implementation and its own (correct) local type. Worse, `SearchSuggestions.listings` in `searchService.ts` is typed as a single object when it's actually an array.
- **Duplicated click-outside-listener logic** in `SearchAutocomplete.tsx:77-83` and `CategoryMegaMenu.tsx:51-64` — a shared `useClickOutside` hook would remove the duplication (and the current inconsistency where only one of the two also handles `Escape`).
- **Avatar rendering (background-image + initials fallback) is copy-pasted six times** across `Navbar.tsx`, `Profile.tsx`, `PublicProfile.tsx`, `ListingDetails.tsx`, `Chat.tsx` (twice), `AdminDashboard.tsx`, with slightly different inline sizing each time.
- **Dead placeholder footer links** — `frontend/src/components/layout/Footer.tsx:34-37,41-44`. Eight `<a href="#">` links go nowhere in a shipped product footer.

---

## Frontend — Accessibility

- **Filter inputs have no accessible label, only a placeholder** — `frontend/src/components/listings/Filters.tsx:14-46`. Location/Min/Max inputs and the sort `<select>` bypass the app's own `Input`/`Select` components (which do support a `label`), so screen-reader users lose all context once a value is typed and the placeholder disappears.
- **Avatars convey nothing to assistive tech once set** — across all six locations above, a set avatar is a CSS `background-image` on an empty `<span>` (initials fallback is only rendered when there's no avatar). A real `<img alt={name}>` (or `aria-label`) would fix this everywhere at once.
- **Custom "button" elements only respond to Enter, not Space** — `frontend/src/components/listings/CategoryMegaMenu.tsx:121-122,135-136`. `<h4 role="button">`/`<li role="button">` with `onKeyDown={(e) => (e.key === 'Enter' ? choose(...) : null)}` violate the ARIA Authoring Practices Guide, which requires `role="button"` elements to also activate on Space.

---

## Frontend — State Management

- **`auth.error` is a single shared field for three independent async flows** (login, register, Google login) with nothing to reset it on mode switch — see Correctness above; architecturally this belongs scoped per-form rather than as one global Redux field.
- **`unreadCount` is a derived value manually pushed from a single page** (`Chat.tsx`) rather than sourced from one authoritative flow — the `bumpUnread`/`resetUnread` actions exist and are tested but are otherwise dead code (see Correctness above), so global unread UI state is only ever fresh while the user is on `/chat`.

---

## Deployment / Config

- **Backend Dockerfile has no `HEALTHCHECK`** despite the app exposing `GET /api/v1/health` (`backend/src/routes/index.js:14`) — orchestrators can't detect an unhealthy container without one. (Railway's `railway.json` does configure a `healthcheckPath`, but the Dockerfile itself has no equivalent for plain `docker run`/Compose use.)
- **Both Dockerfiles use `npm install` instead of `npm ci`** (`backend/Dockerfile:4`, `frontend/Dockerfile:4`) despite committed `package-lock.json` files in both apps — `npm ci` installs exactly what's locked and fails fast on a lockfile mismatch; `npm install` can silently drift.
- **Frontend container runs Nginx as root** — the final stage is plain `nginx:alpine` with no `USER` directive. Backend Dockerfile does the right thing here (runs as the non-root `node` user), so the same care should be extended to the frontend image (e.g. `nginxinc/nginx-unprivileged`).
- **No startup validation for missing/insecure production secrets** (cross-referenced from Backend Security above) — there's no check like `if (config.env === 'production' && config.jwt.accessSecret === 'dev_access_secret_change_me') throw`.
- **`docker-compose.yml` exposes MongoDB's port 27017 directly to the host** (`ports: ["27017:27017"]`) with no auth configured on the `mongo` service. Fine for a local dev compose file, but worth a comment warning not to reuse this compose file as-is for any environment reachable beyond localhost.
- `.env.example` files contain only placeholder values — no real secrets committed, which is correct practice.

---

## Strengths

- **Refresh-token rotation and revocation is implemented correctly** — `authService.refresh` (`backend/src/services/authService.js:43-61`) validates the incoming token is still in the user's stored `refreshTokens`, rotates it atomically, and `logoutAll`/password-change clear all tokens. Well covered by tests (`backend/tests/integration/auth.test.js:108-160`).
- **Consistent `asyncHandler` + `AppError` + centralized `errorHandler` pattern** across nearly all backend controllers, giving a uniform error-response shape and clean layering for the large majority of the codebase.
- **Solid security baseline wired globally**: `helmet`, `express-mongo-sanitize`, `hpp`, a CORS allow-list with credentials, and per-route rate limiting on auth endpoints.
- **The axios refresh interceptor** (`frontend/src/services/api.ts:33-73`) correctly de-duplicates concurrent 401s via a shared in-flight promise and guards against infinite retry loops — a pattern many apps get wrong.
- **`LocationPicker.tsx`** correctly avoids stale-closure bugs in Leaflet click handlers by routing callbacks through refs updated every render — the right fix for imperative-library + React integration.
- **Broad, genuine test coverage on both sides** — 392 backend / 330 frontend tests with an enforced 80% coverage gate, including specific refresh-flow and 401-retry tests.

---

## Suggested priority order

1. Fix the `Conversation` multikey unique index (breaks core messaging for a common real-world case).
2. Enforce a real production check on JWT secrets (fail startup if unset or equal to the dev default).
3. Fix the upload extension/MIME-type validation (stored-XSS risk via `/static`).
4. Fix `PostAd.tsx`'s status-coercion bug (silently republishes sold/disabled listings).
5. Reconsider refresh-token storage (httpOnly cookie) or at least disconnect/reconnect the chat socket on login/logout.
6. Escape regex input in `listingRepository.js`'s `location` filter; validate `GET /listings/mine` query params.
7. Address the unread-badge/read-receipt gaps in Chat (real UX regressions, not just edge cases).
8. Everything else — layering consistency, dedup helpers, accessibility labels, Docker hygiene — as incremental cleanup.
