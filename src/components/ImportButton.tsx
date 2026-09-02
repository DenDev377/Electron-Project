export default function ImportButton() {

    return (
        <button className="flex items-center gap-2 bg-[#635BFF] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#4f46e5] transition-colors shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Import Data
        </button>
    )
}