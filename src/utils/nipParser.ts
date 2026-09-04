/**
 * Hasil parsing tanggal dari NIP.
 */
export interface NipParseResult {
  tahun_pengangkatan: number;
  bulan_pengangkatan: number;
}

/**
 * Mengekstrak tahun dan bulan pengangkatan dari NIP PNS 18 digit.
 *
 * Struktur NIP:
 *   [ 8 digit tgl lahir ][ 6 digit TMT ][ 4 digit nomor urut ]
 *   Contoh: 200410032025052001
 *            ↑8 digit↑↑↑TMT↑↑↑↑4 digit↑
 *                      202505
 *                      ↑↑↑↑ = 2025 (tahun pengangkatan)
 *                          ↑↑ = 05 (bulan pengangkatan)
 *
 * @param nip - String NIP 18 digit (misalnya: "200410032025052001")
 * @returns { tahun_pengangkatan: 2025, bulan_pengangkatan: 5 }
 * @throws Error jika format NIP tidak valid
 *
 * @example
 * parseNipDate("200410032025052001")
 * // → { tahun_pengangkatan: 2025, bulan_pengangkatan: 5 }
 */
export function parseNipDate(nip: string): NipParseResult {
  if (typeof nip !== 'string') {
    throw new Error('NIP harus berupa string.');
  }

  const trimmed = nip.trim();

  // Validasi: harus tepat 18 digit angka
  if (!/^\d{18}$/.test(trimmed)) {
    const digitCount = trimmed.replace(/\D/g, '').length;
    throw new Error(
      `NIP harus terdiri dari 18 digit angka. ` +
      `Diterima: "${trimmed}" (${digitCount} digit angka dari ${trimmed.length} karakter).`
    );
  }

  // Ambil 6 digit tengah: index 8 s/d 13 (inklusif)
  // Contoh: "200410032025052001"
  //           01234567890123456789
  //                   ↑8   ↑14
  const tmtString = trimmed.substring(8, 14); // "202505"

  const tahun = parseInt(tmtString.substring(0, 4), 10); // 2025
  const bulan = parseInt(tmtString.substring(4, 6), 10); // 5

  // Validasi bulan
  if (bulan < 1 || bulan > 12) {
    throw new Error(
      `Bulan pengangkatan tidak valid: ${bulan}. ` +
      `Harus antara 1-12. NIP: "${trimmed}".`
    );
  }

  // Validasi tahun (harus masuk akal untuk PNS Indonesia)
  const tahunSekarang = new Date().getFullYear();
  if (tahun < 1945 || tahun > tahunSekarang + 1) {
    throw new Error(
      `Tahun pengangkatan tidak valid: ${tahun}. NIP: "${trimmed}".`
    );
  }

  return { tahun_pengangkatan: tahun, bulan_pengangkatan: bulan };
}
