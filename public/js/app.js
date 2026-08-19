// app state

Auth.requireAuth();

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', BDT: '৳', INR: '₹' };

const State = {
  user: Auth.getUser(),
  categories: { defaults: { expense: [], income: [] }, custom: [] },
  currentMonth: new Date().toISOString().slice(0, 7),
  txType: 'expense'
};

function currencySymbol() {
  return CURRENCY_SYMBOLS[(State.user && State.user.currency) || 'USD'] || '$';
}
function fmt(amount) {
  const n = Number(amount) || 0;
  return currencySymbol() + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


// init

async function init() {
  applyTheme(State.user && State.user.theme === 'dark');
  document.getElementById('themeSwitch').checked = State.user && State.user.theme === 'dark';
  renderUserChip();
  wireNav();
  wireGlobalControls();
  wireTransactionModal();
  wireBudgetModal();
  wireGoalModal();
  wireSettings();

  await loadCategories();
  populateCategorySelects();

  document.getElementById('budgetMonth').value = State.currentMonth;
  document.getElementById('reportMonth').value = State.currentMonth;

  await loadDashboard();
}

function renderUserChip() {
  const u = State.user;
  if (!u) return;
  document.getElementById('userName').textContent = u.name;
  document.getElementById('userEmail').textContent = u.email;
  document.getElementById('userAvatar').textContent = u.name.slice(0, 1).toUpperCase();
}

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}


// navigation

function wireNav() {
  document.querySelectorAll('.nav a').forEach(a => {
    a.addEventListener('click', () => switchView(a.dataset.view));
  });
  document.querySelectorAll('[data-view]').forEach(el => {
    if (!el.closest('.nav')) el.addEventListener('click', () => switchView(el.dataset.view));
  });
  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

const VIEW_META = {
  dashboard: ['Dashboard', "Here's your financial overview"],
  transactions: ['Transactions', 'All your income & expenses'],
  budget: ['Budget', 'Set limits and track spending'],
  insights: ['Insights', 'Smart analysis of your spending'],
  goals: ['Savings Goals', 'Track progress toward your targets'],
  reports: ['Reports', 'Monthly financial summaries'],
  settings: ['Settings', 'Manage your profile and preferences']
};

async function switchView(view) {
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.getElementById('viewTitle').textContent = VIEW_META[view][0];
  document.getElementById('viewSub').textContent = VIEW_META[view][1];
  document.getElementById('sidebar').classList.remove('open');

  if (view === 'dashboard') await loadDashboard();
  if (view === 'transactions') await loadTransactions();
  if (view === 'budget') await loadBudget();
  if (view === 'insights') await loadInsights();
  if (view === 'goals') await loadGoals();
  if (view === 'reports') await loadReport();
  if (view === 'settings') await loadSettings();
}


// global controls

function wireGlobalControls() {
  document.getElementById('themeSwitch').addEventListener('change', async (e) => {
    const dark = e.target.checked;
    applyTheme(dark);
    try {
      const updated = await API.put('/auth/profile', { theme: dark ? 'dark' : 'light' });
      State.user = updated; Auth.updateUser(updated);
    } catch {}
    // redraw active charts with new theme colors
    const active = document.querySelector('.view.active').id.replace('view-', '');
    switchView(active);
  });

  document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());
}


// categories

async function loadCategories() {
  State.categories = await API.get('/categories');
}

function allCategoryNames(type) {
  const defaults = State.categories.defaults[type] || [];
  const custom = State.categories.custom.filter(c => c.type === type).map(c => c.name);
  return [...defaults, ...custom];
}

function populateCategorySelects() {
  const fill = (selectEl, includeAll) => {
    selectEl.innerHTML = '';
    if (includeAll) {
      const o = document.createElement('option'); o.value = ''; o.textContent = 'All categories';
      selectEl.appendChild(o);
    }
    const all = [...new Set([...allCategoryNames('expense'), ...allCategoryNames('income')])];
    all.forEach(name => {
      const o = document.createElement('option'); o.value = name; o.textContent = name;
      selectEl.appendChild(o);
    });
  };
  fill(document.getElementById('txCategoryFilter'), true);
  fill(document.getElementById('budgetCategory'), false);
  updateTxCategoryOptions();
}

