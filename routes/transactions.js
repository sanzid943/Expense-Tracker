
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDB, writeDB } = require('../db/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

function monthKey(dateStr) {
  return dateStr.slice(0, 7); // YYYY-MM
}


// generate due instances of recurring transactions

function processRecurring(db, userId) {
  const now = new Date();
  const templates = db.transactions.filter(
    t => t.userId === userId && t.recurring && !t.parentRecurringId
  );

  templates.forEach(tpl => {
    let lastDate = new Date(tpl.lastGeneratedDate || tpl.date);
    const freq = tpl.frequency || 'monthly';

    const advance = d => {
      const nd = new Date(d);
      if (freq === 'weekly') nd.setDate(nd.getDate() + 7);
      else if (freq === 'yearly') nd.setFullYear(nd.getFullYear() + 1);
      else nd.setMonth(nd.getMonth() + 1); // monthly default
      return nd;
    };

    let next = advance(lastDate);
    let generatedAny = false;
    let guard = 0;
    while (next <= now && guard < 60) {
      db.transactions.push({
        id: uuidv4(),
        userId,
        type: tpl.type,
        amount: tpl.amount,
        category: tpl.category,
        description: tpl.description + ' (recurring)',
        date: next.toISOString().slice(0, 10),
        recurring: false,
        frequency: null,
        parentRecurringId: tpl.id,
        createdAt: new Date().toISOString()
      });
      tpl.lastGeneratedDate = next.toISOString().slice(0, 10);
      generatedAny = true;
      next = advance(next);
      guard++;
    }
    if (generatedAny) tpl.lastGeneratedDate = tpl.lastGeneratedDate;
  });
}


// list transactions with filters

router.get('/', (req, res) => {
  const db = readDB();
  processRecurring(db, req.userId);
  writeDB(db);

  let list = db.transactions.filter(t => t.userId === req.userId);

  const { type, category, search, startDate, endDate, recurring } = req.query;

  if (type) list = list.filter(t => t.type === type);
  if (category) list = list.filter(t => t.category.toLowerCase() === category.toLowerCase());
  if (recurring !== undefined) list = list.filter(t => String(t.recurring) === recurring);
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(
      t => t.description.toLowerCase().includes(s) || t.category.toLowerCase().includes(s)
    );
  }
  if (startDate) list = list.filter(t => t.date >= startDate);
  if (endDate) list = list.filter(t => t.date <= endDate);

  list.sort((a, b) => (a.date < b.date ? 1 : -1));
  res.json(list);
});


// create transaction

router.post('/', (req, res) => {
  const { type, amount, category, description, date, recurring, frequency } = req.body;
  if (!type || !['income', 'expense'].includes(type)) {
    return res.status(400).json({ message: 'type must be income or expense' });
  }
  if (amount === undefined || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ message: 'amount must be a positive number' });
  }
  if (!category) return res.status(400).json({ message: 'category is required' });
  if (!date) return res.status(400).json({ message: 'date is required' });

  const db = readDB();
  const tx = {
    id: uuidv4(),
    userId: req.userId,
    type,
    amount: Number(amount),
    category,
    description: description || '',
    date,
    recurring: !!recurring,
    frequency: recurring ? (frequency || 'monthly') : null,
    lastGeneratedDate: recurring ? date : undefined,
    parentRecurringId: null,
    createdAt: new Date().toISOString()
  };
  db.transactions.push(tx);
  writeDB(db);
  res.status(201).json(tx);
});


// update transaction

router.put('/:id', (req, res) => {
  const db = readDB();
  const tx = db.transactions.find(t => t.id === req.params.id && t.userId === req.userId);
  if (!tx) return res.status(404).json({ message: 'Transaction not found' });

  const { type, amount, category, description, date, recurring, frequency } = req.body;
  if (type !== undefined) tx.type = type;
  if (amount !== undefined) tx.amount = Number(amount);
  if (category !== undefined) tx.category = category;
  if (description !== undefined) tx.description = description;
  if (date !== undefined) tx.date = date;
  if (recurring !== undefined) tx.recurring = !!recurring;
  if (frequency !== undefined) tx.frequency = frequency;

  writeDB(db);
  res.json(tx);
});


// delete transaction

router.delete('/:id', (req, res) => {
  const db = readDB();
  const idx = db.transactions.findIndex(t => t.id === req.params.id && t.userId === req.userId);
  if (idx === -1) return res.status(404).json({ message: 'Transaction not found' });
  db.transactions.splice(idx, 1);
  writeDB(db);
  res.json({ message: 'Deleted' });
});


// summary: totals

router.get('/meta/summary', (req, res) => {
  const db = readDB();
  const list = db.transactions.filter(t => t.userId === req.userId);
  const { month } = req.query;
  const filtered = month ? list.filter(t => monthKey(t.date) === month) : list;

  const income = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  res.json({ income, expense, balance: income - expense, count: filtered.length });
});


// category-wise summary

router.get('/meta/category-summary', (req, res) => {
  const db = readDB();
  const { month, type } = req.query;
  let list = db.transactions.filter(t => t.userId === req.userId);
  if (month) list = list.filter(t => monthKey(t.date) === month);
  if (type) list = list.filter(t => t.type === type);

  const map = {};
  list.forEach(t => {
    map[t.category] = (map[t.category] || 0) + t.amount;
  });
  res.json(Object.entries(map).map(([category, total]) => ({ category, total })));
});


// monthly summary

router.get('/meta/monthly-summary', (req, res) => {
  const db = readDB();
  const list = db.transactions.filter(t => t.userId === req.userId);
  const map = {};
  list.forEach(t => {
    const k = monthKey(t.date);
    if (!map[k]) map[k] = { month: k, income: 0, expense: 0 };
    map[k][t.type] += t.amount;
  });
  const result = Object.values(map).sort((a, b) => (a.month < b.month ? -1 : 1));
  res.json(result);
});


// weekly summary

router.get('/meta/weekly-summary', (req, res) => {
  const db = readDB();
  const list = db.transactions.filter(t => t.userId === req.userId && t.type === 'expense');
  const map = {};
  list.forEach(t => {
    const d = new Date(t.date);
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
    const key = `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
    map[key] = (map[key] || 0) + t.amount;
  });
  const result = Object.entries(map)
    .map(([week, total]) => ({ week, total }))
    .sort((a, b) => (a.week < b.week ? -1 : 1))
    .slice(-8);
  res.json(result);
});

module.exports = router;
