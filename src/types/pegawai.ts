/**
 * Representasi satu baris data pegawai yang dibaca dari file Excel.
 * Mapping kolom Excel → field TypeScript:
 *   "NIP"         → nip
 *   "Nama"        → nama
 *   "Golongan"    → golongan
 *   "Subgolongan" → subgolongan
 */
export interface PegawaiRow {
  nip: string;
  nama: string;
  golongan: string;
  subgolongan: string;
}
