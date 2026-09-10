import { useState } from 'react';
import type { PegawaiKGB, PegawaiRow } from '../types/pegawai';
import GeneratedButton from './GeneratedButton';

interface TableProps {
  /** Data hasil query KGB dari SQLite. Kosong jika belum di-load atau mode browser. */
  data: PegawaiKGB[] | PegawaiRow[];
}

export default function Table({ data }: TableProps) {
  const [processingId, setProcessingId] = useState<number | null>(null);

  const handleGenerate = async (item: PegawaiKGB | PegawaiRow) => {
    if (!('id' in item) || item.id === undefined) {
      alert("Pegawai belum ada di database, silakan import terlebih dahulu.");
      return;
    }
    
    if (window.electronAPI) {
      setProcessingId(item.id);
      try {
        const result = await window.electronAPI.generateDokumenKGB(item.id);
        if (result.success) {
          // Sukses generate, biarkan user bisa generate ulang jika perlu
        } else {
          alert(`Gagal: ${result.error}`);
        }
      } catch (err) {
        alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setProcessingId(null);
      }
    } else {
      alert("Fitur generate hanya bisa digunakan dalam aplikasi desktop.");
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              No
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              NIP
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nama
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Golongan
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Sub Golongan
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Gaji Pokok
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="px-6 py-10 text-center text-sm text-gray-400 italic"
              >
                Belum ada data. Klik <span className="font-semibold text-[#635BFF]">Import Data</span> untuk memuat file Excel.
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                  {index + 1}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-center font-mono">
                  {item.nip}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                  {item.nama}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                  {item.golongan}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                  {item.subgolongan}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                  {'gaji_pokok' in item && item.gaji_pokok != null 
                    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.gaji_pokok as number)
                    : '-'}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                  <GeneratedButton 
                    onClick={() => handleGenerate(item)} 
                    isLoading={'id' in item && processingId === item.id} 
                    bulanPengangkatan={'bulan_pengangkatan' in item ? item.bulan_pengangkatan : undefined}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}