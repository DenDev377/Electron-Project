import type { PegawaiRow, Employee, ImportError } from '../types/pegawai';
import { parseNipDate } from './nipParser';

/**
 * Hasil transformasi data dari format Excel (PegawaiRow)
 * ke format siap database (Employee).
 */
export interface TransformResult {
  /** Baris yang berhasil divalidasi dan ditransformasi */
  valid: Employee[];
  /** Baris yang gagal divalidasi, beserta alasannya */
  errors: ImportError[];
}

/**
 * Mentransformasi array PegawaiRow (hasil parsing Excel)
 * menjadi Employee[] yang siap dimasukkan ke database.
 *
 * Proses yang dilakukan:
 * 1. Validasi semua field wajib (nip, nama, golongan, subgolongan)
 * 2. Validasi format NIP (tepat 18 digit angka)
 * 3. Deteksi duplikat NIP dalam batch yang sama
 * 4. Ekstrak tahun & bulan pengangkatan dari NIP via parseNipDate()
 * 5. Hitung total_masa_kerja = tahun sekarang - tahun_pengangkatan
 *
 * Baris yang gagal divalidasi tidak membatalkan baris lain —
 * keduanya dilaporkan secara terpisah.
 *
 * @param rows - Array hasil parsing Excel dari parseExcelFile()
 * @returns { valid: Employee[], errors: ImportError[] }
 */
export function transformEmployeeData(rows: PegawaiRow[]): TransformResult {
  const valid: Employee[] = [];
  const errors: ImportError[] = [];

  // Set untuk mendeteksi NIP duplikat dalam satu batch import
  const seenNips = new Set<string>();

  // Tahun berjalan diambil satu kali untuk konsistensi
  const tahunSekarang = new Date().getFullYear();

  rows.forEach((row, index) => {
    // +2: row Excel dimulai dari baris ke-2 (baris ke-1 adalah header)
    const rowNumber = index + 2;

    try {
      // ─── 1. Validasi field wajib ───────────────────────────────────
      if (!row.nip?.trim()) {
        throw new Error('NIP wajib diisi dan tidak boleh kosong.');
      }
      if (!row.nama?.trim()) {
        throw new Error('Nama wajib diisi dan tidak boleh kosong.');
      }
      if (!row.golongan?.trim()) {
        throw new Error('Golongan wajib diisi dan tidak boleh kosong.');
      }
      if (!row.subgolongan?.trim()) {
        throw new Error('Subgolongan wajib diisi dan tidak boleh kosong.');
      }

      const nip = row.nip.trim();

      // ─── 2. Validasi format NIP ────────────────────────────────────
      if (!/^\d{18}$/.test(nip)) {
        const digitOnly = nip.replace(/\D/g, '');
        throw new Error(
          `NIP harus terdiri dari 18 digit angka. ` +
          `Diterima: "${nip}" (${digitOnly.length} digit angka).`
        );
      }

      // ─── 3. Deteksi duplikat NIP dalam batch ini ───────────────────
      if (seenNips.has(nip)) {
        throw new Error(
          `NIP "${nip}" muncul lebih dari satu kali dalam file Excel ini.`
        );
      }
      seenNips.add(nip);

      // ─── 4. Ekstrak tahun & bulan pengangkatan dari NIP ───────────
      const { tahun_pengangkatan, bulan_pengangkatan } = parseNipDate(nip);

      // ─── 5. Hitung total masa kerja ────────────────────────────────
      const total_masa_kerja = tahunSekarang - tahun_pengangkatan;

      valid.push({
        nip,
        nama:        row.nama.trim(),
        golongan:    row.golongan.trim(),
        subgolongan: row.subgolongan.trim(),
        tahun_pengangkatan,
        bulan_pengangkatan,
        total_masa_kerja,
        pangkat_golongan: row.pangkat_golongan?.trim() || undefined,
        satuan_kerja:   row.satuan_kerja?.trim()   || undefined,
        status_pegawai: row.status_pegawai?.trim() || undefined,
      });

    } catch (err) {
      errors.push({
        row:     rowNumber,
        nip:     row.nip?.trim() || '(tidak ada)',
        message: err instanceof Error ? err.message : 'Error tidak diketahui.',
      });
    }
  });

  return { valid, errors };
}
