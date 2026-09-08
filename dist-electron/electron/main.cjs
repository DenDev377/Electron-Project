"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const db_cjs_1 = require("./db.cjs");
const fs_1 = __importDefault(require("fs"));
const pizzip_1 = __importDefault(require("pizzip"));
const docxtemplater_1 = __importDefault(require("docxtemplater"));
// ─── Deteksi mode development ─────────────────────────────────────────────────
// Saat `npm run electron:dev`: NODE_ENV=development
// Saat production (app.isPackaged): app sudah di-bundle oleh electron-builder
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
// ─── Path database SQLite ─────────────────────────────────────────────────────
// Development: path relatif dari project root ke file DB yang sudah ada
// Production : path ke resources yang di-bundle oleh electron-builder
const dbPath = isDev
    ? path_1.default.resolve(process.cwd(), 'src', 'assets', 'database', 'SQLite.db')
    : path_1.default.join(process.resourcesPath, 'database', 'SQLite.db');
console.log('[Main] DB path:', dbPath);
console.log('[Main] Mode:', isDev ? 'development' : 'production');
// ─── Buka koneksi ke database ─────────────────────────────────────────────────
let db;
try {
    db = new better_sqlite3_1.default(dbPath);
    // WAL mode: meningkatkan performa concurrent read/write
    db.pragma('journal_mode = WAL');
    console.log('[Main] Database connected successfully.');
}
catch (err) {
    console.error('[Main] FATAL: Gagal membuka database:', err);
    electron_1.app.quit();
    process.exit(1);
}
// ─── IPC Handlers ─────────────────────────────────────────────────────────────
/**
 * Channel: 'db:importPegawai'
 * Dipanggil oleh renderer via window.electronAPI.importPegawai(data)
 * Menerima array Employee, menjalankan upsert ke tabel `pegawai`,
 * dan mengembalikan ImportResult.
 */
electron_1.ipcMain.handle('db:importPegawai', async (_, employees) => {
    console.log(`[Main] Menerima ${employees.length} data pegawai untuk diimport.`);
    try {
        const result = (0, db_cjs_1.importEmployeesToDatabase)(db, employees);
        console.log('[Main] Import selesai:', result);
        return result;
    }
    catch (err) {
        console.error('[Main] Error saat import:', err);
        // Re-throw: error akan diteruskan ke renderer sebagai rejected Promise
        throw new Error(err instanceof Error ? err.message : 'Terjadi error fatal saat import.');
    }
});
/**
 * Channel: 'db:getPegawaiKGB'
 * Mengambil daftar pegawai yang layak mendapat KGB.
 */
electron_1.ipcMain.handle('db:getPegawaiKGB', async () => {
    console.log('[Main] Mengambil data pegawai KGB...');
    try {
        const result = (0, db_cjs_1.getPegawaiKGB)(db);
        console.log(`[Main] Ditemukan ${result.length} data pegawai KGB.`);
        return result;
    }
    catch (err) {
        console.error('[Main] Error mengambil data KGB:', err);
        throw new Error(err instanceof Error ? err.message : 'Gagal mengambil data dari database.');
    }
});
const NAMA_BULAN = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
// Helper: Membentuk tanggal dalam format bahasa Indonesia (selalu tanggal 1)
function formatTanggal(tahun, bulan) {
    return `01 ${NAMA_BULAN[bulan - 1]} ${tahun}`;
}
// Helper: Menghitung selisih masa kerja (tahun dan bulan)
function hitungMasaKerja(thnAwal, blnAwal, thnAkhir, blnAkhir) {
    let diffYears = thnAkhir - thnAwal;
    let diffMonths = blnAkhir - blnAwal;
    if (diffMonths < 0) {
        diffYears -= 1;
        diffMonths += 12;
    }
    // Mencegah tahun negatif bila aneh (fallback)
    const finalYears = Math.max(0, diffYears);
    return `${finalYears} tahun ${diffMonths} bulan`;
}
// Helper: Format Rupiah
function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}
/**
 * Channel: 'doc:generateKGB'
 * Generate file Word menggunakan Docxtemplater
 */
