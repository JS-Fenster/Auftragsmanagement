import { AUFTRAG_STATUS, PRIORITAETEN } from '../../lib/constants'
import { Search, Filter, X, AlertTriangle } from 'lucide-react'
import {
  StatusBadge,
  PriorityBadge,
  formatDate,
  truncate,
  kundeName,
  kundeAdresse,
  einsatzortAdresse,
} from './auftragHelpers'

export default function AuftraegeListe({
  filtered,
  total,
  search,
  setSearch,
  activeStatuses,
  toggleStatus,
  priorityFilter,
  setPriorityFilter,
  onSelectAuftrag,
}) {
  return (
    <>
      {/* Search */}
      <div className="flex items-center border border-border-default rounded-lg px-3 py-2 mb-4 bg-surface-card">
        <Search className="w-4 h-4 text-text-muted mr-2 shrink-0" />
        <input
          className="flex-1 text-sm outline-none"
          placeholder="Suche nach Nr., Beschreibung, Adresse, Kunde..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-text-muted hover:text-text-secondary">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-text-muted" />
        {Object.entries(AUFTRAG_STATUS).map(([key, val]) => {
          const active = activeStatuses.includes(key)
          return (
            <button
              key={key}
              className="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
              style={{
                backgroundColor: active ? val.bg : 'transparent',
                color: active ? val.text : '#6B7280',
                borderColor: active ? val.color : '#D1D5DB',
              }}
              onClick={() => toggleStatus(key)}
            >
              {val.label}
            </button>
          )
        })}
        <select
          className="ml-2 border border-border-default rounded-lg px-2 py-1 text-xs"
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
        >
          <option value="">{`Alle Priorit\u00e4ten`}</option>
          {Object.entries(PRIORITAETEN).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-surface-card rounded-xl border border-border-default overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-text-secondary py-12 text-center">{`Keine Auftr\u00e4ge gefunden.`}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-main text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                <th className="px-4 py-3">Nr.</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Prio</th>
                <th className="px-4 py-3">Kunde</th>
                <th className="px-4 py-3 hidden md:table-cell">Adresse</th>
                <th className="px-4 py-3 hidden lg:table-cell">Beschreibung</th>
                <th className="px-4 py-3 hidden sm:table-cell">Termin</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(a => (
                <tr
                  key={a.id}
                  className="hover:bg-surface-main cursor-pointer transition-colors"
                  onClick={() => onSelectAuftrag(a)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary whitespace-nowrap">{a.auftragsnummer || '\u2013'}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={a.prioritaet} /></td>
                  <td className="px-4 py-3 font-medium text-text-primary">{truncate(kundeName(a), 30)}</td>
                  <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{truncate(einsatzortAdresse(a) || kundeAdresse(a), 40)}</td>
                  <td className="px-4 py-3 text-text-secondary hidden lg:table-cell">{truncate(a.beschreibung, 50)}</td>
                  <td className="px-4 py-3 text-text-secondary hidden sm:table-cell whitespace-nowrap">{formatDate(a.termin_sv1)}</td>
                  <td className="px-4 py-3">
                    {a.ist_zu_lange_offen && (
                      <AlertTriangle className="w-4 h-4 text-amber-500" title="Zu lange offen" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
