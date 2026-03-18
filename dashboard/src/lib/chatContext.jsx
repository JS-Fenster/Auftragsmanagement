import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation } from 'react-router-dom'

const ChatContext = createContext(null)

// Route-Pattern -> Entity-Type Mapping
const ROUTE_PATTERNS = [
  { pattern: /^\/projekte\/([a-f0-9-]+)$/, type: 'projekt', idGroup: 1 },
  { pattern: /^\/belege\/([a-f0-9-]+)$/, type: 'beleg', idGroup: 1 },
  { pattern: /^\/belege\/neu$/, type: null },
]

// Query-parameter based routes
const QUERY_ROUTES = {
  '/kunden': { type: 'kontakt', param: 'id' },
  '/dokumente': { type: 'document', param: 'id' },
  '/emails': { type: 'email', param: 'id' },
}

// Route -> Page-Name
const PAGE_MAP = {
  '/': 'cockpit',
  '/projekte': 'projekte',
  '/kalender': 'kalender',
  '/finanzen': 'finanzen',
  '/bestellungen': 'bestellungen',
  '/belege': 'belege',
  '/kunden': 'kunden',
  '/dokumente': 'dokumente',
  '/emails': 'emails',
  '/einstellungen': 'einstellungen',
  '/auftraege': 'auftraege',
  '/montageplanung': 'montageplanung',
}

function parseRoute(pathname, search) {
  const params = new URLSearchParams(search)

  // Check path-based patterns first
  for (const { pattern, type, idGroup } of ROUTE_PATTERNS) {
    const match = pathname.match(pattern)
    if (match) {
      return type ? { entity_type: type, entity_id: match[idGroup] } : null
    }
  }

  // Check query-param based routes
  const basePath = pathname.replace(/\/$/, '') || '/'
  const queryRoute = QUERY_ROUTES[basePath]
  if (queryRoute) {
    const id = params.get(queryRoute.param)
    if (id) return { entity_type: queryRoute.type, entity_id: id }
  }

  return null
}

function getPageName(pathname) {
  // Exact match first
  const basePath = pathname.replace(/\/$/, '') || '/'
  if (PAGE_MAP[basePath]) return PAGE_MAP[basePath]

  // Check parent path for detail routes like /projekte/abc-123
  const parent = '/' + basePath.split('/')[1]
  return PAGE_MAP[parent] || 'unbekannt'
}

export function ChatContextProvider({ children }) {
  const location = useLocation()
  const [entity, setEntity] = useState(null) // { entity_name, kunde_id, kunde_name } - set by pages

  // Auto-detect route-based context
  const routeContext = useMemo(() => {
    const parsed = parseRoute(location.pathname, location.search)
    return {
      route: location.pathname + location.search,
      page: getPageName(location.pathname),
      ...(parsed || {}),
    }
  }, [location.pathname, location.search])

  // Reset entity details when route changes
  useEffect(() => {
    setEntity(null)
  }, [location.pathname, location.search])

  // Merge route context with entity details from pages
  const context = useMemo(() => ({
    ...routeContext,
    ...(entity || {}),
  }), [routeContext, entity])

  const setChatEntity = useCallback((details) => {
    // details: { entity_name?, kunde_id?, kunde_name? }
    setEntity(details)
  }, [])

  return (
    <ChatContext.Provider value={{ context, setChatEntity }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  const ctx = useContext(ChatContext)
  if (!ctx) {
    // Fallback when outside provider (should not happen)
    return { context: null, setChatEntity: () => {} }
  }
  return ctx
}
