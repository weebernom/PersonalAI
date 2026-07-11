const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../db');

// Check if the directory exists, if not, create it
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(path.join(dbDir, 'bot.db'));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  db.run(`
    INSERT OR IGNORE INTO settings (key, value)
    VALUES ('current_model', 'llama3-8b-8192')
  `);
});

module.exports = db;
