export default function Header() {
    return (
        <header className="bg-white border-b border-gray-200 px-8 py-0 shadow-sm">
            <div className="max-w-6xl mx-auto flex justify-between">

                <div className="flex items-center gap-3 py-4">
                    <img
                        src="/LOGO-BIN.png"
                        alt="Logo Kejaksaan RI"
                        className="h-10 w-10 object-contain"
                    />
                    <img
                        src="/logo.png"
                        alt="Logo Kejaksaan RI"
                        className="h-10 w-10 object-contain"
                    />
                    <div className="h-8 w-px bg-gray-300" />

                    <div>
                        <h1 className="text-lg font-bold text-gray-900 leading-tight tracking-tight">
                            Kenaikan Gaji Berkala
                        </h1>
                        <p className="text-xs text-gray-400 font-medium">Manajemen Kenaikan Gaji Berkala</p>
                    </div>
                </div>


                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold px-3 py-1.5 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        Tahun {new Date().getFullYear()}
                    </div>

                </div>

            </div>
        </header>
    )
}
