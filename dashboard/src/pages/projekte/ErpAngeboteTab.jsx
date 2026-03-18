/**
 * ErpAngeboteTab — Historische W4A-Angebote fuer einen Kunden
 *
 * Zeigt erp_angebote mit expandierbaren Positionen (erp_angebots_positionen)
 */
import { useState, useEffect, useCallback } from 'react'
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const formatEuro = v => v != null ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '-'
const formatDate = d => d ? new Date(d).toLocaleDateString('de-DE') : '-'

export default function ErpAngeboteTab({ firma }) {
  const [angebote, setAngebote] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedCode, setExpandedCode] = useState(null)
  const [positionen, setPositionen] = useState([])
  const [posLoading, setPosLoading] = useState(false)

  const load = useCallback(async () => {
    if (!firma) { setLoading(false); return }
    setLoading(true)

    // Find kunden_code by firma name
    const { data: kunden } = await supabase
      .from('erp_kunden')
      .select('code')
      .ilike('firma1', `%${firma}%`)
      .limit(5)

    if (!kunden || kunden.length === 0) {
      setAngebote([])
      setLoading(false)
      return
    }

    const codes = kunden.map(k => k.code)
    const { data } = await supabase
      .from('erp_angebote')
      .select('*')
      .in('kunden_code', codes)
      .order('datum', { ascending: false })
      .limit(30)

    setAngebote(data || [])
    setLoading(false)
  }, [firma])

  useEffect(() => { load() }, [load])

  const toggleExpand = async (code) => {
    if (expandedCode === code) {
      setExpandedCode(null)
      return
    }
    setExpandedCode(code)
    setPosLoading(true)
    const { data } = await supabase
      .from('erp_angebots_positionen')
      .select('*')
      .eq('angebots_code', code)
      .order('pos_nr')
      .limit(50)
    setPositionen(data || [])
    setPosLoading(false)
  }

  if (!firma) {
    return <p className="text-sm text-text-muted">Kein Kunde verknuepft — W4A-Angebote nicht verfuegbar.</p>
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-text-muted py-2"><Loader2 size={16} className="animate-spin" /> W4A-Angebote laden...</div>
  }

  if (angebote.length === 0) {
    return <p className="text-sm text-text-muted">Keine W4A-Angebote fuer "{firma}" gefunden.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-light text-left text-xs font-medium text-text-secondary uppercase tracking-wide">
            <th className="pb-2 pr-4">Angebots-Nr.</th>
            <th className="pb-2 pr-4">Datum</th>
            <th className="pb-2 pr-4">Betreff</th>
            <th className="pb-2 pr-4 text-right">Wert</th>
            <th className="pb-2 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {angebote.map(a => (
            <tr key={a.code} className="group">
              <td colSpan={5} className="p-0">
                <div
                  onClick={() => toggleExpand(a.code)}
                  className="flex items-center cursor-pointer hover:bg-surface-main transition-colors"
                >
                  <div className="px-0 py-2 pr-4 text-sm font-mono text-brand w-28 shrink-0">{a.nummer || a.code}</div>
                  <div className="py-2 pr-4 text-sm text-text-secondary w-28 shrink-0">{formatDate(a.datum)}</div>
                  <div className="py-2 pr-4 text-sm text-text-primary truncate flex-1">{a.betreff || a.notiz || '-'}</div>
                  <div className="py-2 pr-4 text-sm font-medium text-right w-28 shrink-0">{formatEuro(a.wert || a.bruttowert)}</div>
                  <div className="py-2 w-10 shrink-0">
                    {expandedCode === a.code ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
                  </div>
                </div>
                {/* Expanded positions */}
                {expandedCode === a.code && (
                  <div className="px-4 pb-3 bg-surface-main/50 border-t border-border-default">
                    {posLoading ? (
                      <div className="flex items-center gap-2 text-xs text-text-muted py-2"><Loader2 size={12} className="animate-spin" /> Positionen laden...</div>
                    ) : positionen.length === 0 ? (
                      <p className="text-xs text-text-muted py-2">Keine Positionen vorhanden</p>
                    ) : (
                      <table className="w-full text-xs mt-2">
                        <thead>
                          <tr className="text-left text-text-muted uppercase">
                            <th className="pb-1 pr-2 w-10">Pos</th>
                            <th className="pb-1 pr-2">Bezeichnung</th>
                            <th className="pb-1 pr-2 w-16">Einheit</th>
                            <th className="pb-1 pr-2 w-16 text-right">Menge</th>
                            <th className="pb-1 pr-2 w-20 text-right">EP</th>
                            <th className="pb-1 w-20 text-right">GP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {positionen.map((p, idx) => (
                            <tr key={p.id || idx} className="border-t border-gray-100">
                              <td className="py-1 pr-2 text-text-muted">{p.pos_nr || idx + 1}</td>
                              <td className="py-1 pr-2 text-text-primary">{p.bezeichnung || p.langtext || '-'}</td>
                              <td className="py-1 pr-2 text-text-muted">{p.einheit || '-'}</td>
                              <td className="py-1 pr-2 text-right">{p.menge ?? '-'}</td>
                              <td className="py-1 pr-2 text-right">{formatEuro(p.einzelpreis)}</td>
                              <td className="py-1 text-right font-medium">{formatEuro(p.gesamtpreis)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
