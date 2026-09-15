import Header from './components/Header'
import type { ReactNode } from 'react'
import Footer from './components/Footer'

interface LayoutProps {
    children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
    return (
        <div className="flex flex-col min-h-screen bg-gray-100">
            <Header />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="w-full px-4 lg:px-8 mx-auto flex flex-col flex-1 min-w-0">
                    {children}
                </div>
            </main>
            <Footer />
        </div>
    )
}
