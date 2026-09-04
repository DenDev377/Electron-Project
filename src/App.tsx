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

  // Ambil data KGB dari database saat aplikasi dimuat pertama kali
  useEffect(() => {
    fetchPegawaiKGB();
  }, []);

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

  return (
    <div className="p-6 flex flex-col gap-4">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Data Pegawai</h2>
          {pegawaiData.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {pegawaiData.length} data dibaca dari Excel
            </p>
          )}
        </div>
        <ImportButton
          onImport={handleImport}
          onImportResult={handleImportResult}
        />
      </div>

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
