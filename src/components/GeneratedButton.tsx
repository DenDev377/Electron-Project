const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

type ButtonState = 'disabled' | 'ready' | 'loading';

interface GeneratedButtonProps {
  onClick?: () => void;
  isLoading?: boolean;
  /** bulan_pengangkatan dari data pegawai (1-12). Jika tidak ada, button selalu ready. */
  bulanPengangkatan?: number;
  /** tahun kgb berikutnya */
  tahunKgbBerikutnya?: number;
}

export default function GeneratedButton({ onClick, isLoading, bulanPengangkatan, tahunKgbBerikutnya }: GeneratedButtonProps) {
  let state: ButtonState = 'ready';
  let labelDisabled = 'Belum siap';

  if (isLoading) {
    state = 'loading';
  } else if (bulanPengangkatan !== undefined && tahunKgbBerikutnya !== undefined) {
    const now = new Date();
    // Tanggal KGB adalah bulanPengangkatan (1-12) di tahunKgbBerikutnya
    // Generate date = KGB date dikurangi 3 bulan
    const generateDate = new Date(tahunKgbBerikutnya, bulanPengangkatan - 1 - 3, 1);
    
    // Set awal hari ini ke tanggal 1 agar bisa dibandingkan dengan generateDate
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);

    if (currentMonthDate < generateDate) {
      state = 'disabled';
      labelDisabled = `${NAMA_BULAN[generateDate.getMonth()]} ${generateDate.getFullYear()}`;
    }
  } else if (bulanPengangkatan !== undefined) {
    // Fallback jika tidak ada tahun (misal dari mode lama)
    state = 'disabled';
  }

  const config: Record<ButtonState, { label: string; className: string; showIcon: boolean }> = {
    disabled: {
      label: labelDisabled,
      className: 'bg-gray-200 text-gray-400 cursor-not-allowed',
      showIcon: false,
    },
    ready: {
      label: 'Generate',
      className: 'bg-[#635BFF] hover:bg-[#5249ea] text-white',
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