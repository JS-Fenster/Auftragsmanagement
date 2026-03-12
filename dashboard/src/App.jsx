import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { FolderKanban, CalendarDays, ArrowLeft, Home, Search, LayoutDashboard } from 'lucide-react'
import { useIsStandalone } from './hooks/usePopout'
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
import CommandPalette from './components/CommandPalette'
import ChatWidget from './components/ChatWidget'

const NAV_ITEMS = [
  { to: '/', label: 'Cockpit', icon: LayoutDashboard },
  { to: '/projekte', label: 'Projekte', icon: FolderKanban },
  { to: '/kalender', label: 'Kalender', icon: CalendarDays },
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
}

function StandaloneHeader() {
  const location = useLocation()
  const basePath = '/' + location.pathname.split('/').filter(Boolean).slice(0, 1).join('/')
  const pageTitle = PAGE_TITLES[basePath] || PAGE_TITLES[location.pathname] || 'JS Fenster'

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b bg-white">
      <button onClick={() => window.close()} className="text-gray-400 hover:text-gray-600">
        <ArrowLeft size={18} />
      </button>
      <button onClick={() => window.location.href = '/'} className="text-gray-400 hover:text-gray-600">
        <Home size={18} />
      </button>
      <span className="text-sm font-medium text-gray-700">{pageTitle}</span>
      <div className="flex-1" />
      <span className="text-xs text-gray-400">JS Fenster</span>
    </div>
  )
}

function Sidebar() {
  return (
    <nav className="w-56 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-900">JS Fenster</h1>
        <p className="text-xs text-gray-500">Auftragsmanagement</p>
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
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
        {/* Cmd+K Hint - klickbar */}
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          className="flex items-center gap-3 px-4 py-2.5 mx-2 mt-4 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors w-full text-left"
        >
          <Search size={18} />
          <span>Suche</span>
          <kbd className="ml-auto text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded border border-gray-200">
            Ctrl+K
          </kbd>
        </button>
      </div>
      <div className="p-4 border-t border-gray-200 text-xs text-gray-400">
        Dashboard v2.0
      </div>
    </nav>
  )
}

function AppRoutes() {
  return (
    <Routes>
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const isStandalone = useIsStandalone()

  if (isStandalone) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <StandaloneHeader />
        <main className="flex-1 overflow-auto">
          <AppRoutes />
        </main>
        <CommandPalette />
        <ChatWidget />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <AppRoutes />
      </main>
      <CommandPalette />
      <ChatWidget />
    </div>
  )
}
