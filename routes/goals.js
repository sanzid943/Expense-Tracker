const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDB, writeDB } = require('../db/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const db = readDB();
  res.json(db.goals.filter(g => g.userId === req.userId));
});

router.post('/', (req, res) => {
  const { name, targetAmount, currentAmount, deadline } = req.body;
  if (!name || !targetAmount) return res.status(400).json({ message: 'name and targetAmount required' });
  const db = readDB();
  const goal = {
    id: uuidv4(),
    userId: req.userId,
    name,
    targetAmount: Number(targetAmount),
    currentAmount: Number(currentAmount) || 0,
    deadline: deadline || null,
    createdAt: new Date().toISOString()
  };
  db.goals.push(goal);
  writeDB(db);
  res.status(201).json(goal);
});

router.put('/:id', (req, res) => {
  const db = readDB();
  const g = db.goals.find(x => x.id === req.params.id && x.userId === req.userId);
  if (!g) return res.status(404).json({ message: 'Goal not found' });
  const { name, targetAmount, currentAmount, deadline } = req.body;
  if (name !== undefined) g.name = name;
  if (targetAmount !== undefined) g.targetAmount = Number(targetAmount);
  if (currentAmount !== undefined) g.currentAmount = Number(currentAmount);
  if (deadline !== undefined) g.deadline = deadline;
  writeDB(db);
  res.json(g);
});

router.delete('/:id', (req, res) => {
  const db = readDB();
  const idx = db.goals.findIndex(x => x.id === req.params.id && x.userId === req.userId);
  if (idx === -1) return res.status(404).json({ message: 'Goal not found' });
  db.goals.splice(idx, 1);
  writeDB(db);
  res.json({ message: 'Deleted' });
});

module.exports = router;
