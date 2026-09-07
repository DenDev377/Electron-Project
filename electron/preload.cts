import { contextBridge, ipcRenderer } from 'electron';
import type { Employee, ImportResult, PegawaiKGB } from '../src/types/pegawai.js';

/**
 * Preload script — jembatan aman antara Electron main process dan renderer.
 *
 * Aturan keamanan:
 * - contextIsolation: true  → renderer tidak dapat akses Node.js langsung
 * - nodeIntegration: false  → renderer tidak dapat require() modul Node
 * - Hanya fungsi yang di-expose di sini yang bisa dipanggil dari React
 *
 * contextBridge.exposeInMainWorld() menempatkan objek `electronAPI`
 * ke dalam `window` renderer, tapi dalam konteks yang terisolasi.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Kirim array Employee ke main process untuk dimasukkan ke SQLite.
   * @param data - Array Employee tervalidasi dari transformEmployeeData()
   * @returns Promise<ImportResult> hasil insert/update dari database
   */
  importPegawai: (data: Employee[]): Promise<ImportResult> =>
    ipcRenderer.invoke('db:importPegawai', data),

  /**
   * Mengambil daftar pegawai yang layak KGB dari SQLite.
   */
  getPegawaiKGB: (): Promise<PegawaiKGB[]> =>
    ipcRenderer.invoke('db:getPegawaiKGB'),

  /**
   * Memicu pembuatan dokumen KGB untuk satu pegawai.
   */
  generateDokumenKGB: (id: number) =>
    ipcRenderer.invoke('doc:generateKGB', id),

});
