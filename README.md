# Database Travel — Hướng dẫn nhanh và từ điển API

Tệp này mô tả cách thiết lập sau khi clone repo và liệt kê các API hiện có trên server (tổng hợp từ `routes/` và `controllers/`).

---

## 1) Thiết lập (sau khi clone)

1. Clone và chuyển vào thư mục dự án

```bash

git clone <repo-url>
cd "Database Travel"
```

2. Sao chép file môi trường mẫu và chỉnh sửa nếu cần

```bash

cp .env.example .env
# sửa DB_PATH, PORT, CORS_ORIGIN, JWT_SECRET nếu cần
```

3. Cài đặt dependencies và chạy server

```bash

```bash
npm install
npm run dev    # phát triển (nodemon)
# hoặc
npm start      # chạy production

```
```

4. Chuẩn bị database

- Nếu có file `travel_app.template.db` trong repo, bạn có thể copy sang `travel_app.db` để bắt đầu nhanh:

```bash
cp "Backend + Database/travel_app.template.db" "Backend + Database/travel_app.db"
```

5. (Tùy chọn) Import dữ liệu mẫu từ CSV/JSON

- Công cụ import: `scripts/import_shops_and_bikes.js` (sẽ backup DB trước khi ghi). Ví dụ chạy từ thư mục `Backend + Database`:

node scripts/import_shops_and_bikes.js --db "travel_app.db" --all
```

Lưu ý: nếu gặp lỗi `SQLITE_BUSY`, đóng các tiến trình khác truy cập DB hoặc chờ vài giây rồi chạy lại.

---

## 2) Từ điển API (tổng hợp)
Base URL: `http://localhost:<PORT>` (mặc định PORT = 5000)

Các endpoint dưới đây được mount tương ứng trong `server.js`:

If you need to seed sample data (SQL):

```bash
npm run seed:sql
```

If you prefer to run the JS seed (contains logic):

```bash
# Database Travel

This repository contains a small Express + SQLite backend for the "Database Travel" app. The project is intentionally lightweight so contributors can run it locally with minimal setup.

This README covers:
- Getting started (install, run)
- Local database workflow (template DB and migrations)
- Seed data and undo
- Useful npm scripts
- Frontend integration and CORS
- Troubleshooting

## Prerequisites
- Node.js (16+ recommended)
- npm
- sqlite3 CLI (optional, for manual inspection/import)

## Quick start
1. Clone the repo and enter the folder:

```bash
git clone <repo-url>
cd "Database Travel"
```

2. Copy environment template and adjust if needed:

```bash
cp .env.example .env
# edit .env to change PORT, DB_PATH or CORS_ORIGIN if required
```

3. Install dependencies and start the server:

```bash
npm install
npm run dev    # development using nodemon
# or
npm start      # run with node
```

4. (Optional) If you want sample data run:

```bash
npm run seed:sql    # apply SQL seed
# or dynamic JS seed
npm run seed
```

## Local database workflow (recommended)

We recommend shipping a sanitized snapshot `travel_app.template.db` in the repo (optional). Each developer copies that template to `travel_app.db` locally so everyone works on their own local copy and avoids file lock/corruption issues. The repository ignores `travel_app.db`.

One-time setup for a new developer:

```bash
# create local DB from template, or if template absent the migrations will create an empty DB
npm run setup-db

# run migrations (if you prefer to create DB from schema)
npm run migrate
```

Notes:
- `npm run setup-db` will copy `travel_app.template.db -> travel_app.db` if the template exists; otherwise it runs `migrations/schema.sql` to create an empty DB.
- After creating the DB you can run `npm run seed:sql` to add sample rows.

## Migrations and seeds
- `migrations/schema.sql` contains the DDL for the 9 tables used by the app.
- `seeds/seed.sql` and `seeds/undo.sql` are SQL scripts to insert or remove sample data.

### Adding the Reviews / Points / Filters tables

If your local DB was created before these features were added, you can create the missing tables using the migration file included here:

```bash
sqlite3 "Backend + Database/travel_app.db" < "Backend + Database/migrations/add_reviews_points_filters.sql"
```

The migration is idempotent (uses `CREATE TABLE IF NOT EXISTS`) and safe to run multiple times. Alternatively, starting the server will run the lightweight migrations in `db/connect.js` which also ensures these tables/columns exist.


You can run them directly with the sqlite3 CLI:

```bash
# create/ensure schema
npm run migrate

