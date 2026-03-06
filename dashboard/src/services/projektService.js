import { supabase } from '../lib/supabase'

const KONTAKTE_SELECT = '*, kontakte(id, firma1, firma2, strasse, plz, ort, kontakt_personen(id, vorname, nachname, ist_hauptkontakt))'

const PRIORITAET_ORDER = { dringend: 0, hoch: 1, normal: 2, niedrig: 3 }

function today() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgo(date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

// ============ PROJEKTE CRUD ============

export async function fetchProjekte(filters = {}) {
  let query = supabase
    .from('projekte')
    .select(KONTAKTE_SELECT)

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.verantwortlich) {
    query = query.eq('verantwortlich', filters.verantwortlich)
  }
  if (filters.prioritaet) {
    query = query.eq('prioritaet', filters.prioritaet)
  }
  if (filters.search) {
    query = query.or(`titel.ilike.%${filters.search}%,projekt_nummer.ilike.%${filters.search}%`)
  }

  query = query
    .order('prioritaet', { ascending: true })
    .order('updated_at', { ascending: false })

  const { data, error } = await query
  if (error) throw new Error('Fehler beim Laden der Projekte: ' + error.message)

  data.sort((a, b) => {
    const pa = PRIORITAET_ORDER[a.prioritaet] ?? 2
    const pb = PRIORITAET_ORDER[b.prioritaet] ?? 2
    if (pa !== pb) return pa - pb
    return new Date(b.updated_at) - new Date(a.updated_at)
  })

  return data
}

export async function fetchProjekt(id) {
  const { data: projekt, error } = await supabase
    .from('projekte')
    .select(KONTAKTE_SELECT)
    .eq('id', id)
    .single()
  if (error) throw new Error('Fehler beim Laden des Projekts: ' + error.message)

  const [positionen, bestellungen, historie] = await Promise.all([
    fetchPositionen(id),
    fetchBestellungen(id),
    fetchHistorie(id),
  ])

  return { ...projekt, positionen, bestellungen, historie }
}

export async function createProjekt(data) {
  const { data: projekt, error } = await supabase
    .from('projekte')
    .insert({ ...data, projekt_nummer: '' })
    .select(KONTAKTE_SELECT)
    .single()
  if (error) throw new Error('Fehler beim Erstellen des Projekts: ' + error.message)

  await addHistorieEintrag(projekt.id, {
    aktion: 'erstellt',
    erstellt_von: data.verantwortlich || 'System',
  })

  return projekt
}

export async function updateProjekt(id, updates) {
  const { data, error } = await supabase
    .from('projekte')
    .update(updates)
    .eq('id', id)
    .select(KONTAKTE_SELECT)
    .single()
  if (error) throw new Error('Fehler beim Aktualisieren des Projekts: ' + error.message)
  return data
}

export async function updateProjektStatus(id, neuerStatus, erstellt_von = 'System') {
  const { data: current, error: fetchError } = await supabase
    .from('projekte')
    .select('status')
    .eq('id', id)
    .single()
  if (fetchError) throw new Error('Fehler beim Laden des aktuellen Status: ' + fetchError.message)

  const alterStatus = current.status
  const updates = { status: neuerStatus }

  const dateFields = {
    angebot: 'angebots_datum',
    auftrag: 'auftrags_datum',
    bestellt: 'bestell_datum',
    ab_erhalten: 'ab_datum',
    erledigt: 'erledigt_datum',
  }

  if (dateFields[neuerStatus]) {
    const feld = dateFields[neuerStatus]
    const { data: check } = await supabase
      .from('projekte')
      .select(feld)
      .eq('id', id)
      .single()
    if (check && !check[feld]) {
      updates[feld] = today()
    }
  }

  const { data, error } = await supabase
    .from('projekte')
    .update(updates)
    .eq('id', id)
    .select(KONTAKTE_SELECT)
    .single()
  if (error) throw new Error('Fehler beim Aktualisieren des Status: ' + error.message)

  await addHistorieEintrag(id, {
    aktion: 'status_change',
    feld: 'status',
    alter_wert: alterStatus,
    neuer_wert: neuerStatus,
    erstellt_von,
  })

  return data
}

export async function deleteProjekt(id) {
  const { error } = await supabase
    .from('projekte')
    .delete()
    .eq('id', id)
  if (error) throw new Error('Fehler beim Loeschen des Projekts: ' + error.message)
}

// ============ POSITIONEN ============

export async function fetchPositionen(projektId) {
  const { data, error } = await supabase
    .from('projekt_positionen')
    .select('*')
    .eq('projekt_id', projektId)
    .order('pos_nr', { ascending: true })
  if (error) throw new Error('Fehler beim Laden der Positionen: ' + error.message)
  return data
}

export async function createPosition(data) {
  const { data: position, error } = await supabase
    .from('projekt_positionen')
    .insert(data)
    .select('*')
    .single()
  if (error) throw new Error('Fehler beim Erstellen der Position: ' + error.message)
  return position
}