function updateTxCategoryOptions() {
  const sel = document.getElementById('txCategory');
  const names = allCategoryNames(State.txType);
  sel.innerHTML = '';
  names.forEach(name => {
    const o = document.createElement('option'); o.value = name; o.textContent = name;
    sel.appendChild(o);
  });
}


// dashboard

async function loadDashboard() {
  const [summary, monthly, catSummary, prediction, budgetStatus, txList] = await Promise.all([
    API.get(`/transactions/meta/summary?month=${State.currentMonth}`),
    API.get('/transactions/meta/monthly-summary'),
    API.get(`/transactions/meta/category-summary?month=${State.currentMonth}&type=expense`),
    API.get('/insights/prediction'),
    API.get(`/budgets/status/${State.currentMonth}`),
    API.get('/transactions')
  ]);

  document.getElementById('statIncome').textContent = fmt(summary.income);
  document.getElementById('statExpense').textContent = fmt(summary.expense);
  document.getElementById('statBalance').textContent = fmt(summary.balance);
  document.getElementById('statPrediction').textContent = fmt(prediction.predictedNextMonth);
  document.getElementById('statPredictionSub').textContent = 'Trend: ' + prediction.trend;

  const months = monthly.map(m => m.month);
  trendChart(months, monthly.map(m => m.income), monthly.map(m => m.expense));
  categoryDonut('categoryChart', catSummary.map(c => c.category), catSummary.map(c => c.total));

  const recentBody = document.querySelector('#recentTxTable tbody');
  recentBody.innerHTML = '';
  txList.slice(0, 6).forEach(t => {
    recentBody.innerHTML += `<tr>
      <td>${t.date}</td>
      <td><span class="cat-pill">${t.category}</span></td>
      <td>${t.description || '—'}</td>
      <td class="amount-cell text-right ${t.type}">${t.type === 'expense' ? '-' : '+'}${fmt(t.amount)}</td>
    </tr>`;
  });
  if (!txList.length) recentBody.innerHTML = `<tr><td colspan="4" class="muted" style="text-align:center;">No transactions yet</td></tr>`;

  const warnEl = document.getElementById('dashboardBudgetWarnings');
  const warnings = budgetStatus.filter(b => b.level !== 'ok');
  warnEl.innerHTML = warnings.length ? '' : `<div class="empty-state" style="padding:20px;"><div class="ic">✓</div>All budgets on track this month</div>`;
  warnings.forEach(b => {
    warnEl.innerHTML += `<div class="alert-item" style="background:${b.level === 'exceeded' ? 'var(--expense-soft)' : 'var(--warn-soft)'}">
      <div><div class="name">${b.category}</div><div class="muted">${fmt(b.spent)} of ${fmt(b.budget)}</div></div>
      <span class="badge ${b.level}">${b.percent}%</span>
    </div>`;
  });
}


// transactions

let txCache = [];

async function loadTransactions() {
  const params = new URLSearchParams();
  const type = document.getElementById('txTypeFilter').value;
  const category = document.getElementById('txCategoryFilter').value;
  const search = document.getElementById('txSearch').value;
  const startDate = document.getElementById('txStartDate').value;
  const endDate = document.getElementById('txEndDate').value;
  if (type) params.set('type', type);
  if (category) params.set('category', category);
  if (search) params.set('search', search);
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);

  txCache = await API.get('/transactions?' + params.toString());
  renderTxTable(txCache);
}

