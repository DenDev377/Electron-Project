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
let dbPath = '';
if (isDev) {
    // Development: path relatif dari project root ke file DB yang sudah ada
    dbPath = path_1.default.resolve(process.cwd(), 'src', 'assets', 'database', 'SQLite.db');
}
else {
    // Production: Database harus dipindah ke userData agar bisa dibaca/tulis (tidak Read-Only)
    const userDataPath = electron_1.app.getPath('userData');
    const dbDir = path_1.default.join(userDataPath, 'database');
    dbPath = path_1.default.join(dbDir, 'SQLite.db');
    // Jika DB belum ada di userData, copy dari resourcesPath (template bawaan instalasi)
    if (!fs_1.default.existsSync(dbPath)) {
        console.log('[Main] Database belum ada di userData. Mengkopi dari resources...');
        if (!fs_1.default.existsSync(dbDir)) {
            fs_1.default.mkdirSync(dbDir, { recursive: true });
        }
        const sourceDbPath = path_1.default.join(process.resourcesPath, 'database', 'SQLite.db');
        if (fs_1.default.existsSync(sourceDbPath)) {
            fs_1.default.copyFileSync(sourceDbPath, dbPath);
        }
        else {
            console.error('[Main] FATAL: Source database tidak ditemukan di resources:', sourceDbPath);
        }
    }
}
console.log('[Main] DB path:', dbPath);
let db;
try {
    db = new better_sqlite3_1.default(dbPath);
    // WAL mode: meningkatkan performa concurrent read/write
    db.pragma('journal_mode = WAL');
    console.log('[Main] Database connected successfully.');
    // Migration: Add mkg_awal column if it doesn't exist
    try {
        const tableInfo = db.pragma('table_info(pegawai)');
        const hasMkgAwal = tableInfo.some(col => col.name === 'mkg_awal');
        if (!hasMkgAwal) {
            console.log('[Main] Migration: Adding mkg_awal column to pegawai table...');
            db.prepare('ALTER TABLE pegawai ADD COLUMN mkg_awal INTEGER DEFAULT 0').run();
        }
    }
    catch (migErr) {
        console.error('[Main] Migration error:', migErr);
    }
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
/**
 * Channel: 'db:resetPegawai'
 * Menghapus semua data pegawai tanpa menghapus tabel gaji.
 */
electron_1.ipcMain.handle('db:resetPegawai', async () => {
    console.log('[Main] Mereset data pegawai...');
    try {
        const result = (0, db_cjs_1.resetPegawai)(db);
        return result;
    }
    catch (err) {
        console.error('[Main] Error reset data pegawai:', err);
        throw new Error(err instanceof Error ? err.message : 'Gagal mereset data pegawai.');
    }
});
const configPath = path_1.default.join(electron_1.app.getPath('userData'), 'config.json');
function getSavedOutputFolder() {
    try {
        if (fs_1.default.existsSync(configPath)) {
            const config = JSON.parse(fs_1.default.readFileSync(configPath, 'utf8'));
            if (config.outputFolder) {
                return config.outputFolder;
            }
        }
    }
    catch (err) {
        console.error('[Main] Gagal membaca config.json:', err);
    }
    return path_1.default.join(electron_1.app.getPath('documents'), 'Dokumen KGB');
}
function saveOutputFolder(folderPath) {
    try {
        let config = {};
        if (fs_1.default.existsSync(configPath)) {
            config = JSON.parse(fs_1.default.readFileSync(configPath, 'utf8'));
        }
        config.outputFolder = folderPath;
        fs_1.default.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    }
    catch (err) {
        console.error('[Main] Gagal menyimpan config.json:', err);
    }
}
electron_1.ipcMain.handle('doc:selectOutputFolder', async () => {
    const result = await electron_1.dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Pilih Folder Penyimpanan Dokumen KGB'
    });
    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    const folderPath = result.filePaths[0];
    saveOutputFolder(folderPath);
    return folderPath;
});
electron_1.ipcMain.handle('doc:getOutputFolder', async () => {
    return getSavedOutputFolder();
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
// Helper: Ubah teks menjadi Title Case (Huruf besar di awal kata)
function toTitleCase(str) {
    if (!str)
        return '';
    return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
}
/**
 * Helper: Hitung tanggal surat KGB.
 * Aturan:
 * - Bulan surat = bulan KGB berlaku - 3 bulan (dengan rollover tahun).
 * - Tanggal surat = tgl 1 bulan tersebut, jika bukan hari kerja maka geser ke Senin berikutnya.
 * - Format: "Baturaja, DD NamaBulan YYYY"
 */
function formatTanggalSurat(tahunKgb, bulanKgb) {
    // Kurangi 3 bulan dari bulan berlaku KGB (bulanKgb dalam format 1-12)
    let bulanSurat = bulanKgb - 3;
    let tahunSurat = tahunKgb;
    if (bulanSurat <= 0) {
        bulanSurat += 12;
        tahunSurat -= 1;
    }
    // Tanggal = tanggal hari ini saat dokumen di-generate
    const hariIni = new Date().getDate();
    const tglStr = hariIni.toString().padStart(2, '0');
    const bulanStr = NAMA_BULAN[bulanSurat - 1];
    return `Baturaja, ${tglStr} ${bulanStr} ${tahunSurat}`;
}
/**
 * Channel: 'doc:generateKGB'
 * Generate file Word menggunakan Docxtemplater
 */
electron_1.ipcMain.handle('doc:generateKGB', async (_, id, tanggalSuratOverride) => {
    console.log(`[Main] generateDokumenKGB dipanggil untuk id: ${id} dengan tanggal: ${tanggalSuratOverride}`);
    try {
        // 1. Ambil data pegawai berdasarkan id
        const stmt = db.prepare('SELECT nama, nip, satuan_kerja, tahun_pengangkatan, bulan_pengangkatan, golongan, subgolongan, pangkat_golongan, total_masa_kerja, mkg_awal FROM pegawai WHERE id = ?');
        const row = stmt.get(id);
        if (!row) {
            return { success: false, error: `Pegawai dengan ID ${id} tidak ditemukan.` };
        }
        const { nama, nip, satuan_kerja, tahun_pengangkatan, bulan_pengangkatan, golongan, subgolongan, pangkat_golongan, total_masa_kerja, mkg_awal } = row;
        // Validasi data pengangkatan
        if (!tahun_pengangkatan || !bulan_pengangkatan || bulan_pengangkatan < 1 || bulan_pengangkatan > 12) {
            return { success: false, error: `Data tahun atau bulan pengangkatan tidak valid untuk pegawai: ${nama}.` };
        }
        const effective_mkg = total_masa_kerja + (mkg_awal || 0);
        const now = new Date();
        const currentYear = now.getFullYear();
        // 1. Ambil gaji baru (menggunakan effective_mkg)
        const stmtGajiBaru = db.prepare(`
      SELECT mkg, gaji_pokok 
      FROM tabel_gaji 
      WHERE golongan = ? COLLATE NOCASE 
        AND subgolongan = ? COLLATE NOCASE 
        AND mkg >= ? 
        AND gaji_pokok > 0
      ORDER BY mkg ASC
      LIMIT 1
    `);
        const rowGajiBaru = stmtGajiBaru.get(golongan, subgolongan, effective_mkg);
        // Jika tidak ditemukan, coba cari gaji maksimal (mentok)
        let finalRowGajiBaru = rowGajiBaru;
        if (!finalRowGajiBaru) {
            const stmtGajiMax = db.prepare(`
        SELECT mkg, gaji_pokok 
        FROM tabel_gaji 
        WHERE golongan = ? COLLATE NOCASE 
          AND subgolongan = ? COLLATE NOCASE 
          AND gaji_pokok > 0
        ORDER BY mkg DESC
        LIMIT 1
      `);
            finalRowGajiBaru = stmtGajiMax.get(golongan, subgolongan);
        }
        if (!finalRowGajiBaru || finalRowGajiBaru.gaji_pokok <= 0) {
            return { success: false, error: `Gaji baru tidak ditemukan atau tidak valid untuk golongan ${golongan}/${subgolongan} dengan MKG ${effective_mkg}.` };
        }
        const gaji_baru = formatRupiah(finalRowGajiBaru.gaji_pokok);
        const targetMkg = finalRowGajiBaru.mkg;
        // Hitung tahun KGB
        // Target MKG dicapai saat: tahun = currentYear + (targetMkg - effective_mkg)
        const tahunKgb = currentYear + (targetMkg - effective_mkg);
        // Bentuk data tanggal & masa kerja
        const tanggalPengangkatan = formatTanggal(currentYear, bulan_pengangkatan); // BKN format biasanya menggunakan tahun berjalan untuk TMT
        const tanggalBerlaku = formatTanggal(tahunKgb, bulan_pengangkatan);
        // Masa kerja dihitung dari tahun pengangkatan sampai tahun KGB (mempertimbangkan offset mkg_awal)
        // Karena targetMkg sudah merupakan akumulasi yang akurat dari tabel gaji, kita bisa langsung pakai targetMkg.
        // Jika ingin format "X tahun Y bulan", Y biasanya 0 untuk KGB, atau kita pakai hitungMasaKerja dengan mkg_awal.
        // Untuk keakuratan, mari kita gunakan fungsi hitungMasaKerja yang dimodifikasi logika offset-nya:
        const totalBulanAsli = (tahunKgb - tahun_pengangkatan) * 12 + (bulan_pengangkatan - bulan_pengangkatan); // selalu 0 bulan selisihnya di bulan yang sama
        const totalTahunOffset = (tahunKgb - tahun_pengangkatan) + (mkg_awal || 0);
        const masaKerja = `${totalTahunOffset} tahun 0 bulan`;
        // Ambil gaji lama
        const stmtGajiLama = db.prepare(`
      SELECT mkg, gaji_pokok 
      FROM tabel_gaji 
      WHERE golongan = ? COLLATE NOCASE 
        AND subgolongan = ? COLLATE NOCASE 
        AND mkg < ? 
        AND gaji_pokok > 0
      ORDER BY mkg DESC
      LIMIT 1
    `);
        const rowGajiLama = stmtGajiLama.get(golongan, subgolongan, targetMkg);
        if (!rowGajiLama || rowGajiLama.gaji_pokok <= 0) {
            return { success: false, error: `Gaji lama tidak ditemukan. Tidak ada data gaji sebelumnya untuk golongan ${golongan}/${subgolongan} di bawah MKG ${targetMkg}.` };
        }
        const gaji_lama = formatRupiah(rowGajiLama.gaji_pokok);
        const masa_kerja_lama = `${rowGajiLama.mkg} tahun 0 bulan`;
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
        const rowKgbBerikutnya = stmtKgbBerikutnya.get(golongan, subgolongan, targetMkg);
        let textMkgBerikutnya = '';
        let textTahunKgbBerikutnya = '';
        if (rowKgbBerikutnya) {
            const selisihMkg = rowKgbBerikutnya.mkg - targetMkg;
            const calculatedYearKgbNext = tahunKgb + selisihMkg;
            textMkgBerikutnya = rowKgbBerikutnya.mkg.toString();
            textTahunKgbBerikutnya = formatTanggal(calculatedYearKgbNext, bulan_pengangkatan);
        }
        else {
            textMkgBerikutnya = '-';
            textTahunKgbBerikutnya = '-';
        }
        // Hitung tanggal surat
        let tanggalSurat = formatTanggalSurat(currentYear, bulan_pengangkatan);
        let bulanTahunSurat = '';
        if (tanggalSuratOverride) {
            const d = new Date(tanggalSuratOverride);
            if (!isNaN(d.getTime())) {
                const tglStr = d.getDate().toString().padStart(2, '0');
                const blnIndex = d.getMonth();
                const thnStr = d.getFullYear();
                tanggalSurat = `Baturaja, ${tglStr} ${NAMA_BULAN[blnIndex]} ${thnStr}`;
                bulanTahunSurat = `${(blnIndex + 1).toString().padStart(2, '0')}/${thnStr}`;
            }
        }
        else {
            let blnSurat = bulan_pengangkatan - 3;
            let thnSurat = currentYear;
            if (blnSurat <= 0) {
                blnSurat += 12;
                thnSurat -= 1;
            }
            bulanTahunSurat = `${blnSurat.toString().padStart(2, '0')}/${thnSurat}`;
        }
        // 2. Baca template Word
        const templateDir = isDev ? path_1.default.resolve(process.cwd(), 'templates') : path_1.default.join(process.resourcesPath, 'templates');
        const templatePath = path_1.default.join(templateDir, 'kgb-template.docx');
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
            satuan_kerja: satuan_kerja ? toTitleCase(satuan_kerja) : '-',
            tanggal_pengangkatan: tanggalPengangkatan,
            tanggal_berlaku: tanggalBerlaku,
            masa_kerja: masaKerja, // Kompatibilitas untuk template lama
            masa_kerja_lama: masa_kerja_lama, // Untuk poin d (Gaji Lama)
            masa_kerja_baru: masaKerja, // Untuk poin 7 (Gaji Baru)
            gaji_lama,
            gaji_baru,
            mkg_berikutnya: textMkgBerikutnya,
            tahun_kgb_berikutnya: textTahunKgbBerikutnya,
            tanggal_surat: tanggalSurat,
            bln_thn: bulanTahunSurat
        });
        const buf = doc.getZip().generate({
            type: 'nodebuffer',
            compression: 'DEFLATE',
        });
        // 5. Simpan file
        const outputDir = getSavedOutputFolder();
        if (!fs_1.default.existsSync(outputDir)) {
            fs_1.default.mkdirSync(outputDir, { recursive: true });
        }
        // Sanitasi nama untuk nama file yang valid
        const safeName = nama.replace(/[^a-zA-Z0-9 \-_]/g, '_').trim();
        const outPath = path_1.default.join(outputDir, `KGB_${currentYear}_${safeName}.docx`);
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
    const iconIco = path_1.default.join(electron_1.app.getAppPath(), isDev ? 'public' : 'dist', 'icon.ico');
    const iconPng = path_1.default.join(electron_1.app.getAppPath(), 'public', 'LOGO-BIN.png');
    const iconPath = iconIco;
    const win = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        title: 'Aplikasi KGB Pegawai',
        icon: iconPath,
        webPreferences: {
            // Preload script: jembatan aman ke main process
            preload: path_1.default.join(__dirname, 'preload.cjs'),
            // WAJIB: konteks renderer terisolasi dari Node.js
            contextIsolation: true,
            // WAJIB: renderer tidak boleh akses Node.js secara langsung
            nodeIntegration: false,
        },
    });
    // Set icon via PNG (ICO format tidak kompatibel dengan win.setIcon pada semua platform)
    if (fs_1.default.existsSync(iconPng)) {
        win.setIcon(iconPng);
    }
    if (isDev) {
        // Mode dev: load dari Vite dev server
        win.loadURL('http://localhost:5173');
        // Buka DevTools otomatis saat development
        //win.webContents.openDevTools();
    }
    else {
        // Mode production: load dari file yang sudah di-build
        win.loadFile(path_1.default.join(electron_1.app.getAppPath(), 'dist', 'index.html'));
    }
}
// ─── App lifecycle ────────────────────────────────────────────────────────────
electron_1.app.whenReady().then(() => {
    if (process.platform === 'win32') {
        electron_1.app.setAppUserModelId(isDev ? 'com.kgb.dev.' + Date.now() : 'com.kgb.app');
    }
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
