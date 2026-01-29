import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, AlertTriangle, Clock, User, Phone, Calendar, Wrench, Plus, X, MapPin, FileText, CheckCircle, ChevronDown, Users, Tag, Edit3 } from 'lucide-react';
import { format } from 'date-fns';

// Reparatur-Status Konstanten (gemaess SPEC 3.2)
const REPARATUR_STATUS = [
  { value: 'OFFEN', label: 'Offen', bgColor: 'bg-gray-100', textColor: 'text-gray-800' },
  { value: 'IN_BEARBEITUNG', label: 'In Bearbeitung', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  { value: 'TERMIN_RESERVIERT', label: 'Termin reserviert', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
  { value: 'TERMIN_FIX', label: 'Termin fix', bgColor: 'bg-green-100', textColor: 'text-green-800' },
  { value: 'NICHT_BESTAETIGT', label: 'Nicht bestaetigt', bgColor: 'bg-orange-100', textColor: 'text-orange-800' },
  { value: 'ERLEDIGT', label: 'Erledigt', bgColor: 'bg-green-200', textColor: 'text-green-900' },
  { value: 'NO_SHOW', label: 'No-Show', bgColor: 'bg-red-100', textColor: 'text-red-800' },
  { value: 'STORNIERT', label: 'Storniert', bgColor: 'bg-red-200', textColor: 'text-red-900' },
  { value: 'WARTET', label: 'Wartet', bgColor: 'bg-purple-100', textColor: 'text-purple-800' },
];

// Prioritaet-Konstanten
const PRIORITAETEN = [
  { value: 'HOCH', label: 'Hoch', bgColor: 'bg-red-100', textColor: 'text-red-800' },
  { value: 'MITTEL', label: 'Mittel', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
  { value: 'NORMAL', label: 'Normal', bgColor: 'bg-gray-100', textColor: 'text-gray-600' },
];

// Helper: Status-Info aus Value holen
function getStatusInfo(statusValue) {
  return REPARATUR_STATUS.find(s => s.value === statusValue) || REPARATUR_STATUS[0];
}

// Helper: Prioritaet-Info aus Value holen
function getPrioInfo(prioValue) {
  return PRIORITAETEN.find(p => p.value === prioValue) || PRIORITAETEN[2];
}

// API-Konfiguration
const API_BASE_URL = 'https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1/reparatur-api';

// Erlaubte Status-Uebergaenge (gemaess SPEC 3.8)
const ERLAUBTE_TRANSITIONS = {
  'OFFEN': ['IN_BEARBEITUNG'],
  'IN_BEARBEITUNG': ['TERMIN_RESERVIERT', 'STORNIERT'],
  'TERMIN_RESERVIERT': ['TERMIN_FIX', 'NICHT_BESTAETIGT'],
  'TERMIN_FIX': ['ERLEDIGT', 'NO_SHOW'],
  'NO_SHOW': ['TERMIN_RESERVIERT', 'STORNIERT'],
  'NICHT_BESTAETIGT': ['TERMIN_RESERVIERT', 'STORNIERT'],
  'ERLEDIGT': [],
  'STORNIERT': [],
  'WARTET': ['IN_BEARBEITUNG', 'STORNIERT'],
};

// Zeitfenster-Definition (gemaess SPEC)
const ZEITFENSTER = [
  { value: 'FRUEH', label: 'Frueh (08:00-10:00)', hour: 8 },
  { value: 'VORMITTAG', label: 'Vormittag (10:00-12:00)', hour: 10 },
  { value: 'NACHMITTAG', label: 'Nachmittag (13:00-16:00)', hour: 13 },
  { value: 'SPAET', label: 'Spaet (16:00-18:00)', hour: 16 },
];

// Status, bei denen Termin-Setzen erlaubt ist
const TERMIN_ERLAUBTE_STATUS = ['IN_BEARBEITUNG', 'TERMIN_RESERVIERT', 'NICHT_BESTAETIGT', 'NO_SHOW'];

// Auftrags-Detail Modal Komponente
function AuftragsDetailModal({ isOpen, onClose, auftrag, onStatusChange, anonKey }) {
  const [newStatus, setNewStatus] = useState('');
  const [statusNotiz, setStatusNotiz] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Termin-Setzen State
  const [terminDatum, setTerminDatum] = useState('');
  const [terminZeitfenster, setTerminZeitfenster] = useState('');
  const [terminNotiz, setTerminNotiz] = useState('');
  const [terminSubmitting, setTerminSubmitting] = useState(false);
  const [terminError, setTerminError] = useState(null);
  const [terminSuccess, setTerminSuccess] = useState(false);

  // Reset wenn Modal oeffnet
  useEffect(() => {
    if (isOpen && auftrag) {
      setNewStatus('');
      setStatusNotiz('');
      setSubmitError(null);
      setSubmitSuccess(false);
      // Termin-Felder zuruecksetzen
      setTerminDatum('');
      setTerminZeitfenster('');
      setTerminNotiz('');
      setTerminError(null);
      setTerminSuccess(false);
    }
  }, [isOpen, auftrag?.id]);

  if (!isOpen || !auftrag) return null;

  const statusInfo = getStatusInfo(auftrag.status);
  const prioInfo = getPrioInfo(auftrag.prioritaet);
  const kundeName = auftrag.kunde_name || auftrag.neukunde_name || `ERP-ID: ${auftrag.erp_kunde_id}`;
  const erlaubteZiele = ERLAUBTE_TRANSITIONS[auftrag.status] || [];
  const kannTerminSetzen = TERMIN_ERLAUBTE_STATUS.includes(auftrag.status);

  // Termin setzen Handler
  const handleTerminSetzen = async () => {
    if (!terminDatum || !terminZeitfenster) return;

    setTerminSubmitting(true);
    setTerminError(null);

    try {
      // Zeitfenster zu Uhrzeit umwandeln
      const zeitfensterInfo = ZEITFENSTER.find(z => z.value === terminZeitfenster);
      if (!zeitfensterInfo) {
        throw new Error('Ungueltiges Zeitfenster');
      }

      // ISO-String erstellen: Datum + Uhrzeit aus Zeitfenster
      const terminDateTime = new Date(terminDatum);
      terminDateTime.setHours(zeitfensterInfo.hour, 0, 0, 0);
      const termin_sv1 = terminDateTime.toISOString();

      const response = await fetch(`${API_BASE_URL}/reparatur/${auftrag.id}/termin`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          termin_sv1,
          zeitfenster: terminZeitfenster,
          notiz: terminNotiz.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      setTerminSuccess(true);

      // Nach kurzer Verzoegerung Modal aktualisieren
      setTimeout(() => {
        onStatusChange();
        onClose();
      }, 1000);

    } catch (err) {
      console.error('Fehler beim Termin-Setzen:', err);
      setTerminError(err.message || 'Unbekannter Fehler');
    } finally {
      setTerminSubmitting(false);
    }
  };

  const handleStatusChange = async () => {
    if (!newStatus) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/reparatur/${auftrag.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          neuer_status: newStatus,
          notiz: statusNotiz.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      setSubmitSuccess(true);

      // Nach kurzer Verzoegerung Modal schliessen und Liste aktualisieren
      setTimeout(() => {
        onStatusChange();
        onClose();
      }, 1000);

    } catch (err) {
      console.error('Fehler beim Status-Update:', err);
      setSubmitError(err.message || 'Unbekannter Fehler');
    } finally {
      setSubmitting(false);
    }
  };

  // Formatiere Datum/Uhrzeit
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd.MM.yyyy HH:mm');
    } catch {
      return dateStr;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd.MM.yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Auftrags-Details
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Warnungen */}
          {(auftrag.ist_zu_lange_offen || auftrag.ist_no_show) && (
            <div className="p-4 bg-amber-50 border-b border-amber-200">
              {auftrag.ist_zu_lange_offen && (
                <div className="flex items-center gap-2 text-amber-800 mb-1">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">Auftrag ist zu lange offen!</span>
                </div>
              )}
              {auftrag.ist_no_show && (
                <div className="flex items-center gap-2 text-red-800">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">Kunde ist nicht erschienen (No-Show)!</span>
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-4 space-y-6">
            {/* Status und Prioritaet */}
            <div className="flex flex-wrap gap-3">
              <span
                className={`inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-full ${statusInfo.bgColor} ${statusInfo.textColor}`}
              >
                <Tag className="h-4 w-4 mr-1.5" />
                {statusInfo.label}
              </span>
              <span
                className={`inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-full ${prioInfo.bgColor} ${prioInfo.textColor}`}
              >
                <AlertTriangle className="h-4 w-4 mr-1.5" />
                Prioritaet: {prioInfo.label}
              </span>
            </div>

            {/* Kunde */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                <User className="h-4 w-4" />
                Kunde
              </h3>
              <p className="text-lg font-semibold text-gray-900">{kundeName}</p>
              {auftrag.neukunde_telefon && (
                <p className="text-gray-600 flex items-center gap-1 mt-1">
                  <Phone className="h-4 w-4" />
                  {auftrag.neukunde_telefon}
                </p>
              )}
              {(auftrag.adresse_strasse || auftrag.adresse_plz || auftrag.adresse_ort) && (
                <p className="text-gray-600 flex items-center gap-1 mt-1">
                  <MapPin className="h-4 w-4" />
                  {[auftrag.adresse_strasse, auftrag.adresse_plz, auftrag.adresse_ort].filter(Boolean).join(', ')}
                </p>
              )}
              {auftrag.kundentyp && (
                <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                  {auftrag.kundentyp}
                </span>
              )}
            </div>

            {/* Problembeschreibung */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Wrench className="h-4 w-4" />
                Problembeschreibung
              </h3>
              <p className="text-gray-900 font-medium">{auftrag.problembeschreibung_kurz || '-'}</p>
              {auftrag.problembeschreibung_lang && (
                <p className="text-gray-600 mt-2 text-sm whitespace-pre-wrap">{auftrag.problembeschreibung_lang}</p>
              )}
            </div>

            {/* Termine */}
            {(auftrag.termin_sv1 || auftrag.termin_sv2) && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Termine
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">Servicebesuch 1:</span>
                    <p className="font-medium">{formatDateTime(auftrag.termin_sv1)}</p>
                  </div>
                  {auftrag.termin_sv2 && (
                    <div>
                      <span className="text-sm text-gray-500">Servicebesuch 2:</span>
                      <p className="font-medium">{formatDateTime(auftrag.termin_sv2)}</p>
                    </div>
                  )}
                </div>
                {auftrag.outcome_sv1 && (
                  <div className="mt-2">
                    <span className="text-sm text-gray-500">Outcome SV1: </span>
                    <span className={`font-medium ${auftrag.outcome_sv1 === 'A' ? 'text-green-700' : 'text-blue-700'}`}>
                      {auftrag.outcome_sv1 === 'A' ? 'A - Beim 1. Besuch erledigt' : 'B - Folgeeinsatz noetig'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Interne Infos */}
            <div className="grid grid-cols-2 gap-4">
              {auftrag.mannstaerke && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Mannstaerke
                  </h3>
                  <p className="text-gray-900">{auftrag.mannstaerke} {auftrag.mannstaerke === 1 ? 'Person' : 'Personen'}</p>
                </div>
              )}
              {auftrag.zeitfenster && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Zeitfenster
                  </h3>
                  <p className="text-gray-900">{auftrag.zeitfenster}</p>
                </div>
              )}
            </div>

            {/* Meta-Daten */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Zeitstempel</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Erstellt:</span>
                  <p className="text-gray-900">{formatDateTime(auftrag.erstellt_am)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Aktualisiert:</span>
                  <p className="text-gray-900">{formatDateTime(auftrag.aktualisiert_am)}</p>
                </div>
                {auftrag.letzter_kontakt_am && (
                  <div>
                    <span className="text-gray-500">Letzter Kontakt:</span>
                    <p className="text-gray-900">{formatDateTime(auftrag.letzter_kontakt_am)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Notizen */}
            {auftrag.notizen && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Notizen
                </h3>
                <p className="text-gray-600 text-sm whitespace-pre-wrap bg-gray-50 rounded p-3">
                  {auftrag.notizen}
                </p>
              </div>
            )}

            {/* Termin setzen */}
            {kannTerminSetzen && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Termin setzen
                </h3>

                {terminSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-3">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Termin erfolgreich reserviert!</span>
                    </div>
                  </div>
                )}

                {terminError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertTriangle className="h-5 w-5" />
                      <span>{terminError}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {/* Datum */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Datum</label>
                    <input
                      type="date"
                      value={terminDatum}
                      onChange={(e) => setTerminDatum(e.target.value)}
                      disabled={terminSubmitting || terminSuccess}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Zeitfenster */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Zeitfenster</label>
                    <div className="relative">
                      <select
                        value={terminZeitfenster}
                        onChange={(e) => setTerminZeitfenster(e.target.value)}
                        disabled={terminSubmitting || terminSuccess}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                      >
                        <option value="">-- Zeitfenster waehlen --</option>
                        {ZEITFENSTER.map((zf) => (
                          <option key={zf.value} value={zf.value}>
                            {zf.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Notiz (optional) */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Notiz (optional)</label>
                    <textarea
                      value={terminNotiz}
                      onChange={(e) => setTerminNotiz(e.target.value)}
                      placeholder="z.B. Kunde bevorzugt Vormittag..."
                      disabled={terminSubmitting || terminSuccess}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleTerminSetzen}
                    disabled={!terminDatum || !terminZeitfenster || terminSubmitting || terminSuccess}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {terminSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Wird reserviert...
                      </>
                    ) : terminSuccess ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Reserviert!
                      </>
                    ) : (
                      <>
                        <Calendar className="h-4 w-4" />
                        Termin reservieren
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Status-Aenderung */}
            {erlaubteZiele.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
                  <Edit3 className="h-4 w-4" />
                  Status aendern
                </h3>

                {submitSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-3">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Status erfolgreich geaendert!</span>
                    </div>
                  </div>
                )}

                {submitError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertTriangle className="h-5 w-5" />
                      <span>{submitError}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="relative">
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      disabled={submitting || submitSuccess}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                    >
                      <option value="">-- Neuen Status waehlen --</option>
                      {erlaubteZiele.map((status) => {
                        const info = getStatusInfo(status);
                        return (
                          <option key={status} value={status}>
                            {info.label}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>

                  <textarea
                    value={statusNotiz}
                    onChange={(e) => setStatusNotiz(e.target.value)}
                    placeholder="Optionale Notiz zur Status-Aenderung..."
                    disabled={submitting || submitSuccess}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />

                  <button
                    onClick={handleStatusChange}
                    disabled={!newStatus || submitting || submitSuccess}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Wird aktualisiert...
                      </>
                    ) : submitSuccess ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Geaendert!
                      </>
                    ) : (
                      <>
                        <Edit3 className="h-4 w-4" />
                        Status aktualisieren
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {erlaubteZiele.length === 0 && (
              <div className="border-t pt-4">
                <p className="text-sm text-gray-500 italic">
                  Dieser Auftrag kann nicht mehr geaendert werden (Status: {statusInfo.label}).
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end p-4 border-t bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Schliessen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Neukunden-Formular Modal Komponente
function NeukundenFormularModal({ isOpen, onClose, onSuccess, anonKey }) {
  const [formData, setFormData] = useState({
    neukunde_name: '',
    neukunde_telefon: '',
    problembeschreibung_kurz: '',
    problembeschreibung_lang: '',
    adresse_strasse: '',
    adresse_plz: '',
    adresse_ort: '',
    prioritaet: 'NORMAL',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Form zuruecksetzen wenn Modal geoeffnet wird
  useEffect(() => {
    if (isOpen) {
      setFormData({
        neukunde_name: '',
        neukunde_telefon: '',
        problembeschreibung_kurz: '',
        problembeschreibung_lang: '',
        adresse_strasse: '',
        adresse_plz: '',
        adresse_ort: '',
        prioritaet: 'NORMAL',
      });
      setSubmitError(null);
      setSubmitSuccess(false);
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Fehler zuruecksetzen wenn User tippt
    if (submitError) setSubmitError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    // Validierung
    if (!formData.neukunde_name.trim()) {
      setSubmitError('Name ist ein Pflichtfeld');
      setSubmitting(false);
      return;
    }
    if (!formData.neukunde_telefon.trim()) {
      setSubmitError('Telefon ist ein Pflichtfeld');
      setSubmitting(false);
      return;
    }
    if (!formData.problembeschreibung_kurz.trim()) {
      setSubmitError('Problembeschreibung ist ein Pflichtfeld');
      setSubmitting(false);
      return;
    }

    try {
      const requestBody = {
        kundentyp: 'NEUKUNDE',
        name: formData.neukunde_name.trim(),
        telefon: formData.neukunde_telefon.trim(),
        problembeschreibung_kurz: formData.problembeschreibung_kurz.trim(),
        prioritaet: formData.prioritaet,
      };

      // Optionale Felder nur wenn befuellt
      if (formData.problembeschreibung_lang.trim()) {
        requestBody.beschreibung = formData.problembeschreibung_lang.trim();
      }
      if (formData.adresse_strasse.trim()) {
        requestBody.adresse_strasse = formData.adresse_strasse.trim();
      }
      if (formData.adresse_plz.trim()) {
        requestBody.adresse_plz = formData.adresse_plz.trim();
      }
      if (formData.adresse_ort.trim()) {
        requestBody.adresse_ort = formData.adresse_ort.trim();
      }

      const response = await fetch(`${API_BASE_URL}/reparatur`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Erfolg
      setSubmitSuccess(true);

      // Nach kurzer Verzoegerung Modal schliessen und Liste aktualisieren
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);

    } catch (err) {
      console.error('Fehler beim Erstellen des Auftrags:', err);
      setSubmitError(err.message || 'Unbekannter Fehler beim Erstellen');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Neuer Reparatur-Auftrag (Neukunde)
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Erfolgs-Meldung */}
          {submitSuccess && (
            <div className="p-4 bg-green-50 border-b border-green-200">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Auftrag erfolgreich erstellt!</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Fehler-Meldung */}
            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertTriangle className="h-5 w-5" />
                  <span>{submitError}</span>
                </div>
              </div>
            )}

            {/* Pflichtfelder-Hinweis */}
            <p className="text-sm text-gray-500">
              Felder mit <span className="text-red-500">*</span> sind Pflichtfelder
            </p>

            {/* Name */}
            <div>
              <label htmlFor="neukunde_name" className="block text-sm font-medium text-gray-700 mb-1">
                <User className="h-4 w-4 inline mr-1" />
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="neukunde_name"
                name="neukunde_name"
                value={formData.neukunde_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Max Mustermann"
                disabled={submitting || submitSuccess}
              />
            </div>

            {/* Telefon */}
            <div>
              <label htmlFor="neukunde_telefon" className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="h-4 w-4 inline mr-1" />
                Telefon <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="neukunde_telefon"
                name="neukunde_telefon"
                value={formData.neukunde_telefon}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+49 171 1234567"
                disabled={submitting || submitSuccess}
              />
            </div>

            {/* Problembeschreibung kurz */}
            <div>
              <label htmlFor="problembeschreibung_kurz" className="block text-sm font-medium text-gray-700 mb-1">
                <FileText className="h-4 w-4 inline mr-1" />
                Kurzbeschreibung <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="problembeschreibung_kurz"
                name="problembeschreibung_kurz"
                value={formData.problembeschreibung_kurz}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="z.B. Fenster klemmt, Tuerschloss defekt"
                maxLength={200}
                disabled={submitting || submitSuccess}
              />
            </div>

            {/* Problembeschreibung lang (optional) */}
            <div>
              <label htmlFor="problembeschreibung_lang" className="block text-sm font-medium text-gray-700 mb-1">
                <FileText className="h-4 w-4 inline mr-1" />
                Detaillierte Beschreibung
              </label>
              <textarea
                id="problembeschreibung_lang"
                name="problembeschreibung_lang"
                value={formData.problembeschreibung_lang}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Weitere Details zum Problem..."
                disabled={submitting || submitSuccess}
              />
            </div>

            {/* Adresse (optional) */}
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                Adresse (optional)
              </p>

              <input
                type="text"
                name="adresse_strasse"
                value={formData.adresse_strasse}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Strasse und Hausnummer"
                disabled={submitting || submitSuccess}
              />

              <div className="flex gap-3">
                <input
                  type="text"
                  name="adresse_plz"
                  value={formData.adresse_plz}
                  onChange={handleChange}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="PLZ"
                  maxLength={5}
                  disabled={submitting || submitSuccess}
                />
                <input
                  type="text"
                  name="adresse_ort"
                  value={formData.adresse_ort}
                  onChange={handleChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ort"
                  disabled={submitting || submitSuccess}
                />
              </div>
            </div>

            {/* Prioritaet */}
            <div>
              <label htmlFor="prioritaet" className="block text-sm font-medium text-gray-700 mb-1">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                Prioritaet
              </label>
              <select
                id="prioritaet"
                name="prioritaet"
                value={formData.prioritaet}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                disabled={submitting || submitSuccess}
              >
                <option value="NORMAL">Normal</option>
                <option value="MITTEL">Mittel</option>
                <option value="HOCH">Hoch</option>
              </select>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={submitting}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={submitting || submitSuccess}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Wird erstellt...
                  </>
                ) : submitSuccess ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Erstellt!
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Auftrag erstellen
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Reparaturen() {
  const [auftraege, setAuftraege] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPrio, setFilterPrio] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAuftrag, setSelectedAuftrag] = useState(null);

  // Anon-Key aus Environment Variable
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Daten laden
  useEffect(() => {
    loadAuftraege();
  }, []);

  const loadAuftraege = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/reparatur`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setAuftraege(data.auftraege || []);

    } catch (err) {
      console.error('Fehler beim Laden der Reparatur-Auftraege:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Gefilterte und sortierte Auftraege
  const filteredAuftraege = useMemo(() => {
    let result = [...auftraege];

    // Suche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(a => {
        const kundeName = a.kunde_name || a.neukunde_name || '';
        const kurztext = a.problembeschreibung_kurz || '';
        const adresse = a.adresse_ort || '';
        return (
          kundeName.toLowerCase().includes(term) ||
          kurztext.toLowerCase().includes(term) ||
          adresse.toLowerCase().includes(term) ||
          (a.erp_kunde_id && a.erp_kunde_id.toString().includes(term))
        );
      });
    }

    // Status-Filter
    if (filterStatus) {
      result = result.filter(a => a.status === filterStatus);
    }

    // Prioritaet-Filter
    if (filterPrio) {
      result = result.filter(a => a.prioritaet === filterPrio);
    }

    // Sortierung: Hohe Prioritaet zuerst, dann nach Erstelldatum (aelteste zuerst)
    result.sort((a, b) => {
      // Prioritaet-Reihenfolge: HOCH > MITTEL > NORMAL
      const prioOrder = { 'HOCH': 0, 'MITTEL': 1, 'NORMAL': 2 };
      const prioA = prioOrder[a.prioritaet] ?? 2;
      const prioB = prioOrder[b.prioritaet] ?? 2;

      if (prioA !== prioB) {
        return prioA - prioB;
      }

      // Bei gleicher Prioritaet: Aelteste zuerst
      const dateA = new Date(a.erstellt_am);
      const dateB = new Date(b.erstellt_am);
      return dateA - dateB;
    });

    return result;
  }, [auftraege, searchTerm, filterStatus, filterPrio]);

  // Zaehler fuer Status-Badges
  const statusCounts = useMemo(() => {
    const counts = {};
    auftraege.forEach(a => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
    return counts;
  }, [auftraege]);

  // Loading-Zustand
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Fehler-Zustand
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-red-800 mb-2">Fehler beim Laden</h2>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={loadAuftraege}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Wrench className="h-8 w-8 text-blue-600" />
            Reparaturen
          </h1>
          <p className="text-gray-600 mt-1">
            {filteredAuftraege.length} offene Auftraege
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Neuer Auftrag
          </button>
          <button
            onClick={loadAuftraege}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Clock className="h-4 w-4" />
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Suche */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Suche nach Kunde, Beschreibung, Ort..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status-Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="">Alle Status</option>
              {REPARATUR_STATUS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Prioritaet-Filter */}
          <div className="relative">
            <AlertTriangle className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={filterPrio}
              onChange={(e) => setFilterPrio(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="">Alle Prioritaeten</option>
              {PRIORITAETEN.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Status-Schnellfilter */}
      <div className="flex flex-wrap gap-2">
        {REPARATUR_STATUS.slice(0, 7).map((status) => {
          const count = statusCounts[status.value] || 0;
          const isActive = filterStatus === status.value;

          return (
            <button
              key={status.value}
              onClick={() => setFilterStatus(isActive ? '' : status.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? `${status.bgColor} ${status.textColor} ring-2 ring-offset-1`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Tabelle */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kunde
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Beschreibung
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prioritaet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Erstellt
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAuftraege.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <Wrench className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Keine Reparatur-Auftraege gefunden</p>
                  </td>
                </tr>
              ) : (
                filteredAuftraege.map((auftrag) => {
                  const statusInfo = getStatusInfo(auftrag.status);
                  const prioInfo = getPrioInfo(auftrag.prioritaet);
                  const kundeName = auftrag.kunde_name || auftrag.neukunde_name || `ERP-ID: ${auftrag.erp_kunde_id}`;
                  const istZuLangeOffen = auftrag.ist_zu_lange_offen;

                  return (
                    <tr
                      key={auftrag.id}
                      onClick={() => setSelectedAuftrag(auftrag)}
                      className={`hover:bg-gray-50 cursor-pointer ${istZuLangeOffen ? 'bg-amber-50' : ''}`}
                    >
                      {/* Kunde */}
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-2">
                          <User className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
                          <div>
                            <div className="font-medium text-gray-900">
                              {kundeName}
                            </div>
                            {auftrag.neukunde_telefon && (
                              <div className="text-sm text-gray-500 flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {auftrag.neukunde_telefon}
                              </div>
                            )}
                            {auftrag.adresse_ort && (
                              <div className="text-xs text-gray-400">
                                {auftrag.adresse_ort}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Beschreibung */}
                      <td className="px-6 py-4">
                        <div className="max-w-xs">
                          <div className="text-sm text-gray-900 truncate">
                            {auftrag.problembeschreibung_kurz || '-'}
                          </div>
                          {istZuLangeOffen && (
                            <div className="mt-1 flex items-center gap-1 text-amber-600 text-xs font-medium">
                              <AlertTriangle className="h-3 w-3" />
                              Zu lange offen!
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.bgColor} ${statusInfo.textColor}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Prioritaet */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${prioInfo.bgColor} ${prioInfo.textColor}`}
                        >
                          {prioInfo.label}
                        </span>
                      </td>

                      {/* Erstellt */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {auftrag.erstellt_am && format(new Date(auftrag.erstellt_am), 'dd.MM.yyyy')}
                        </div>
                        {auftrag.erstellt_am && (
                          <div className="text-xs text-gray-400">
                            {format(new Date(auftrag.erstellt_am), 'HH:mm')} Uhr
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Neukunden-Formular Modal */}
      <NeukundenFormularModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadAuftraege}
        anonKey={anonKey}
      />

      {/* Auftrags-Detail Modal */}
      <AuftragsDetailModal
        isOpen={selectedAuftrag !== null}
        onClose={() => setSelectedAuftrag(null)}
        auftrag={selectedAuftrag}
        onStatusChange={loadAuftraege}
        anonKey={anonKey}
      />
    </div>
  );
}

export default Reparaturen;
