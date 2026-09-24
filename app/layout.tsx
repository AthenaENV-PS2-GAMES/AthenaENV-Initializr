import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemedToaster, themeInitScript } from '@/components/theme'
import { strings } from '@/lib/strings'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: strings.meta.title,
  description: strings.meta.description,
  generator: 'v0.app',
}
export const viewport: Viewport = { colorScheme: 'dark light', themeColor: '#A791B7' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark bg-background" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head><body className={`${geist.variable} ${geistMono.variable} antialiased`}><ThemedToaster />{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
