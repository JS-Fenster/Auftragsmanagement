/**
 * Budgetangebot - Hauptkomponente (Orchestrator)
 *
 * Wann lesen: Wenn du State-Management, API-Calls (budget-ki, budget-dokument),
 * Speichern/Laden-Logik oder die Step-Navigation aendern musst.
 *
 * Sub-Komponenten (in ./budgetangebot/):
 *   constants.js            - SYSTEME, MWST_SATZ, FIRMA_INFO, Helpers (formatEuro etc.)
 *   ui.jsx                  - StepIndicator, ConfidenceBadge, EditableCell
 *   KundenSuche.jsx         - searchKontakte(), KundenSuchModal
 *   StepEingabe.jsx         - Step 1: Freitext + Kundendaten + Optionen
 *   StepPositionen.jsx      - Step 2: Editierbare Positionstabelle
 *   StepZusammenfassung.jsx - Step 3: Preiszusammenfassung + Speichern + Generieren
 *   StepVorschau.jsx        - Step 4: HTML-Vorschau + PDF-Download
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase'
import { Loader2, History } from 'lucide-react'

import { MWST_SATZ, generateTempId } from './budgetangebot/constants'
import { StepIndicator } from './budgetangebot/ui'
import { searchKontakte } from './budgetangebot/KundenSuche'
import { StepEingabe } from './budgetangebot/StepEingabe'
import { StepPositionen } from './budgetangebot/StepPositionen'
import { StepZusammenfassung } from './budgetangebot/StepZusammenfassung'
import { StepVorschau } from './budgetangebot/StepVorschau'

// ══════════════════════════════════════════════════════════
// Main Page Component
// ══════════════════════════════════════════════════════════

export default function Budgetangebot() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // Step management
  const [step, setStep] = useState(1)
  const [maxVisitedStep, setMaxVisitedStep] = useState(1)

  // Freitext-Hash (U2) - verhindert unnoetige GPT-Calls
  const lastParsedTextRef = useRef(null)

  // Netto/Brutto Toggle
  const [showNetto, setShowNetto] = useState(false)

  // Step 1: Input
  const [inputText, setInputText] = useState('')
  const [kundenInfo, setKundenInfo] = useState({ name: '', telefon: '', email: '', strasse: '', plz: '', ort: '' })
  const [showKundenInfo, setShowKundenInfo] = useState(false)
  const [selectedSystem, setSelectedSystem] = useState('')
  const [montageOptions, setMontageOptions] = useState({ montage: true, demontage: true, entsorgung: true })

  // Kunden-Autocomplete
  const [kundenSuche, setKundenSuche] = useState('')
  const [kundenVorschlaege, setKundenVorschlaege] = useState([])
  const [kundenLoading, setKundenLoading] = useState(false)
  const [showKundenModal, setShowKundenModal] = useState(false)
  const [selectedKontaktId, setSelectedKontaktId] = useState(null)
  const kundenTimerRef = useRef(null)

  // Loading & errors
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Step 2-3: Result
  const [result, setResult] = useState(null)
  const [editedPositions, setEditedPositions] = useState([])
  const [caseId, setCaseId] = useState(null)

  // Step 4: Document
  const [documentHtml, setDocumentHtml] = useState(null)
  const [documentUrl, setDocumentUrl] = useState(null)
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState(null)

  // Speichern-State
  const [savedAngebotId, setSavedAngebotId] = useState(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [loadingAngebot, setLoadingAngebot] = useState(false)

  // ── Step Navigation ─────────────────────────────────────
  const goToStep = useCallback((targetStep) => {
    if (targetStep <= maxVisitedStep) {
      setStep(targetStep)
    }
  }, [maxVisitedStep])

  // ── Kunden-Autocomplete Callbacks ─────────────────────
  const handleKundenSearch = useCallback((term) => {
    clearTimeout(kundenTimerRef.current)
    if (!term || term.length < 2) {
      setKundenVorschlaege([])
      return
    }
    kundenTimerRef.current = setTimeout(async () => {
      setKundenLoading(true)
      try {
        const res = await searchKontakte(term)
        setKundenVorschlaege(res)
      } catch (err) {
        console.error('Kundensuche Fehler:', err)
      } finally {
        setKundenLoading(false)
      }
    }, 400)
  }, [])

  const handleKundeSelect = useCallback((kunde) => {
    const name = kunde.display_name || kunde.firma || ''
    setKundenInfo({
      name,
      telefon: kunde.telefon || '',
      email: kunde.email || '',
      strasse: kunde.strasse || '',
      plz: kunde.plz || '',
      ort: kunde.ort || '',
    })
    setSelectedKontaktId(kunde.kontakt_id)
    setKundenSuche(name)
    setKundenVorschlaege([])
  }, [])

  const handleKundeReset = useCallback(() => {
    setSelectedKontaktId(null)
    setKundenSuche('')
    setKundenVorschlaege([])
    setKundenInfo({ name: '', telefon: '', email: '', strasse: '', plz: '', ort: '' })
  }, [])

  // ── Speichern-Funktion ──────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaveLoading(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const positionenNetto = editedPositions.reduce((sum, p) => sum + (parseFloat(p.gesamtpreis) || 0), 0)
      const montageData = result?.data?.montage || result?.montage || {}
      const montageKosten = (parseFloat(montageData.montage) || 0)
        + (parseFloat(montageData.demontage) || 0)
        + (parseFloat(montageData.entsorgung) || 0)
      const netto = positionenNetto + montageKosten
      const mwst = netto * MWST_SATZ
      const brutto = netto + mwst

      const angebotData = {
        kontakt_id: selectedKontaktId || null,
        kontakt_name: kundenInfo.name || null,
        projekt_bezeichnung: inputText.substring(0, 200) || null,
        profilsystem: selectedSystem || null,
        montage: montageOptions.montage,
        demontage: montageOptions.demontage,
        entsorgung: montageOptions.entsorgung,
        netto_summe: netto,
        mwst_summe: mwst,
        brutto_summe: brutto,
        montage_kosten: montageKosten > 0 ? {
          montage: parseFloat(montageData.montage) || 0,
          demontage: parseFloat(montageData.demontage) || 0,
          entsorgung: parseFloat(montageData.entsorgung) || 0,
        } : null,
        aktualisiert_am: new Date().toISOString(),
      }

      let angebotId = savedAngebotId

      if (angebotId) {
        // Update existing
        const { error: updErr } = await supabase
          .from('budgetangebote')
          .update(angebotData)
          .eq('id', angebotId)
        if (updErr) throw updErr
      } else {
        // Insert new
        const { data: inserted, error: insErr } = await supabase
          .from('budgetangebote')
          .insert(angebotData)
          .select('id')
          .single()
        if (insErr) throw insErr
        angebotId = inserted.id
        setSavedAngebotId(angebotId)
      }

      // Positionen: loeschen + neu einfuegen
      await supabase
        .from('budgetangebot_positionen')
        .delete()
        .eq('budgetangebot_id', angebotId)

      if (editedPositions.length > 0) {
        const posRows = editedPositions.map((p, idx) => ({
          budgetangebot_id: angebotId,
          pos_nr: idx + 1,
          raum: p.raum || null,
          typ: p.typ || null,
          bezeichnung: p.bezeichnung || null,
          breite_mm: p.breite || null,
          hoehe_mm: p.hoehe || null,
          menge: p.menge || 1,
          einzelpreis: p.einzelpreis || 0,
          gesamtpreis: p.gesamtpreis || 0,
          details: {
            zubehoer: p.zubehoer || [],
            system: p.system || null,
            verglasung: p.verglasung || null,
          },
        }))

        const { error: posErr } = await supabase
          .from('budgetangebot_positionen')
          .insert(posRows)
        if (posErr) throw posErr
      }

      setSaveSuccess(true)
      // Update URL with saved ID
      setSearchParams({ id: angebotId }, { replace: true })
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Speichern Fehler:', err)
      setSaveError(err.message)
    } finally {
      setSaveLoading(false)
    }
  }, [editedPositions, result, kundenInfo, selectedKontaktId, selectedSystem, montageOptions, inputText, savedAngebotId, setSearchParams])

  // ── Lade-Funktion ─────────────────────────────────────
  const loadBudgetangebot = useCallback(async (id) => {
    setLoadingAngebot(true)
    setError(null)

    try {
      // Lade Angebot
      const { data: angebot, error: angErr } = await supabase
        .from('budgetangebote')
        .select('*')
        .eq('id', id)
        .single()

      if (angErr) throw angErr
      if (!angebot) throw new Error('Angebot nicht gefunden')

      // Lade Positionen
      const { data: positionen, error: posErr } = await supabase
        .from('budgetangebot_positionen')
        .select('*')
        .eq('budgetangebot_id', id)
        .order('pos_nr', { ascending: true })

      if (posErr) throw posErr

      // State befuellen
      setSavedAngebotId(id)
      setKundenInfo({
        name: angebot.kontakt_name || '',
        telefon: '',
        email: '',
        strasse: '',
        plz: '',
        ort: '',
      })
      if (angebot.kontakt_id) {
        setSelectedKontaktId(angebot.kontakt_id)
        setKundenSuche(angebot.kontakt_name || '')
        setShowKundenInfo(true)

        // Lade Kontakt-Details fuer vollstaendige Kundendaten
        const { data: kontakt } = await supabase
          .from('kontakte')
          .select('*, kontakt_personen!kontakt_id(vorname, nachname, ist_hauptkontakt, kontakt_details(typ, wert, ist_primaer))')
          .eq('id', angebot.kontakt_id)
          .single()

        if (kontakt) {
          const personen = kontakt.kontakt_personen || []
          const haupt = personen.find(p => p.ist_hauptkontakt) || personen[0]
          const allDetails = personen.flatMap(p => p.kontakt_details || [])
          setKundenInfo({
            name: angebot.kontakt_name || kontakt.firma1 || '',
            telefon: allDetails.find(d => d.typ === 'telefon')?.wert || '',
            email: allDetails.find(d => d.typ === 'email')?.wert || '',
            strasse: kontakt.strasse || '',
            plz: kontakt.plz || '',
            ort: kontakt.ort || '',
          })
        }
      } else if (angebot.kontakt_name) {
        setShowKundenInfo(true)
      }

      setSelectedSystem(angebot.profilsystem || '')
      setMontageOptions({
        montage: angebot.montage ?? true,
        demontage: angebot.demontage ?? true,
        entsorgung: angebot.entsorgung ?? true,
      })
      setInputText(angebot.projekt_bezeichnung || '')

      // Positionen mappen
      const mappedPositions = (positionen || []).map((p, i) => ({
        _id: generateTempId(),
        pos: p.pos_nr || i + 1,
        raum: p.raum || '',
        typ: p.typ || 'Fenster',
        bezeichnung: p.bezeichnung || '',
        breite: p.breite_mm || 0,
        hoehe: p.hoehe_mm || 0,
        menge: p.menge || 1,
        einzelpreis: parseFloat(p.einzelpreis) || 0,
        gesamtpreis: parseFloat(p.gesamtpreis) || 0,
        zubehoer: p.details?.zubehoer || [],
      }))
      setEditedPositions(mappedPositions)

      // Montage-Kosten als pseudo result fuer StepZusammenfassung
      if (angebot.montage_kosten) {
        setResult({
          data: {
            montage: angebot.montage_kosten,
            zusammenfassung: { confidence: 'medium' },
          }
        })
      }

      // Springe zu Step 2 (Positionen) wenn Positionen vorhanden
      if (mappedPositions.length > 0) {
        setStep(2)
        setMaxVisitedStep(3)
        lastParsedTextRef.current = angebot.projekt_bezeichnung || ''
      }
    } catch (err) {
      console.error('Laden Fehler:', err)
      setError(`Angebot konnte nicht geladen werden: ${err.message}`)
    } finally {
      setLoadingAngebot(false)
    }
  }, [])

  // ── URL-Parameter: Angebot laden wenn ?id= vorhanden ──
  useEffect(() => {
    const id = searchParams.get('id')
    if (id && id !== savedAngebotId) {
      loadBudgetangebot(id)
    }
  }, []) // nur einmal beim Mount

  // ── Submit to AI ───────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!inputText.trim()) return

    // U2: Freitext-Hash - ueberspringe GPT-Call wenn Text unveraendert
    if (lastParsedTextRef.current === inputText.trim() && editedPositions.length > 0) {
      console.log('[U2] Freitext unveraendert - ueberspringe GPT-Call, behalte bestehende Positionen')
      setStep(2)
      setMaxVisitedStep(prev => Math.max(prev, 2))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/budget-ki`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: inputText,
          kunde: {
            name: kundenInfo.name || undefined,
            telefon: kundenInfo.telefon || undefined,
            email: kundenInfo.email || undefined,
          },
          kontakt_id: selectedKontaktId || undefined,
          optionen: {
            montage: montageOptions.montage,
            demontage: montageOptions.demontage,
            entsorgung: montageOptions.entsorgung,
            system: selectedSystem || undefined,
          },
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || errData.message || `Fehler ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setResult(data)
      setCaseId(data.budget_case_id || data.case_id || null)

      // Map positions with temp IDs for stable rendering
      // Edge Function returns data nested: { success, data: { positionen: [...] } }
      const rawPositions = data.data?.positionen || data.positionen || []
      const positions = rawPositions.map((p, i) => ({
        ...p,
        _id: generateTempId(),
        pos: p.pos || i + 1,
        breite: p.breite ?? p.breite_mm ?? 0,
        hoehe: p.hoehe ?? p.hoehe_mm ?? 0,
        einzelpreis: p.einzelpreis ?? p.einzel_preis ?? 0,
        gesamtpreis: p.gesamtpreis ?? p.gesamt_preis ?? (parseFloat(p.einzelpreis ?? p.einzel_preis) || 0) * (parseInt(p.menge) || 1),
        zubehoer: p.zubehoer || p.accessories || [],
      }))
      setEditedPositions(positions)
      lastParsedTextRef.current = inputText.trim()
      setStep(2)
      setMaxVisitedStep(prev => Math.max(prev, 2))
    } catch (err) {
      console.error('Budget KI Fehler:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [inputText, kundenInfo, montageOptions, selectedSystem, selectedKontaktId, editedPositions.length])

  // ── Generate Document ──────────────────────────────────
  const handleGenerateDocument = useCallback(async () => {
    setDocLoading(true)
    setDocError(null)

    try {
      const positionenNetto = editedPositions.reduce((sum, p) => sum + (parseFloat(p.gesamtpreis) || 0), 0)

      // Montage/Demontage/Entsorgung aus KI-Ergebnis einbeziehen (B-007 Fix)
      const montageData = result?.data?.montage || result?.montage || {}
      const montageKosten = (parseFloat(montageData.montage) || 0)
        + (parseFloat(montageData.demontage) || 0)
        + (parseFloat(montageData.entsorgung) || 0)

      const netto = positionenNetto + montageKosten
      const mwst = netto * 0.19
      const brutto = netto + mwst

      const summaryData = {
        netto,
        mwst,
        brutto,
        brutto_gerundet: Math.ceil(brutto / 10) * 10,
        confidence: result?.data?.zusammenfassung?.confidence || result?.zusammenfassung?.confidence || 'medium',
        preis_spanne: result?.data?.zusammenfassung?.preis_spanne || result?.zusammenfassung?.preis_spanne || {},
        annahmen: result?.data?.zusammenfassung?.annahmen || result?.zusammenfassung?.annahmen || result?.data?.annahmen || result?.annahmen || [],
      }

      const kundeData = {
        name: kundenInfo.name || undefined,
        telefon: kundenInfo.telefon || undefined,
        email: kundenInfo.email || undefined,
        strasse: kundenInfo.strasse || undefined,
        plz: kundenInfo.plz || undefined,
        ort: kundenInfo.ort || undefined,
      }

      // Clean positions for API (remove _id)
      const cleanPositions = editedPositions.map(({ _id, ...rest }) => rest)

      // Montage-Daten fuer Dokument-Generator aufbereiten (B-007 Fix)
      const montageForDoc = montageKosten > 0 ? {
        montage: parseFloat(montageData.montage) || 0,
        demontage: parseFloat(montageData.demontage) || 0,
        entsorgung: parseFloat(montageData.entsorgung) || 0,
      } : undefined

      const docResponse = await fetch(`${supabaseUrl}/functions/v1/budget-dokument`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          budget_case_id: caseId,
          positionen: cleanPositions,
          kunde: kundeData,
          kontakt_id: selectedKontaktId || undefined,
          zusammenfassung: summaryData,
          montage: montageForDoc,
        }),
      })

      if (!docResponse.ok) {
        const errData = await docResponse.json().catch(() => ({}))
        throw new Error(errData.error || errData.message || `Fehler ${docResponse.status}: ${docResponse.statusText}`)
      }

      const docData = await docResponse.json()
      setDocumentHtml(docData.html || null)
      setDocumentUrl(docData.pdf_url || docData.url || null)
      setStep(4)
      setMaxVisitedStep(prev => Math.max(prev, 4))
    } catch (err) {
      console.error('Dokument-Generierung Fehler:', err)
      setDocError(err.message)
    } finally {
      setDocLoading(false)
    }
  }, [editedPositions, result, kundenInfo, selectedKontaktId, caseId])

  // ── Reset ──────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setStep(1)
    setMaxVisitedStep(1)
    lastParsedTextRef.current = null
    setShowNetto(false)
    setInputText('')
    setKundenInfo({ name: '', telefon: '', email: '', strasse: '', plz: '', ort: '' })
    setShowKundenInfo(false)
    setSelectedSystem('')
    setMontageOptions({ montage: true, demontage: true, entsorgung: true })
    setLoading(false)
    setError(null)
    setResult(null)
    setEditedPositions([])
    setCaseId(null)
    setDocumentHtml(null)
    setDocumentUrl(null)
    setDocLoading(false)
    setDocError(null)
    // Kunden-Autocomplete reset
    setKundenSuche('')
    setKundenVorschlaege([])
    setSelectedKontaktId(null)
    setShowKundenModal(false)
    // Speichern reset
    setSavedAngebotId(null)
    setSaveLoading(false)
    setSaveSuccess(false)
    setSaveError(null)
    setLoadingAngebot(false)
    // URL bereinigen
    setSearchParams({}, { replace: true })
  }, [setSearchParams])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Loading Overlay fuer Angebot laden */}
      {loadingAngebot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
            <p className="text-sm text-gray-600">Angebot wird geladen...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {savedAngebotId ? 'Budgetangebot bearbeiten' : 'Budgetangebot erstellen'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {savedAngebotId
              ? 'Gespeichertes Angebot wird bearbeitet.'
              : 'Beschreiben Sie die gewuenschten Fenster und Tueren im Freitext. Die KI erstellt daraus ein vollstaendiges Budgetangebot mit Preisen.'
            }
          </p>
        </div>
        <button
          onClick={() => navigate('/budgetangebot-verlauf')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <History className="w-4 h-4" />
          Alle Angebote
        </button>
      </div>

      {/* Step Indicator (U1: klickbar) */}
      <StepIndicator currentStep={step} maxVisitedStep={maxVisitedStep} onStepClick={goToStep} />

      {/* Step Content */}
      {step === 1 && (
        <StepEingabe
          inputText={inputText}
          setInputText={setInputText}
          kundenInfo={kundenInfo}
          setKundenInfo={setKundenInfo}
          showKundenInfo={showKundenInfo}
          setShowKundenInfo={setShowKundenInfo}
          selectedSystem={selectedSystem}
          setSelectedSystem={setSelectedSystem}
          montageOptions={montageOptions}
          setMontageOptions={setMontageOptions}
          loading={loading}
          error={error}
          onSubmit={handleSubmit}
          kundenSuche={kundenSuche}
          setKundenSuche={setKundenSuche}
          kundenVorschlaege={kundenVorschlaege}
          kundenLoading={kundenLoading}
          selectedKontaktId={selectedKontaktId}
          onKundenSearch={handleKundenSearch}
          onKundeSelect={handleKundeSelect}
          onKundeReset={handleKundeReset}
          showKundenModal={showKundenModal}
          setShowKundenModal={setShowKundenModal}
        />
      )}

      {step === 2 && (
        <StepPositionen
          editedPositions={editedPositions}
          setEditedPositions={setEditedPositions}
          onBack={() => setStep(1)}
          onNext={() => { setStep(3); setMaxVisitedStep(prev => Math.max(prev, 3)) }}
        />
      )}

      {step === 3 && (
        <StepZusammenfassung
          editedPositions={editedPositions}
          result={result}
          loading={docLoading}
          error={docError}
          onBack={() => setStep(2)}
          onGenerateDocument={handleGenerateDocument}
          onReset={handleReset}
          showNetto={showNetto}
          setShowNetto={setShowNetto}
          onSave={handleSave}
          saveLoading={saveLoading}
          saveSuccess={saveSuccess}
          saveError={saveError}
          savedAngebotId={savedAngebotId}
        />
      )}

      {step === 4 && (
        <StepVorschau
          documentHtml={documentHtml}
          documentUrl={documentUrl}
          onReset={handleReset}
          onSave={handleSave}
          saveLoading={saveLoading}
          saveSuccess={saveSuccess}
          saveError={saveError}
          savedAngebotId={savedAngebotId}
        />
      )}
    </div>
  )
}
