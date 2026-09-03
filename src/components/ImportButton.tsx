import { useRef, useState } from 'react';
import type { PegawaiRow } from '../types/pegawai';
import { parseExcelFile } from '../utils/excelParser';

interface ImportButtonProps {
  onImport: (data: PegawaiRow[]) => void;
}

export default function ImportButton({ onImport }: ImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    // Reset error, kemudian buka file picker native
    setError(null);
    inputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validasi ekstensi
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError('File harus berformat .xlsx atau .xls');
      // Reset input agar file yang sama bisa dipilih ulang
      e.target.value = '';
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await parseExcelFile(file);
      console.log('[Import Excel] Hasil parsing:', data);
      onImport(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal membaca file Excel.';
      console.error('[Import Excel] Error:', err);
      setError(message);
    } finally {
      setLoading(false);
      // Reset input supaya file yang sama bisa di-import ulang
      e.target.value = '';
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {/* Hidden file input — hanya accept xlsx dan xls */}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-2 bg-[#635BFF] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#4f46e5] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            {/* Spinner */}
            <svg
              className="w-4 h-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            Memproses...
          </>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Import Data
          </>
        )}
      </button>

      {/* Pesan error validasi */}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}