electron_1.ipcMain.handle('doc:generateKGB', async (_, id) => {
    console.log(`[Main] generateDokumenKGB dipanggil untuk id: ${id}`);
    try {
        // 1. Ambil data pegawai berdasarkan id
        const stmt = db.prepare('SELECT nama, nip, satuan_kerja, tahun_pengangkatan, bulan_pengangkatan, golongan, subgolongan, pangkat_golongan, total_masa_kerja FROM pegawai WHERE id = ?');
        const row = stmt.get(id);
        if (!row) {
            return { success: false, error: `Pegawai dengan ID ${id} tidak ditemukan.` };
        }
        const { nama, nip, satuan_kerja, tahun_pengangkatan, bulan_pengangkatan, golongan, subgolongan, pangkat_golongan, total_masa_kerja } = row;
        // Validasi data pengangkatan
        if (!tahun_pengangkatan || !bulan_pengangkatan || bulan_pengangkatan < 1 || bulan_pengangkatan > 12) {
            return { success: false, error: `Data tahun atau bulan pengangkatan tidak valid untuk pegawai: ${nama}.` };
        }
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-12
        // Bentuk data tanggal & masa kerja
        const tanggalPengangkatan = formatTanggal(currentYear, bulan_pengangkatan);
        const tanggalBerlaku = formatTanggal(currentYear, currentMonth);
        const masaKerja = hitungMasaKerja(tahun_pengangkatan, bulan_pengangkatan, currentYear, currentMonth);
        // Ambil gaji baru
        const stmtGajiBaru = db.prepare(`
      SELECT gaji_pokok 
      FROM tabel_gaji 
      WHERE golongan = ? COLLATE NOCASE 
        AND subgolongan = ? COLLATE NOCASE 
        AND mkg = ? 
        AND gaji_pokok > 0
      LIMIT 1
    `);
        const rowGajiBaru = stmtGajiBaru.get(golongan, subgolongan, total_masa_kerja);
        if (!rowGajiBaru || rowGajiBaru.gaji_pokok <= 0) {
            return { success: false, error: `Gaji baru tidak ditemukan atau tidak valid untuk golongan ${golongan}/${subgolongan} dengan MKG ${total_masa_kerja}.` };
        }
        const gaji_baru = formatRupiah(rowGajiBaru.gaji_pokok);
        // Ambil gaji lama
        const stmtGajiLama = db.prepare(`
      SELECT gaji_pokok 
      FROM tabel_gaji 
      WHERE golongan = ? COLLATE NOCASE 
        AND subgolongan = ? COLLATE NOCASE 
        AND mkg < ? 
        AND gaji_pokok > 0
      ORDER BY mkg DESC
      LIMIT 1
    `);
        const rowGajiLama = stmtGajiLama.get(golongan, subgolongan, total_masa_kerja);
        if (!rowGajiLama || rowGajiLama.gaji_pokok <= 0) {
            return { success: false, error: `Gaji lama tidak ditemukan. Tidak ada data gaji sebelumnya untuk golongan ${golongan}/${subgolongan} di bawah MKG ${total_masa_kerja}.` };
        }
        const gaji_lama = formatRupiah(rowGajiLama.gaji_pokok);
        // Ambil KGB Berikutnya
        const stmtKgbBerikutnya = db.prepare(`
      SELECT mkg 
      FROM tabel_gaji 
      WHERE golongan = ? COLLATE NOCASE 
        AND subgolongan = ? COLLATE NOCASE 
        AND mkg > ? 
        AND gaji_pokok > 0
      ORDER BY mkg ASC
      LIMIT 1
    `);
        const rowKgbBerikutnya = stmtKgbBerikutnya.get(golongan, subgolongan, total_masa_kerja);
        let textMkgBerikutnya = '';
        let textTahunKgbBerikutnya = '';
        if (rowKgbBerikutnya) {
            const selisihMkg = rowKgbBerikutnya.mkg - total_masa_kerja;
            const calculatedYear = currentYear + selisihMkg;
            textMkgBerikutnya = rowKgbBerikutnya.mkg.toString();
            textTahunKgbBerikutnya = formatTanggal(calculatedYear, bulan_pengangkatan);
        }
        else {
            textMkgBerikutnya = '-';
            textTahunKgbBerikutnya = '-';
        }
        // 2. Baca template Word
        const templatePath = path_1.default.resolve(process.cwd(), 'templates', 'kgb-template.docx');
        if (!fs_1.default.existsSync(templatePath)) {
            return { success: false, error: `Template tidak ditemukan di: ${templatePath}` };
        }
        const content = fs_1.default.readFileSync(templatePath, 'binary');
        // 3. Gunakan docxtemplater & pizzip
        const zip = new pizzip_1.default(content);
        const doc = new docxtemplater_1.default(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });
        // Format pangkat_golongan dan dalam_golongan
        const textDalamGolongan = `${golongan}/${subgolongan}`;
        const textPangkatGolongan = pangkat_golongan || textDalamGolongan; // Fallback jika kosong
        // 4. Set data & render
        doc.render({
            nama,
            nip,
            pangkat_golongan: textPangkatGolongan,
            dalam_golongan: textDalamGolongan,
            satuan_kerja: satuan_kerja || '-',
            tanggal_pengangkatan: tanggalPengangkatan,
            tanggal_berlaku: tanggalBerlaku,
            masa_kerja: masaKerja,
            gaji_lama,
            gaji_baru,
            mkg_berikutnya: textMkgBerikutnya,
            tahun_kgb_berikutnya: textTahunKgbBerikutnya
        });
        const buf = doc.getZip().generate({
            type: 'nodebuffer',
            compression: 'DEFLATE',
        });
        // 5. Simpan file
        const outputDir = path_1.default.resolve(process.cwd(), 'output');
        if (!fs_1.default.existsSync(outputDir)) {
            fs_1.default.mkdirSync(outputDir, { recursive: true });
        }
        // Sanitasi nama untuk nama file yang valid
        const safeName = nama.replace(/[^a-zA-Z0-9 \-_]/g, '_').trim();
        const outPath = path_1.default.join(outputDir, `test-${safeName}.docx`);
        fs_1.default.writeFileSync(outPath, buf);
        console.log(`[Main] Dokumen berhasil dibuat di: ${outPath}`);
        return { success: true, filePath: outPath };
    }
    catch (err) {
        console.error('[Main] Error generate dokumen:', err);
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Gagal menghasilkan dokumen.',
        };
    }
});
// ─── BrowserWindow ────────────────────────────────────────────────────────────
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        title: 'Aplikasi KGB Pegawai',
        webPreferences: {
            // Preload script: jembatan aman ke main process
            preload: path_1.default.join(__dirname, 'preload.cjs'),
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
    }
    else {
        // Mode production: load dari file yang sudah di-build
        win.loadFile(path_1.default.join(electron_1.app.getAppPath(), 'dist', 'index.html'));
    }
}
// ─── App lifecycle ────────────────────────────────────────────────────────────
electron_1.app.whenReady().then(() => {
    createWindow();
    // macOS: buat window baru jika klik icon di dock setelah semua window ditutup
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    // Tutup koneksi DB dan quit (kecuali di macOS yang punya konvensi berbeda)
    if (process.platform !== 'darwin') {
        db?.close();
        electron_1.app.quit();
    }
});
