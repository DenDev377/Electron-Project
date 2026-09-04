import { useRef, useState } from 'react';
import type { PegawaiRow, ImportResult } from '../types/pegawai';
import { parseExcelFile } from '../utils/excelParser';
import { transformEmployeeData } from '../utils/employeeTransformer';

interface ImportButtonProps {
  /** Dipanggil setelah parsing selesai — untuk mengisi tabel di UI */
  onImport: (data: PegawaiRow[]) => void;
  /** Dipanggil setelah proses import ke database selesai */
  onImportResult?: (result: ImportResult) => void;
}

type ImportStatus = 'idle' | 'parsing' | 'saving' | 'done' | 'error';

export default function ImportButton({ onImport, onImportResult }: ImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const isLoading = status === 'parsing' || status === 'saving';

  function handleClick() {
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
      e.target.value = '';
      return;
    }

    setError(null);

    try {
      // ── Tahap 1: Parsing Excel ────────────────────────────────────────
      setStatus('parsing');
      const rawRows = await parseExcelFile(file);
      console.log('[Import] Hasil parsing Excel:', rawRows);

      // Tampilkan data di tabel segera setelah parsing
      onImport(rawRows);

      // ── Tahap 2: Validasi & Transformasi data ─────────────────────────
      const { valid, errors: transformErrors } = transformEmployeeData(rawRows);

      console.log('[Import] Data valid:', valid.length);
      if (transformErrors.length > 0) {
        console.warn('[Import] Baris bermasalah:', transformErrors);
      }

      // ── Tahap 3: Simpan ke database via IPC ───────────────────────────
      if (!window.electronAPI) {
        // Berjalan di browser biasa (npm run dev) — tidak ada akses database
        console.warn(
          '[Import] window.electronAPI tidak tersedia. ' +
          'Jalankan dengan `npm run electron:dev` untuk mengaktifkan penyimpanan database.'
        );

        // Buat hasil sementara dari transform errors saja
        if (onImportResult) {
          onImportResult({
            berhasil:   0,
            diperbarui: 0,
            gagal:      transformErrors.length,
            errors:     transformErrors,
          });
        }

        setStatus('done');
        setError(
          'Mode browser: data ditampilkan di tabel, tapi tidak disimpan ke database. ' +
          'Gunakan `npm run electron:dev` untuk menyimpan.'
        );
        e.target.value = '';
        return;
      }

      if (valid.length === 0) {
        // Semua baris gagal validasi — tidak perlu ke database
        if (onImportResult) {
          onImportResult({
            berhasil:   0,
            diperbarui: 0,
            gagal:      transformErrors.length,
            errors:     transformErrors,
          });
        }
        setStatus('done');
        e.target.value = '';
        return;
      }

      // Kirim ke Electron main process
      setStatus('saving');
      const dbResult = await window.electronAPI.importPegawai(valid);
      console.log('[Import] Hasil database:', dbResult);

      // Gabungkan error dari transformasi + error dari database
      const combinedResult: ImportResult = {
        berhasil:   dbResult.berhasil,
        diperbarui: dbResult.diperbarui,
        gagal:      dbResult.gagal + transformErrors.length,
        errors:     [...transformErrors, ...dbResult.errors],
      };

      if (onImportResult) {
        onImportResult(combinedResult);
      }

      setStatus('done');

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memproses file.';
      console.error('[Import] Error:', err);
      setError(message);
      setStatus('error');
    } finally {
      e.target.value = '';
    }
  }

  // Label & warna tombol berdasarkan status
  const buttonLabel = {
    idle:    'Import Data',
    parsing: 'Membaca Excel...',
    saving:  'Menyimpan ke DB...',
    done:    'Import Data',
    error:   'Import Data',
  }[status];

  return (
    <div className="flex flex-col items-end gap-1">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        id="import-data-button"
        onClick={handleClick}
        disabled={isLoading}
        className="flex items-center gap-2 bg-[#635BFF] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#4f46e5] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            {/* Spinner */}
            <svg
              className="w-4 h-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {buttonLabel}
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
            {buttonLabel}
          </>
        )}
      </button>

      {/* Status indicator saat loading */}
      {status === 'saving' && (
        <p className="text-xs text-blue-500">Menyimpan ke database...</p>
      )}

      {/* Pesan error */}
      {error && (
        <p className="text-xs text-amber-600 max-w-xs text-right">{error}</p>
      )}
    </div>
  );
}