import db from "../db/connect.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const ACCESS_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h'; // access token lifetime
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30;

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function insertRefreshToken(userId, token, cb) {
  // Use SQLite datetime function to set expires_at consistently
  db.run(`INSERT INTO user_refresh_tokens (user_id, token, expires_at) VALUES (?, ?, datetime('now', '+${REFRESH_TTL_DAYS} days'))`, [userId, token], cb);
}

export const register = (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  db.run("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [username, email, password], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    const payload = { id: this.lastID, username };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
    const refreshToken = generateRefreshToken();
    insertRefreshToken(this.lastID, refreshToken, (rErr) => {
      if (rErr) console.warn('Could not persist refresh token:', rErr.message);
      res.json({ token: accessToken, refreshToken, userId: this.lastID });
    });
  });
};

export const login = (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });
  db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(401).json({ error: "Invalid credentials" });
    const payload = { id: row.id, username: row.username };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
    const refreshToken = generateRefreshToken();
    insertRefreshToken(row.id, refreshToken, (rErr) => {
      if (rErr) console.warn('Could not persist refresh token:', rErr.message);
      res.json({ token: accessToken, refreshToken, userId: row.id, username: row.username, points: row.total_point || 0 });
    });
  });
};

export const logout = (req, res) => {
  // Accept refresh_token in body to revoke server-side
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.json({ message: 'Logout successful' });
  db.run('UPDATE user_refresh_tokens SET revoked = 1 WHERE token = ?', [refreshToken], function (err) {
    if (err) console.warn('Could not revoke refresh token:', err.message);
    res.json({ message: 'Logout successful' });
  });
};

export const me = (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  db.get(
    "SELECT id, username, email, total_point, avatar_url as avatar, dob, gender, phone FROM users WHERE id = ?",
    [userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'User not found' });
      res.json(row);
    }
  );
};

// Refresh access token endpoint
export const refresh = (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });
  // Validate token exists, not revoked and not expired
  db.get(`SELECT * FROM user_refresh_tokens WHERE token = ? AND revoked = 0 AND (expires_at IS NULL OR expires_at > datetime('now'))`, [refreshToken], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    // Load user to build payload
    db.get('SELECT id, username FROM users WHERE id = ?', [row.user_id], (uErr, user) => {
      if (uErr) return res.status(500).json({ error: uErr.message });
      if (!user) return res.status(404).json({ error: 'User not found' });

      // Rotate refresh token: revoke old, insert a new one
      const newRefresh = generateRefreshToken();
      db.run('UPDATE user_refresh_tokens SET revoked = 1 WHERE id = ?', [row.id], (revokeErr) => {
        if (revokeErr) console.warn('Could not revoke old refresh token:', revokeErr.message);
        insertRefreshToken(user.id, newRefresh, (insErr) => {
          if (insErr) console.warn('Could not persist new refresh token:', insErr.message);
          const payload = { id: user.id, username: user.username };
          const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
          res.json({ token: accessToken, refreshToken: newRefresh });
        });
      });
    });
  });
};