function renderTxTable(list) {
  const tbody = document.querySelector('#txTable tbody');
  tbody.innerHTML = '';
  document.getElementById('txEmptyState').style.display = list.length ? 'none' : 'block';
  list.forEach(t => {
    tbody.innerHTML += `<tr>
      <td>${t.date}</td>
      <td><span class="badge ${t.type === 'income' ? 'ok' : 'exceeded'}">${t.type}</span></td>
      <td><span class="cat-pill">${t.category}</span></td>
      <td>${t.description || '—'} ${t.recurring ? `<span class="recurring-tag">↻ ${t.frequency}</span>` : ''}</td>
      <td class="amount-cell text-right ${t.type}">${t.type === 'expense' ? '-' : '+'}${fmt(t.amount)}</td>
      <td><button class="icon-btn" onclick="editTransaction('${t.id}')">✎</button></td>
      <td><button class="icon-btn" onclick="removeTransaction('${t.id}')">🗑</button></td>
    </tr>`;
  });
}

function wireTransactionModal() {
  document.getElementById('addTxBtn').addEventListener('click', () => openTxModal());
  document.getElementById('txModalClose').addEventListener('click', closeTxModal);
  document.getElementById('txModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'txModalOverlay') closeTxModal(); });

  document.getElementById('typeIncomeBtn').addEventListener('click', () => setTxType('income'));
  document.getElementById('typeExpenseBtn').addEventListener('click', () => setTxType('expense'));

  document.getElementById('txRecurring').addEventListener('change', (e) => {
    document.getElementById('frequencyField').style.display = e.target.checked ? 'block' : 'none';
  });

  document.getElementById('saveTxBtn').addEventListener('click', saveTransaction);

  ['txTypeFilter', 'txCategoryFilter', 'txStartDate', 'txEndDate'].forEach(id => {
    document.getElementById(id).addEventListener('change', loadTransactions);
  });
  let searchTimer;
  document.getElementById('txSearch').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadTransactions, 300);
  });

  document.getElementById('exportCsvBtn').addEventListener('click', () => exportTransactionsCSV(txCache));
  document.getElementById('exportPdfBtn').addEventListener('click', () => exportTransactionsPDF(txCache, 'Transaction History'));
}

function setTxType(type) {
  State.txType = type;
  document.getElementById('typeIncomeBtn').classList.toggle('active', type === 'income');
  document.getElementById('typeIncomeBtn').classList.toggle('income-active', type === 'income');
  document.getElementById('typeExpenseBtn').classList.toggle('active', type === 'expense');
  document.getElementById('typeExpenseBtn').classList.toggle('expense-active', type === 'expense');
  updateTxCategoryOptions();
}

function openTxModal(tx) {
  document.getElementById('txModalTitle').textContent = tx ? 'Edit Transaction' : 'Add Transaction';
  document.getElementById('txId').value = tx ? tx.id : '';
  setTxType(tx ? tx.type : 'expense');
  document.getElementById('txAmount').value = tx ? tx.amount : '';
  document.getElementById('txDate').value = tx ? tx.date : new Date().toISOString().slice(0, 10);
  document.getElementById('txDescription').value = tx ? tx.description : '';
  document.getElementById('txRecurring').checked = tx ? tx.recurring : false;
  document.getElementById('frequencyField').style.display = tx && tx.recurring ? 'block' : 'none';
  document.getElementById('txFrequency').value = (tx && tx.frequency) || 'monthly';
  updateTxCategoryOptions();
  if (tx) document.getElementById('txCategory').value = tx.category;
  document.getElementById('txModalOverlay').classList.add('active');
}
function closeTxModal() { document.getElementById('txModalOverlay').classList.remove('active'); }

async function saveTransaction() {
  const id = document.getElementById('txId').value;
  const payload = {
    type: State.txType,
    amount: parseFloat(document.getElementById('txAmount').value),
    category: document.getElementById('txCategory').value,
    description: document.getElementById('txDescription').value,
    date: document.getElementById('txDate').value,
    recurring: document.getElementById('txRecurring').checked,
    frequency: document.getElementById('txFrequency').value
  };
  if (!payload.amount || payload.amount <= 0) { alert('Please enter a valid amount'); return; }
  if (!payload.date) { alert('Please select a date'); return; }

  try {
    if (id) await API.put('/transactions/' + id, payload);
    else await API.post('/transactions', payload);
    closeTxModal();
    await loadTransactions();
  } catch (err) {
    alert(err.message);
  }
}

