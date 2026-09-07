import type { Database } from 'better-sqlite3';
import type { Employee, ImportResult, ImportError, PegawaiKGB } from '../src/types/pegawai.js';

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
export function importEmployeesToDatabase(
  db: Database,
  employees: Employee[]
): ImportResult {
  let berhasil  = 0;
  let diperbarui = 0;
  let gagal     = 0;
  const errors: ImportError[] = [];

  // Prepared statement: cek apakah NIP sudah ada di database
  const checkStmt = db.prepare<[string], { id: number }>(
    'SELECT id FROM pegawai WHERE nip = ?'
  );

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
      pangkat_golongan   = excluded.pangkat_golongan,
      satuan_kerja       = excluded.satuan_kerja,
      status_pegawai     = excluded.status_pegawai
  `);

  // Bungkus seluruh loop dalam satu transaction.
  // better-sqlite3 transaction: jika fungsi selama callback throw
  // tanpa ditangkap, seluruh transaction di-ROLLBACK otomatis.
  const runTransaction = db.transaction((emps: Employee[]) => {
    for (let i = 0; i < emps.length; i++) {
      const emp = emps[i];
      try {
        // Cek apakah NIP sudah ada sebelum insert
        const existing = checkStmt.get(emp.nip);

        upsertStmt.run({
          nip:                emp.nip,
          nama:               emp.nama,
          golongan:           emp.golongan,
          subgolongan:        emp.subgolongan,
          tahun_pengangkatan: emp.tahun_pengangkatan,
          bulan_pengangkatan: emp.bulan_pengangkatan,
          total_masa_kerja:   emp.total_masa_kerja,
          pangkat_golongan:   emp.pangkat_golongan ?? null,
          satuan_kerja:       emp.satuan_kerja   ?? null,
          status_pegawai:     emp.status_pegawai ?? null,
        });

        if (existing) {
          diperbarui++;
        } else {
          berhasil++;
        }

      } catch (err) {
        // Error per-baris: catat & lanjutkan baris berikutnya
        gagal++;
        errors.push({
          row:     i + 1,
          nip:     emp.nip,
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
export function getPegawaiKGB(db: Database): PegawaiKGB[] {
  const stmt = db.prepare<[], PegawaiKGB>(`
    SELECT
      p.id,
      p.nip,
      p.nama,
      p.golongan,
      p.subgolongan,
      p.tahun_pengangkatan,
      p.bulan_pengangkatan,
      p.total_masa_kerja,
      p.pangkat_golongan,
      p.satuan_kerja,
      p.status_pegawai,
      tg.gaji_pokok
    FROM pegawai p
    INNER JOIN tabel_gaji tg
      ON  tg.golongan    = p.golongan COLLATE NOCASE
      AND tg.subgolongan = p.subgolongan COLLATE NOCASE
      AND tg.mkg         = p.total_masa_kerja
    WHERE tg.gaji_pokok > 0
    ORDER BY p.nama ASC
  `);

  return stmt.all();
}
