import { ReviewStats } from '../lib/api';

interface StatsPanelProps {
  stats: ReviewStats | null;
  loading: boolean;
}

export function StatsPanel({ stats, loading }: StatsPanelProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // Calculate "Ampel" status
  const sonstigesPercent = parseFloat(stats.suspects_48h.sonstiges_percent);
  const ampelColor = sonstigesPercent > 30 ? 'bg-red-500' : sonstigesPercent > 15 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Review Status</h2>
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded-full ${ampelColor}`} title={`${stats.suspects_48h.sonstiges_percent}% Sonstiges in 48h`}></div>
          <span className="text-sm text-gray-600">{stats.suspects_48h.sonstiges_percent}% Sonstiges (48h)</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Pending Reviews */}
        <div className="bg-yellow-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-yellow-700">{stats.pending_reviews}</div>
          <div className="text-sm text-yellow-600">Ausstehend</div>
        </div>

        {/* Approved */}
        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-700">{stats.review_status.approved}</div>
          <div className="text-sm text-green-600">Bestaetigt</div>
        </div>

        {/* Corrected */}
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-700">{stats.review_status.corrected}</div>
          <div className="text-sm text-blue-600">Korrigiert</div>
        </div>

        {/* Errors */}
        <div className="bg-red-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-red-700">{stats.errors_total}</div>
          <div className="text-sm text-red-600">Fehler</div>
        </div>
      </div>

      {/* Suspects breakdown */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          Verdaechtig (48h):
          <span className="ml-2 font-medium">{stats.suspects_48h.sonstiges_dokument} Sonstiges_Dokument</span>
          <span className="ml-2 font-medium">{stats.suspects_48h.sonstiges_email} Sonstiges_Email</span>
        </div>
      </div>
    </div>
  );
}
