import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Euro, Calendar, Building2, ClipboardList } from 'lucide-react';
import { supabase, WORKFLOW_STATUS, getStatusInfo } from '../lib/supabase';
import { format } from 'date-fns';

function Auftraege() {
  const [auftraege, setAuftraege] = useState([]);
  const [kunden, setKunden] = useState({});
  const [projekte, setProjekte] = useState({});
  const [auftragStatus, setAuftragStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Alle Daten parallel laden
      const [
        { data: angeboteData },
        { data: kundenData },
        { data: projekteData },
        { data: statusData }
      ] = await Promise.all([
        supabase
          .from('erp_angebote')
          .select('*')
          .not('auftrags_datum', 'is', null)
          .order('auftrags_datum', { ascending: false }),
        supabase.from('erp_kunden').select('code, firma1, name, ort'),
        supabase.from('erp_projekte').select('code, nummer, name'),
        supabase.from('auftrag_status').select('*')
      ]);

      // Lookup-Maps erstellen
      const kundenMap = {};
      kundenData?.forEach(k => kundenMap[k.code] = k);

      const projekteMap = {};
      projekteData?.forEach(p => projekteMap[p.code] = p);

      const statusMap = {};
      statusData?.forEach(s => statusMap[s.projekt_code] = s);

      setAuftraege(angeboteData || []);
      setKunden(kundenMap);
      setProjekte(projekteMap);
      setAuftragStatus(statusMap);

    } catch (error) {
      console.error('Fehler beim Laden der Auftraege:', error);
    } finally {
      setLoading(false);
    }
  };

  // Status aendern
  const updateStatus = async (auftrag, newStatus) => {
    const projektCode = auftrag.projekt_code;
    const existingStatus = auftragStatus[projektCode];

    try {
      if (existingStatus) {
        // Update
        const { error } = await supabase
          .from('auftrag_status')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', existingStatus.id);

        if (error) throw error;

        setAuftragStatus({
          ...auftragStatus,
          [projektCode]: { ...existingStatus, status: newStatus }
        });
      } else {
        // Insert
        const { data, error } = await supabase
          .from('auftrag_status')
          .insert({
            projekt_code: projektCode,
            angebot_code: auftrag.code,
            status: newStatus
          })
          .select()
          .single();

        if (error) throw error;

        setAuftragStatus({
          ...auftragStatus,
          [projektCode]: data
        });
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Status:', error);
      alert('Fehler: ' + error.message);
    }
  };

  // Gefilterte Auftraege
  const filteredAuftraege = useMemo(() => {
    let result = [...auftraege];

    // Suche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(a => {
        const kunde = kunden[a.kunden_code];
        const projekt = projekte[a.projekt_code];
        return (
          a.nummer?.toString().includes(term) ||
          projekt?.nummer?.toLowerCase().includes(term) ||
          projekt?.name?.toLowerCase().includes(term) ||
          kunde?.firma1?.toLowerCase().includes(term) ||
          kunde?.name?.toLowerCase().includes(term)
        );
      });
    }

    // Status-Filter
    if (filterStatus) {
      result = result.filter(a => {
        const status = auftragStatus[a.projekt_code];
        return status?.status === filterStatus;
      });
    }

    return result;
  }, [auftraege, kunden, projekte, auftragStatus, searchTerm, filterStatus]);

  // Summen berechnen
  const totalWert = useMemo(() => {
    return filteredAuftraege.reduce((sum, a) => sum + (parseFloat(a.wert) || 0), 0);
  }, [filteredAuftraege]);

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
          <h1 className="text-3xl font-bold text-gray-900">Auftraege</h1>
          <p className="text-gray-600 mt-1">
            {filteredAuftraege.length} Auftraege - Gesamt: {totalWert.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          </p>
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
              placeholder="Suche nach Nummer, Projekt, Kunde..."
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
              {WORKFLOW_STATUS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Status-Schnellfilter */}
      <div className="flex flex-wrap gap-2">
        {WORKFLOW_STATUS.slice(1, 8).map((status) => {
          const count = auftraege.filter(a =>
            auftragStatus[a.projekt_code]?.status === status.value
          ).length;
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
                  Auftrag
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Projekt
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kunde
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Wert
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAuftraege.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Keine Auftraege gefunden
                  </td>
                </tr>
              ) : (
                filteredAuftraege.map((auftrag) => {
                  const kunde = kunden[auftrag.kunden_code];
                  const projekt = projekte[auftrag.projekt_code];
                  const status = auftragStatus[auftrag.projekt_code];
                  const statusInfo = getStatusInfo(status?.status || 'auftrag');

                  return (
                    <tr key={auftrag.code} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-medium text-gray-900">
                            #{auftrag.auftrags_nummer || auftrag.nummer}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {auftrag.auftrags_datum && format(new Date(auftrag.auftrags_datum), 'dd.MM.yyyy')}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {projekt ? (
                          <Link
                            to={`/projekte/${projekt.code}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <div className="font-medium">{projekt.nummer}</div>
                            <div className="text-sm text-gray-500 truncate max-w-[200px]">
                              {projekt.name}
                            </div>
                          </Link>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {kunde ? (
                          <div className="flex items-start gap-2">
                            <Building2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                                {kunde.firma1 || kunde.name}
                              </div>
                              {kunde.ort && (
                                <div className="text-xs text-gray-500">{kunde.ort}</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-semibold text-gray-900">
                          <Euro className="h-4 w-4 text-gray-400" />
                          {auftrag.wert?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={status?.status || 'auftrag'}
                          onChange={(e) => updateStatus(auftrag, e.target.value)}
                          className={`px-2 py-1 rounded text-sm font-medium border-0 cursor-pointer ${statusInfo.bgColor} ${statusInfo.textColor}`}
                        >
                          {WORKFLOW_STATUS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Auftraege;
