import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Filter, Plus, Calculator, Calendar, Building2,
  Phone, Mail, Store, Globe, AlertCircle, RefreshCw
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

// Kanal-Icons
const KANAL_CONFIG = {
  showroom: { icon: Store, label: 'Showroom', color: 'text-blue-600' },
  telefon: { icon: Phone, label: 'Telefon', color: 'text-green-600' },
  email: { icon: Mail, label: 'E-Mail', color: 'text-orange-600' },
  website: { icon: Globe, label: 'Website', color: 'text-purple-600' }
};

function getStatusInfo(statusValue) {
  return BUDGET_STATUS.find(s => s.value === statusValue) || BUDGET_STATUS[0];
}

function Budgetangebot() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterKanal, setFilterKanal] = useState('');

  // Modal fuer neuen Case
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [newCaseData, setNewCaseData] = useState({
    lead_name: '',
    lead_telefon: '',
    lead_email: '',
    kanal: 'showroom',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCases();
  }, [filterStatus, filterKanal]);

  const loadCases = async () => {
    setLoading(true);
    setError(null);

    try {
      // API-Call zum Backend
      let url = '/api/budget/cases?limit=200';
      if (filterStatus) url += `&status=${filterStatus}`;
      if (filterKanal) url += `&kanal=${filterKanal}`;

      const response = await fetch(url);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Fehler beim Laden der Cases');
      }

      setCases(result.data || []);
    } catch (err) {
      console.error('Fehler beim Laden der Budget-Cases:', err);
      setError(err.message);

      // Fallback: Direkt von Supabase laden
      try {
        let query = supabase
          .from('budget_cases')
          .select(`
            id,
            created_at,
            updated_at,
            erp_kunden_code,
            lead_name,
            lead_telefon,
            lead_email,
            kanal,
            status,
            notes,
            erp_kunden (
              firma1,
              name,
              ort
            )
          `)
          .order('created_at', { ascending: false })
          .limit(200);

        if (filterStatus) query = query.eq('status', filterStatus);
        if (filterKanal) query = query.eq('kanal', filterKanal);

        const { data, error: supaError } = await query;
        if (supaError) throw supaError;

        setCases(data || []);
        setError(null);
      } catch (supaErr) {
        console.error('Supabase Fallback auch fehlgeschlagen:', supaErr);
      }
    } finally {
      setLoading(false);
    }
  };

  // Neuen Case anlegen
  const handleCreateCase = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/budget/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCaseData)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Fehler beim Anlegen');
      }

      // Zur Detail-Seite navigieren
      navigate(`/budget/${result.data.id}`);

    } catch (err) {
      console.error('Fehler beim Anlegen des Cases:', err);
      alert('Fehler: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Gefilterte Cases
  const filteredCases = useMemo(() => {
    if (!searchTerm) return cases;

    const term = searchTerm.toLowerCase();
    return cases.filter(c => {
      const kundenName = c.erp_kunden?.firma1 || c.erp_kunden?.name || c.lead_name || '';
      const ort = c.erp_kunden?.ort || '';
      return (
        kundenName.toLowerCase().includes(term) ||
        ort.toLowerCase().includes(term) ||
        c.notes?.toLowerCase().includes(term)
      );
    });
  }, [cases, searchTerm]);

  // Status-Zaehler
  const statusCounts = useMemo(() => {
    const counts = {};
    BUDGET_STATUS.forEach(s => counts[s.value] = 0);
    cases.forEach(c => {
      if (counts[c.status] !== undefined) {
        counts[c.status]++;
      }
    });
    return counts;
  }, [cases]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Budgetangebote</h1>
          <p className="text-gray-600 mt-1">
            {filteredCases.length} Anfragen
          </p>
        </div>
        <button
          onClick={() => setShowNewCaseModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Neuer Case
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-red-800 font-medium">Verbindungsfehler</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
          <button
            onClick={loadCases}
            className="ml-auto p-2 hover:bg-red-100 rounded-full"
          >
            <RefreshCw className="h-5 w-5 text-red-600" />
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Suche */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Suche nach Kunde, Ort, Notiz..."
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
              {BUDGET_STATUS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Kanal-Filter */}
          <div className="relative">
            <Store className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={filterKanal}
              onChange={(e) => setFilterKanal(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="">Alle Kanaele</option>
              {Object.entries(KANAL_CONFIG).map(([value, config]) => (
                <option key={value} value={value}>{config.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Status-Schnellfilter */}
      <div className="flex flex-wrap gap-2">
        {BUDGET_STATUS.map((status) => {
          const count = statusCounts[status.value];
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

      {/* Case-Liste */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Datum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kunde/Lead
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kanal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notizen
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="font-medium">Keine Budget-Cases gefunden</p>
                    <p className="text-sm mt-1">Erstellen Sie einen neuen Case mit dem Button oben.</p>
                  </td>
                </tr>
              ) : (
                filteredCases.map((caseItem) => {
                  const statusInfo = getStatusInfo(caseItem.status);
                  const kanalConfig = KANAL_CONFIG[caseItem.kanal] || KANAL_CONFIG.showroom;
                  const KanalIcon = kanalConfig.icon;
                  const kundenName = caseItem.erp_kunden?.firma1 || caseItem.erp_kunden?.name || caseItem.lead_name;

                  return (
                    <tr key={caseItem.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link to={`/budget/${caseItem.id}`} className="block">
                          <div className="font-medium text-gray-900">
                            {format(new Date(caseItem.created_at), 'dd.MM.yyyy')}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(caseItem.created_at), 'HH:mm')} Uhr
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <Link to={`/budget/${caseItem.id}`}>
                          {kundenName ? (
                            <div className="flex items-start gap-2">
                              <Building2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                                  {kundenName}
                                </div>
                                {caseItem.erp_kunden?.ort && (
                                  <div className="text-xs text-gray-500">{caseItem.erp_kunden.ort}</div>
                                )}
                                {caseItem.lead_telefon && (
                                  <div className="text-xs text-gray-500 flex items-center gap-1">
                                    <Phone className="h-3 w-3" /> {caseItem.lead_telefon}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`flex items-center gap-2 ${kanalConfig.color}`}>
                          <KanalIcon className="h-4 w-4" />
                          <span className="text-sm">{kanalConfig.label}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${statusInfo.bgColor} ${statusInfo.textColor}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {caseItem.notes ? (
                          <p className="text-sm text-gray-600 truncate max-w-[200px]" title={caseItem.notes}>
                            {caseItem.notes}
                          </p>
                        ) : (
                          <span className="text-gray-300">-</span>
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

      {/* Modal: Neuer Case */}
      {showNewCaseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Neuer Budget-Case</h2>
              <p className="text-sm text-gray-600 mt-1">Lead-Daten erfassen</p>
            </div>

            <form onSubmit={handleCreateCase} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name / Firma *
                </label>
                <input
                  type="text"
                  required
                  value={newCaseData.lead_name}
                  onChange={(e) => setNewCaseData({...newCaseData, lead_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Max Mustermann"
                />
              </div>

              {/* Telefon */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefon
                </label>
                <input
                  type="tel"
                  value={newCaseData.lead_telefon}
                  onChange={(e) => setNewCaseData({...newCaseData, lead_telefon: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0123 456789"
                />
              </div>

              {/* E-Mail */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-Mail
                </label>
                <input
                  type="email"
                  value={newCaseData.lead_email}
                  onChange={(e) => setNewCaseData({...newCaseData, lead_email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="email@beispiel.de"
                />
              </div>

              {/* Kanal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kanal *
                </label>
                <select
                  required
                  value={newCaseData.kanal}
                  onChange={(e) => setNewCaseData({...newCaseData, kanal: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.entries(KANAL_CONFIG).map(([value, config]) => (
                    <option key={value} value={value}>{config.label}</option>
                  ))}
                </select>
              </div>

              {/* Notizen */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notizen
                </label>
                <textarea
                  value={newCaseData.notes}
                  onChange={(e) => setNewCaseData({...newCaseData, notes: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Erste Notizen zum Projekt..."
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewCaseModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                >
                  {saving ? 'Anlegen...' : 'Case anlegen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Budgetangebot;
