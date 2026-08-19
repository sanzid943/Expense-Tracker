const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { readDB, writeDB } = require('../db/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
}

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

// Register
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  const db = readDB();
  const exists = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (exists) return res.status(409).json({ message: 'Email already registered' });

  const passwordHash = bcrypt.hashSync(password, 10);
  const user = {
    id: uuidv4(),
    name,
    email,
    passwordHash,
    currency: 'USD',
    theme: 'light',
    monthlyIncomeTarget: 0,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  writeDB(db);

  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, user.passwordHash);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

// Get profile
router.get('/me', authMiddleware, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(publicUser(user));
});

// Update profile
router.put('/profile', authMiddleware, (req, res) => {
  const { name, currency, theme, monthlyIncomeTarget } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (name !== undefined) user.name = name;
  if (currency !== undefined) user.currency = currency;
  if (theme !== undefined) user.theme = theme;
  if (monthlyIncomeTarget !== undefined) user.monthlyIncomeTarget = monthlyIncomeTarget;

  writeDB(db);
  res.json(publicUser(user));
});

// Change password
router.put('/password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const valid = bcrypt.compareSync(currentPassword || '', user.passwordHash);
  if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' });
  }
  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  writeDB(db);
  res.json({ message: 'Password updated successfully' });
});

module.exports = router;
