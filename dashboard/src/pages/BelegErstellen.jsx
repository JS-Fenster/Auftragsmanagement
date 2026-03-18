/**
 * BelegErstellen — Seite zum Erstellen/Bearbeiten von Belegen
 *
 * Routes:
 *   /belege/neu?projekt_id=xxx&typ=angebot  — Neuer Beleg
 *   /belege/neu?from=<beleg_id>             — Konversion aus bestehendem Beleg
 *   /belege/:id                             — Bestehenden Beleg bearbeiten
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileText, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import BelegFormular from './belege/BelegFormular'
import { BELEG_TYPEN, BELEG_KONVERSIONEN, DEFAULT_TEXTE, generateBelegNummer } from './belege/constants'

export default function BelegErstellen() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [beleg, setBeleg] = useState(null)
  const [positionen, setPositionen] = useState([])
  const [loading, setLoading] = useState(true)

  const projektId = searchParams.get('projekt_id')
  const fromBelegId = searchParams.get('from')
  const typ = searchParams.get('typ') || 'angebot'

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Fall 1: Bestehenden Beleg bearbeiten
      if (id) {
        const [belegRes, posRes] = await Promise.all([
          supabase.from('belege').select('*').eq('id', id).single(),
          supabase.from('beleg_positionen').select('*').eq('beleg_id', id).order('pos_nr'),
        ])
        if (belegRes.error) { navigate('/belege'); return }
        setBeleg(belegRes.data)
        setPositionen((posRes.data || []).map(p => ({ ...p, _id: p.id })))
        return
      }

      // Fall 2: Konversion aus bestehendem Beleg
      if (fromBelegId) {
        const [parentRes, parentPosRes] = await Promise.all([
          supabase.from('belege').select('*').eq('id', fromBelegId).single(),
          supabase.from('beleg_positionen').select('*').eq('beleg_id', fromBelegId).order('pos_nr'),
        ])

        if (!parentRes.error && parentRes.data) {
          const parent = parentRes.data
          const parentTyp = BELEG_TYPEN[parent.beleg_typ]
          const erlaubte = BELEG_KONVERSIONEN[parent.beleg_typ] || []
          const newTyp = erlaubte[0] || 'rechnung'
          const nummer = await generateBelegNummer(newTyp)
          const defaults = DEFAULT_TEXTE[newTyp] || {}

          setBeleg({
            id: null,
            projekt_id: parent.projekt_id,
            beleg_typ: newTyp,
            beleg_nummer: nummer,
            status: 'entwurf',
            datum: new Date().toISOString().split('T')[0],
            empfaenger_kontakt_id: parent.empfaenger_kontakt_id,
            empfaenger_firma: parent.empfaenger_firma,
            empfaenger_name: parent.empfaenger_name,
            empfaenger_strasse: parent.empfaenger_strasse,
            empfaenger_plz: parent.empfaenger_plz,
            empfaenger_ort: parent.empfaenger_ort,
            betreff: parent.betreff,
            einleitungstext: defaults.einleitung || '',
            schlusstext: defaults.schluss || '',
            kunden_bestellnummer: parent.kunden_bestellnummer,
            rabatt_prozent: parent.rabatt_prozent,
            mwst_satz: parent.mwst_satz,
            parent_id: parent.id,
            _parent_nummer: parent.beleg_nummer,
            _parent_typ_label: parentTyp?.label || parent.beleg_typ,
          })

          setPositionen((parentPosRes.data || []).map(p => ({
            _id: 'pos_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            bezeichnung: p.bezeichnung,
            beschreibung: p.beschreibung,
            einheit: p.einheit,
            menge: p.menge,
            einzelpreis: p.einzelpreis,
            breite: p.breite,
            hoehe: p.hoehe,
            gruppe: p.gruppe,
          })))
          return
        }
      }

      // Fall 3: Neuer leerer Beleg
      const nummer = await generateBelegNummer(typ)
      const defaults = DEFAULT_TEXTE[typ] || {}
      setBeleg({
        id: null,
        projekt_id: projektId || null,
        beleg_typ: typ,
        beleg_nummer: nummer,
        status: 'entwurf',
        datum: new Date().toISOString().split('T')[0],
        einleitungstext: defaults.einleitung || '',
        schlusstext: defaults.schluss || '',
        mwst_satz: 19,
        rabatt_prozent: 0,
      })
      setPositionen([])
    } finally {
      setLoading(false)
    }
  }, [id, fromBelegId, projektId, typ, navigate])

  useEffect(() => { loadData() }, [loadData])

  const handleSaved = useCallback((savedBeleg) => {
    navigate(`/belege/${savedBeleg.id}`)
  }, [navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    )
  }

  const title = id ? `Beleg ${beleg?.beleg_nummer || ''} bearbeiten` : 'Neuer Beleg'
  const typLabel = BELEG_TYPEN[beleg?.beleg_typ]?.label || ''

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-brand" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">{title}</h1>
            {typLabel && <p className="text-sm text-text-muted">{typLabel}</p>}
          </div>
        </div>
      </div>

      {/* Formular */}
      <BelegFormular
        beleg={beleg}
        positionen={positionen}
        onSaved={handleSaved}
        onCancel={() => navigate(-1)}
      />
    </div>
  )
}
