import { useState, useMemo, useEffect } from 'react';
import type { PegawaiKGB, PegawaiRow } from '../types/pegawai';
import GeneratedButton from './GeneratedButton';

interface TableProps {
  /** Data hasil query KGB dari SQLite. Kosong jika belum di-load atau mode browser. */
  data: (PegawaiKGB | PegawaiRow)[];
}

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

type SortMode = 'nama' | 'kgb_asc' | 'kgb_desc';

export default function Table({ data }: TableProps) {
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('kgb_asc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select');

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

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
          alert(`Dokumen berhasil dibuat!\n\nTersimpan otomatis di:\n${result.filePath}`);
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

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allValidIds = data.filter(d => 'id' in d && d.id !== undefined).map(d => (d as any).id);
      setSelectedIds(new Set(allValidIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleMouseDownRow = (e: React.MouseEvent, id: number, currentlySelected: boolean) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input[type="checkbox"]')) return;
    
    // Prevent text selection when dragging
    e.preventDefault();

    setIsDragging(true);
    const newMode = currentlySelected ? 'deselect' : 'select';
    setDragMode(newMode);
    
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newMode === 'select') newSet.add(id);
      else newSet.delete(id);
      return newSet;
    });
  };

  const handleMouseEnterRow = (id: number) => {
    if (!isDragging) return;
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (dragMode === 'select') newSet.add(id);
      else newSet.delete(id);
      return newSet;
    });
  };

  const handleSelectRowCheckbox = (id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleGenerateSelected = async () => {
    if (!window.electronAPI) {
      alert("Fitur generate hanya bisa digunakan dalam aplikasi desktop.");
      return;
    }
    
    setIsGeneratingBatch(true);
    let successCount = 0;
    let failCount = 0;
    
    try {
      for (const id of Array.from(selectedIds)) {
        setProcessingId(id);
        const result = await window.electronAPI.generateDokumenKGB(id);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          console.error(`Gagal generate ID ${id}: ${result.error}`);
        }
      }
      
      alert(`Selesai! Berhasil membuat ${successCount} dokumen.${failCount > 0 ? `\nGagal membuat ${failCount} dokumen.` : ''}`);
      setSelectedIds(new Set());
    } catch (err) {
      alert(`Terjadi error saat generate massal: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGeneratingBatch(false);
      setProcessingId(null);
    }
  };

  const sortedData = useMemo(() => {
    if (sortMode === 'nama') {
      return [...data].sort((a, b) => a.nama.localeCompare(b.nama));
    }

    return [...data].sort((a, b) => {
      // Check if both items have KGB data
      const aKgb = 'tahun_kgb_berikutnya' in a ? a : null;
      const bKgb = 'tahun_kgb_berikutnya' in b ? b : null;

      // Items without KGB data go to the bottom
      if (!aKgb?.tahun_kgb_berikutnya && !bKgb?.tahun_kgb_berikutnya) return 0;
      if (!aKgb?.tahun_kgb_berikutnya) return 1;
      if (!bKgb?.tahun_kgb_berikutnya) return -1;

      const yearDiff = aKgb.tahun_kgb_berikutnya - bKgb.tahun_kgb_berikutnya;
      if (yearDiff !== 0) {
        return sortMode === 'kgb_asc' ? yearDiff : -yearDiff;
      }

      const monthDiff = aKgb.bulan_pengangkatan - bKgb.bulan_pengangkatan;
      if (monthDiff !== 0) {
        return sortMode === 'kgb_asc' ? monthDiff : -monthDiff;
      }
      
      // If same date, sort by name
      return sortMode === 'kgb_asc' 
        ? a.nama.localeCompare(b.nama) 
        : b.nama.localeCompare(a.nama);
    });
  }, [data, sortMode]);

  const toggleSort = () => {
    setSortMode(current => {
      if (current === 'nama') return 'kgb_asc';
      if (current === 'kgb_asc') return 'kgb_desc';
      return 'nama';
    });
  };

  const getUrgencyBadge = (tahunKgb: number | null, bulanKgb: number | undefined) => {
    if (!tahunKgb || bulanKgb === undefined) return null;

    const now = new Date();
    const kgbDate = new Date(tahunKgb, bulanKgb - 1);
    
    // Hitung selisih bulan
    const diffMonths = (kgbDate.getFullYear() - now.getFullYear()) * 12 + (kgbDate.getMonth() - now.getMonth());

    let color = 'bg-gray-100 text-gray-800 border-gray-200';
    let dot = 'bg-gray-400';
    
    if (diffMonths <= 3) {
      color = 'bg-red-50 text-red-700 border-red-200';
      dot = 'bg-red-500';
    } else if (diffMonths <= 6) {
      color = 'bg-amber-50 text-amber-700 border-amber-200';
      dot = 'bg-amber-500';
    } else {
      color = 'bg-green-50 text-green-700 border-green-200';
      dot = 'bg-green-500';
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
        {NAMA_BULAN[bulanKgb - 1]} {tahunKgb}
      </span>
    );
  };

  const SortIcon = () => {
    if (sortMode === 'nama') {
      return (
        <svg className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    if (sortMode === 'kgb_asc') {
      return (
        <svg className="w-4 h-4 text-[#635BFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 text-[#635BFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-[#F4F3FF] border border-[#E0DEFF] rounded-lg animate-in fade-in slide-in-from-top-2">
          <span className="text-sm font-medium text-[#635BFF]">
            {selectedIds.size} pegawai dipilih
          </span>
          <button
            onClick={handleGenerateSelected}
            disabled={isGeneratingBatch}
            className="px-4 py-2 text-sm font-medium text-white bg-[#635BFF] rounded-md hover:bg-[#5249ea] transition-colors focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:ring-offset-2 disabled:opacity-50 flex items-center gap-2"
          >
            {isGeneratingBatch ? (
              <>
                <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
              'Generate Selected'
            )}
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th scope="col" className="px-4 py-4 text-center w-12">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-gray-300 text-[#635BFF] focus:ring-[#635BFF] cursor-pointer"
                checked={selectedIds.size > 0 && selectedIds.size === data.filter(d => 'id' in d && d.id !== undefined).length}
                onChange={handleSelectAll}
                disabled={isGeneratingBatch}
              />
            </th>
            <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              No
            </th>
            <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              NIP
            </th>
            <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Nama
            </th>
            <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Pangkat
            </th>
            <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              MKG
            </th>
            <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Gaji Pokok
            </th>
            <th 
              scope="col" 
              className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors"
              onClick={toggleSort}
              title="Klik untuk mengurutkan berdasarkan waktu KGB"
            >
              <div className="flex items-center justify-center gap-2">
                <span>KGB Berikutnya</span>
                <SortIcon />
              </div>
            </th>
            <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedData.length === 0 ? (
            <tr>
              <td
                colSpan={9}
                className="px-6 py-12 text-center text-sm text-gray-500 bg-gray-50/50"
              >
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p>Belum ada data. Klik <span className="font-semibold text-[#635BFF]">Import Data</span> untuk memuat file Excel.</p>
                </div>
              </td>
            </tr>
          ) : (
            sortedData.map((item, index) => {
              const currentYear = new Date().getFullYear();
              const tahunKgbBerikutnya = 'tahun_kgb_berikutnya' in item ? item.tahun_kgb_berikutnya : undefined;
              const isFutureKgb = tahunKgbBerikutnya && tahunKgbBerikutnya > currentYear;
              
              return (
              <tr 
                key={index} 
                className={`transition-colors cursor-pointer select-none ${isFutureKgb ? 'opacity-40 bg-gray-50/30 hover:bg-gray-50/60' : 'hover:bg-gray-50/80'} ${'id' in item && item.id !== undefined && selectedIds.has(item.id) ? 'bg-[#F4F3FF] hover:bg-[#EAE8FF]' : ''}`}
                onMouseDown={(e) => {
                  if ('id' in item && item.id !== undefined) {
                    handleMouseDownRow(e, item.id, selectedIds.has(item.id));
                  }
                }}
                onMouseEnter={() => {
                  if ('id' in item && item.id !== undefined) {
                    handleMouseEnterRow(item.id);
                  }
                }}
              >
                <td className="px-4 py-3 text-center">
                  {'id' in item && item.id !== undefined && (
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-[#635BFF] focus:ring-[#635BFF] cursor-pointer"
                      checked={selectedIds.has(item.id)}
                      onChange={() => handleSelectRowCheckbox(item.id as number)}
                      disabled={isGeneratingBatch}
                    />
                  )}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                  {index + 1}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600 text-center font-mono">
                  {item.nip}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                  {item.nama}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600 text-center">
                  {item.golongan}/{item.subgolongan}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600 text-center">
                  {'mkg' in item && item.mkg !== undefined ? item.mkg : '-'}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600 text-center font-mono">
                  {'gaji_pokok' in item && item.gaji_pokok != null 
                    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.gaji_pokok as number)
                    : '-'}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-center">
                  {'tahun_kgb_berikutnya' in item 
                    ? (item.tahun_kgb_berikutnya === null 
                        ? <span className="text-xs font-medium text-gray-500 italic">Gaji Berkala Sudah Mentok</span> 
                        : getUrgencyBadge(item.tahun_kgb_berikutnya, item.bulan_pengangkatan))
                    : '-'}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-center">
                  <GeneratedButton 
                    onClick={() => handleGenerate(item)} 
                    isLoading={'id' in item && processingId === item.id} 
                    bulanPengangkatan={'bulan_pengangkatan' in item ? item.bulan_pengangkatan : undefined}
                    tahunKgbBerikutnya={tahunKgbBerikutnya ?? undefined}
                  />
                </td>
              </tr>
            )})
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}