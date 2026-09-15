import type { PegawaiRow, Employee, ImportError } from '../types/pegawai';
import { parseNipDate } from './nipParser';

/**
 * Mengekstrak golongan dari string mentah seperti "2c" atau "II/c".
 */
function parseGolonganMentah(raw: string): { gol: string; sub: string } | null {
  const cleaned = raw.trim().toLowerCase();
  
  const arabicMatch = cleaned.match(/^([1-4])\s*\/?\s*([a-e])$/);
  if (arabicMatch) {
    const romawis = ['', 'I', 'II', 'III', 'IV'];
    return { gol: romawis[parseInt(arabicMatch[1], 10)], sub: arabicMatch[2] };
  }
  
  const romawiMatch = cleaned.match(/^([ivx]+)[\s/\-]*([a-e])$/);
  if (romawiMatch) {
    return { gol: romawiMatch[1].toUpperCase(), sub: romawiMatch[2] };
  }
  
  return null;
}

/**
 * Menghitung kredit/penyesuaian MKG berdasarkan golongan awal & sekarang.
 */
function hitungMkgAwalOtomatis(golSekarang: string, subSekarang: string, rawGolAwal?: string): number {
  const currGol = golSekarang.toUpperCase();
  const currSub = subSekarang.toLowerCase();
  
  if (!rawGolAwal) return 0;

  const awal = parseGolonganMentah(rawGolAwal);
  if (!awal) return 0;
  
  const startGol = awal.gol;
  const startSub = awal.sub;

  // 1. Kredit awal berdasarkan formasi pertama kali masuk
  let offset = 0;
  if (startSub === 'b' || startSub === 'c' || startSub === 'd') {
    offset = 3;
  }

  const mapGol: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 };
  const s = mapGol[startGol];
  const c = mapGol[currGol];

  if (!s || !c) return offset;

  // 2. Evaluasi apakah sudah melompat ke Golongan yang lebih tinggi (Penyesuaian Ijazah)
  
  // Jika pernah melompat dari Golongan I ke II
  if (s === 1 && c >= 2) {
    offset -= 6; // Pengurangan 6 tahun
  }

  // Jika pernah melompat dari Golongan II ke III
  if (s <= 2 && c >= 3) {
    offset -= 5; // Pengurangan 5 tahun
  }

  // Catatan: Tidak ada pengurangan untuk perpindahan dari III ke IV, 
  // sehingga offset akan dipertahankan utuh.
  
  return offset;
}

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

      // ─── 6. Hitung MKG awal (kredit MKG formasi langsung) ──────────
      // Deteksi Pangkat Awal dari NRP (NRP berawalan 6=3a, 5=2c, 4=2a)
      let golAwalOtomatis: string | undefined;
      if (row.nrp) {
        if (row.nrp.startsWith('6')) golAwalOtomatis = '3a';
        else if (row.nrp.startsWith('5')) golAwalOtomatis = '2c';
        else if (row.nrp.startsWith('4')) golAwalOtomatis = '2a';
      }

      // Jika ada di data Excel (contoh: Penyesuaian MKG = -5 untuk II/d ke III/a), gunakan itu.
      // Jika tidak ada, tapi NRP terdeteksi, sistem hitung otomatis pengurangnya.
      const mkg_awal = row.mkg_awal ?? hitungMkgAwalOtomatis(row.golongan.trim(), row.subgolongan.trim(), golAwalOtomatis);

      valid.push({
        nip,
        nama:        row.nama.trim(),
        golongan:    row.golongan.trim(),
        subgolongan: row.subgolongan.trim(),
        tahun_pengangkatan,
        bulan_pengangkatan,
        total_masa_kerja,
        mkg_awal,
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
