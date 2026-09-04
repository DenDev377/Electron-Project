const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'src', 'assets', 'database', 'SQLite.db');
const db = new Database(dbPath);

console.log("=== PEGAWAI ===");
const pegawai = db.prepare("SELECT * FROM pegawai LIMIT 3").all();
console.log(JSON.stringify(pegawai, null, 2));

console.log("\n=== TABEL GAJI ===");
const tabelGaji = db.prepare("SELECT * FROM tabel_gaji LIMIT 3").all();
console.log(JSON.stringify(tabelGaji, null, 2));

console.log("\n=== ATTEMPT JOIN ===");
const joinCheck = db.prepare(`
    SELECT
      p.nip,
      p.golongan,
      p.subgolongan,
      p.total_masa_kerja,
      tg.mkg
    FROM pegawai p
    LEFT JOIN tabel_gaji tg
      ON  tg.golongan    = p.golongan
      AND tg.subgolongan = p.subgolongan
      AND tg.mkg         = p.total_masa_kerja
    LIMIT 10
`).all();
console.log(JSON.stringify(joinCheck, null, 2));
