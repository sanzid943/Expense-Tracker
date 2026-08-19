# SpendTrack — Smart Expense Tracker

A full-stack personal finance tracker with authentication, budgeting, savings goals,
charts, smart insights (pattern analysis, budget recommendations, unusual-spending
alerts, next-month prediction), and PDF/CSV export.

**Stack:** Node.js + Express (REST API) · JSON file storage (no DB server needed) ·
JWT auth + bcrypt · Vanilla HTML/CSS/JS frontend · Chart.js · jsPDF

## Features
- User registration/login (JWT, hashed passwords)
- Dashboard with income/expense/balance, trend chart, category chart, recent activity
- Add / edit / delete income & expense transactions
- Custom + default expense/income categories
- Full transaction history with search & filters (type, category, date range, keyword)
- Monthly budgets per category with progress bars and over-budget warnings
- Recurring transactions (weekly/monthly/yearly), auto-generated on each load
- Weekly & monthly expense summaries, category-wise breakdown
- Spending pattern analysis (6-month trend per category)
- Budget recommendations (avg. spend based + 50/30/20 income rule)
- Unusual spending alerts (current month vs. trailing average)
- Simple linear-regression expense prediction for next month
- Savings goals with progress tracking
- Monthly financial report with charts, budget vs actual, and full transaction list
- Export any transaction list or monthly report as CSV or PDF
- Profile settings: name, currency, monthly income target, password change
- Dark / light mode toggle (saved per user)

## Run it in VS Code

1. Open this folder (`expense-tracker`) in VS Code.
2. Open a terminal (`` Ctrl+` ``) and install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
   (or `npm run dev` if you installed `nodemon` and want auto-reload)
4. Open your browser at **http://localhost:5000**
5. Click **Create one** to register a new account, then log in.

The app stores all data in `db/db.json` (created automatically on first run) —
no external database setup required. Delete that file any time to reset all data.

## Project structure
```
expense-tracker/
├── server.js              # Express app entry point
├── db/
│   ├── db.js               # tiny JSON-file datastore helper
│   └── db.json              # data file (auto-created)
├── middleware/
│   └── auth.js              # JWT auth middleware
├── routes/
│   ├── auth.js               # register/login/profile/password
│   ├── transactions.js       # CRUD + summaries + recurring engine
│   ├── budget.js              # monthly budgets + status
│   ├── goals.js                # savings goals
│   ├── categories.js           # default + custom categories
│   └── insights.js              # patterns/recommendation/alerts/prediction/report
└── public/                 # frontend (served statically by Express)
    ├── login.html / register.html / index.html
    ├── css/style.css
    └── js/api.js, charts.js, export.js, app.js
```

## Notes
- Change `JWT_SECRET` in `.env` before using this anywhere beyond local/demo use.
- This uses a JSON file as a lightweight database, which is fine for personal/demo
  use but not for concurrent multi-user production traffic — swap `db/db.js` for a
  real database (e.g. SQLite/Postgres) if you want to take it further.
