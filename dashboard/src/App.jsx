import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { FolderKanban, CalendarDays, ArrowLeft, Home, Search, LayoutDashboard, Moon, Sun, Euro, Package, FileText, Truck, LogOut } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useIsStandalone } from './hooks/usePopout'
import { useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Cockpit from './pages/Cockpit'
import Uebersicht from './pages/Uebersicht'
import Auftraege from './pages/Auftraege'
import Dokumente from './pages/Dokumente'
import Kunden from './pages/Kunden'
import Emails from './pages/Emails'
import Einstellungen from './pages/Einstellungen'
import Budgetangebot from './pages/Budgetangebot'
import BudgetangebotVerlauf from './pages/BudgetangebotVerlauf'
import Projekte from './pages/Projekte'
import ProjektDetail from './pages/ProjektDetail'
import Montageplanung from './pages/Montageplanung'
import Finanzen from './pages/Finanzen'
import Bestellungen from './pages/Bestellungen'
import BelegListe from './pages/BelegListe'
import BelegErstellen from './pages/BelegErstellen'
import Lieferanten from './pages/Lieferanten'
import CommandPalette from './components/CommandPalette'
import ChatWidget from './components/ChatWidget'
import NotificationBell from './components/NotificationBell'
import { ChatContextProvider } from './lib/chatContext'

const NAV_ITEMS = [
  { to: '/', label: 'Cockpit', icon: LayoutDashboard },
  { to: '/projekte', label: 'Projekte', icon: FolderKanban },
  { to: '/kalender', label: 'Kalender', icon: CalendarDays },
  { to: '/finanzen', label: 'Finanzen', icon: Euro },
  { to: '/bestellungen', label: 'Bestellungen', icon: Package },
  { to: '/belege', label: 'Belege', icon: FileText },
  { to: '/lieferanten', label: 'Lieferanten', icon: Truck },
]

const PAGE_TITLES = {
  '/': 'Cockpit',
  '/projekte': 'Projekte',
  '/kalender': 'Kalender',
  '/montageplanung': 'Montageplanung',
  '/budgetangebot': 'Budgetangebot',
  '/budgetangebot-verlauf': 'Angebotsverlauf',
  '/auftraege': 'Auftraege',
  '/dokumente': 'Dokumente',
  '/kunden': 'Kunden',
  '/emails': 'E-Mail',
  '/einstellungen': 'Einstellungen',
  '/uebersicht': 'Uebersicht',
  '/finanzen': 'Finanzen',
  '/bestellungen': 'Bestellungen',
  '/belege': 'Belege',
  '/lieferanten': 'Lieferanten',
}

function StandaloneHeader() {
  const location = useLocation()
  const basePath = '/' + location.pathname.split('/').filter(Boolean).slice(0, 1).join('/')
  const pageTitle = PAGE_TITLES[basePath] || PAGE_TITLES[location.pathname] || 'JS Fenster'

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border-default bg-surface-sidebar">
      <button onClick={() => window.close()} className="text-text-muted hover:text-text-secondary">
        <ArrowLeft size={18} />
      </button>
      <button onClick={() => window.location.href = '/'} className="text-text-muted hover:text-text-secondary">
        <Home size={18} />
      </button>
      <span className="text-sm font-medium text-text-primary">{pageTitle}</span>
      <div className="flex-1" />
      <span className="text-xs text-text-muted">JS Fenster</span>
    </div>
  )
}

function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return [dark, () => setDark(prev => !prev)]
}

function Sidebar() {
  const [dark, toggleDark] = useDarkMode()
  const { user, signOut } = useAuth()

  return (
    <nav className="w-56 bg-surface-sidebar border-r border-border-default flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-border-default">
        <img src="/js-logo.svg" alt="J.S. Fenster & Tueren" className="w-44 dark:brightness-200" />
        <p className="text-xs text-text-muted mt-1.5 pl-0.5">Auftragsmanagement</p>
      </div>
      <div className="flex-1 py-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-nav-active-bg text-nav-active-text font-medium'
                  : 'text-text-secondary hover:bg-nav-hover-bg hover:text-nav-hover-text'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          className="flex items-center gap-3 px-4 py-2.5 mx-2 mt-4 text-sm text-text-muted hover:text-text-secondary hover:bg-nav-hover-bg rounded-lg transition-colors w-full text-left"
        >
          <Search size={18} />
          <span>Suche</span>
          <kbd className="ml-auto text-xs bg-surface-hover text-text-muted px-1.5 py-0.5 rounded border border-border-default">
            Ctrl+K
          </kbd>
        </button>
        <NotificationBell />
      </div>
      <div className="px-4 py-3 border-t border-border-default">
        {user && (
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-[var(--brand-light)] text-[var(--brand-dark)] flex items-center justify-center text-xs font-medium">
              {user.email?.[0]?.toUpperCase() || '?'}
            </div>
            <span className="text-xs text-text-secondary truncate flex-1">{user.email}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">Dashboard v2.0</span>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleDark}
              className="p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer"
              title={dark ? 'Light Mode' : 'Dark Mode'}
            >
              {dark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              onClick={signOut}
              className="p-1.5 rounded-md text-text-muted hover:text-red-500 hover:bg-surface-hover transition-colors cursor-pointer"
              title="Abmelden"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Cockpit />} />
      <Route path="/projekte" element={<Projekte />} />
      <Route path="/projekte/:id" element={<ProjektDetail />} />
      <Route path="/kalender" element={<Montageplanung />} />
      <Route path="/montageplanung" element={<Montageplanung />} />
      <Route path="/budgetangebot" element={<Budgetangebot />} />
      <Route path="/budgetangebot-verlauf" element={<BudgetangebotVerlauf />} />
      <Route path="/auftraege" element={<Auftraege />} />
      <Route path="/dokumente" element={<Dokumente />} />
      <Route path="/kunden" element={<Kunden />} />
      <Route path="/emails" element={<Emails />} />
      <Route path="/einstellungen" element={<Einstellungen />} />
      <Route path="/uebersicht" element={<Uebersicht />} />
      <Route path="/finanzen" element={<Finanzen />} />
      <Route path="/bestellungen" element={<Bestellungen />} />
      <Route path="/belege" element={<BelegListe />} />
      <Route path="/belege/neu" element={<BelegErstellen />} />
      <Route path="/belege/:id" element={<BelegErstellen />} />
      <Route path="/lieferanten" element={<Lieferanten />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function ProtectedApp() {
  const isStandalone = useIsStandalone()

  if (isStandalone) {
    return (
      <ChatContextProvider>
        <div className="flex flex-col h-screen bg-surface-main">
          <StandaloneHeader />
          <main className="flex-1 overflow-auto">
            <AppRoutes />
          </main>
          <CommandPalette />
          <ChatWidget />
        </div>
      </ChatContextProvider>
    )
  }

  return (
    <ChatContextProvider>
      <div className="flex h-screen bg-surface-main">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <AppRoutes />
        </main>
        <CommandPalette />
        <ChatWidget />
      </div>
    </ChatContextProvider>
  )
}

export default function App() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-main">
        <div className="w-8 h-8 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session && location.pathname !== '/login') {
    return <Navigate to="/login" replace />
  }

  if (session && location.pathname === '/login') {
    return <Navigate to="/" replace />
  }

  if (location.pathname === '/login') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    )
  }

  return <ProtectedApp />
}
