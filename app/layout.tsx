import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { NavigationLoaderProvider, NavigationLoaderHost } from '@/components/brand/NavigationLoader'

const inter = Inter({ subsets: ['latin'], variable: '--font-geist-sans' })

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