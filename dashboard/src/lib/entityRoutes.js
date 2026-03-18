// Entity type + ID -> Dashboard route mapping
const ENTITY_ROUTES = {
  kontakt: (id) => `/kunden?id=${id}`,
  projekt: (id) => `/projekte/${id}`,
  document: (id) => `/dokumente?id=${id}`,
  email: (id) => `/emails?id=${id}`,
  beleg: (id) => `/belege/${id}`,
}

export function getEntityRoute(type, id) {
  const builder = ENTITY_ROUTES[type]
  return builder ? builder(id) : null
}

// Icon names for entity types (Lucide icon names)
export const ENTITY_ICONS = {
  kontakt: 'User',
  projekt: 'FolderKanban',
  document: 'FileText',
  email: 'Mail',
  beleg: 'Receipt',
}

// Display labels for entity types
export const ENTITY_LABELS = {
  kontakt: 'Kunde',
  projekt: 'Projekt',
  document: 'Dokument',
  email: 'Email',
  beleg: 'Beleg',
}
