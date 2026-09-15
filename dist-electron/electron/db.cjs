"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importEmployeesToDatabase = importEmployeesToDatabase;
exports.getPegawaiKGB = getPegawaiKGB;
exports.resetPegawai = resetPegawai;
/**
 * Memasukkan atau memperbarui data pegawai ke tabel `pegawai` dalam SQLite.
 *
 * Strategi:
 * - INSERT ... ON CONFLICT(nip) DO UPDATE → "upsert" aman tanpa duplikat
 * - Seluruh operasi dibungkus dalam satu transaction
 * - Error per-baris dicatat tanpa membatalkan baris lain
 * - Error fatal di luar transaction otomatis di-rollback oleh better-sqlite3
 *
 * @param db        - Instance Database dari better-sqlite3
 * @param employees - Array Employee yang sudah tervalidasi
 * @returns ImportResult berisi statistik dan detail error
 */
function importEmployeesToDatabase(db, employees) {
    let berhasil = 0;
    let diperbarui = 0;
    let gagal = 0;
    const errors = [];
    // Prepared statement: cek apakah NIP sudah ada di database
    const checkStmt = db.prepare('SELECT id FROM pegawai WHERE nip = ?');
    // Prepared statement: INSERT dengan upsert via ON CONFLICT
    // Jika nip sudah ada → UPDATE semua kolom kecuali id
    // Jika nip belum ada → INSERT record baru
    const upsertStmt = db.prepare(`
    INSERT INTO pegawai (
      nip,
      nama,
      golongan,
      subgolongan,
      tahun_pengangkatan,
      bulan_pengangkatan,
      total_masa_kerja,
      mkg_awal,
      pangkat_golongan,
      satuan_kerja,
      status_pegawai
    ) VALUES (
      @nip,
      @nama,
      @golongan,
      @subgolongan,
      @tahun_pengangkatan,
      @bulan_pengangkatan,
      @total_masa_kerja,
      @mkg_awal,
      @pangkat_golongan,
      @satuan_kerja,
      @status_pegawai
    )
    ON CONFLICT(nip) DO UPDATE SET
      nama               = excluded.nama,
      golongan           = excluded.golongan,
      subgolongan        = excluded.subgolongan,
      tahun_pengangkatan = excluded.tahun_pengangkatan,
      bulan_pengangkatan = excluded.bulan_pengangkatan,
      total_masa_kerja   = excluded.total_masa_kerja,
      mkg_awal           = excluded.mkg_awal,
      pangkat_golongan   = excluded.pangkat_golongan,
      satuan_kerja       = excluded.satuan_kerja,
      status_pegawai     = excluded.status_pegawai
  `);
    // Bungkus seluruh loop dalam satu transaction.
    // better-sqlite3 transaction: jika fungsi selama callback throw
    // tanpa ditangkap, seluruh transaction di-ROLLBACK otomatis.
    const runTransaction = db.transaction((emps) => {
        for (let i = 0; i < emps.length; i++) {
            const emp = emps[i];
            try {
                // Cek apakah NIP sudah ada sebelum insert
                const existing = checkStmt.get(emp.nip);
                upsertStmt.run({
                    nip: emp.nip,
                    nama: emp.nama,
                    golongan: emp.golongan,
                    subgolongan: emp.subgolongan,
                    tahun_pengangkatan: emp.tahun_pengangkatan,
                    bulan_pengangkatan: emp.bulan_pengangkatan,
                    total_masa_kerja: emp.total_masa_kerja,
                    mkg_awal: emp.mkg_awal ?? 0,
                    pangkat_golongan: emp.pangkat_golongan ?? null,
                    satuan_kerja: emp.satuan_kerja ?? null,
                    status_pegawai: emp.status_pegawai ?? null,
                });
                if (existing) {
                    diperbarui++;
                }
                else {
                    berhasil++;
                }
            }
            catch (err) {
                // Error per-baris: catat & lanjutkan baris berikutnya
                gagal++;
                errors.push({
                    row: i + 1,
                    nip: emp.nip,
                    message: err instanceof Error
                        ? err.message
                        : 'Gagal menyimpan ke database.',
                });
            }
        }
    });
    // Jalankan transaction
    // Jika terjadi error fatal yang tidak tertangkap di dalam callback,
    // better-sqlite3 otomatis melakukan ROLLBACK
    runTransaction(employees);
    return { berhasil, diperbarui, gagal, errors };
}
/**
 * Mengambil daftar pegawai yang mendapat KGB pada tahun berjalan.
 *
 * Cara kerja:
 * - JOIN tabel `pegawai` dengan `tabel_gaji`
 * - Cocokkan golongan, subgolongan, dan total_masa_kerja (= MKG di tabel_gaji)
 * - Hanya ambil baris di mana gaji_pokok IS NOT NULL
 *   (NULL berarti MKG tersebut tidak valid / pegawai belum layak KGB)
 *
 * @param db - Instance Database dari better-sqlite3
 * @returns Array PegawaiKGB yang siap ditampilkan di UI
 */
