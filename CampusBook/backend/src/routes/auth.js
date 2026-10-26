const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { isEmail, isText, validateBody } = require('../middleware/validate');

const router = express.Router();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED = 10;
const failed = new Map();

function tooManyFailures(key) {
  const entry = failed.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    failed.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILED;
}

function recordFailure(key) {
  const entry = failed.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) failed.set(key, { count: 1, first: Date.now() });
  else entry.count += 1;
}

const loginRules = validateBody({
  email: [isEmail, 'Enter a valid email address'],
  password: [value => isText(value, 100), 'Enter your password'],
});

router.post('/login', loginRules, async (req, res, next) => {
  try {
    const email = req.body.email.trim().toLowerCase();
    const key = `${req.ip}|${email}`;
    if (tooManyFailures(key)) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes' });
    }
    const [[user]] = await pool.query(
      'SELECT user_id, full_name, email, password_hash, role FROM users WHERE email = ?',
      [email]
    );

    const valid = user && (await bcrypt.compare(req.body.password, user.password_hash));
    if (!valid) {
      recordFailure(key);
      return res.status(401).json({ error: 'Email or password is incorrect' });
    }

    failed.delete(key);
    const profile = { id: user.user_id, name: user.full_name, email: user.email, role: user.role };
    const token = jwt.sign(profile, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: profile });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  const { id, name, email, role } = req.user;
  res.json({ user: { id, name, email, role } });
});

module.exports = router;
