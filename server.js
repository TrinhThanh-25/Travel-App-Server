import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from "path";
import fs from 'fs';
import { fileURLToPath } from 'url';
import { sanitizeRequest } from './middleware/sanitize.js'; // Importing sanitizeRequest

// Load .env relative to this server file so running node from another cwd still
// picks up the backend `.env` (ensures DB_PATH and other settings are correct).
dotenv.config({ path: new URL('./.env', import.meta.url).pathname });
// Prefer explicit DB_PATH from environment (.env) else fallback to mutable travel_app.db (not template)
// Force use of mutable travel_app.db so imported data is visible (override any template setting)
process.env.DB_PATH = fileURLToPath(new URL('./travel_app.template.db', import.meta.url));
console.log('Using DB_PATH (template copy):', process.env.DB_PATH);

// Import DB dynamically after dotenv is configured so DB can read DB_PATH
const dbModule = await import("./db/connect.js");
const db = dbModule.default;
const dbReady = dbModule.ready;

// Wait for DB creation/migrations before loading routes that may query the DB
await dbReady;

// Dynamic route imports (single pass, avoid duplicate declarations)
const [
  locationRoutesModule,
  challengeRoutesModule,
  userRoutesModule,
  rewardRoutesModule,
  locationImageRoutesModule,
  authRoutesModule,
  favoriteRoutesModule,
  motorbikeRoutesModule,
  shopRoutesModule,
  rentalRoutesModule,
	reviewRoutesModule,
	tripReviewRoutesModule,
	pointsRoutesModule,
	tripsRoutesModule,
	tripsLocationRoutesModule
] = await Promise.all([
  import('./routes/locationRoutes.js'),
  import('./routes/challengeRoutes.js'),
  import('./routes/userRoutes.js'),
  import('./routes/rewardRoutes.js'),
  import('./routes/locationImageRoutes.js'),
  import('./routes/authRoutes.js'),
  import('./routes/favoriteRoutes.js'),
  import('./routes/motorbikeRoutes.js'),
  import('./routes/shopRoutes.js'),
  import('./routes/rentalRoutes.js'),
	import('./routes/locationReviewRoutes.js'),
	import('./routes/tripReviewRoutes.js'),
	import('./routes/pointsRoutes.js'),
	import('./routes/tripsRoutes.js'),
	import('./routes/tripsLocationRoutes.js')
]);

const locationRoutes = locationRoutesModule.default;
const challengeRoutes = challengeRoutesModule.default;
const userRoutes = userRoutesModule.default;
const rewardRoutes = rewardRoutesModule.default;
const locationImageRoutes = locationImageRoutesModule.default;
const authRoutes = authRoutesModule.default;
const favoriteRoutes = favoriteRoutesModule.default;
const motorbikeRoutes = motorbikeRoutesModule.default;
const shopRoutes = shopRoutesModule.default;
const rentalRoutes = rentalRoutesModule.default;
const reviewRoutes = reviewRoutesModule.default;
const tripReviewRoutes = tripReviewRoutesModule.default;
const pointsRoutes = pointsRoutesModule.default;
const tripsRoutes = tripsRoutesModule.default;
const tripsLocationRoutes = tripsLocationRoutesModule.default;
// dynamic import for payments
const paymentRoutesModule = await import('./routes/paymentRoutes.js');
const paymentRoutes = paymentRoutesModule.default;

const app = express();
// limit request body size to avoid large payload attacks
app.use(express.json({ limit: '10kb' }));

// basic security headers
app.use(helmet());

// simple global rate limiter (helps against basic abuse)
// Relax or disable in local/dev to avoid "Too many requests" when testing.
// Keep it simple: very high per-IP cap and short window, still prevents abuse bursts.
const limiterOptions = {
	windowMs: 60 * 1000, // 1 minute
	max: 100000, // allow up to 100k req/min per IP
	standardHeaders: true,
	legacyHeaders: false,
};
const globalLimiter = rateLimit(limiterOptions);
app.use(globalLimiter);

// basic request sanitization (escape HTML-sensitive characters)
app.use(sanitizeRequest);

// Serve the simple static client from /client so opening http://localhost:5000/index.html works
// Resolve client directory relative to this file so the server works when started
// from the project root or from inside the backend folder.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.join(__dirname, 'client');
app.use(express.static(clientDir));

