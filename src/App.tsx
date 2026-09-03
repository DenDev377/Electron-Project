import { useState } from 'react';
import ImportButton from './components/ImportButton';
import Table from './components/Table';
import type { PegawaiRow } from './types/pegawai';

export default function App() {
  // State hasil parsing Excel — dimulai dari array kosong
  const [pegawaiData, setPegawaiData] = useState<PegawaiRow[]>([]);

  function handleImport(data: PegawaiRow[]) {
    setPegawaiData(data);
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Data Pegawai</h2>
          {pegawaiData.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {pegawaiData.length} data berhasil diimport dari Excel
            </p>
          )}
        </div>
        <ImportButton onImport={handleImport} />
      </div>

      {/* Tabel data pegawai */}
      <Table data={pegawaiData} />
    </div>
  );
}