# seed using SQL
npm run seed:sql

# undo seed
npm run seed:undo:sql
```

There is also a Node-based seeder `seeds/seed.js` (useful when you need logic, last-insert-id handling, or programmatic seeding):

```bash
npm run seed
```

### CSV: user_reward (voucher inventory)

Legacy export used only three columns:

```text
user_id,reward_id,claimed_at
```

Current schema stores additional lifecycle fields. Recommended CSV header now:

```text
user_id,reward_id,code,status,obtained_at,issued_at,expires_at,used_at
```

Import logic (`scripts/import_all.js`) auto-detects which columns are present:

- If only `claimed_at` exists it maps to `obtained_at`.
- Optional columns (`code,status,issued_at,expires_at,used_at`) are inserted when supplied.

Codes are never stored on the base `rewards` row; each `user_reward` gets its own generated `code` when redeemed or awarded by a challenge.

## npm scripts

- `npm run dev` — run `nodemon server.js` (development)
- `npm start` — run `node server.js`
- `npm run migrate` — run `migrations/schema.sql` against `travel_app.db`
- `npm run seed:sql` — run `seeds/seed.sql` against `travel_app.db`
- `npm run seed:undo:sql` — run `seeds/undo.sql` against `travel_app.db`
- `npm run seed` — run the Node JS seeder (if present)
- `npm run setup-db` — copy template DB or run migrations to create local DB

## Frontend integration

- Backend default port: `5000` (change in `.env`). Server will bind to `process.env.PORT || 5000`.
- Frontend should call the backend API using the full base URL if it runs on a different origin (e.g. `http://localhost:5000/api/...`).
- If your frontend runs at `http://localhost:5173` set backend `.env`:

```bash
CORS_ORIGIN=http://localhost:5173
```

And in the frontend set its API base URL accordingly (for Vite: `VITE_API_URL=http://localhost:5000`).

## Troubleshooting

- If the server fails to start, check console logs for errors and verify `.env` values.
- If sqlite `travel_app.db` is corrupted or missing, regenerate it with:

```bash
npm run setup-db
```

- To inspect the DB manually (CLI):

```bash
sqlite3 travel_app.db
.tables
.schema users
SELECT * FROM users LIMIT 10;
.exit
```

## Security / privacy

- Never commit production secrets or real user data into the repo. Use `travel_app.template.db` sanitized for sample data.
- `travel_app.db` is in `.gitignore` — keep local copies out of version control.

## Next steps (optional)

- If you want, I can add a small `docker-compose.yml` for a Postgres dev DB if you later decide to move away from SQLite.
- I can also generate API endpoint docs (list of routes) or add a health-check endpoint.

If anything is unclear or you want me to update the README with screenshots or specific frontend env examples (Vite/CRA), tell me which frontend stack you're using and I'll add them.

## API Endpoints

The backend exposes a REST API under `/api`. All responses are JSON.

Base path: `http://localhost:<PORT>` (default PORT = 5000)

Auth (mount: `/auth`)
- POST `/auth/register` — create user { username, email, password }
- POST `/auth/login` — login, returns { token, username, userId, points }
- POST `/auth/logout` — stateless logout
- GET `/auth/me` — get current user (Authorization: Bearer token)

Users (mount: `/api/users`)
- GET `/api/users` — list users
- POST `/api/users` — create user
- POST `/api/users/complete` — mark challenge complete { user_id, challenge_id }
- GET `/api/users/:id` — get user profile
- POST `/api/users/:id` — update user profile
- POST `/api/users/:id/avatar` — update avatar
- POST `/api/users/:id/password` — change password
- GET `/api/users/:id/vouchers` — list vouchers for user

