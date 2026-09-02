
import GeneratedButton from "./GeneratedButton"

export default function Table() {
    const TotalData = [
        {
            id: 1,
            Nama: "Ahmad",
            NIP: "123456789",
            Golongan: "Yuana Darma/II/a",
            TanggalMasuk: "2025-05",
            TanggalKenaikan: "2026-05",
            Aksi: "Generated"

        },
        {
            id: 2,
            Nama: "Budi",
            NIP: "123456789",
            Golongan: "Yuana Darma/II/a",
            TanggalMasuk: "2025-05",
            TanggalKenaikan: "2026-05",
            Aksi: "Generated"

        },
        {
            id: 3,
            Nama: "Budi",
            NIP: "123456789",
            Golongan: "Yuana Darma/II/a",
            TanggalMasuk: "2025-05",
            TanggalKenaikan: "2026-05",
            Aksi: "Generated"

        },

    ]

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            No
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Nama
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            NIP
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Golongan
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tanggal Masuk
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tanggal Kenaikan
                        </th>

                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Aksi
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {TotalData.map((item) => (
                        <tr key={item.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.Nama}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.NIP}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.Golongan}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.TanggalMasuk}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.TanggalKenaikan}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <GeneratedButton />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}