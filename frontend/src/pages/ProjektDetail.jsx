import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Building2, Calendar, Euro, FileText, Truck,
  Receipt, Package, ClipboardCheck, Save, Plus, Trash2, Check
} from 'lucide-react';
import { supabase, WORKFLOW_STATUS, getStatusInfo, getProjektTyp } from '../lib/supabase';
import { format } from 'date-fns';

function ProjektDetail() {
  const { code } = useParams();
  const [projekt, setProjekt] = useState(null);
  const [kunde, setKunde] = useState(null);
  const [angebote, setAngebote] = useState([]);
  const [rechnungen, setRechnungen] = useState([]);
  const [bestellungen, setBestellungen] = useState([]);
  const [workflowStatus, setWorkflowStatus] = useState(null);
  const [checkliste, setCheckliste] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCheckItem, setNewCheckItem] = useState('');

  useEffect(() => {
    loadProjektData();
  }, [code]);

  const loadProjektData = async () => {
    try {
      // Projekt laden
      const { data: projektData } = await supabase
        .from('erp_projekte')
        .select('*')
        .eq('code', code)
        .single();

      if (!projektData) {
        setLoading(false);
        return;
      }

      setProjekt(projektData);

      // Parallele Queries
      const [
        { data: kundeData },
        { data: angeboteData },
        { data: rechnungenData },
        { data: bestellungenData },
        { data: statusData },
      ] = await Promise.all([
        projektData.kunden_code
          ? supabase.from('erp_kunden').select('*').eq('code', projektData.kunden_code).single()
          : { data: null },
        supabase.from('erp_angebote').select('*').eq('projekt_code', code).order('datum', { ascending: false }),
        supabase.from('erp_rechnungen').select('*').eq('projekt_code', code).order('datum', { ascending: false }),
        supabase.from('erp_bestellungen').select('*').eq('projekt_code', code).order('datum', { ascending: false }),
        supabase.from('auftrag_status').select('*').eq('projekt_code', code).single(),
      ]);

      setKunde(kundeData);
      setAngebote(angeboteData || []);
      setRechnungen(rechnungenData || []);
      setBestellungen(bestellungenData || []);

      // Workflow-Status (oder Default erstellen)
      if (statusData) {
        setWorkflowStatus(statusData);
        // Checkliste laden
        const { data: checkData } = await supabase
          .from('auftrag_checkliste')
          .select('*')
          .eq('auftrag_status_id', statusData.id)
          .order('reihenfolge', { ascending: true });
        setCheckliste(checkData || []);
      } else {
        // Noch kein Status vorhanden
        setWorkflowStatus({
          projekt_code: parseInt(code),
          status: 'angebot',
          montage_geplant: null,
          notiz: ''
        });
      }

    } catch (error) {
      console.error('Fehler beim Laden des Projekts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Status speichern
  const saveWorkflowStatus = async () => {
    setSaving(true);
    try {
      if (workflowStatus.id) {
        // Update
        const { error } = await supabase
          .from('auftrag_status')
          .update({
            status: workflowStatus.status,
            montage_geplant: workflowStatus.montage_geplant,
            notiz: workflowStatus.notiz,
            updated_at: new Date().toISOString()
          })
          .eq('id', workflowStatus.id);

        if (error) throw error;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('auftrag_status')
          .insert({
            projekt_code: parseInt(code),
            status: workflowStatus.status,
            montage_geplant: workflowStatus.montage_geplant,
            notiz: workflowStatus.notiz
          })
          .select()
          .single();

        if (error) throw error;
        setWorkflowStatus(data);
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Checklisten-Item hinzufuegen
  const addChecklistItem = async () => {
    if (!newCheckItem.trim() || !workflowStatus.id) return;

    try {
      const { data, error } = await supabase
        .from('auftrag_checkliste')
        .insert({
          auftrag_status_id: workflowStatus.id,
          titel: newCheckItem.trim(),
          reihenfolge: checkliste.length
        })
        .select()
        .single();

      if (error) throw error;
      setCheckliste([...checkliste, data]);
      setNewCheckItem('');
    } catch (error) {
      console.error('Fehler beim Hinzufuegen:', error);
    }
  };

  // Checklisten-Item toggeln
  const toggleChecklistItem = async (item) => {
    try {
      const newErledigt = !item.erledigt;
      const { error } = await supabase
        .from('auftrag_checkliste')
        .update({
          erledigt: newErledigt,
          erledigt_am: newErledigt ? new Date().toISOString() : null
        })
        .eq('id', item.id);

      if (error) throw error;
      setCheckliste(checkliste.map(c =>
        c.id === item.id ? { ...c, erledigt: newErledigt } : c
      ));
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
    }
  };

  // Checklisten-Item loeschen
  const deleteChecklistItem = async (id) => {
    try {
      const { error } = await supabase
        .from('auftrag_checkliste')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCheckliste(checkliste.filter(c => c.id !== id));
    } catch (error) {
      console.error('Fehler beim Loeschen:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!projekt) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Projekt nicht gefunden</p>
        <Link to="/projekte" className="text-blue-600 hover:underline mt-2 inline-block">
          Zurueck zur Liste
        </Link>
      </div>
    );
  }

  const typ = getProjektTyp(projekt.notiz);
  const statusInfo = getStatusInfo(workflowStatus?.status);
  const auftrag = angebote.find(a => a.auftrags_datum);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            to="/projekte"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Zurueck
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            {projekt.nummer}
            {typ && (
              <span className={`px-2 py-1 text-sm font-medium rounded ${
                typ.key === 'REP' ? 'bg-orange-100 text-orange-800' :
                typ.key === 'HT' ? 'bg-purple-100 text-purple-800' :
                typ.key === 'DKF' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {typ.key}
              </span>
            )}
          </h1>
          <p className="text-gray-600 mt-1">{projekt.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Linke Spalte: Projekt-Info + ERP-Daten */}
        <div className="lg:col-span-2 space-y-6">
          {/* Kunde */}
          {kunde && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-gray-400" />
                Kunde
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Firma:</span>
                  <p className="font-medium">{kunde.firma1 || kunde.name}</p>
                  {kunde.firma2 && <p className="text-gray-600">{kunde.firma2}</p>}
                </div>
                <div>
                  <span className="text-gray-500">Adresse:</span>
                  <p className="font-medium">{kunde.strasse}</p>
                  <p>{kunde.plz} {kunde.ort}</p>
                </div>
                {kunde.telefon && (
                  <div>
                    <span className="text-gray-500">Telefon:</span>
                    <p className="font-medium">{kunde.telefon}</p>
                  </div>
                )}
                {kunde.email && (
                  <div>
                    <span className="text-gray-500">E-Mail:</span>
                    <p className="font-medium">{kunde.email}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Angebote/Auftraege */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-400" />
              Angebote / Auftraege ({angebote.length})
            </h2>
            {angebote.length === 0 ? (
              <p className="text-gray-500 text-sm">Keine Angebote vorhanden</p>
            ) : (
              <div className="space-y-3">
                {angebote.map((a) => (
                  <div
                    key={a.code}
                    className={`p-3 rounded-lg border ${
                      a.auftrags_datum
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium">
                          {a.auftrags_datum ? 'Auftrag' : 'Angebot'} #{a.nummer}
                        </span>
                        <div className="text-sm text-gray-500 mt-1">
                          {a.datum && format(new Date(a.datum), 'dd.MM.yyyy')}
                          {a.auftrags_datum && (
                            <span className="ml-2 text-green-600">
                              (Auftrag: {format(new Date(a.auftrags_datum), 'dd.MM.yyyy')})
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-semibold text-gray-900">
                        {a.wert?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rechnungen */}
          {rechnungen.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-gray-400" />
                Rechnungen ({rechnungen.length})
              </h2>
              <div className="space-y-3">
                {rechnungen.map((r) => (
                  <div key={r.code} className="p-3 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium">Rechnung #{r.nummer}</span>
                        <div className="text-sm text-gray-500 mt-1">
                          {r.datum && format(new Date(r.datum), 'dd.MM.yyyy')}
                          {r.zahlbar_bis && (
                            <span className="ml-2">
                              (faellig: {format(new Date(r.zahlbar_bis), 'dd.MM.yyyy')})
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-semibold text-gray-900">
                        {r.bruttowert?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bestellungen */}
          {bestellungen.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-gray-400" />
                Bestellungen ({bestellungen.length})
              </h2>
              <div className="space-y-3">
                {bestellungen.map((b) => (
                  <div key={b.code} className="p-3 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium">Bestellung #{b.nummer}</span>
                        <div className="text-sm text-gray-500 mt-1">
                          {b.datum && format(new Date(b.datum), 'dd.MM.yyyy')}
                        </div>
                      </div>
                      <span className="font-semibold text-gray-900">
                        {b.wert?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rechte Spalte: Workflow-Status */}
        <div className="space-y-6">
          {/* Status-Karte */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-gray-400" />
              Workflow-Status
            </h2>

            <div className="space-y-4">
              {/* Status Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={workflowStatus?.status || 'angebot'}
                  onChange={(e) => setWorkflowStatus({ ...workflowStatus, status: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${statusInfo.bgColor} ${statusInfo.textColor}`}
                >
                  {WORKFLOW_STATUS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Montage-Datum */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montage geplant
                </label>
                <input
                  type="date"
                  value={workflowStatus?.montage_geplant || ''}
                  onChange={(e) => setWorkflowStatus({ ...workflowStatus, montage_geplant: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notiz */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notizen
                </label>
                <textarea
                  value={workflowStatus?.notiz || ''}
                  onChange={(e) => setWorkflowStatus({ ...workflowStatus, notiz: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Interne Notizen..."
                />
              </div>

              {/* Speichern Button */}
              <button
                onClick={saveWorkflowStatus}
                disabled={saving}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  saving
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Save className="h-4 w-4" />
                {saving ? 'Speichern...' : 'Status speichern'}
              </button>
            </div>
          </div>

          {/* Checkliste */}
          {workflowStatus?.id && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Checkliste
              </h2>

              {/* Bestehende Items */}
              <div className="space-y-2 mb-4">
                {checkliste.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-2 rounded ${
                      item.erledigt ? 'bg-green-50' : 'bg-gray-50'
                    }`}
                  >
                    <button
                      onClick={() => toggleChecklistItem(item)}
                      className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center ${
                        item.erledigt
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300'
                      }`}
                    >
                      {item.erledigt && <Check className="h-3 w-3" />}
                    </button>
                    <span className={`flex-1 text-sm ${item.erledigt ? 'line-through text-gray-500' : ''}`}>
                      {item.titel}
                    </span>
                    <button
                      onClick={() => deleteChecklistItem(item.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Neues Item hinzufuegen */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addChecklistItem()}
                  placeholder="Neuer Punkt..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={addChecklistItem}
                  disabled={!newCheckItem.trim()}
                  className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Info wenn noch nicht gespeichert */}
          {!workflowStatus?.id && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              Speichere den Status, um die Checkliste freizuschalten.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjektDetail;
