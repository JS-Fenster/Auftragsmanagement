import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { FolderKanban, CalendarDays, ArrowLeft, Home, Search, LayoutDashboard, Moon, Sun, Euro, Package, FileText, Truck, LogOut, Users, Menu, X as XIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useEffect, lazy, Suspense } from 'react'
import { useIsStandalone } from './hooks/usePopout'
import { useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import CommandPalette from './components/CommandPalette'
import ChatWidget from './components/ChatWidget'
import NotificationBell from './components/NotificationBell'
import { ChatContextProvider } from './lib/chatContext'

// Code-splitting: lazy load all page components (AM-090)
const Cockpit = lazy(() => import('./pages/Cockpit'))
const Uebersicht = lazy(() => import('./pages/Uebersicht'))
const Auftraege = lazy(() => import('./pages/Auftraege'))
const Dokumente = lazy(() => import('./pages/Dokumente'))
const Kunden = lazy(() => import('./pages/Kunden'))
const Emails = lazy(() => import('./pages/Emails'))
const Einstellungen = lazy(() => import('./pages/Einstellungen'))
const Budgetangebot = lazy(() => import('./pages/Budgetangebot'))
const BudgetangebotVerlauf = lazy(() => import('./pages/BudgetangebotVerlauf'))
const Projekte = lazy(() => import('./pages/Projekte'))
const ProjektDetail = lazy(() => import('./pages/ProjektDetail'))
const Kalender = lazy(() => import('./pages/Kalender'))
const Montageplanung = lazy(() => import('./pages/Montageplanung'))
const TerminDetail = lazy(() => import('./components/TerminDetail'))
const TerminForm = lazy(() => import('./components/TerminForm'))
const Finanzen = lazy(() => import('./pages/Finanzen'))
const Bestellungen = lazy(() => import('./pages/Bestellungen'))
const BelegListe = lazy(() => import('./pages/BelegListe'))
const BelegErstellen = lazy(() => import('./pages/BelegErstellen'))
const Lieferanten = lazy(() => import('./pages/Lieferanten'))
const Mitarbeiter = lazy(() => import('./pages/Mitarbeiter'))
const MitarbeiterDetail = lazy(() => import('./pages/MitarbeiterDetail'))

const NAV_ITEMS = [
  { to: '/', label: 'Cockpit', icon: LayoutDashboard },
  { to: '/projekte', label: 'Projekte', icon: FolderKanban },
  { to: '/kalender', label: 'Kalender', icon: CalendarDays },
  { to: '/finanzen', label: 'Finanzen', icon: Euro },
  { to: '/bestellungen', label: 'Bestellungen', icon: Package },
  { to: '/belege', label: 'Belege', icon: FileText },
  { to: '/lieferanten', label: 'Lieferanten', icon: Truck },
  { to: '/mitarbeiter', label: 'Mitarbeiter', icon: Users },
]

const PAGE_TITLES = {
  '/': 'Cockpit',
  '/projekte': 'Projekte',
  '/kalender': 'Kalender',
  '/montageplanung': 'Montageplanung',
  '/budgetangebot': 'Budgetangebot',
  '/budgetangebot-verlauf': 'Angebotsverlauf',
  '/auftraege': 'Aufträge',
  '/dokumente': 'Dokumente',
  '/kunden': 'Kunden',
  '/emails': 'E-Mail',
  '/einstellungen': 'Einstellungen',
  '/uebersicht': 'Übersicht',
  '/finanzen': 'Finanzen',
  '/bestellungen': 'Bestellungen',
  '/belege': 'Belege',
  '/lieferanten': 'Lieferanten',
  '/mitarbeiter': 'Mitarbeiter',
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

function Sidebar({ mobileOpen, onClose }) {
  const [dark, toggleDark] = useDarkMode()
  const { user, signOut } = useAuth()
  const location = useLocation()

  // Auto-close mobile sidebar on navigation
  useEffect(() => { if (onClose) onClose() }, [location.pathname])

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={onClose} />}
      <nav className={`
        bg-surface-sidebar border-r border-border-default flex flex-col
        fixed inset-y-0 left-0 z-50 w-56 transition-transform duration-200 lg:relative lg:translate-x-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
      <div className="px-4 pt-4 pb-3 border-b border-border-default">
        <img src="/js-logo.svg" alt="J.S. Fenster & Türen" className="w-44 dark:brightness-200" />
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
            <div className="w-6 h-6 rounded-full bg-[#C4C7C7] dark:bg-[#9E9E9E] text-[#333] dark:text-[#1a1a1a] flex items-center justify-center text-xs font-semibold">
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
    </>
  )
}

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-6 h-6 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
  </div>
)

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Cockpit />} />
      <Route path="/projekte" element={<Projekte />} />
      <Route path="/projekte/:id" element={<ProjektDetail />} />
      <Route path="/kalender" element={<Kalender />} />
      <Route path="/montageplanung" element={<Navigate to="/kalender" replace />} />
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
      <Route path="/mitarbeiter" element={<Mitarbeiter />} />
      <Route path="/mitarbeiter/:id" element={<MitarbeiterDetail />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}

function ProtectedApp() {
  const isStandalone = useIsStandalone()

  if (isStandalone) {
    return (
      <ChatContextProvider>
        <div className="flex flex-col h-screen bg-surface-main">
          <StandaloneHeader />
          <main className="flex-1 overflow-y-auto h-full">
            <AppRoutes />
          </main>
          <Suspense fallback={null}><TerminDetail /></Suspense>
          <Suspense fallback={null}><TerminForm /></Suspense>
          <CommandPalette />
          <ChatWidget />
        </div>
      </ChatContextProvider>
    )
  }

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [jessOpen, setJessOpen] = useState(false)

  return (
    <ChatContextProvider>
      <div className="flex h-screen bg-surface-main">
        <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header with hamburger */}
          <div className="lg:hidden flex items-center gap-3 px-3 py-2 border-b border-border-default bg-surface-sidebar shrink-0">
            <button onClick={() => setMobileMenuOpen(true)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary">
              <Menu size={20} />
            </button>
            <img src="/js-logo.svg" alt="JS Fenster" className="h-6 dark:brightness-200" />
            <div className="flex-1" />
            <button onClick={() => setJessOpen(!jessOpen)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary">
              <img src="/jess-avatar.png" alt="Jess" className="w-6 h-6 rounded-full" onError={e => { e.target.style.display = 'none' }} />
            </button>
          </div>

          <main className="flex-1 overflow-y-auto">
            <AppRoutes />
          </main>
        </div>

        {/* Mobile: Jess Fullscreen Panel */}
        {jessOpen && (
          <div className="fixed inset-0 z-50 bg-surface-card flex flex-col lg:hidden">
            <ChatWidget embedded onClose={() => setJessOpen(false)} />
          </div>
        )}

        {/* Desktop: Original floating ChatWidget (unten rechts) */}
        <div className="hidden lg:block">
          <ChatWidget />
        </div>

        <Suspense fallback={null}><TerminDetail /></Suspense>
        <Suspense fallback={null}><TerminForm /></Suspense>
        <CommandPalette />
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