// Debug route to inspect client directory used by static middleware
app.get('/__client_debug', (req, res) => {
	try {
		const files = fs.readdirSync(clientDir);
		res.json({ clientDir, exists: fs.existsSync(clientDir), files });
	} catch (err) {
		res.status(500).json({ clientDir, exists: fs.existsSync(clientDir), error: err.message });
	}
});

// Configure CORS for development. Frontend should set its origin in CORS_ORIGIN
// Example: CORS_ORIGIN=http://localhost:5173
const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: corsOrigin }));

// Định nghĩa các nhóm API
app.use("/api/locations", locationRoutes);
// nested images route for locations
app.use('/api/locations/:locationId/images', locationImageRoutes);
app.use("/api/challenges", challengeRoutes);
app.use("/api/users", userRoutes);
// temporary alias to match older docs that referenced /api/usersa
app.use("/api/usersa", userRoutes);
// mount auth routes at /auth to match endpoints like /auth/register
app.use("/auth", authRoutes);
app.use("/api/rewards", rewardRoutes);
// Mount newly added API groups
app.use('/api/favorites', favoriteRoutes);
app.use('/api/motorbikes', motorbikeRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/rentals', rentalRoutes);
// new endpoints for reviews, points, and filters
app.use("/api/reviews", reviewRoutes);
app.use("/api/trip-reviews", tripReviewRoutes);
app.use("/api/points", pointsRoutes);
app.use("/api/trips", tripsRoutes);
app.use("/api/trips-location", tripsLocationRoutes);
// payments endpoints
app.use('/api/payments', paymentRoutes);

// lightweight API root/status endpoint so visiting /api returns useful info
app.get('/api', (req, res) => {
	res.json({
		status: 'ok',
		api: '/api',
		endpoints: [
			'/api/locations',
			'/api/challenges',
			'/api/users',
			'/api/rewards',
			'/api/reviews',
			'/api/trip-reviews',
			'/api/points',
			'/api/trips',
			'/api/trips-location',
			'/api/favorites',
			'/api/motorbikes',
			'/api/shops',
			'/api/rentals',
			'/api/payments',
			'/auth/register',
			'/auth/login',
			'/auth/me',
			'/api/export/startup',
			'/api/chat',
			'/api/events',
		],
		message: 'Welcome to the Travel App API. See individual endpoints for resources.'
	});
});

// Export startup CSV if available
app.get('/api/export/startup', (req, res) => {
	// Look for startup_export.csv under the backend folder's scripts/db_exports first,
	// then fallback to the project root of this backend directory.
	const candidatePaths = [
		path.join(__dirname, 'scripts', 'db_exports', 'startup_export.csv'),
		path.join(__dirname, 'startup_export.csv')
	];
	const filePath = candidatePaths.find(p => fs.existsSync(p));
	if (!filePath) {
		return res.status(404).json({ error: 'startup_export.csv not found' });
	}
	res.setHeader('Content-Type', 'text/csv');
	res.setHeader('Content-Disposition', 'attachment; filename="startup_export.csv"');
	const stream = fs.createReadStream(filePath);
	stream.pipe(res);
});

// Proxy Chat to external Python Chat API (set CHAT_API_URL in env). If not configured, return 501.
app.post('/api/chat', async (req, res) => {
	const target = process.env.CHAT_API_URL;
	if (!target) {
		return res.status(501).json({ error: 'CHAT_API_URL not configured' });
	}
	try {
		const resp = await fetch(target, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(req.body || {})
		});
		const contentType = resp.headers.get('content-type') || '';
		res.status(resp.status);
		if (contentType.includes('application/json')) {
			const data = await resp.json();
			return res.json(data);
		}
		const text = await resp.text();
		return res.send(text);
	} catch (e) {
		return res.status(502).json({ error: 'Failed to reach Chat API', detail: e.message });
	}
});

// Events endpoint placeholder
app.post('/api/events', (req, res) => {
	// echo back for now; can be extended to persist or fan-out later
	res.status(201).json({ received: true, event: req.body || {} });
});

const PORT = process.env.PORT || 3000;
// Export the app for testing. Only start listening when not in test mode.
export default app;

if (process.env.NODE_ENV !== 'test') {
	app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT} (CORS allowed: ${corsOrigin})`));
}