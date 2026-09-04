import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import Database from 'better-sqlite3';
import { importEmployeesToDatabase, getPegawaiKGB } from './db.cjs';
import type { Employee } from '../src/types/pegawai.js';

// ─── Deteksi mode development ─────────────────────────────────────────────────
// Saat `npm run electron:dev`: NODE_ENV=development
// Saat production (app.isPackaged): app sudah di-bundle oleh electron-builder
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// ─── Path database SQLite ─────────────────────────────────────────────────────
// Development: path relatif dari project root ke file DB yang sudah ada
// Production : path ke resources yang di-bundle oleh electron-builder
const dbPath = isDev
  ? path.resolve(process.cwd(), 'src', 'assets', 'database', 'SQLite.db')
  : path.join(process.resourcesPath, 'database', 'SQLite.db');

console.log('[Main] DB path:', dbPath);
console.log('[Main] Mode:', isDev ? 'development' : 'production');

// ─── Buka koneksi ke database ─────────────────────────────────────────────────
let db: ReturnType<typeof Database>;

try {
  db = new Database(dbPath);
  // WAL mode: meningkatkan performa concurrent read/write
  db.pragma('journal_mode = WAL');
  console.log('[Main] Database connected successfully.');
} catch (err) {
  console.error('[Main] FATAL: Gagal membuka database:', err);
  app.quit();
  process.exit(1);
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

/**
 * Channel: 'db:importPegawai'
 * Dipanggil oleh renderer via window.electronAPI.importPegawai(data)
 * Menerima array Employee, menjalankan upsert ke tabel `pegawai`,
 * dan mengembalikan ImportResult.
 */
ipcMain.handle('db:importPegawai', async (_, employees: Employee[]) => {
  console.log(`[Main] Menerima ${employees.length} data pegawai untuk diimport.`);
  try {
    const result = importEmployeesToDatabase(db, employees);
    console.log('[Main] Import selesai:', result);
    return result;
  } catch (err) {
    console.error('[Main] Error saat import:', err);
    // Re-throw: error akan diteruskan ke renderer sebagai rejected Promise
    throw new Error(
      err instanceof Error ? err.message : 'Terjadi error fatal saat import.'
    );
  }
});

/**
 * Channel: 'db:getPegawaiKGB'
 * Mengambil daftar pegawai yang layak mendapat KGB.
 */
ipcMain.handle('db:getPegawaiKGB', async () => {
  console.log('[Main] Mengambil data pegawai KGB...');
  try {
    const result = getPegawaiKGB(db);
    console.log(`[Main] Ditemukan ${result.length} data pegawai KGB.`);
    return result;
  } catch (err) {
    console.error('[Main] Error mengambil data KGB:', err);
    throw new Error(
      err instanceof Error ? err.message : 'Gagal mengambil data dari database.'
    );
  }
});

// ─── BrowserWindow ────────────────────────────────────────────────────────────

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Aplikasi KGB Pegawai',
    webPreferences: {
      // Preload script: jembatan aman ke main process
      preload: path.join(__dirname, 'preload.cjs'),
      // WAJIB: konteks renderer terisolasi dari Node.js
      contextIsolation: true,
      // WAJIB: renderer tidak boleh akses Node.js secara langsung
      nodeIntegration: false,
    },
  });

  if (isDev) {
    // Mode dev: load dari Vite dev server
    win.loadURL('http://localhost:5173');
    // Buka DevTools otomatis saat development
    win.webContents.openDevTools();
  } else {
    // Mode production: load dari file yang sudah di-build
    win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();

  // macOS: buat window baru jika klik icon di dock setelah semua window ditutup
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Tutup koneksi DB dan quit (kecuali di macOS yang punya konvensi berbeda)
  if (process.platform !== 'darwin') {
    db?.close();
    app.quit();
  }
});