function editTransaction(id) {
  const tx = txCache.find(t => t.id === id);
  if (tx) openTxModal(tx);
}
async function removeTransaction(id) {
  if (!confirm('Delete this transaction?')) return;
  await API.delete('/transactions/' + id);
  await loadTransactions();
}


// budget

async function loadBudget() {
  const month = document.getElementById('budgetMonth').value || State.currentMonth;
  const [status] = await Promise.all([API.get(`/budgets/status/${month}`)]);
  const grid = document.getElementById('budgetCards');
  grid.innerHTML = '';
  document.getElementById('budgetEmptyState').style.display = status.length ? 'none' : 'block';
  status.forEach(b => {
    const cls = b.level === 'ok' ? '' : b.level === 'warning' ? 'warn' : 'over';
    grid.innerHTML += `<div class="card">
      <div class="card-head"><h3>${b.category}</h3><span class="badge ${b.level}">${b.percent}%</span></div>
      <div class="stat-value mono" style="font-size:1.2rem;">${fmt(b.spent)} <span class="muted" style="font-size:.85rem;font-weight:400;">/ ${fmt(b.budget)}</span></div>
      <div class="progress ${cls}"><div style="width:${Math.min(b.percent, 100)}%"></div></div>
      <div class="stat-sub">${b.level === 'exceeded' ? '⚠ Over budget' : b.level === 'warning' ? '⚠ Approaching limit' : '✓ On track'}</div>
    </div>`;
  });
}

