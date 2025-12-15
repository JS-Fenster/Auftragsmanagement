import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Building2, MapPin, Phone, Mail, FolderKanban, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

function Kunden() {
  const [kunden, setKunden] = useState([]);
  const [projekteCount, setProjekteCount] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKunde, setSelectedKunde] = useState(null);
  const [kundeProjekte, setKundeProjekte] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Kunden laden (mit Limit fuer Performance)
      const { data: kundenData } = await supabase
        .from('erp_kunden')
        .select('*')
        .order('firma1', { ascending: true })
        .limit(1000);

      // Projekte pro Kunde zaehlen
      const { data: projekte } = await supabase
        .from('erp_projekte')
        .select('kunden_code');

      const countMap = {};
      projekte?.forEach(p => {
        if (p.kunden_code) {
          countMap[p.kunden_code] = (countMap[p.kunden_code] || 0) + 1;
        }
      });

      setKunden(kundenData || []);
      setProjekteCount(countMap);
    } catch (error) {
      console.error('Fehler beim Laden der Kunden:', error);
    } finally {
      setLoading(false);
    }
  };

  // Projekte eines Kunden laden
  const loadKundeProjekte = async (kundenCode) => {
    try {
      const { data } = await supabase
        .from('erp_projekte')
        .select('code, nummer, name, datum')
        .eq('kunden_code', kundenCode)
        .order('datum', { ascending: false })
        .limit(10);

      setKundeProjekte(data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Kundenprojekte:', error);
    }
  };

  // Kunde auswaehlen
  const selectKunde = (kunde) => {
    if (selectedKunde?.code === kunde.code) {
      setSelectedKunde(null);
      setKundeProjekte([]);
    } else {
      setSelectedKunde(kunde);
      loadKundeProjekte(kunde.code);
    }
  };

  // Gefilterte Kunden
  const filteredKunden = useMemo(() => {
    if (!searchTerm) return kunden;

    const term = searchTerm.toLowerCase();
    return kunden.filter(k =>
      k.firma1?.toLowerCase().includes(term) ||
      k.firma2?.toLowerCase().includes(term) ||
      k.name?.toLowerCase().includes(term) ||
      k.ort?.toLowerCase().includes(term) ||
      k.plz?.includes(term)
    );
  }, [kunden, searchTerm]);

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
        <h1 className="text-3xl font-bold text-gray-900">Kunden</h1>
        <p className="text-gray-600 mt-1">
          {filteredKunden.length} von {kunden.length} Kunden
        </p>
      </div>

      {/* Suche */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Suche nach Firma, Name, Ort, PLZ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Kunden-Liste */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredKunden.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            Keine Kunden gefunden
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredKunden.slice(0, 100).map((kunde) => {
              const isSelected = selectedKunde?.code === kunde.code;
              const projektCount = projekteCount[kunde.code] || 0;

              return (
                <div key={kunde.code}>
                  <div
                    onClick={() => selectKunde(kunde)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Building2 className="h-5 w-5 text-gray-500" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {kunde.firma1 || kunde.name}
                          </div>
                          {kunde.firma2 && (
                            <div className="text-sm text-gray-600">{kunde.firma2}</div>
                          )}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                            {kunde.ort && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {kunde.plz} {kunde.ort}
                              </span>
                            )}
                            {kunde.telefon && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {kunde.telefon}
                              </span>
                            )}
                            {kunde.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {kunde.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {projektCount > 0 && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                            {projektCount} Projekt{projektCount !== 1 ? 'e' : ''}
                          </span>
                        )}
                        <ChevronRight
                          className={`h-5 w-5 text-gray-400 transition-transform ${
                            isSelected ? 'rotate-90' : ''
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Projekte des Kunden (aufgeklappt) */}
                  {isSelected && (
                    <div className="bg-gray-50 border-t border-gray-200 p-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <FolderKanban className="h-4 w-4" />
                        Projekte von {kunde.firma1 || kunde.name}
                      </h3>

                      {kundeProjekte.length === 0 ? (
                        <p className="text-sm text-gray-500">Keine Projekte vorhanden</p>
                      ) : (
                        <div className="space-y-2">
                          {kundeProjekte.map((projekt) => (
                            <Link
                              key={projekt.code}
                              to={`/projekte/${projekt.code}`}
                              className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 hover:border-blue-300 transition-colors"
                            >
                              <div>
                                <span className="font-medium text-blue-600">
                                  {projekt.nummer}
                                </span>
                                <span className="ml-2 text-sm text-gray-600">
                                  {projekt.name}
                                </span>
                              </div>
                              {projekt.datum && (
                                <span className="text-xs text-gray-500">
                                  {new Date(projekt.datum).toLocaleDateString('de-DE')}
                                </span>
                              )}
                            </Link>
                          ))}
                          {projektCount > 10 && (
                            <p className="text-xs text-gray-500 text-center pt-2">
                              + {projektCount - 10} weitere Projekte
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredKunden.length > 100 && (
              <div className="p-4 text-center text-sm text-gray-500 bg-gray-50">
                Zeige 100 von {filteredKunden.length} Kunden. Bitte Suche verwenden.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Kunden;
