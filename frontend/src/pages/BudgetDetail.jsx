import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Save, Calculator, Plus, Trash2, AlertCircle,
  CheckCircle, RefreshCw, FileText, Euro, Building2, Phone,
  Mail, Store, Globe, ChevronDown, ChevronUp, Settings2, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

// Budget-Status Konstanten
const BUDGET_STATUS = [
  { value: 'draft', label: 'Entwurf', bgColor: 'bg-gray-100', textColor: 'text-gray-800' },
  { value: 'calculated', label: 'Berechnet', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  { value: 'sent', label: 'Versendet', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
  { value: 'quoted', label: 'Angebot erstellt', bgColor: 'bg-purple-100', textColor: 'text-purple-800' },
  { value: 'ordered', label: 'Bestellt', bgColor: 'bg-orange-100', textColor: 'text-orange-800' },
  { value: 'won', label: 'Gewonnen', bgColor: 'bg-green-100', textColor: 'text-green-800' },
  { value: 'lost', label: 'Verloren', bgColor: 'bg-red-100', textColor: 'text-red-800' }
];

// Kanal-Config
const KANAL_CONFIG = {
  showroom: { icon: Store, label: 'Showroom', color: 'text-blue-600' },
  telefon: { icon: Phone, label: 'Telefon', color: 'text-green-600' },
  email: { icon: Mail, label: 'E-Mail', color: 'text-orange-600' },
  website: { icon: Globe, label: 'Website', color: 'text-purple-600' }
};

// Element-Typen
const ELEMENT_TYPES = [
  { value: 'fenster', label: 'Fenster' },
  { value: 'tuer', label: 'Tuer' },
  { value: 'hst', label: 'Hebeschiebetuer' },
  { value: 'psk', label: 'PSK-Tuer' },
  { value: 'haustuer', label: 'Haustuer' }
];

// System-Optionen
const SYSTEMS = ['CASTELLO', 'CALIDO', 'IMPREO', 'AFINO'];
const GLAZINGS = ['2-fach', '3-fach'];
const COLORS = ['weiss', 'anthrazit', 'golden oak', 'nussbaum', 'mooreiche', 'grau', 'silber'];

function getStatusInfo(statusValue) {
  return BUDGET_STATUS.find(s => s.value === statusValue) || BUDGET_STATUS[0];
}

function BudgetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // State
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState(null);

  // Form-Daten
  const [profile, setProfile] = useState({
    manufacturer: 'WERU',
    system: '',
    glazing: '',
    color_inside: 'weiss',
    color_outside: 'weiss'
  });

  const [items, setItems] = useState([]);
  const [result, setResult] = useState(null);

  // Text-Parser
  const [parserText, setParserText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parserResult, setParserResult] = useState(null);
  const [showParser, setShowParser] = useState(false);

  // Quick-Calculate Preview
  const [quickPreview, setQuickPreview] = useState(null);
  const [quickCalculating, setQuickCalculating] = useState(false);

  // Sections
  const [expandedSections, setExpandedSections] = useState({
    lead: true,
    profile: true,
    items: true,
    parser: false,
    result: true
  });

  // Case laden
  useEffect(() => {
    loadCase();
  }, [id]);

  const loadCase = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/budget/cases/${id}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Fehler beim Laden');
      }

      const data = result.data;
      setCaseData(data);

      // Profile setzen
      if (data.budget_profile && data.budget_profile.length > 0) {
        const p = data.budget_profile[0];
        setProfile({
          manufacturer: p.manufacturer || 'WERU',
          system: p.system || '',
          glazing: p.glazing || '',
          color_inside: p.color_inside || 'weiss',
          color_outside: p.color_outside || 'weiss'
        });
      }

      // Items setzen
      if (data.budget_items && data.budget_items.length > 0) {
        setItems(data.budget_items.map(item => ({
          id: item.id,
          element_type: item.element_type,
          width_mm: item.width_mm,
          height_mm: item.height_mm,
          qty: item.qty || 1,
          room: item.room || '',
          notes: item.notes || '',
          accessories: item.budget_accessories && item.budget_accessories.length > 0
            ? item.budget_accessories[0]
            : {
                shutter: false,
                shutter_type: 'rollladen',
                shutter_electric: false,
                afb: false,
                ifb: false,
                insect: false,
                plissee: false
              }
        })));
      }

      // Letztes Ergebnis setzen
      if (data.budget_results && data.budget_results.length > 0) {
        // Neuestes Ergebnis (letztes im Array)
        const latestResult = data.budget_results[data.budget_results.length - 1];
        setResult(latestResult);
      }

    } catch (err) {
      console.error('Fehler beim Laden des Cases:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Profil speichern
  const saveProfile = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/budget/cases/${id}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message);
      }
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      alert('Fehler: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Item hinzufuegen
  const addItem = () => {
    setItems([...items, {
      id: `temp-${Date.now()}`,
      element_type: 'fenster',
      width_mm: 1000,
      height_mm: 1200,
      qty: 1,
      room: '',
      notes: '',
      accessories: {
        shutter: false,
        shutter_type: 'rollladen',
        shutter_electric: false,
        afb: false,
        ifb: false,
        insect: false,
        plissee: false
      }
    }]);
  };

  // Item entfernen
  const removeItem = (index) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  // Item aktualisieren
  const updateItem = (index, field, value) => {
    const newItems = [...items];
    if (field.startsWith('accessories.')) {
      const accField = field.replace('accessories.', '');
      newItems[index].accessories = {
        ...newItems[index].accessories,
        [accField]: value
      };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setItems(newItems);

    // Quick-Calculate triggern (debounced)
    triggerQuickCalculate(newItems);
  };

  // Quick-Calculate (debounced)
  const triggerQuickCalculate = useCallback(
    debounce(async (currentItems) => {
      if (currentItems.length === 0) {
        setQuickPreview(null);
        return;
      }

      setQuickCalculating(true);
      try {
        // Nur erstes Item fuer schnelle Vorschau
        const item = currentItems[0];
        const response = await fetch('/api/budget/quick-calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            width_mm: item.width_mm,
            height_mm: item.height_mm,
            element_type: item.element_type,
            qty: item.qty,
            system: profile.system,
            color_inside: profile.color_inside,
            color_outside: profile.color_outside,
            accessories: item.accessories
          })
        });

        const result = await response.json();
        if (result.success) {
          setQuickPreview(result.data);
        }
      } catch (err) {
        console.error('Quick-Calculate Fehler:', err);
      } finally {
        setQuickCalculating(false);
      }
    }, 500),
    [profile]
  );

  // Items speichern und berechnen
  const saveAndCalculate = async () => {
    if (items.length === 0) {
      alert('Bitte mindestens ein Element hinzufuegen');
      return;
    }

    setCalculating(true);
    try {
      // Zuerst Profil speichern
      await saveProfile();

      // Items vorbereiten (nur neue Items oder alle)
      const itemsToSave = items.filter(item => String(item.id).startsWith('temp-'));

      if (itemsToSave.length > 0) {
        // Neue Items speichern
        const response = await fetch(`/api/budget/cases/${id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: itemsToSave.map(item => ({
              element_type: item.element_type,
              width_mm: parseInt(item.width_mm),
              height_mm: parseInt(item.height_mm),
              qty: parseInt(item.qty) || 1,
              room: item.room,
              notes: item.notes,
              accessories: item.accessories
            }))
          })
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message);
        }
      }

      // Kalkulation ausfuehren
      const calcResponse = await fetch(`/api/budget/cases/${id}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workConfig: {
            montage: true,
            demontage: true,
            entsorgung: 'element'
          }
        })
      });

      const calcResult = await calcResponse.json();
      if (!calcResult.success) {
        throw new Error(calcResult.message);
      }

      setResult(calcResult.data);

      // Case neu laden fuer aktuellen Status
      await loadCase();

    } catch (err) {
      console.error('Fehler bei Berechnung:', err);
      alert('Fehler: ' + err.message);
    } finally {
      setCalculating(false);
    }
  };

  // Text parsen
  const parseText = async () => {
    if (!parserText.trim()) {
      alert('Bitte Text eingeben');
      return;
    }

    setParsing(true);
    setParserResult(null);

    try {
      const response = await fetch('/api/budget/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_text: parserText,
          source_type: 'kundennotiz'
        })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message);
      }

      setParserResult(result.data);

      // Profil aus Parser-Ergebnis uebernehmen (falls vorhanden)
      if (result.data.profile) {
        setProfile(prev => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(result.data.profile).filter(([k, v]) => v !== null)
          )
        }));
      }

    } catch (err) {
      console.error('Parser Fehler:', err);
      alert('Parser Fehler: ' + err.message);
    } finally {
      setParsing(false);
    }
  };

  // Parser-Items uebernehmen
  const applyParserItems = () => {
    if (!parserResult?.items) return;

    const newItems = parserResult.items.map((item, index) => ({
      id: `temp-${Date.now()}-${index}`,
      element_type: item.element_type || 'fenster',
      width_mm: item.width_mm,
      height_mm: item.height_mm,
      qty: item.qty || 1,
      room: '',
      notes: item.raw_line || '',
      accessories: {
        shutter: false,
        shutter_type: 'rollladen',
        shutter_electric: false,
        afb: false,
        ifb: false,
        insect: false,
        plissee: false
      }
    }));

    setItems([...items, ...newItems]);
    setParserResult(null);
    setParserText('');
    setShowParser(false);
  };

  // Section toggle
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !caseData) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-red-800">Fehler beim Laden</h2>
        <p className="text-red-600 mt-2">{error}</p>
        <button
          onClick={() => navigate('/budget')}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Zurueck zur Liste
        </button>
      </div>
    );
  }

  const statusInfo = getStatusInfo(caseData?.status);
  const kanalConfig = KANAL_CONFIG[caseData?.kanal] || KANAL_CONFIG.showroom;
  const KanalIcon = kanalConfig.icon;
  const kundenName = caseData?.erp_kunden?.firma1 || caseData?.erp_kunden?.name || caseData?.lead_name;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/budget"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Budget-Case</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={`px-2 py-1 rounded text-sm font-medium ${statusInfo.bgColor} ${statusInfo.textColor}`}>
                {statusInfo.label}
              </span>
              <span className={`flex items-center gap-1 text-sm ${kanalConfig.color}`}>
                <KanalIcon className="h-4 w-4" />
                {kanalConfig.label}
              </span>
              <span className="text-sm text-gray-500">
                Erstellt: {caseData && format(new Date(caseData.created_at), 'dd.MM.yyyy HH:mm')}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={saveAndCalculate}
          disabled={calculating || items.length === 0}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
        >
          {calculating ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <Calculator className="h-5 w-5 mr-2" />
          )}
          {calculating ? 'Berechne...' : 'Berechnen'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Linke Spalte: Lead + Profil + Items */}
        <div className="lg:col-span-2 space-y-6">

          {/* Lead Info Section */}
          <div className="bg-white rounded-lg shadow">
            <button
              onClick={() => toggleSection('lead')}
              className="w-full px-6 py-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-gray-400" />
                <span className="font-semibold text-gray-900">Kunde / Lead</span>
              </div>
              {expandedSections.lead ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
            </button>

            {expandedSections.lead && (
              <div className="px-6 pb-6 border-t border-gray-100 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name / Firma</label>
                    <p className="text-gray-900">{kundenName || '-'}</p>
                  </div>
                  {caseData?.erp_kunden?.ort && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ort</label>
                      <p className="text-gray-900">{caseData.erp_kunden.ort}</p>
                    </div>
                  )}
                  {caseData?.lead_telefon && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                      <p className="text-gray-900 flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        {caseData.lead_telefon}
                      </p>
                    </div>
                  )}
                  {caseData?.lead_email && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                      <p className="text-gray-900 flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        {caseData.lead_email}
                      </p>
                    </div>
                  )}
                  {caseData?.notes && (
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                      <p className="text-gray-900 whitespace-pre-wrap">{caseData.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profil Section */}
          <div className="bg-white rounded-lg shadow">
            <button
              onClick={() => toggleSection('profile')}
              className="w-full px-6 py-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <Settings2 className="h-5 w-5 text-gray-400" />
                <span className="font-semibold text-gray-900">Profil-Einstellungen</span>
              </div>
              {expandedSections.profile ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
            </button>

            {expandedSections.profile && (
              <div className="px-6 pb-6 border-t border-gray-100 pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* Hersteller */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hersteller</label>
                    <input
                      type="text"
                      value={profile.manufacturer}
                      onChange={(e) => setProfile({...profile, manufacturer: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* System */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">System</label>
                    <select
                      value={profile.system}
                      onChange={(e) => setProfile({...profile, system: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Automatisch</option>
                      {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Verglasung */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Verglasung</label>
                    <select
                      value={profile.glazing}
                      onChange={(e) => setProfile({...profile, glazing: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">-</option>
                      {GLAZINGS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>

                  {/* Farbe Innen */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Farbe Innen</label>
                    <select
                      value={profile.color_inside}
                      onChange={(e) => setProfile({...profile, color_inside: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Farbe Aussen */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Farbe Aussen</label>
                    <select
                      value={profile.color_outside}
                      onChange={(e) => setProfile({...profile, color_outside: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Items Section */}
          <div className="bg-white rounded-lg shadow">
            <button
              onClick={() => toggleSection('items')}
              className="w-full px-6 py-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-400" />
                <span className="font-semibold text-gray-900">Elemente ({items.length})</span>
              </div>
              {expandedSections.items ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
            </button>

            {expandedSections.items && (
              <div className="px-6 pb-6 border-t border-gray-100 pt-4 space-y-4">
                {/* Items-Liste */}
                {items.map((item, index) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-gray-700">Element {index + 1}</span>
                      <button
                        onClick={() => removeItem(index)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      {/* Typ */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Typ</label>
                        <select
                          value={item.element_type}
                          onChange={(e) => updateItem(index, 'element_type', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        >
                          {ELEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>

                      {/* Breite */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Breite (mm)</label>
                        <input
                          type="number"
                          value={item.width_mm}
                          onChange={(e) => updateItem(index, 'width_mm', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          min="300"
                          max="5000"
                        />
                      </div>

                      {/* Hoehe */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Hoehe (mm)</label>
                        <input
                          type="number"
                          value={item.height_mm}
                          onChange={(e) => updateItem(index, 'height_mm', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          min="300"
                          max="5000"
                        />
                      </div>

                      {/* Anzahl */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Anzahl</label>
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => updateItem(index, 'qty', parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          min="1"
                          max="100"
                        />
                      </div>
                    </div>

                    {/* Zubehoer */}
                    <div className="border-t border-gray-100 pt-3">
                      <label className="block text-xs font-medium text-gray-500 mb-2">Zubehoer</label>
                      <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={item.accessories?.shutter || false}
                            onChange={(e) => updateItem(index, 'accessories.shutter', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          Rollladen
                        </label>
                        {item.accessories?.shutter && (
                          <label className="flex items-center gap-2 text-sm ml-4">
                            <input
                              type="checkbox"
                              checked={item.accessories?.shutter_electric || false}
                              onChange={(e) => updateItem(index, 'accessories.shutter_electric', e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            elektrisch
                          </label>
                        )}
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={item.accessories?.afb || false}
                            onChange={(e) => updateItem(index, 'accessories.afb', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          AFB
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={item.accessories?.ifb || false}
                            onChange={(e) => updateItem(index, 'accessories.ifb', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          IFB
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={item.accessories?.insect || false}
                            onChange={(e) => updateItem(index, 'accessories.insect', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          Insektenschutz
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={item.accessories?.plissee || false}
                            onChange={(e) => updateItem(index, 'accessories.plissee', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          Plissee
                        </label>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={addItem}
                    className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Element hinzufuegen
                  </button>
                  <button
                    onClick={() => { setShowParser(true); toggleSection('parser'); }}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    Text parsen
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Parser Section */}
          {showParser && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <span className="font-semibold text-gray-900">Text-Parser</span>
                  </div>
                  <button
                    onClick={() => setShowParser(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    &times;
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Fuege OCR-Text oder Notizen ein. Masse werden automatisch erkannt.
                </p>
              </div>

              <div className="px-6 pb-6 pt-4 space-y-4">
                <textarea
                  value={parserText}
                  onChange={(e) => setParserText(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder="WERU CALIDO&#10;Fenster 1230x1480 DK&#10;Fenster 1000x1200 DK&#10;Tuere 900x2100&#10;..."
                />

                <button
                  onClick={parseText}
                  disabled={parsing || !parserText.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 transition-colors"
                >
                  {parsing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  {parsing ? 'Parsen...' : 'Text parsen'}
                </button>

                {/* Parser-Ergebnis */}
                {parserResult && (
                  <div className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-green-800">
                        {parserResult.items.length} Element(e) erkannt
                      </span>
                      <span className={`text-sm px-2 py-0.5 rounded ${
                        parserResult.parsing.confidence === 'high' ? 'bg-green-200 text-green-800' :
                        parserResult.parsing.confidence === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                        'bg-red-200 text-red-800'
                      }`}>
                        Confidence: {parserResult.parsing.confidence}
                      </span>
                    </div>

                    {/* Erkannte Items */}
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {parserResult.items.map((item, index) => (
                        <div key={index} className="text-sm bg-white rounded px-3 py-2 flex justify-between items-center">
                          <span className="font-medium">{item.element_type}: {item.width_mm}x{item.height_mm} mm</span>
                          <span className="text-gray-500">x{item.qty}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={applyParserItems}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Alle uebernehmen
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rechte Spalte: Ergebnis */}
        <div className="space-y-6">
          {/* Quick Preview */}
          {quickCalculating && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              <span className="text-blue-700">Berechne Vorschau...</span>
            </div>
          )}

          {quickPreview && !quickCalculating && !result && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">Schnell-Vorschau</h3>
              <p className="text-sm text-blue-600 mb-2">(Erstes Element)</p>
              <div className="text-2xl font-bold text-blue-900">
                ca. {quickPreview.gross_rounded_50?.toLocaleString('de-DE')} EUR
              </div>
            </div>
          )}

          {/* Ergebnis */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Euro className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-gray-900">Ergebnis</span>
              </div>
            </div>

            <div className="p-6">
              {result ? (
                <div className="space-y-4">
                  {/* Hauptpreis */}
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-sm text-green-600 mb-1">Budgetpreis (brutto)</div>
                    <div className="text-4xl font-bold text-green-800">
                      {result.gross_rounded_50?.toLocaleString('de-DE')} EUR
                    </div>
                    <div className="text-sm text-green-600 mt-2">
                      Range: {result.range_low?.toLocaleString('de-DE')} - {result.range_high?.toLocaleString('de-DE')} EUR
                    </div>
                  </div>

                  {/* Aufschluesselung */}
                  <div className="border-t border-gray-100 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Netto</span>
                      <span className="font-medium">{result.net_total?.toLocaleString('de-DE', { minimumFractionDigits: 2 })} EUR</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">MwSt. ({result.vat_rate || 19}%)</span>
                      <span className="font-medium">{((result.gross_total || 0) - (result.net_total || 0)).toLocaleString('de-DE', { minimumFractionDigits: 2 })} EUR</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
                      <span className="text-gray-600">Brutto (exakt)</span>
                      <span className="font-medium">{result.gross_total?.toLocaleString('de-DE', { minimumFractionDigits: 2 })} EUR</span>
                    </div>
                  </div>

                  {/* Breakdown */}
                  {result.breakdown && (
                    <div className="border-t border-gray-100 pt-4 space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Aufschluesselung</h4>
                      {result.breakdown.fenster > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Fenster/Tueren</span>
                          <span>{result.breakdown.fenster?.toLocaleString('de-DE')} EUR</span>
                        </div>
                      )}
                      {result.breakdown.zubehoer > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Zubehoer</span>
                          <span>{result.breakdown.zubehoer?.toLocaleString('de-DE')} EUR</span>
                        </div>
                      )}
                      {result.breakdown.montage > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Montage/Demontage</span>
                          <span>{result.breakdown.montage?.toLocaleString('de-DE')} EUR</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Confidence */}
                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Confidence</span>
                      <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                        result.confidence === 'high' ? 'bg-green-100 text-green-800' :
                        result.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {result.confidence || 'medium'}
                      </span>
                    </div>
                  </div>

                  {/* Modell-Info */}
                  <div className="text-xs text-gray-400 text-center pt-2">
                    Modell: {result.model_version || 'v1.0.0'}
                    {result.calculated_at && ` | ${format(new Date(result.calculated_at), 'dd.MM.yyyy HH:mm')}`}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Calculator className="h-12 w-12 mx-auto mb-3" />
                  <p>Noch kein Ergebnis</p>
                  <p className="text-sm mt-1">Fuege Elemente hinzu und klicke "Berechnen"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Debounce Helper
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export default BudgetDetail;
