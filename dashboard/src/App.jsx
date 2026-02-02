import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, FileText, Users, Mail, Settings } from 'lucide-react'
import Uebersicht from './pages/Uebersicht'
import Auftraege from './pages/Auftraege'
import Dokumente from './pages/Dokumente'
import Kunden from './pages/Kunden'
import Emails from './pages/Emails'
import Einstellungen from './pages/Einstellungen'

const NAV_ITEMS = [
  { to: '/uebersicht', label: 'Übersicht', icon: LayoutDashboard },
  { to: '/auftraege', label: 'Aufträge', icon: ClipboardList },
  { to: '/dokumente', label: 'Dokumente', icon: FileText },
  { to: '/kunden', label: 'Kunden', icon: Users },
  { to: '/emails', label: 'E-Mail', icon: Mail },
  { to: '/einstellungen', label: 'Einstellungen', icon: Settings },
]

export default function App() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
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
        </div>
        <div className="p-4 border-t border-gray-200 text-xs text-gray-400">
          Dashboard v1.0
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/uebersicht" element={<Uebersicht />} />
          <Route path="/auftraege" element={<Auftraege />} />
          <Route path="/dokumente" element={<Dokumente />} />
          <Route path="/kunden" element={<Kunden />} />
          <Route path="/emails" element={<Emails />} />
          <Route path="/einstellungen" element={<Einstellungen />} />
          <Route path="*" element={<Navigate to="/uebersicht" replace />} />
        </Routes>
      </main>
    </div>
  )
}