function wireBudgetModal() {
  document.getElementById('addBudgetBtn').addEventListener('click', () => {
    document.getElementById('budgetModalMonth').value = document.getElementById('budgetMonth').value || State.currentMonth;
    document.getElementById('budgetModalOverlay').classList.add('active');
  });
  document.getElementById('budgetModalClose').addEventListener('click', () => document.getElementById('budgetModalOverlay').classList.remove('active'));
  document.getElementById('budgetModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'budgetModalOverlay') e.target.classList.remove('active'); });
  document.getElementById('saveBudgetBtn').addEventListener('click', async () => {
    const payload = {
      category: document.getElementById('budgetCategory').value,
      month: document.getElementById('budgetModalMonth').value,
      amount: parseFloat(document.getElementById('budgetAmount').value)
    };
    if (!payload.amount || payload.amount <= 0) { alert('Enter a valid budget amount'); return; }
    await API.post('/budgets', payload);
    document.getElementById('budgetModalOverlay').classList.remove('active');
    await loadBudget();
  });
  document.getElementById('budgetMonth').addEventListener('change', loadBudget);
}


// insights

async function loadInsights() {
  const [patterns, alerts, recommendation, prediction] = await Promise.all([
    API.get('/insights/patterns'),
    API.get('/insights/alerts'),
    API.get('/insights/recommendation'),
    API.get('/insights/prediction')
  ]);

  patternLineChart(patterns.months, patterns.series);

  const alertsList = document.getElementById('alertsList');
  alertsList.innerHTML = alerts.length ? '' : `<div class="empty-state" style="padding:20px;"><div class="ic">✓</div>No unusual spending detected this month</div>`;
  alerts.forEach(a => {
    alertsList.innerHTML += `<div class="alert-item">
      <div><div class="name">${a.category}</div><div class="muted">${fmt(a.currentSpend)} vs avg ${fmt(a.averagePriorSpend)}</div></div>
      <span class="badge warning">${a.percentIncrease !== null ? '+' + a.percentIncrease + '%' : 'New'}</span>
    </div>`;
  });

  const recList = document.getElementById('recommendationList');
  recList.innerHTML = recommendation.recommendations.length ? '' : `<div class="muted">Add more transaction history to get recommendations.</div>`;
  recommendation.recommendations.forEach(r => {
    recList.innerHTML += `<div class="recommend-row"><span>${r.category}</span><span class="mono">${fmt(r.recommendedBudget)}<span class="muted"> avg ${fmt(r.averageSpend)}</span></span></div>`;
  });

  const rule = document.getElementById('rule502030');
  rule.innerHTML = `
    <div class="card stat-card"><div class="stat-label">Needs (50%)</div><div class="stat-value mono" style="font-size:1.15rem;">${fmt(recommendation.rule502030.needs)}</div></div>
    <div class="card stat-card"><div class="stat-label">Wants (30%)</div><div class="stat-value mono" style="font-size:1.15rem;">${fmt(recommendation.rule502030.wants)}</div></div>
    <div class="card stat-card"><div class="stat-label">Savings (20%)</div><div class="stat-value mono" style="font-size:1.15rem;">${fmt(recommendation.rule502030.savings)}</div></div>
  `;

  predictionBarChart(prediction.months, prediction.historicalTotals, prediction.predictedNextMonth);
  document.getElementById('predictionText').textContent =
    `Next month's expenses are predicted at ${fmt(prediction.predictedNextMonth)} — trend is ${prediction.trend}.`;
}


// goals

let goalsCache = [];
async function loadGoals() {
  goalsCache = await API.get('/goals');
  const grid = document.getElementById('goalsGrid');
  grid.innerHTML = '';
  document.getElementById('goalsEmptyState').style.display = goalsCache.length ? 'none' : 'block';
  goalsCache.forEach(g => {
    const percent = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
    grid.innerHTML += `<div class="card goal-card">
      <div class="goal-top"><h3 style="margin:0;">${g.name}</h3><span class="badge ${percent >= 100 ? 'ok' : 'warning'}">${percent}%</span></div>
      <div class="goal-amounts">${fmt(g.currentAmount)} of ${fmt(g.targetAmount)}${g.deadline ? ' · by ' + g.deadline : ''}</div>
      <div class="progress"><div style="width:${percent}%"></div></div>
      <div class="row-actions">
        <button class="icon-btn" onclick="editGoal('${g.id}')">✎</button>
        <button class="icon-btn" onclick="removeGoal('${g.id}')">🗑</button>
      </div>
    </div>`;
  });
}

function wireGoalModal() {
  document.getElementById('addGoalBtn').addEventListener('click', () => openGoalModal());
  document.getElementById('goalModalClose').addEventListener('click', () => document.getElementById('goalModalOverlay').classList.remove('active'));
  document.getElementById('goalModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'goalModalOverlay') e.target.classList.remove('active'); });
  document.getElementById('saveGoalBtn').addEventListener('click', saveGoal);
}

function openGoalModal(goal) {
  document.getElementById('goalModalTitle').textContent = goal ? 'Edit Goal' : 'New Savings Goal';
  document.getElementById('goalId').value = goal ? goal.id : '';
  document.getElementById('goalName').value = goal ? goal.name : '';
  document.getElementById('goalTarget').value = goal ? goal.targetAmount : '';
  document.getElementById('goalCurrent').value = goal ? goal.currentAmount : 0;
  document.getElementById('goalDeadline').value = goal ? (goal.deadline || '') : '';
  document.getElementById('goalModalOverlay').classList.add('active');
}

async function saveGoal() {
  const id = document.getElementById('goalId').value;
  const payload = {
    name: document.getElementById('goalName').value,
    targetAmount: parseFloat(document.getElementById('goalTarget').value),
    currentAmount: parseFloat(document.getElementById('goalCurrent').value) || 0,
    deadline: document.getElementById('goalDeadline').value || null
  };
  if (!payload.name || !payload.targetAmount) { alert('Please enter a name and target amount'); return; }
  if (id) await API.put('/goals/' + id, payload);
  else await API.post('/goals', payload);
  document.getElementById('goalModalOverlay').classList.remove('active');
  await loadGoals();
}

function editGoal(id) {
  const g = goalsCache.find(x => x.id === id);
  if (g) openGoalModal(g);
}
async function removeGoal(id) {
  if (!confirm('Delete this goal?')) return;
  await API.delete('/goals/' + id);
  await loadGoals();
}


// reports

let reportCache = null;
async function loadReport() {
  const month = document.getElementById('reportMonth').value || State.currentMonth;
  const [report, budgetStatus] = await Promise.all([
    API.get('/insights/report/' + month),
    API.get('/budgets/status/' + month)
  ]);
  reportCache = report;

  document.getElementById('reportIncome').textContent = fmt(report.income);
  document.getElementById('reportExpense').textContent = fmt(report.expense);
  document.getElementById('reportBalance').textContent = fmt(report.balance);

  categoryDonut('reportChart', report.categoryBreakdown.map(c => c.category), report.categoryBreakdown.map(c => c.total));

  const budgetList = document.getElementById('reportBudgetList');
  budgetList.innerHTML = budgetStatus.length ? '' : `<div class="muted">No budgets set for this month.</div>`;
  budgetStatus.forEach(b => {
    budgetList.innerHTML += `<div class="recommend-row"><span>${b.category}</span><span class="mono">${fmt(b.spent)} / ${fmt(b.budget)} <span class="badge ${b.level}">${b.percent}%</span></span></div>`;
  });

  const tbody = document.querySelector('#reportTxTable tbody');
  tbody.innerHTML = '';
  report.transactions.forEach(t => {
    tbody.innerHTML += `<tr>
      <td>${t.date}</td>
      <td><span class="badge ${t.type === 'income' ? 'ok' : 'exceeded'}">${t.type}</span></td>
      <td><span class="cat-pill">${t.category}</span></td>
      <td>${t.description || '—'}</td>
      <td class="amount-cell text-right ${t.type}">${t.type === 'expense' ? '-' : '+'}${fmt(t.amount)}</td>
    </tr>`;
  });
  if (!report.transactions.length) tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;">No transactions this month</td></tr>`;

  document.getElementById('reportMonth').onchange = loadReport;
  document.getElementById('reportExportCsvBtn').onclick = () => exportTransactionsCSV(report.transactions, `report-${month}.csv`);
  document.getElementById('reportExportPdfBtn').onclick = () => exportReportPDF(report, currencySymbol());
}


// settings

function wireSettings() {
  document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
  document.getElementById('changePasswordBtn').addEventListener('click', changePassword);
  document.getElementById('addCategoryBtn').addEventListener('click', addCustomCategory);
}

async function loadSettings() {
  const u = State.user;
  document.getElementById('settingsName').value = u.name;
  document.getElementById('settingsEmail').value = u.email;
  document.getElementById('settingsCurrency').value = u.currency || 'USD';
  document.getElementById('settingsIncomeTarget').value = u.monthlyIncomeTarget || 0;
  renderCustomCategories();
}

async function saveProfile() {
  const payload = {
    name: document.getElementById('settingsName').value,
    currency: document.getElementById('settingsCurrency').value,
    monthlyIncomeTarget: parseFloat(document.getElementById('settingsIncomeTarget').value) || 0
  };
  const updated = await API.put('/auth/profile', payload);
  State.user = updated; Auth.updateUser(updated);
  renderUserChip();
  alert('Profile updated');
}

async function changePassword() {
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  if (!currentPassword || !newPassword) { alert('Fill both password fields'); return; }
  try {
    await API.put('/auth/password', { currentPassword, newPassword });
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    alert('Password updated successfully');
  } catch (err) {
    alert(err.message);
  }
}

function renderCustomCategories() {
  const el = document.getElementById('customCategoriesList');
  el.innerHTML = '';
  State.categories.custom.forEach(c => {
    el.innerHTML += `<span class="pill">${c.name} <span class="muted">(${c.type})</span> <span style="cursor:pointer;" onclick="removeCategory('${c.id}')">✕</span></span>`;
  });
}

async function addCustomCategory() {
  const name = document.getElementById('newCategoryName').value.trim();
  const type = document.getElementById('newCategoryType').value;
  if (!name) return;
  await API.post('/categories', { name, type });
  document.getElementById('newCategoryName').value = '';
  await loadCategories();
  populateCategorySelects();
  renderCustomCategories();
}

async function removeCategory(id) {
  await API.delete('/categories/' + id);
  await loadCategories();
  populateCategorySelects();
  renderCustomCategories();
}


// boot

init();
