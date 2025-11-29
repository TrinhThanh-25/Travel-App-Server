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

The backend exposes a small REST API under `/api`. All responses are JSON. Below are the currently available endpoints and example request bodies.

Base path: `http://localhost:<PORT>/api` (default PORT=5000)

### Locations
 - `/api/locations` (routes/locationRoutes.js)
 - `/api/challenges` (routes/challengeRoutes.js)
 - `/api/users` (routes/userRoutes.js)
 - `/api/rewards` (routes/rewardRoutes.js)
 - `/auth` (routes/authRoutes.js)

### Reviews, Points & Filters (new)

The project now includes support for user reviews, a simple points/transactions ledger, and named filters which can be applied to locations.

- Reviews are stored in the `reviews` table and endpoints are mounted at `/api/reviews`.
	- POST `/api/reviews` (auth required) — create a review: { location_id, rating, comment }
	- GET `/api/reviews/location/:locationId` — list reviews for a location
	- DELETE `/api/reviews/:id` (auth required) — delete a review (owner only)

- Points transactions are stored in the `points_transactions` table and endpoints are mounted at `/api/points`.
	- POST `/api/points/transactions` (auth required) — record a credit/debit: { points, type, description, user_id? }
	- GET `/api/points/transactions` (auth required) — list the current user's transactions
	- GET `/api/points/me` (auth required) — get current user's total points

- Filters and `location_filters` let you tag locations with named filters and are mounted at `/api/filters`.
	- GET `/api/filters` — list available filters
	- POST `/api/filters` (auth required) — create a new filter: { name }

These endpoints are simple and intentionally lightweight. Reviews will recompute the associated location's `rating` and `review_count` automatically when created or deleted.

Ghi chú: các route hiện hầu hết là công khai; middleware JWT có sẵn và được áp dụng cho `/auth/me`.

### Auth (mount: /auth)

- POST /auth/register
	- Body: { username, email, password }
	- Tạo user mới, trả về { message, userId }

- POST /auth/login
	- Body: { email, password }
	- Trả về JWT token và thông tin cơ bản: { token, username, userId, points }

- POST /auth/logout
	- Stateless: server trả { message }

- GET /auth/me
	- Yêu cầu header Authorization: Bearer <token>
	- Trả về thông tin user (id, username, email, total_point, avatar, dob, ...)

### Users (mount: /api/users)

- GET /api/users
	- Lấy danh sách users (các cột hiển thị: id, username, email, total_point, avatar_url, dob, gender, phone)

- POST /api/users
	- Body: { username, email, password }
	- Tạo user mới

- POST /api/users/complete
	- Body: { user_id, challenge_id }
	- Ghi nhận user hoàn thành challenge (cộng điểm từ challenges.reward_point và upsert vào user_challenge)

- GET /api/users/:id
	- Lấy profile user theo id

- POST /api/users/:id
	- Cập nhật profile: { username, email, avatar_url, dob, gender, phone }

- POST /api/users/:id/avatar
	- Cập nhật avatar: { avatar_url }

- POST /api/users/:id/password
	- Đổi mật khẩu: { old_password, new_password }

- GET /api/users/:id/vouchers
	- Lấy voucher của user (từ bảng user_reward join rewards)

### Locations (mount: /api/locations)

- GET /api/locations
	- Trả về array các location (toàn bộ cột trong bảng `locations`)

- POST /api/locations
	- Body: { name, image_url, description, address, city, opening_hours, closing_hours, rating, review_count, qr_code }
	- Thêm location mới, trả id mới

### Challenges (mount: /api/challenges)

- GET /api/challenges
	- Trả về list challenges; controller gom tên locations liên quan vào trường `locations` bằng GROUP_CONCAT

- POST /api/challenges
	- Body: { name, description, start_date, end_date, reward_point, location_ids }
	- Tạo challenge và (tuỳ chọn) liên kết locations

- POST /api/challenges/:id/join
	- Body: { user_id }
	- User join challenge

- POST /api/challenges/:id/complete
	- Body: { user_id }
	- Ghi nhận hoàn thành, cộng điểm cho user và cập nhật user_challenge

### Rewards (mount: /api/rewards)

- GET /api/rewards
	- Trả về tất cả rewards

- GET /api/rewards/catalog?user_id=<id>
	- Trả về danh sách rewards mà user đủ điểm để đổi (so sánh users.total_point <= rewards.cost)