Locations (mount: `/api/locations`)
- GET `/api/locations` — list locations
- GET `/api/locations/nearby` — list nearby by query params (lat/lon)
- GET `/api/locations/:id` — get location details
- POST `/api/locations` — create location
- GET `/api/locations/me/favorites` — list my favorite locations (auth)
- POST `/api/locations/:id/favorite` — add favorite (auth)
- DELETE `/api/locations/:id/favorite` — remove favorite (auth)

Location Images (mount: `/api/locations/:locationId/images`)
- GET `/api/locations/:locationId/images` — list images for a location
- POST `/api/locations/:locationId/images` — add image (if implemented)

Challenges (mount: `/api/challenges`)
- GET `/api/challenges` — list challenges
- POST `/api/challenges` — create challenge
- POST `/api/challenges/:id/join` — join challenge
- POST `/api/challenges/:id/complete` — complete challenge
- GET `/api/challenges/:id/locations` — list locations of challenge
- GET `/api/challenges/:id/rewards` — list rewards of challenge

Rewards (mount: `/api/rewards`)
- GET `/api/rewards` — list rewards
- GET `/api/rewards/catalog` — rewards catalog (optional `user_id`)
- POST `/api/rewards` — create reward
- POST `/api/rewards/redeem` — redeem reward { user_id, reward_id }
- GET `/api/rewards/user/:userId/inventory` — list voucher inventory (user_reward rows) for user
- GET `/api/rewards/user/:userId/transactions` — list reward transactions (issuance, redemption, usage)
- GET `/api/rewards/user/:userId/voucher/:userRewardId` — fetch a specific voucher (code/status/expiry)
- POST `/api/rewards/use/:userRewardId` — mark voucher used (sets `status=used`, `used_at`)

Reviews (locations) (mount: `/api/reviews`)
- POST `/api/reviews` — create location review (auth) { location_id, rating, comment }
- GET `/api/reviews/location/:locationId` — list reviews for a location
- PUT `/api/reviews/:id` — edit review (auth)
- DELETE `/api/reviews/:id` — delete review (auth)

Trip Reviews (mount: `/api/trip-reviews`)
- POST `/api/trip-reviews` — create trip review (auth) { trip_id, rating, comment }
- GET `/api/trip-reviews/trip/:tripId` — list reviews for a trip
- PUT `/api/trip-reviews/:id` — edit trip review (auth)
- DELETE `/api/trip-reviews/:id` — delete trip review (auth)

Points (mount: `/api/points`)
- POST `/api/points/transactions` — add points tx (auth)
- GET `/api/points/transactions` — list my transactions (auth)
- GET `/api/points/me` — get my points (auth)

Favorites (mount: `/api/favorites`)
- GET `/api/favorites` — list favorites
- GET `/api/favorites/find` — find favorite by query params
- POST `/api/favorites` — create favorite (auth)
- DELETE `/api/favorites/:id` — delete favorite (auth)

Shops (mount: `/api/shops`)
- GET `/api/shops` — list shops
- GET `/api/shops/:shopId` — shop details

Motorbikes (mount: `/api/motorbikes`)
- GET `/api/motorbikes` — list motorbikes
- GET `/api/motorbikes/:bikeId` — motorbike details
- PATCH `/api/motorbikes/:bikeId` — update motorbike (auth)

Rentals (mount: `/api/rentals`)
- POST `/api/rentals` — create rental (auth)
- GET `/api/rentals` — list/find rentals
- PATCH `/api/rentals/:id` — update rental (auth)
- GET `/api/rentals/open` — list open rentals for a user

Trips (mount: `/api/trips`)
- GET `/api/trips` — list trips
- GET `/api/trips/:id` — get trip details
 - GET `/api/trips/me/favorites` — list my favorite trips (auth)
 - POST `/api/trips/:id/favorite` — add trip favorite (auth)
 - DELETE `/api/trips/:id/favorite` — remove trip favorite (auth)

