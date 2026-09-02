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
            <main className="flex-1 flex flex-col">
                <div className="max-w-6xl mx-auto w-full flex flex-col flex-1">
                    {children}
                </div>
            </main>
            <Footer />
        </div>
    )
}
