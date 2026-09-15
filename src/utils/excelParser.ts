import * as XLSX from 'xlsx';
import type { PegawaiRow } from '../types/pegawai';

/**
 * Mapping header kolom Excel (case-insensitive, trimmed)
 * ke field PegawaiRow.
 */
const HEADER_MAP: Record<string, keyof PegawaiRow> = {
  // NIP
  'nip': 'nip',
  'nip/nrp': 'nip',
  'nip / nrp': 'nip',
  'n i p': 'nip',
  'n.i.p': 'nip',
  // Nama
  'nama': 'nama',
  'nama pegawai': 'nama',
  // Golongan (kolom ini juga akan menghasilkan subgolongan via parseGolonganField)
  'golongan': 'golongan',
  'gol/pangkat': 'golongan',
  'pangkat/gol': 'golongan',
  'pangkat/golongan': 'golongan',
  'pangkat golongan': 'golongan',
  // Subgolongan (jika memang ada kolom terpisah di Excel)
  'subgolongan': 'subgolongan',
  'sub golongan': 'subgolongan',
  'ruang': 'subgolongan',
  // MKG Awal / Penyesuaian MKG
  'mkg awal': 'mkg_awal',
  'penyesuaian mkg': 'mkg_awal',
  'kredit mkg': 'mkg_awal',
  'pengurang mkg': 'mkg_awal',
  'satker': 'satuan_kerja',
  'satuan kerja': 'satuan_kerja',
  'status pegawai': 'status_pegawai',
};

/**
 * Mengekstrak 18-digit NIP dan NRP (jika ada) dari string seperti:
 *   "197505152000031003 / 60075136"
 *   → { nip: "197505152000031003", nrp: "60075136" }
 */
function parseNip(raw: string): { nip: string; nrp: string } {
  // Hapus semua tanda petik (', ", `) yang kadang muncul
  const cleaned = raw.replace(/['"``]/g, '').trim();

  const parts = cleaned.split('/').map((p) => p.trim());
  // Cari bagian yang tepat 18 digit angka (format NIP PNS)
  const nipPart = parts.find((p) => /^\d{18}$/.test(p));
  const nip = nipPart ?? parts[0] ?? cleaned;
  
  // NRP biasanya bagian lainnya setelah '/'
  let nrp = '';
  if (parts.length > 1) {
    const nrpPart = parts.find(p => p !== nipPart);
    if (nrpPart) nrp = nrpPart;
  }
  
  return { nip, nrp };
}

/**
 * Mengekstrak golongan (romawi) dan subgolongan (huruf) dari string seperti:
 *   "Jaksa Madya / (IV/a)"
 *   → { golongan: "IV", subgolongan: "a" }
 *
 * Pola yang dicari: tanda kurung berisi romawi garis miring huruf, contoh: (IV/a)
 * Romawi yang valid untuk PNS: I, II, III, IV (dan variasinya)
 */
function parseGolonganField(raw: string): { golongan: string; subgolongan: string } {
  const cleaned = raw.trim().toLowerCase();

  // Match pola 1: "2c", "3a", "4b" (Arabic)
  const arabicMatch = cleaned.match(/^([1-4])\s*\/?\s*([a-e])$/);
  if (arabicMatch) {
    const romawis = ['', 'I', 'II', 'III', 'IV'];
    return { golongan: romawis[parseInt(arabicMatch[1], 10)], subgolongan: arabicMatch[2] };
  }

  // Match pola 2: "II/c", "IIIa", "IV-b" (Roman)
  const romawiMatch = cleaned.match(/^([ivx]+)[\s/\-]*([a-e])$/);
  if (romawiMatch) {
    return { golongan: romawiMatch[1].toUpperCase(), subgolongan: romawiMatch[2] };
  }

  // Match pola 3: "(IV/a)" (Biasa dipakai di format lengkap)
  const bracketMatch = cleaned.match(/\(([ivx]+)\/([a-e])\)/);
  if (bracketMatch) {
    return { golongan: bracketMatch[1].toUpperCase(), subgolongan: bracketMatch[2] };
  }

  // Fallback: kembalikan nilai mentah (tidak ada pola yang cocok)
  return { golongan: raw, subgolongan: '' };
}

/**
 * Membaca File Excel (.xlsx / .xls) dan mengembalikan
 * array PegawaiRow dari worksheet pertama.
 *
 * @param file - File object dari input[type="file"] browser
 * @returns Promise<PegawaiRow[]>
 */
export async function parseExcelFile(file: File): Promise<PegawaiRow[]> {
  // Baca file sebagai ArrayBuffer
  const buffer = await file.arrayBuffer();

  // Parse workbook dengan SheetJS
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Ambil worksheet pertama
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('File Excel tidak memiliki worksheet.');
  }
  const worksheet = workbook.Sheets[firstSheetName];

  // Konversi worksheet ke array-of-arrays (raw rows)
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
  });

  if (rawRows.length < 2) {
    return [];
  }

  // Baris pertama = header (normalkan ke lowercase)
  const headerRow = (rawRows[0] as unknown[]).map((h) =>
    String(h).trim().toLowerCase()
  );

  // Baris berikutnya = data
  const dataRows = rawRows.slice(1);

  const result: PegawaiRow[] = dataRows
    .map((row) => {
      const cols = row as unknown[];
      const entry: Partial<PegawaiRow> = {};

      headerRow.forEach((header, colIndex) => {
        const field = HEADER_MAP[header];
        if (!field) return;

        const rawValue = cols[colIndex];
        const strValue =
          rawValue !== undefined && rawValue !== null
            ? String(rawValue).trim()
            : '';

        if (field === 'nip') {
          // Ekstrak 18-digit NIP dan NRP dari string seperti "197505152000031003 / 60075136"
          const parsedNip = parseNip(strValue);
          entry.nip = parsedNip.nip;
          if (parsedNip.nrp) {
            entry.nrp = parsedNip.nrp;
          }

        } else if (field === 'golongan') {
          // Ekstrak romawi DAN subgolongan dari satu kolom
          // contoh: "Jaksa Madya / (IV/a)" → golongan="IV", subgolongan="a"
          entry.pangkat_golongan = strValue;
          const parsed = parseGolonganField(strValue);
          entry.golongan = parsed.golongan;
          // Hanya set subgolongan dari sini jika belum diisi oleh kolom terpisah
          if (!entry.subgolongan) {
            entry.subgolongan = parsed.subgolongan;
          }

        } else {
          entry[field] = strValue;
        }
      });

      return entry as PegawaiRow;
    })
    // Buang baris kosong
    .filter(
      (row) =>
        row.nip !== '' ||
        row.nama !== '' ||
        row.golongan !== '' ||
        row.subgolongan !== '' ||
        row.satuan_kerja !== ''
    );

  return result;
}
