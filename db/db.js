const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = { users: [], transactions: [], budgets: [], goals: [], categories: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw || '{}');
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { readDB, writeDB };
