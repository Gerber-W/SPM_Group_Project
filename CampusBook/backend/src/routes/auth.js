const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { isEmail, isText, validateBody } = require('../middleware/validate');

const router = express.Router();

const loginRules = validateBody({
  email: [isEmail, 'Enter a valid email address'],
  password: [value => isText(value, 100), 'Enter your password'],
});

router.post('/login', loginRules, async (req, res, next) => {
  try {
    const email = req.body.email.trim().toLowerCase();
    const [[user]] = await pool.query(
      'SELECT user_id, full_name, email, password_hash, role FROM users WHERE email = ?',
      [email]
    );

    const valid = user && (await bcrypt.compare(req.body.password, user.password_hash));
    if (!valid) return res.status(401).json({ error: 'Email or password is incorrect' });

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
