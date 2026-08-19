
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDB, writeDB } = require('../db/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const DEFAULT_CATEGORIES = {
  expense: ['Food', 'Transport', 'Housing', 'Utilities', 'Entertainment', 'Health', 'Shopping', 'Education', 'Other'],
  income: ['Salary', 'Freelance', 'Investment', 'Gift', 'Other']
};

router.get('/', (req, res) => {
  const db = readDB();
  const custom = db.categories.filter(c => c.userId === req.userId);
  res.json({
    defaults: DEFAULT_CATEGORIES,
    custom
  });
});

router.post('/', (req, res) => {
  const { name, type } = req.body;
  if (!name || !type) return res.status(400).json({ message: 'name and type required' });
  const db = readDB();
  const cat = { id: uuidv4(), userId: req.userId, name, type };
  db.categories.push(cat);
  writeDB(db);
  res.status(201).json(cat);
});

router.delete('/:id', (req, res) => {
  const db = readDB();
  const idx = db.categories.findIndex(c => c.id === req.params.id && c.userId === req.userId);
  if (idx === -1) return res.status(404).json({ message: 'Category not found' });
  db.categories.splice(idx, 1);
  writeDB(db);
  res.json({ message: 'Deleted' });
});

module.exports = router;
