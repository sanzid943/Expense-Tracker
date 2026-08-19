const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDB, writeDB } = require('../db/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// List budgets (optionally by month)
router.get('/', (req, res) => {
  const db = readDB();
  let list = db.budgets.filter(b => b.userId === req.userId);
  if (req.query.month) list = list.filter(b => b.month === req.query.month);
  res.json(list);
});

// Create/update budget for category+month (upsert)
router.post('/', (req, res) => {
  const { category, amount, month } = req.body;
  if (!category || amount === undefined || !month) {
    return res.status(400).json({ message: 'category, amount and month are required' });
  }
  const db = readDB();
  let budget = db.budgets.find(
    b => b.userId === req.userId && b.category === category && b.month === month
  );
  if (budget) {
    budget.amount = Number(amount);
  } else {
    budget = { id: uuidv4(), userId: req.userId, category, amount: Number(amount), month };
    db.budgets.push(budget);
  }
  writeDB(db);
  res.status(201).json(budget);
});

router.put('/:id', (req, res) => {
  const db = readDB();
  const b = db.budgets.find(x => x.id === req.params.id && x.userId === req.userId);
  if (!b) return res.status(404).json({ message: 'Budget not found' });
  const { amount, category, month } = req.body;
  if (amount !== undefined) b.amount = Number(amount);
  if (category !== undefined) b.category = category;
  if (month !== undefined) b.month = month;
  writeDB(db);
  res.json(b);
});

router.delete('/:id', (req, res) => {
  const db = readDB();
  const idx = db.budgets.findIndex(x => x.id === req.params.id && x.userId === req.userId);
  if (idx === -1) return res.status(404).json({ message: 'Budget not found' });
  db.budgets.splice(idx, 1);
  writeDB(db);
  res.json({ message: 'Deleted' });
});

// Budget status: spend vs limit + warnings
router.get('/status/:month', (req, res) => {
  const db = readDB();
  const month = req.params.month;
  const budgets = db.budgets.filter(b => b.userId === req.userId && b.month === month);
  const txs = db.transactions.filter(
    t => t.userId === req.userId && t.type === 'expense' && t.date.slice(0, 7) === month
  );

  const status = budgets.map(b => {
    const spent = txs.filter(t => t.category === b.category).reduce((s, t) => s + t.amount, 0);
    const percent = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
    let level = 'ok';
    if (percent >= 100) level = 'exceeded';
    else if (percent >= 80) level = 'warning';
    return { category: b.category, budget: b.amount, spent, percent, level };
  });

  res.json(status);
});

module.exports = router;