Trips-Location (mount: `/api/trips-location`)
- GET `/api/trips-location` — list trip-location mappings
- GET `/api/trips-location/:tripId` — list locations for a trip

Misc
- GET `/api` — API index listing
- POST `/api/chat` — proxy to Chat API (if configured)
- POST `/api/events` — echo ingest endpoint

---

Use the `routes/` files as the source of truth if you need exact parameter names or additional query options. If you want, I can also generate a small machine-readable OpenAPI spec (YAML/JSON) from these routes.

## Một số lưu ý kỹ thuật

- Schema & migrations: `db/connect.js` tạo bảng chính và có hàm `ensureColumn` để thêm cột nếu DB cũ thiếu.
- Import dữ liệu: `scripts/import_shops_and_bikes.js` + `scripts/upsert_from_json.js`. Import sẽ backup DB trước khi ghi.
- Mật khẩu hiện đang lưu plaintext trong DB (chỉ dev). Khi lên production, chuyển sang hash (bcrypt) và an toàn hơn.

---

Muốn tôi bổ sung ví dụ curl cho một số endpoint (auth: register/login, rewards: redeem) không? Hoặc bạn muốn README tiếng Anh song song — chọn 1 trong các tuỳ chọn và tôi sẽ cập nhật ngay.
		```json
		{
			"name": "Old Town",
			"description": "Historic area",
			"address": "123 Old St",
			"city": "Hanoi",
			"rating": 4.5,
			"qr_code": "QR1"
		}
		```
	- Response: { id: <newId>, message: "📍 New location added!" }

### Users
- GET /api/users
	- Description: List all users
	- Response: Array of user objects

- POST /api/users
	- Description: Create a new user
	- Body:
		```json
		{ "username": "alice", "email": "alice@example.com", "password": "hashed_pw" }
		```
	- Response: { id: <newId>, message: "🧍 New user created!" }

- POST /api/users/complete
	- Description: Mark a challenge as completed for a user and add reward points
	- Body:
		```json
		{ "user_id": 1, "challenge_id": 2 }
		```
	- Response: { message: "✅ Challenge completed! +<points> points" }

### Challenges
- GET /api/challenges
	- Description: List all challenges (includes comma-separated locations in `locations` field)

- POST /api/challenges
	- Description: Create a challenge and optionally link to locations
	- Body:
		```json
		{
			"name": "Visit Historic",
			"description": "Visit historic places",
			"start_date": "2025-10-01",
			"end_date": "2025-12-31",
			"reward_point": 50,
			"location_ids": [1, 2]
		}
		```
	- Response: { id: <newId>, message: "🎯 Challenge created!" }

### Rewards
- GET /api/rewards
	- Description: List all rewards

- POST /api/rewards
	- Description: Create a new reward
	- Body:
		```json
		{ "name": "Free Coffee", "start_date": "2025-10-01", "end_date": "2025-12-31", "point_reward": 50 }
		```
	- Response: { id: <newId>, message: "🎁 New reward added!" }

- POST /api/rewards/redeem
	- Description: Redeem a reward for a user (will deduct user points and record the reward)
	- Body:
		```json
		{ "user_id": 1, "reward_id": 1 }
		```
	- Responses:
		- Success: { message: "🎉 Reward redeemed! Remaining points: <n>" }
		- Failure: { message: "❌ Not enough points" } or error object

## Notes about API
- All endpoints return JSON and use simple validation. The backend performs DB operations using SQLite and enforces FK constraints.
- For frontend integration, ensure CORS is configured (`CORS_ORIGIN`) so your frontend origin can call these endpoints during development.
- Voucher lifecycle: per-user codes generated on redemption or challenge completion (fields: `code,status,obtained_at,issued_at,expires_at,used_at`). Consume via `POST /api/rewards/use/:userRewardId`.
- Trip favorites mirror location favorites and expose `is_favorite` in trip list/detail responses.
- Shop addresses trimmed (city-level only) for cleaner international display.