- POST /api/rewards
	- Body: { name, start_date, end_date, description, cost, expires_at, point_reward, max_uses, per_user_limit, metadata }
	- Tạo reward mới

- POST /api/rewards/redeem
	- Body: { user_id, reward_id }
	- Quy trình: kiểm tra điểm, trừ điểm, tạo row trong `user_reward` (voucher code), trả về voucher thông tin

---

## API Endpoints (hiện trạng)

Dưới đây là danh sách các route đang thực tế được mount trong thư mục `routes/`. Dùng danh sách này để test hoặc kết nối frontend.

Base URL: http://localhost:<PORT> (mặc định PORT = 5000)

Lưu ý chung:
- Nhiều route yêu cầu authentication (JWT) — xem `/auth` để biết cách lấy token.
- Một vài route trong `routes/` dùng helper `handlerOrNotImplemented` và sẽ trả 501 nếu handler chưa được cài (được chú thích trong code).
- Mật khẩu hiện lưu dưới dạng plaintext trong DB (dev only). Cần đổi sang bcrypt trước khi đưa lên production.

---

Auth (mount: `/auth`)
- POST `/auth/register` — body: { username, email, password } -> tạo user, trả về message/userId
- POST `/auth/login` — body: { email, password } -> trả về { token, username, userId, points }
- POST `/auth/logout` — stateless
- GET `/auth/me` — requires Authorization: Bearer <token>

Locations (mount: `/api/locations`)
- GET `/api/locations` — list locations (array)
- GET `/api/locations/:id` — get single location by id
- POST `/api/locations` — create location

Users (mount: `/api/users`)
- GET `/api/users` — list users (id, username, email, total_point, avatar_url, dob, gender, phone)
- POST `/api/users` — create user { username, email, password }
- POST `/api/users/complete` — mark challenge completed for user { user_id, challenge_id }
- GET `/api/users/:id` — get profile
- POST `/api/users/:id` — update profile
- POST `/api/users/:id/avatar` — update avatar
- POST `/api/users/:id/password` — change password
- GET `/api/users/:id/vouchers` — user vouchers

Challenges (mount: `/api/challenges`)
- GET `/api/challenges` — list challenges (may include `locations` comma-separated)
- POST `/api/challenges` — create challenge
- POST `/api/challenges/:id/join` — user join
- POST `/api/challenges/:id/complete` — mark complete, add points
- GET `/api/challenges/:id/locations`
- GET `/api/challenges/:id/rewards`

Rewards (mount: `/api/rewards`)
- GET `/api/rewards` — list rewards
- GET `/api/rewards/catalog` — optional query/user_id
- POST `/api/rewards` — create reward
- POST `/api/rewards/redeem` — redeem reward { user_id, reward_id }

Reviews (mount: `/api/reviews`)
- POST `/api/reviews` — create review (auth required) { location_id, rating, comment }
- GET `/api/reviews/location/:locationId` — list reviews for location
- DELETE `/api/reviews/:id` — delete (auth required)

Points (mount: `/api/points`)
- POST `/api/points/transactions` — record tx (auth required)
- GET `/api/points/transactions` — list user's tx (auth required)
- GET `/api/points/me` — get my points (auth required)

Filters (mount: `/api/filters`)
- GET `/api/filters` — list filters
- POST `/api/filters` — create filter (auth required)

Favorites (mount: `/api/favorites`)
- GET `/api/favorites` — list (queryable)
- GET `/api/favorites/find` — find favorite by query params
- POST `/api/favorites` — create favorite (auth)
- DELETE `/api/favorites/:id` — delete (auth)

Shops (mount: `/api/shops`)
- GET `/api/shops` — list shops
- GET `/api/shops/:shopId` — get shop details

Motorbikes (mount: `/api/motorbikes`)
- GET `/api/motorbikes` — list bikes
- GET `/api/motorbikes/:bikeId` — get bike
- PATCH `/api/motorbikes/:bikeId` — update bike (auth)

Rentals (mount: `/api/rentals`)
- POST `/api/rentals` — create rental (auth)
- GET `/api/rentals` — find rentals by filters (bikeId/userEmail/isReturned)
- PATCH `/api/rentals/:id` — update rental (auth)
- GET `/api/rentals/open` — list open rentals for a user

Tours (mount: `/api/tours`)
- GET `/api/tours` — list tours
- GET `/api/tours/:tourId` — get tour
- POST `/api/tours` — create tour
- PUT `/api/tours/:tourId` — update
- DELETE `/api/tours/:tourId` — delete

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