export async function updatePosition(id, updates) {
  const { data, error } = await supabase
    .from('projekt_positionen')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error('Fehler beim Aktualisieren der Position: ' + error.message)
  return data
}

export async function deletePosition(id) {
  const { error } = await supabase
    .from('projekt_positionen')
    .delete()
    .eq('id', id)
  if (error) throw new Error('Fehler beim Loeschen der Position: ' + error.message)
}

// ============ BESTELLUNGEN ============

export async function fetchBestellungen(projektId) {
  const { data, error } = await supabase
    .from('projekt_bestellungen')
    .select('*')
    .eq('projekt_id', projektId)
    .order('bestell_datum', { ascending: false })
  if (error) throw new Error('Fehler beim Laden der Bestellungen: ' + error.message)
  return data
}

export async function createBestellung(data) {
  const { data: bestellung, error } = await supabase
    .from('projekt_bestellungen')
    .insert(data)
    .select('*')
    .single()
  if (error) throw new Error('Fehler beim Erstellen der Bestellung: ' + error.message)
  return bestellung
}

export async function updateBestellung(id, updates) {
  const { data, error } = await supabase
    .from('projekt_bestellungen')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error('Fehler beim Aktualisieren der Bestellung: ' + error.message)
  return data
}

// ============ HISTORIE ============

export async function fetchHistorie(projektId) {
  const { data, error } = await supabase
    .from('projekt_historie')
    .select('*')
    .eq('projekt_id', projektId)
    .order('erstellt_am', { ascending: false })
  if (error) throw new Error('Fehler beim Laden der Historie: ' + error.message)
  return data
}

export async function addHistorieEintrag(projektId, { aktion, feld, alter_wert, neuer_wert, erstellt_von }) {
  const { data, error } = await supabase
    .from('projekt_historie')
    .insert({
      projekt_id: projektId,
      aktion,
      feld: feld || null,
      alter_wert: alter_wert || null,
      neuer_wert: neuer_wert || null,
      erstellt_von: erstellt_von || 'System',
    })
    .select('*')
    .single()
  if (error) throw new Error('Fehler beim Erstellen des Historie-Eintrags: ' + error.message)
  return data
}

// ============ STATISTIKEN ============

export async function fetchProjektStats() {
  const { data, error } = await supabase
    .from('projekte')
    .select('status')
  if (error) throw new Error('Fehler beim Laden der Statistiken: ' + error.message)

  const byStatus = {}
  for (const row of data) {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1
  }

  const alerts = await fetchAlerts()

  return {
    byStatus,
    total: data.length,
    alerts: alerts.length,
  }
}

export async function fetchAlerts() {
  const { data: projekte, error } = await supabase
    .from('projekte')
    .select('*, kontakte(id, firma1, firma2, strasse, plz, ort), projekt_bestellungen(id, status)')
    .in('status', ['angebot', 'bestellt', 'ab_erhalten', 'lieferung_geplant', 'montagebereit'])
  if (error) throw new Error('Fehler beim Laden der Alerts: ' + error.message)

  const alerts = []

  for (const projekt of projekte) {
    if (projekt.status === 'angebot' && projekt.angebots_datum) {
      const tage = daysAgo(projekt.angebots_datum)
      if (tage > 7) {
        alerts.push({
          projekt,
          alertType: 'angebot_offen',
          message: `Angebot seit ${tage} Tagen ohne Rueckmeldung`,
          severity: tage > 14 ? 'hoch' : 'normal',
        })
      }
    }

    if (projekt.status === 'bestellt' && projekt.bestell_datum) {
      const tage = daysAgo(projekt.bestell_datum)
      if (tage > 5) {
        alerts.push({
          projekt,
          alertType: 'ab_fehlt',
          message: `AB fehlt seit ${tage} Tagen`,
          severity: tage > 10 ? 'hoch' : 'normal',
        })
      }
    }

    if (
      projekt.liefertermin_geplant &&
      ['bestellt', 'ab_erhalten', 'lieferung_geplant'].includes(projekt.status) &&
      new Date(projekt.liefertermin_geplant) < new Date(today())
    ) {
      const tage = daysAgo(projekt.liefertermin_geplant)
      alerts.push({
        projekt,
        alertType: 'liefertermin_ueberschritten',
        message: `Liefertermin ueberschritten seit ${tage} Tagen`,
        severity: tage > 7 ? 'hoch' : 'normal',
      })
    }

    if (projekt.status === 'montagebereit') {
      const bestellungen = projekt.projekt_bestellungen || []
      const hatGeliefert = bestellungen.some(b => b.status === 'geliefert')
      if (!hatGeliefert) {
        alerts.push({
          projekt,
          alertType: 'montage_ohne_material',
          message: 'Montage geplant aber Material unklar',
          severity: 'hoch',
        })
      }
    }
  }

  return alerts
}
