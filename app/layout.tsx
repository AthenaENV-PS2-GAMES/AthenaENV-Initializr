import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'Athena Initializr — PS2 QuickJS Runtime',
  description: 'Configure e gere projetos de jogos AthenaEnv para PlayStation 2.',
  generator: 'v0.app',
}
export const viewport: Viewport = { colorScheme: 'dark light', themeColor: '#A791B7', userScalable: false }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" className="dark bg-background"><body className={`${geist.variable} ${geistMono.variable} antialiased`}><Toaster theme="dark" position="bottom-right" />{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
