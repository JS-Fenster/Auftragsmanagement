import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL oder Key fehlt! Bitte .env pruefen.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Workflow-Status Konstanten
export const WORKFLOW_STATUS = [
  { value: 'angebot', label: 'Angebot', color: 'gray', bgColor: 'bg-gray-100', textColor: 'text-gray-800' },
  { value: 'auftrag', label: 'Auftrag erteilt', color: 'blue', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  { value: 'material_bestellt', label: 'Material bestellt', color: 'yellow', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
  { value: 'material_da', label: 'Material da', color: 'lime', bgColor: 'bg-lime-100', textColor: 'text-lime-800' },
  { value: 'montage_geplant', label: 'Montage geplant', color: 'purple', bgColor: 'bg-purple-100', textColor: 'text-purple-800' },
  { value: 'in_montage', label: 'In Montage', color: 'orange', bgColor: 'bg-orange-100', textColor: 'text-orange-800' },
  { value: 'montage_fertig', label: 'Montage fertig', color: 'teal', bgColor: 'bg-teal-100', textColor: 'text-teal-800' },
  { value: 'abnahme_ausstehend', label: 'Abnahme ausstehend', color: 'pink', bgColor: 'bg-pink-100', textColor: 'text-pink-800' },
  { value: 'abnahme_erfolgt', label: 'Abnahme erfolgt', color: 'emerald', bgColor: 'bg-emerald-100', textColor: 'text-emerald-800' },
  { value: 'rechnung_gestellt', label: 'Rechnung gestellt', color: 'indigo', bgColor: 'bg-indigo-100', textColor: 'text-indigo-800' },
  { value: 'bezahlt', label: 'Bezahlt', color: 'green', bgColor: 'bg-green-100', textColor: 'text-green-800' },
  { value: 'abgeschlossen', label: 'Abgeschlossen', color: 'slate', bgColor: 'bg-slate-100', textColor: 'text-slate-800' }
];

// Projekt-Typen aus Notiz-Feld
export const PROJEKT_TYPEN = {
  'DKF': 'Dreh-Kipp-Fenster',
  'HT': 'Haustuer',
  'IT': 'Innentuer',
  'VR': 'Vorbau-Rollladen',
  'RAFF': 'Raffstore',
  'ISS': 'Insektenschutz',
  'REP': 'Reparatur',
  'GT': 'Glastuer',
  'EA': 'Einzelauftrag'
};

// Helper: Status-Objekt aus Value holen
export function getStatusInfo(statusValue) {
  return WORKFLOW_STATUS.find(s => s.value === statusValue) || WORKFLOW_STATUS[0];
}

// Helper: Projekt-Typ aus Notiz extrahieren
export function getProjektTyp(notiz) {
  if (!notiz) return null;
  const upperNotiz = notiz.toUpperCase().trim();
  for (const [key, label] of Object.entries(PROJEKT_TYPEN)) {
    if (upperNotiz.startsWith(key)) {
      return { key, label };
    }
  }
  return null;
}
