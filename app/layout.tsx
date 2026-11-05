import type { Metadata } from 'next'
// Self-hosted (app/fonts, built from google/fonts by subsetting to the same
// character sets next/font/google used): builds never need the internet.
import localFont from 'next/font/local'
import './globals.css'
import { NavigationLoaderProvider, NavigationLoaderHost } from '@/components/brand/NavigationLoader'

const inter = localFont({ src: './fonts/inter-latin.woff2', weight: '100 900', variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: "Choose'Tounsi — Admin Panel",
  description: 'Platform Administration Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // ✅ Keep "dark" class — required for the dark theme CSS variables to apply
    <html lang="en" className="dark">
      <body className={`${inter.variable} bg-bg-primary text-text-primary antialiased`}>
        <NavigationLoaderProvider>
          {children}
          {/* fullscreen (login); the dashboard mounts its own over its content area */}
          <NavigationLoaderHost />
        </NavigationLoaderProvider>
      </body>
    </html>
  )
}