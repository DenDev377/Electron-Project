/**
 * Representasi satu baris data pegawai yang dibaca dari file Excel.
 * Dihasilkan oleh parseExcelFile() di excelParser.ts.
 */
export interface PegawaiRow {
  nip: string;
  nama: string;
  golongan: string;
  subgolongan: string;
  pangkat_golongan?: string;
  satuan_kerja: string;
  status_pegawai: string;
}

/**
 * Data pegawai yang sudah ditransformasi lengkap,
 * siap untuk disimpan ke tabel `pegawai` di SQLite.
 */
export interface Employee {
  nip: string;
  nama: string;
  golongan: string;
  subgolongan: string;
  tahun_pengangkatan: number;
  bulan_pengangkatan: number;
  total_masa_kerja: number;
  pangkat_golongan?: string;
  satuan_kerja?: string;
  status_pegawai?: string;
}

/**
 * Informasi error untuk satu baris Excel yang gagal diproses.
 */
export interface ImportError {
  row: number;
  nip: string;
  message: string;
}

/**
 * Hasil keseluruhan proses import dari Excel ke database.
 */
export interface ImportResult {
  berhasil: number;
  diperbarui: number;
  gagal: number;
  errors: ImportError[];
}

/**
 * Hasil JOIN antara tabel `pegawai` dan `tabel_gaji`.
 * Hanya berisi pegawai yang memiliki pasangan golongan/subgolongan/mkg
 * di tabel_gaji dengan gaji_pokok IS NOT NULL — artinya mereka
 * mendapat Kenaikan Gaji Berkala (KGB) pada tahun berjalan.
 */
export interface PegawaiKGB {
  id: number;
  nip: string;
  nama: string;
  golongan: string;
  subgolongan: string;
  tahun_pengangkatan: number;
  bulan_pengangkatan: number;
  total_masa_kerja: number;
  pangkat_golongan: string | null;
  satuan_kerja: string | null;
  status_pegawai: string | null;
  gaji_pokok: number;
}
