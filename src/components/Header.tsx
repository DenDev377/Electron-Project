export default function Header() {
    return (
        <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-0 shadow-sm">
            <div className="w-full mx-auto flex justify-between">

                <div className="flex items-center gap-3 py-4">
                    <img
                        src="./LOGO-BIN.png"
                        alt="Logo Kejaksaan RI"
                        className="h-10 w-10 object-contain"
                    />
                    <img
                        src="./logo.png"
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


            </div>
        </header>
    )
}
