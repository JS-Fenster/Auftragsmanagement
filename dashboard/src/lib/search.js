/**
 * Zentrale Such-Logik fuer Kontakte und Projekte.
 *
 * PFLICHT: Neue Suchfelder die Kontakte oder Projekte durchsuchen MUESSEN
 * diese Funktionen nutzen — keine eigene .or(...ilike...) Logik mehr bauen.
 * Siehe AM-CLAUDE.md Abschnitt "Suchfelder".
 *
 * Kernprinzip — Multi-Wort-Queries:
 *   "Koller Kuemmersbruck" wird in Tokens ["Koller", "Kuemmersbruck"] zerlegt.
 *   JEDER Token muss irgendwo matchen (AND ueber Tokens, OR ueber Felder/Tabellen).
 *   Bei Kontakten wird parallel in kontakte / kontakt_personen / kontakt_details
 *   gesucht und am Ende die Schnittmenge gebildet.
 *
 * Entstehung: 2026-04-23 nach Multi-Wort-Such-Bug ("Koller Kuemmersbruck" fand
 * 0 Treffer obwohl 6 Kontakte matchen). Davor war die Logik in 4 Komponenten
 * dupliziert (AM-Backlog-Referenz: AM-210).
 */
import { supabase } from './supabase'

/** Tokenisiert eine Such-Query. Nur Tokens >= 2 Zeichen. */
function tokenize(term) {
  if (!term || typeof term !== 'string') return []
  return term.trim().split(/\s+/).filter(t => t.length >= 2)
}

/**
 * Sucht kontakt_ids fuer einen Query-String. Durchsucht in Tokens zerlegt
 * ueber 3 Dimensionen: kontakte (firma/ort/plz/strasse), kontakt_personen
 * (vorname/nachname), kontakt_details (wert — telefon/email).
 *
 * @param {string} term - Suchstring, z.B. "Koller Kuemmersbruck"
 * @param {object} opts
 * @param {number} [opts.limit=500] - Limit pro Einzel-Query (nicht final)
 * @returns {Promise<Set<string>>} Set matchender kontakt_ids
 */
export async function searchKontakteIds(term, { limit = 500 } = {}) {
  const tokens = tokenize(term)
  if (tokens.length === 0) return new Set()

  const idSetsPerToken = await Promise.all(tokens.map(async (token) => {
    const p = `%${token}%`
    const [kontakteRes, personenRes, detailsRes] = await Promise.all([
      supabase.from('kontakte').select('id')
        .or(`firma1.ilike.${p},firma2.ilike.${p},ort.ilike.${p},plz.ilike.${p},strasse.ilike.${p}`)
        .limit(limit),
      supabase.from('kontakt_personen').select('kontakt_id')
        .or(`vorname.ilike.${p},nachname.ilike.${p}`)
        .limit(limit),
      supabase.from('kontakt_details').select('kontakt_personen!inner(kontakt_id)')
        .ilike('wert', p)
        .limit(limit),
    ])
    const ids = new Set()
    for (const k of (kontakteRes.data || [])) ids.add(k.id)
    for (const kp of (personenRes.data || [])) ids.add(kp.kontakt_id)
    for (const d of (detailsRes.data || [])) {
      const kid = d.kontakt_personen?.kontakt_id
      if (kid) ids.add(kid)
    }
    return ids
  }))

  // AND-Schnittmenge aller Token-Sets
  return idSetsPerToken.reduce((acc, set) => {
    if (acc === null) return set
    return new Set([...acc].filter(id => set.has(id)))
  }, null) || new Set()
}

/**
 * Sucht Kontakte als vollstaendige Datensaetze. Laedt die matchenden IDs
 * via searchKontakteIds und zieht dann die gewuenschten Spalten in einem
 * Batch nach.
 *
 * @param {string} term
 * @param {object} opts
 * @param {number} [opts.limit=50]
 * @param {string} [opts.select] - Supabase-Select-String
 * @returns {Promise<Array>}
 */
export async function searchKontakte(term, { limit = 50, select = 'id, firma1, firma2, ort, plz, strasse, erp_kunden_code' } = {}) {
  const ids = await searchKontakteIds(term)
  if (ids.size === 0) return []
  const { data } = await supabase.from('kontakte')
    .select(select)
    .in('id', Array.from(ids))
    .limit(limit)
  return data || []
}

/**
 * Sucht Projekte. Tokenisiert die Query und laesst jeden Token gegen
 * titel/projekt_nummer/notizen matchen.
 *
 * @param {string} term
 * @param {object} opts
 * @param {number} [opts.limit=20]
 * @param {string} [opts.select]
 * @param {Array<string>} [opts.fields] - Felder in denen gesucht wird
 * @returns {Promise<Array>}
 */
export async function searchProjekte(term, {
  limit = 20,
  select = 'id, projekt_nummer, titel, status',
  fields = ['titel', 'projekt_nummer', 'notizen'],
} = {}) {
  const tokens = tokenize(term)
  if (tokens.length === 0) return []
  let q = supabase.from('projekte').select(select).limit(limit)
  for (const t of tokens) {
    const or = fields.map(f => `${f}.ilike.%${t}%`).join(',')
    q = q.or(or)
  }
  const { data } = await q
  return data || []
}

/**
 * Wendet die Token-Filter-Logik auf einen vorhandenen Query-Builder an.
 * Nuetzlich wenn die Such-Query mit anderen Filtern (status, typ, ...)
 * kombiniert werden muss (z.B. Projekte-Listenansicht mit Status-Filter).
 *
 * @param {object} query - Supabase-Query-Builder (chainable)
 * @param {string} term - Such-Query
 * @param {Array<string>} fields - Felder gegen die getestet wird
 * @returns {object} modifizierter Query-Builder
 */
export function applyTokenFilter(query, term, fields) {
  const tokens = tokenize(term)
  for (const t of tokens) {
    const or = fields.map(f => `${f}.ilike.%${t}%`).join(',')
    query = query.or(or)
  }
  return query
}
