import ImportButton from './components/ImportButton'
import Table from './components/Table'

export default function App() {
  return (
    <div className=" p-6 flex flex-col gap-4 ">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Data Pegawai</h2>
        <ImportButton />
      </div>

      {/* Content area — taruh komponen lain di sini */}
      <Table />
    </div>
  )
}
