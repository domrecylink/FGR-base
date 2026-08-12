import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '../src/index.css'
import Providers from './providers'

export const metadata: Metadata = {
  title: 'Recylink · FGR',
  description: 'Avance de obra, generación de residuos y FGR por sucursal.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
