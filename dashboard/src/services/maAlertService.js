/**
 * MA-Alert Service — Prueft Mitarbeiter-Daten auf faellige Alerts
 *
 * Checks: Fuehrerschein-Pruefung, Probezeit-Ende, Befristungs-Ablauf
 * Erzeugt notifications wenn noetig (dedupliziert per metadata.alert_key)
 */
import { supabase } from '../lib/supabase'

const ALERT_VORLAUF_TAGE = 30 // Warnung X Tage vorher

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysDiff(dateStr) {
  const target = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24))
}

export async function checkMaAlerts() {
  const alerts = []
  const today = new Date().toISOString().slice(0, 10)
  const vorlaufDate = addDays(today, ALERT_VORLAUF_TAGE)

  // 1. Fuehrerschein-Pruefungen faellig
  const { data: fuehrerscheine } = await supabase
    .from('mitarbeiter_fuehrerscheine')
    .select('*, mitarbeiter(vorname, nachname)')
    .not('naechste_pruefung', 'is', null)
    .lte('naechste_pruefung', vorlaufDate)

  for (const fs of (fuehrerscheine || [])) {
    const tage = daysDiff(fs.naechste_pruefung)
    const name = `${fs.mitarbeiter?.vorname} ${fs.mitarbeiter?.nachname}`
    const severity = tage <= 0 ? 'critical' : tage <= 14 ? 'warning' : 'info'
    alerts.push({
      type: 'ma_fuehrerschein',
      severity,
      source: 'ma-alerts',
      title: tage <= 0
        ? `Führerscheinprüfung überfällig: ${name}`
        : `Führerscheinprüfung in ${tage} Tagen: ${name}`,
      body: `Klasse ${fs.klasse} — Nächste Prüfung: ${new Date(fs.naechste_pruefung + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
      metadata: { alert_key: `fs_${fs.id}_${fs.naechste_pruefung}`, mitarbeiter_id: fs.mitarbeiter_id },
    })
  }

  // 2. Probezeit endet bald
  const { data: mitarbeiterDaten } = await supabase
    .from('mitarbeiter_daten')
    .select('*, personen!mitarbeiter_daten_person_id_fkey(vorname, nachname)')
    .not('probezeit_monate', 'is', null)
    .eq('status', 'aktiv')

  for (const md of (mitarbeiterDaten || [])) {
    if (!md.eintrittsdatum || !md.probezeit_monate) continue
    const probeEnde = new Date(md.eintrittsdatum + 'T00:00:00')
    probeEnde.setMonth(probeEnde.getMonth() + md.probezeit_monate)
    const probeEndeStr = probeEnde.toISOString().slice(0, 10)
    if (probeEndeStr > vorlaufDate) continue
    if (probeEndeStr < today) continue // already past

    const tage = daysDiff(probeEndeStr)
    const name = md.personen ? `${md.personen.vorname} ${md.personen.nachname}` : `MA ${md.personalnummer}`
    alerts.push({
      type: 'ma_probezeit',
      severity: tage <= 7 ? 'warning' : 'info',
      source: 'ma-alerts',
      title: `Probezeit endet in ${tage} Tagen: ${name}`,
      body: `Eintritt: ${new Date(md.eintrittsdatum + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} — Probezeit ${md.probezeit_monate} Monate`,
      metadata: { alert_key: `probe_${md.id}_${probeEndeStr}`, mitarbeiter_id: md.mitarbeiter_alt_id },
    })
  }

  // 3. Befristung laeuft aus
  const { data: vertraege } = await supabase
    .from('arbeitsvertraege')
    .select('*, mitarbeiter(vorname, nachname)')
    .eq('ist_aktuell', true)
    .not('gueltig_bis', 'is', null)
    .lte('gueltig_bis', vorlaufDate)

  for (const v of (vertraege || [])) {
    const tage = daysDiff(v.gueltig_bis)
    if (tage < -30) continue // long past
    const name = `${v.mitarbeiter?.vorname} ${v.mitarbeiter?.nachname}`
    const severity = tage <= 0 ? 'critical' : tage <= 14 ? 'warning' : 'info'
    alerts.push({
      type: 'ma_befristung',
      severity,
      source: 'ma-alerts',
      title: tage <= 0
        ? `Befristung abgelaufen: ${name}`
        : `Befristung endet in ${tage} Tagen: ${name}`,
      body: `Vertrag bis: ${new Date(v.gueltig_bis + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
      metadata: { alert_key: `befr_${v.id}_${v.gueltig_bis}`, mitarbeiter_id: v.mitarbeiter_id },
    })
  }

  // Deduplicate: Don't create alerts that already exist (by alert_key)
  if (alerts.length === 0) return []

  const alertKeys = alerts.map(a => a.metadata.alert_key)
  const { data: existing } = await supabase
    .from('notifications')
    .select('metadata')
    .eq('source', 'ma-alerts')
    .eq('archived', false)

  const existingKeys = new Set((existing || []).map(n => n.metadata?.alert_key).filter(Boolean))
  const newAlerts = alerts.filter(a => !existingKeys.has(a.metadata.alert_key))

  if (newAlerts.length > 0) {
    await supabase.from('notifications').insert(newAlerts)
  }

  return newAlerts
}
