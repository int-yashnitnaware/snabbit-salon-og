import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Snabbit Salon OG',
  description: 'On-ground attendance app for the Snabbit salon category',
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
