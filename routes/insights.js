const express = require('express');
const { readDB } = require('../db/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

function lastNMonthKeys(n) {
  const keys = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

// Spending pattern analysis: category totals per month for last 6 months
router.get('/patterns', (req, res) => {
  const db = readDB();
  const months = lastNMonthKeys(6);
  const txs = db.transactions.filter(t => t.userId === req.userId && t.type === 'expense');

  const byMonthCategory = {};
  months.forEach(m => (byMonthCategory[m] = {}));
  txs.forEach(t => {
    const m = monthKey(t.date);
    if (!byMonthCategory[m]) return;
    byMonthCategory[m][t.category] = (byMonthCategory[m][t.category] || 0) + t.amount;
  });

  const categories = [...new Set(txs.map(t => t.category))];
  const series = categories.map(cat => ({
    category: cat,
    data: months.map(m => byMonthCategory[m][cat] || 0)
  }));

  res.json({ months, series });
});

// Budget recommendation: based on avg spend per category over last 3 months, suggest budgets
// Also apply a 50/30/20 style guideline on overall income if available
router.get('/recommendation', (req, res) => {
  const db = readDB();
  const months = lastNMonthKeys(3);
  const txs = db.transactions.filter(
    t => t.userId === req.userId && t.type === 'expense' && months.includes(monthKey(t.date))
  );

  const totals = {};
  txs.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });

  const recommendations = Object.entries(totals).map(([category, total]) => {
    const avg = total / months.length;
    // recommend slightly below average spend to encourage saving (95%)
    return { category, averageSpend: Math.round(avg), recommendedBudget: Math.round(avg * 0.95) };
  });

  const incomeTxs = db.transactions.filter(
    t => t.userId === req.userId && t.type === 'income' && months.includes(monthKey(t.date))
  );
  const avgIncome = incomeTxs.reduce((s, t) => s + t.amount, 0) / months.length || 0;

  const rule502030 = {
    needs: Math.round(avgIncome * 0.5),
    wants: Math.round(avgIncome * 0.3),
    savings: Math.round(avgIncome * 0.2)
  };

  res.json({ recommendations, averageMonthlyIncome: Math.round(avgIncome), rule502030 });
});

// Unusual spending alerts: flag categories where current month spend > avg of prior 3 months + 40%
router.get('/alerts', (req, res) => {
  const db = readDB();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const priorMonths = lastNMonthKeys(4).filter(m => m !== currentMonth);

  const txs = db.transactions.filter(t => t.userId === req.userId && t.type === 'expense');

  const currentTotals = {};
  txs.filter(t => monthKey(t.date) === currentMonth).forEach(t => {
    currentTotals[t.category] = (currentTotals[t.category] || 0) + t.amount;
  });

  const priorTotals = {};
  priorMonths.forEach(m => (priorTotals[m] = {}));
  txs.filter(t => priorMonths.includes(monthKey(t.date))).forEach(t => {
    const m = monthKey(t.date);
    priorTotals[m][t.category] = (priorTotals[m][t.category] || 0) + t.amount;
  });

  const alerts = [];
  Object.keys(currentTotals).forEach(cat => {
    const priorAmounts = priorMonths.map(m => priorTotals[m][cat] || 0);
    const avgPrior = priorAmounts.reduce((a, b) => a + b, 0) / (priorAmounts.length || 1);
    const current = currentTotals[cat];
    if (avgPrior > 0 && current > avgPrior * 1.4) {
      alerts.push({
        category: cat,
        currentSpend: current,
        averagePriorSpend: Math.round(avgPrior),
        percentIncrease: Math.round(((current - avgPrior) / avgPrior) * 100)
      });
    } else if (avgPrior === 0 && current > 0) {
      alerts.push({
        category: cat,
        currentSpend: current,
        averagePriorSpend: 0,
        percentIncrease: null,
        note: 'New spending category this month'
      });
    }
  });

  res.json(alerts);
});

// Expense prediction: simple linear regression over last 6 months' totals
router.get('/prediction', (req, res) => {
  const db = readDB();
  const months = lastNMonthKeys(6);
  const txs = db.transactions.filter(t => t.userId === req.userId && t.type === 'expense');

  const totals = months.map(m =>
    txs.filter(t => monthKey(t.date) === m).reduce((s, t) => s + t.amount, 0)
  );

  // simple linear regression y = a + bx
  const n = totals.length;
  const xs = totals.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = totals.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * totals[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);

  const denom = n * sumX2 - sumX * sumX;
  let b = 0;
  let a = totals.length ? sumY / n : 0;
  if (denom !== 0) {
    b = (n * sumXY - sumX * sumY) / denom;
    a = (sumY - b * sumX) / n;
  }

  const nextX = n;
  let predicted = a + b * nextX;
  if (predicted < 0) predicted = 0;

  res.json({
    months,
    historicalTotals: totals,
    predictedNextMonth: Math.round(predicted),
    trend: b > 0 ? 'increasing' : b < 0 ? 'decreasing' : 'stable'
  });
});

// Monthly financial report data
router.get('/report/:month', (req, res) => {
  const db = readDB();
  const month = req.params.month;
  const txs = db.transactions.filter(t => t.userId === req.userId && monthKey(t.date) === month);

  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const categoryBreakdown = {};
  txs.filter(t => t.type === 'expense').forEach(t => {
    categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + t.amount;
  });

  const budgets = db.budgets.filter(b => b.userId === req.userId && b.month === month);

  res.json({
    month,
    income,
    expense,
    balance: income - expense,
    categoryBreakdown: Object.entries(categoryBreakdown).map(([category, total]) => ({ category, total })),
    budgets,
    transactions: txs.sort((a, b) => (a.date < b.date ? -1 : 1))
  });
});

module.exports = router;
