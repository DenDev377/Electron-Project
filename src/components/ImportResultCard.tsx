import type { ImportResult } from '../types/pegawai';

interface ImportResultCardProps {
  result: ImportResult;
  onDismiss: () => void;
}

/**
 * Menampilkan hasil proses import Excel → SQLite kepada user.
 * Menampilkan: jumlah berhasil, diperbarui, gagal, dan daftar error.
 */
export default function ImportResultCard({ result, onDismiss }: ImportResultCardProps) {
  const { berhasil, diperbarui, gagal, errors } = result;
  const total = berhasil + diperbarui + gagal;
  const adaError = errors.length > 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          {/* Icon status keseluruhan */}
          {gagal === total ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100">
              <svg className="h-4 w-4 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            </span>
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100">
              <svg className="h-4 w-4 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            </span>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-800">Hasil Import</p>
            <p className="text-xs text-gray-400">{total} data diproses dari Excel</p>
          </div>
        </div>

        {/* Tombol tutup */}
        <button
          onClick={onDismiss}
          title="Tutup"
          className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {/* ── Statistik ── */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
        {/* Berhasil */}
        <div className="flex flex-col items-center py-4 gap-1">
          <span className="text-2xl font-bold text-green-600">{berhasil}</span>
          <span className="text-xs text-gray-500 font-medium">Data Baru</span>
          <span className="inline-block w-2 h-2 rounded-full bg-green-400"></span>
        </div>

        {/* Diperbarui */}
        <div className="flex flex-col items-center py-4 gap-1">
          <span className="text-2xl font-bold text-blue-600">{diperbarui}</span>
          <span className="text-xs text-gray-500 font-medium">Diperbarui</span>
          <span className="inline-block w-2 h-2 rounded-full bg-blue-400"></span>
        </div>

        {/* Gagal */}
        <div className="flex flex-col items-center py-4 gap-1">
          <span className={`text-2xl font-bold ${gagal > 0 ? 'text-red-600' : 'text-gray-300'}`}>
            {gagal}
          </span>
          <span className="text-xs text-gray-500 font-medium">Gagal</span>
          <span className={`inline-block w-2 h-2 rounded-full ${gagal > 0 ? 'bg-red-400' : 'bg-gray-200'}`}></span>
        </div>
      </div>

      {/* ── Daftar Error (jika ada) ── */}
      {adaError && (
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">
            Detail Baris Bermasalah ({errors.length})
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {errors.map((err, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2"
              >
                {/* Nomor baris */}
                <div className="shrink-0">
                  <span className="inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs font-mono font-semibold text-red-700">
                    Baris {err.row}
                  </span>
                </div>
                {/* Detail */}
                <div className="min-w-0">
                  {err.nip && err.nip !== '(tidak ada)' && (
                    <p className="text-xs font-mono text-gray-500 truncate">
                      NIP: {err.nip}
                    </p>
                  )}
                  <p className="text-xs text-red-700 wrap-break-words">{err.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pesan sukses tanpa error ── */}
      {!adaError && (gagal === 0) && (
        <div className="px-5 py-3">
          <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
            ✅ Semua data berhasil diimport tanpa error.
          </p>
        </div>
      )}
    </div>
  );
}
