import { useState, useEffect } from 'react';
import ImportButton from './components/ImportButton';
import ImportResultCard from './components/ImportResultCard';
import Table from './components/Table';
import type { PegawaiRow, PegawaiKGB, ImportResult } from './types/pegawai';

export default function App() {
  // Data hasil query KGB atau parsing Excel
  const [pegawaiData, setPegawaiData] = useState<(PegawaiRow | PegawaiKGB)[]>([]);
  // Hasil import ke database — untuk ditampilkan di result card
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  // Folder output
  const [outputFolder, setOutputFolder] = useState<string>('');

  // Ambil data KGB dari database saat aplikasi dimuat pertama kali
  useEffect(() => {
    fetchPegawaiKGB();
    if (window.electronAPI) {
      window.electronAPI.getOutputFolder().then(folder => {
        if (folder) setOutputFolder(folder);
      });
    }
  }, []);

  async function handleChangeFolder() {
    if (window.electronAPI) {
      const newFolder = await window.electronAPI.selectOutputFolder();
      if (newFolder) {
        setOutputFolder(newFolder);
      }
    }
  }

  async function fetchPegawaiKGB() {
    if (window.electronAPI) {
      try {
        const kgbData = await window.electronAPI.getPegawaiKGB();
        setPegawaiData(kgbData);
      } catch (err) {
        console.error("Gagal mengambil data KGB:", err);
      }
    }
  }

  function handleImport(data: PegawaiRow[]) {
    // Jika tidak di Electron (browser biasa), tampilkan raw data
    if (!window.electronAPI) {
      setPegawaiData(data);
    }
    // Reset hasil import lama saat file baru dimuat
    setImportResult(null);
  }

  function handleImportResult(result: ImportResult) {
    setImportResult(result);
    // Setelah import selesai (berhasil/gagal), ambil ulang data terbaru dari database
    fetchPegawaiKGB();
  }

  function handleDismissResult() {
    setImportResult(null);
  }

  async function handleResetPegawai() {
    if (!window.electronAPI) return;
    
    const confirmReset = window.confirm("Apakah Anda yakin ingin menghapus semua data pegawai? Data terkait gaji tidak akan ikut terhapus.");
    if (!confirmReset) return;

    try {
      const success = await window.electronAPI.resetPegawai();
      if (success) {
        // Refresh data setelah berhasil dihapus
        fetchPegawaiKGB();
      } else {
        alert("Gagal mereset data pegawai. Silakan coba lagi.");
      }
    } catch (error) {
      console.error("Error mereset data:", error);
      alert("Terjadi kesalahan sistem saat mencoba mereset data.");
    }
  }

  return (
    <div className="p-6 flex flex-col gap-4 min-w-0">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Data Pegawai</h2>
          {pegawaiData.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {pegawaiData.length} pegawai dengan data KGB
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetPegawai}
            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Reset Data
          </button>
          <ImportButton
            onImport={handleImport}
            onImportResult={handleImportResult}
          />
        </div>
      </div>

      {/* ── Info Folder Output ── */}
      {outputFolder && (
        <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 overflow-hidden">
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <div className="text-sm">
              <span className="text-gray-500">Folder Penyimpanan: </span>
              <span className="font-medium text-gray-700 truncate" title={outputFolder}>{outputFolder}</span>
            </div>
          </div>
          <button
            onClick={handleChangeFolder}
            className="ml-4 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:border-transparent flex-shrink-0 transition-colors"
          >
            Ubah Folder
          </button>
        </div>
      )}

      {/* ── Hasil Import Database ── */}
      {importResult && (
        <ImportResultCard
          result={importResult}
          onDismiss={handleDismissResult}
        />
      )}

      {/* ── Tabel data pegawai ── */}
      <Table data={pegawaiData} />
    </div>
  );
}
