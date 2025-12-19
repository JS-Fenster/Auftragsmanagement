import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, FolderKanban, ClipboardList, Users, Euro, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase, getStatusInfo, getProjektTyp, WORKFLOW_STATUS } from '../lib/supabase';
import axios from 'axios';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function StatCard({ title, value, icon: Icon, color, link }) {
  const content = (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
        </div>
        <div className={`p-3 rounded-full bg-opacity-10 ${color.replace('text-', 'bg-')}`}>
          <Icon className={`h-8 w-8 ${color}`} />
        </div>
      </div>
    </div>
  );

  if (link) {
    return <Link to={link}>{content}</Link>;
  }
  return content;
}

function Dashboard() {
  const [stats, setStats] = useState({
    projekte: 0,
    auftraege: 0,
    kunden: 0,
    offeneAuftraege: 0,
    inMontage: 0,
    umsatzMonat: 0
  });
  const [recentProjekte, setRecentProjekte] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    checkSyncStatus();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Parallele Queries
      const [
        { count: projekteCount },
        { count: kundenCount },
        { data: angebote },
        { data: recentProj },
        { data: auftragStatus }
      ] = await Promise.all([
        supabase.from('erp_projekte').select('*', { count: 'exact', head: true }),
        supabase.from('erp_kunden').select('*', { count: 'exact', head: true }),
        supabase.from('erp_angebote').select('code, auftrags_datum, wert'),
        supabase.from('erp_projekte')
          .select('code, nummer, name, datum, notiz, kunden_code')
          .order('datum', { ascending: false })
          .limit(5),
        supabase.from('auftrag_status').select('status')
      ]);

      // Auftraege = Angebote mit auftrags_datum
      const auftraege = angebote?.filter(a => a.auftrags_datum) || [];

      // Status-Zaehlung
      const statusCounts = {};
      auftragStatus?.forEach(s => {
        statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
      });

      // Umsatz diesen Monat (aus Angeboten mit auftrags_datum)
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const umsatzMonat = auftraege
        .filter(a => new Date(a.auftrags_datum) >= monthStart)
        .reduce((sum, a) => sum + (parseFloat(a.wert) || 0), 0);

      setStats({
        projekte: projekteCount || 0,
        auftraege: auftraege.length,
        kunden: kundenCount || 0,
        offeneAuftraege: statusCounts['auftrag'] || 0,
        inMontage: (statusCounts['in_montage'] || 0) + (statusCounts['montage_geplant'] || 0),
        umsatzMonat
      });

      setRecentProjekte(recentProj || []);

    } catch (error) {
      console.error('Fehler beim Laden der Dashboard-Daten:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkSyncStatus = async () => {
    try {
      // Letzten synced_at Wert aus einer Tabelle holen
      const { data } = await supabase
        .from('erp_projekte')
        .select('synced_at')
        .order('synced_at', { ascending: false })
        .limit(1);

      if (data && data[0]?.synced_at) {
        setLastSync(new Date(data[0].synced_at));
      }
    } catch (error) {
      console.error('Fehler beim Pruefen des Sync-Status:', error);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);

    try {
      const response = await axios.post(`${API_URL}/api/sync`);
      if (response.data.success) {
        // Daten neu laden
        await loadDashboardData();
        await checkSyncStatus();
      }
    } catch (error) {
      console.error('Sync Fehler:', error);
      setSyncError(error.response?.data?.message || 'Sync fehlgeschlagen');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header mit Sync-Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Übersicht Auftragsmanagement
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Letzter Sync */}
          <div className="text-sm text-gray-500 text-right">
            <div>Letzter Sync:</div>
            <div className="font-medium">
              {lastSync
                ? formatDistanceToNow(lastSync, { addSuffix: true, locale: de })
                : 'Unbekannt'}
            </div>
          </div>

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              syncing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Synchronisiere...' : 'ERP Sync'}
          </button>
        </div>
      </div>

      {/* Sync Error */}
      {syncError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-800">Sync fehlgeschlagen</p>
            <p className="text-sm text-red-600">{syncError}</p>
          </div>
        </div>
      )}

      {/* Statistik-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Projekte"
          value={stats.projekte.toLocaleString('de-DE')}
          icon={FolderKanban}
          color="text-blue-600"
          link="/projekte"
        />
        <StatCard
          title="Aufträge"
          value={stats.auftraege.toLocaleString('de-DE')}
          icon={ClipboardList}
          color="text-green-600"
          link="/auftraege"
        />
        <StatCard
          title="Kunden"
          value={stats.kunden.toLocaleString('de-DE')}
          icon={Users}
          color="text-purple-600"
          link="/kunden"
        />
        <StatCard
          title="Umsatz (Monat)"
          value={`${(stats.umsatzMonat / 1000).toFixed(0)}k`}
          icon={Euro}
          color="text-emerald-600"
        />
      </div>

      {/* Workflow-Status Uebersicht */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Workflow-Status
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {WORKFLOW_STATUS.slice(1, 7).map((status) => (
            <div
              key={status.value}
              className={`${status.bgColor} ${status.textColor} rounded-lg p-3 text-center`}
            >
              <div className="text-2xl font-bold">
                {stats[status.value] || 0}
              </div>
              <div className="text-xs font-medium truncate">
                {status.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Neueste Projekte */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Neueste Projekte
            </h2>
            <Link
              to="/projekte"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Alle anzeigen
            </Link>
          </div>
        </div>

        {recentProjekte.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            Keine Projekte gefunden
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nummer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Typ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Datum
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentProjekte.map((projekt) => {
                  const typ = getProjektTyp(projekt.notiz);
                  return (
                    <tr key={projekt.code} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/projekte/${projekt.code}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {projekt.nummer}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 truncate max-w-xs">
                          {projekt.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {typ ? (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                            {typ.key}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {projekt.datum
                          ? format(new Date(projekt.datum), 'dd.MM.yyyy')
                          : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
