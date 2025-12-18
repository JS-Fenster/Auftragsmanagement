import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, ChevronDown, ChevronUp, Calendar, Building2 } from 'lucide-react';
import { supabase, getProjektTyp, PROJEKT_TYPEN } from '../lib/supabase';
import { format } from 'date-fns';

function Projekte() {
  const [projekte, setProjekte] = useState([]);
  const [kunden, setKunden] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTyp, setFilterTyp] = useState('');
  const [sortField, setSortField] = useState('datum');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Erst Projekte laden
      const { data: projekteData } = await supabase
        .from('erp_projekte')
        .select('*')
        .order('datum', { ascending: false })
        .limit(500);

      // Dann nur die benoetigten Kunden laden (anhand der kunden_codes)
      const kundenCodes = [...new Set(
        (projekteData || [])
          .map(p => p.kunden_code)
          .filter(code => code && code !== 0)
      )];

      const kundenMap = {};

      if (kundenCodes.length > 0) {
        // Supabase erlaubt max ~300 IDs pro IN-Query, daher chunken
        const chunkSize = 300;
        for (let i = 0; i < kundenCodes.length; i += chunkSize) {
          const chunk = kundenCodes.slice(i, i + chunkSize);
          const { data: kundenData } = await supabase
            .from('erp_kunden')
            .select('code, firma1, name, ort')
            .in('code', chunk);

          kundenData?.forEach(k => {
            kundenMap[k.code] = k;
          });
        }
      }

      setProjekte(projekteData || []);
      setKunden(kundenMap);
    } catch (error) {
      console.error('Fehler beim Laden der Projekte:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sortierung aendern
  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // Gefilterte und sortierte Projekte
  const filteredProjekte = useMemo(() => {
    let result = [...projekte];

    // Suche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => {
        const kunde = kunden[p.kunden_code];
        return (
          p.nummer?.toLowerCase().includes(term) ||
          p.name?.toLowerCase().includes(term) ||
          kunde?.firma1?.toLowerCase().includes(term) ||
          kunde?.name?.toLowerCase().includes(term) ||
          kunde?.ort?.toLowerCase().includes(term)
        );
      });
    }

    // Typ-Filter
    if (filterTyp) {
      result = result.filter(p => {
        const typ = getProjektTyp(p.notiz);
        return typ?.key === filterTyp;
      });
    }

    // Sortierung
    result.sort((a, b) => {
      let valA, valB;

      switch (sortField) {
        case 'nummer':
          valA = a.nummer || '';
          valB = b.nummer || '';
          break;
        case 'name':
          valA = a.name || '';
          valB = b.name || '';
          break;
        case 'kunde':
          valA = kunden[a.kunden_code]?.firma1 || kunden[a.kunden_code]?.name || '';
          valB = kunden[b.kunden_code]?.firma1 || kunden[b.kunden_code]?.name || '';
          break;
        case 'datum':
        default:
          valA = a.datum || '';
          valB = b.datum || '';
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [projekte, kunden, searchTerm, filterTyp, sortField, sortDir]);

  // Sort Icon
  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc'
      ? <ChevronUp className="h-4 w-4 inline ml-1" />
      : <ChevronDown className="h-4 w-4 inline ml-1" />;
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Projekte</h1>
        <p className="text-gray-600 mt-1">
          {filteredProjekte.length} von {projekte.length} Projekten
        </p>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Suche */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Suche nach Nummer, Name, Kunde, Ort..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Typ-Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={filterTyp}
              onChange={(e) => setFilterTyp(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="">Alle Typen</option>
              {Object.entries(PROJEKT_TYPEN).map(([key, label]) => (
                <option key={key} value={key}>{key} - {label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabelle */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleSort('nummer')}
                >
                  Nummer <SortIcon field="nummer" />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleSort('name')}
                >
                  Name <SortIcon field="name" />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleSort('kunde')}
                >
                  Kunde <SortIcon field="kunde" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Typ
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleSort('datum')}
                >
                  Datum <SortIcon field="datum" />
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProjekte.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Keine Projekte gefunden
                  </td>
                </tr>
              ) : (
                filteredProjekte.map((projekt) => {
                  const kunde = kunden[projekt.kunden_code];
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
                        <div className="text-sm text-gray-900 max-w-xs truncate" title={projekt.name}>
                          {projekt.name || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {kunde ? (
                          <div className="flex items-start gap-2">
                            <Building2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
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
                        {typ ? (
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            typ.key === 'REP'
                              ? 'bg-orange-100 text-orange-800'
                              : typ.key === 'HT'
                              ? 'bg-purple-100 text-purple-800'
                              : typ.key === 'DKF'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {typ.key}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="h-4 w-4" />
                          {projekt.datum
                            ? format(new Date(projekt.datum), 'dd.MM.yyyy')
                            : '-'}
                        </div>
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

export default Projekte;
