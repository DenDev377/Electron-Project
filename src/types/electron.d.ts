import type { Employee, ImportResult, PegawaiKGB } from './pegawai';

/**
 * API yang diekspos oleh Electron preload script ke window renderer.
 * Hanya tersedia saat aplikasi berjalan di dalam Electron.
 */
export interface ElectronAPI {
  importPegawai:  (data: Employee[]) => Promise<ImportResult>;
  getPegawaiKGB:  () => Promise<PegawaiKGB[]>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
