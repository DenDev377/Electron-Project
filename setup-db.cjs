const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(process.cwd(), 'src', 'assets', 'database', 'SQLite.db');
const db = new Database(dbPath);

try {
  db.prepare('ALTER TABLE pegawai ADD COLUMN pangkat_golongan TEXT;').run();
  console.log('Successfully added pangkat_golongan column.');
} catch (e) {
  if (e.message.includes('duplicate column name')) {
    console.log('Column pangkat_golongan already exists.');
  } else {
    console.error('Error adding column:', e);
  }
}
db.close();
