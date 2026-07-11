const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../../db/bot.db'));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  db.run(`
    INSERT OR IGNORE INTO settings (key, value)
    VALUES ('current_model', 'gemma2:2b')
  `);
});

module.exports = db;
