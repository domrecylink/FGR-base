'use client'

import type { ReactNode } from 'react'
import { DataProvider } from '../src/store/DataContext'
import { ToastProvider } from '../src/components/ds/Toast'

/** Todo el estado vive en el cliente: los datos salen del Web App de Apps Script. */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <DataProvider>{children}</DataProvider>
    </ToastProvider>
  )
}