function getPegawaiKGB(db) {
    const currentYear = new Date().getFullYear();
    // MKG efektif = mkg_awal + total_masa_kerja
    // - mkg_awal=0: pegawai reguler (II/a, III/a) mulai dari 0
    // - mkg_awal=3: pegawai formasi langsung (II/b, II/c, II/d, dst) mulai dari 3
    // Dengan rumus ini, RIRIS (mkg_awal=3, total=1) → effective_mkg=4 → next_valid=5 → KGB 1 tahun lagi
    // Dan MARISKA (mkg_awal=0, total=2) → effective_mkg=2 → next_valid=3 → KGB 1 tahun lagi
    const stmt = db.prepare(`
    SELECT
      p.id,
      p.nip,
      p.nama,
      p.golongan,
      p.subgolongan,
      p.tahun_pengangkatan,
      p.bulan_pengangkatan,
      p.total_masa_kerja,
      COALESCE(p.mkg_awal, 0) as mkg_awal,
      COALESCE(p.mkg_awal, 0) + p.total_masa_kerja as mkg,
      p.pangkat_golongan,
      p.satuan_kerja,
      p.status_pegawai,
      CASE
        WHEN tg_curr.gaji_pokok > 0 THEN tg_curr.gaji_pokok
        WHEN tg_next.gaji_pokok > 0 THEN tg_next.gaji_pokok
        WHEN tg_max.gaji_pokok > 0 THEN tg_max.gaji_pokok
        ELSE NULL
      END as gaji_pokok,
      NULL as mkg_berikutnya,
      CASE
        WHEN tg_curr.gaji_pokok > 0 THEN ?
        WHEN tg_next.gaji_pokok > 0 THEN ? + (tg_next.mkg - (COALESCE(p.mkg_awal, 0) + p.total_masa_kerja))
        ELSE NULL -- Jika sudah mentok MKG maksimal, tidak ada KGB berikutnya
      END as tahun_kgb_berikutnya
    FROM pegawai p
    -- Cek gaji di MKG efektif saat ini (mkg_awal + total_masa_kerja)
    LEFT JOIN tabel_gaji tg_curr
      ON  tg_curr.golongan    = p.golongan    COLLATE NOCASE
      AND tg_curr.subgolongan = p.subgolongan COLLATE NOCASE
      AND tg_curr.mkg         = COALESCE(p.mkg_awal, 0) + p.total_masa_kerja
      AND tg_curr.gaji_pokok  > 0
    -- Cari MKG valid terdekat di atas effective_mkg
    LEFT JOIN tabel_gaji tg_next
      ON  tg_next.golongan    = p.golongan    COLLATE NOCASE
      AND tg_next.subgolongan = p.subgolongan COLLATE NOCASE
      AND tg_next.mkg         = (
            SELECT MIN(mkg) FROM tabel_gaji
            WHERE golongan    = p.golongan    COLLATE NOCASE
              AND subgolongan = p.subgolongan COLLATE NOCASE
              AND mkg         > COALESCE(p.mkg_awal, 0) + p.total_masa_kerja
              AND gaji_pokok  > 0
          )
      AND tg_curr.id IS NULL
    -- Cari MKG maksimum jika effective_mkg melebihi batas tabel
    LEFT JOIN tabel_gaji tg_max
      ON  tg_max.golongan    = p.golongan    COLLATE NOCASE
      AND tg_max.subgolongan = p.subgolongan COLLATE NOCASE
      AND tg_max.mkg         = (
            SELECT MAX(mkg) FROM tabel_gaji
            WHERE golongan    = p.golongan    COLLATE NOCASE
              AND subgolongan = p.subgolongan COLLATE NOCASE
              AND gaji_pokok  > 0
          )
      AND tg_curr.id IS NULL 
      AND tg_next.id IS NULL
    ORDER BY tahun_kgb_berikutnya ASC, p.bulan_pengangkatan ASC, p.nama ASC
  `);
    return stmt.all(currentYear, currentYear);
}
/**
 * Menghapus semua data dari tabel pegawai
 * tanpa menghapus data gaji dari tabel referensi.
 *
 * @param db - Instance Database dari better-sqlite3
 * @returns boolean sukses atau gagal
 */
function resetPegawai(db) {
    const transaction = db.transaction(() => {
        // 1. Hapus semua data pegawai
        db.prepare('DELETE FROM pegawai').run();
        // 2. Reset ID auto-increment (agar kembali mulai dari 1)
        db.prepare("DELETE FROM sqlite_sequence WHERE name='pegawai'").run();
    });
    try {
        transaction();
        return true;
    }
    catch (error) {
        console.error('[DB] Gagal mereset data pegawai:', error);
        return false;
    }
}
