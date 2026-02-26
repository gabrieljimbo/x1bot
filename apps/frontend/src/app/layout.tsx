import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { LicenseBanner } from '@/components/LicenseBanner'
import { ExpiredAccountScreen } from '@/components/ExpiredAccountScreen'

const inter = Inter({ subsets: ['latin'] })
// ... metadata
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <LicenseBanner />
          <ExpiredAccountScreen />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}





