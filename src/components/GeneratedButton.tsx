
const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Hitung bulan kapan tombol Generate boleh aktif.
 * bulanGenerate = bulan_pengangkatan - 3, dengan rollover ke tahun sebelumnya.
 */
function getBulanGenerate(bulanPengangkatan: number): { bulan: number; rollbackTahun: boolean } {
  let bulan = bulanPengangkatan - 3;
  let rollbackTahun = false;
  if (bulan <= 0) {
    bulan += 12;
    rollbackTahun = true;
  }
  return { bulan, rollbackTahun };
}

type ButtonState = 'disabled' | 'ready' | 'loading';

interface GeneratedButtonProps {
  onClick?: () => void;
  isLoading?: boolean;
  /** bulan_pengangkatan dari data pegawai (1-12). Jika tidak ada, button selalu ready. */
  bulanPengangkatan?: number;
}

export default function GeneratedButton({ onClick, isLoading, bulanPengangkatan }: GeneratedButtonProps) {
  let state: ButtonState = 'ready';

  if (isLoading) {
    state = 'loading';
  } else if (bulanPengangkatan !== undefined) {
    const currentMonth = new Date().getMonth() + 1; // 1-12

    const { bulan: bulanGenerate, rollbackTahun } = getBulanGenerate(bulanPengangkatan);

    // Jika rollbackTahun = true, bulan generate ada di akhir tahun lalu
    // artinya tahun ini sudah melewati periode tersebut → selalu ready
    const sudahSiap = rollbackTahun ? true : currentMonth >= bulanGenerate;

    if (!sudahSiap) {
      state = 'disabled';
    }
  }

  const namaBuilanGenerate = bulanPengangkatan !== undefined
    ? NAMA_BULAN[getBulanGenerate(bulanPengangkatan).bulan - 1]
    : 'Belum siap';

  const config: Record<ButtonState, { label: string; className: string; showIcon: boolean }> = {
    disabled: {
      label: namaBuilanGenerate,
      className: 'bg-gray-200 text-gray-400 cursor-not-allowed',
      showIcon: false,
    },
    ready: {
      label: 'Generate',
      className: 'bg-amber-500 hover:bg-amber-600 text-white',
      showIcon: true,
    },
    loading: {
      label: 'Loading...',
      className: 'bg-gray-400 text-white cursor-not-allowed',
      showIcon: true,
    }
  };

  const { label, className, showIcon } = config[state];

  return (
    <button
      onClick={state === 'ready' ? onClick : undefined}
      disabled={state === 'disabled' || state === 'loading'}
      className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm ${className}`}
    >
      {showIcon && (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
      {label}
    </button>
  );
}