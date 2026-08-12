import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { DataProvider, useData } from './store/DataContext'
import { ToastProvider } from './components/ds/Toast'
import Sidebar from './components/Sidebar'
import Onboarding from './pages/Onboarding'
import Sucursales from './pages/Sucursales'
import Dashboard from './pages/Dashboard'
import IngresoMensual from './pages/IngresoMensual'
import CargaMasiva from './pages/CargaMasiva'

function ErrorBanner() {
  const { error, clearError } = useData()
  if (!error) return null
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderRadius: 'var(--rl-radius-md)',
        background: 'var(--rl-error-50)',
        color: 'var(--rl-error-700)',
        border: '1px solid var(--rl-error-200)',
        marginBottom: 16,
      }}
    >
      <span>⚠️ {error}</span>
      <button
        onClick={clearError}
        style={{ all: 'unset', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}
      >
        Cerrar
      </button>
    </div>
  )
}

function Shell() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'stretch' }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: '32px 40px 64px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <ErrorBanner />
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <DataProvider>
          <Routes>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route element={<Shell />}>
              <Route path="/sucursales" element={<Sucursales />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/ingreso" element={<IngresoMensual />} />
              <Route path="/masiva" element={<CargaMasiva />} />
            </Route>
            <Route path="*" element={<Navigate to="/sucursales" replace />} />
          </Routes>
        </DataProvider>
      </ToastProvider>
    </HashRouter>
  )
}
