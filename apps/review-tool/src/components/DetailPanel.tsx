import { useState } from 'react';
import { ReviewDocument, Categories, formatDate, getConfidenceColor, AdminReviewApi } from '../lib/api';
import { AttachmentList } from './AttachmentPreview';

interface DetailPanelProps {
  document: ReviewDocument | null;
  categories: Categories | null;
  api: AdminReviewApi;
  onUpdate: () => void;
}

export function DetailPanel({ document: doc, categories, api, onUpdate }: DetailPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEmailKategorie, setSelectedEmailKategorie] = useState<string>('');
  const [selectedKategorie, setSelectedKategorie] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!doc) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Dokument auswaehlen um Details zu sehen
      </div>
    );
  }

  const handleApprove = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      await api.updateLabel(doc.id, {
        action: 'approve',
        reviewed_by: 'admin',
      });
      setSuccess('Bestaetigt!');
      setTimeout(() => setSuccess(null), 2000);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Bestaetigen');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCorrect = async () => {
    if (!selectedEmailKategorie && !selectedKategorie) {
      setError('Bitte mindestens eine Kategorie auswaehlen');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await api.updateLabel(doc.id, {
        action: 'correct',
        email_kategorie_manual: selectedEmailKategorie || undefined,
        kategorie_manual: selectedKategorie || undefined,
        reviewed_by: 'admin',
      });
      setSuccess('Korrigiert!');
      setSelectedEmailKategorie('');
      setSelectedKategorie('');
      setTimeout(() => setSuccess(null), 2000);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Korrigieren');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentEmailKategorie = doc.email_kategorie_manual || doc.email_kategorie;
  const currentKategorie = doc.kategorie_manual || doc.kategorie;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b">
        <h3 className="text-lg font-medium text-gray-900 truncate" title={doc.email_betreff || ''}>
          {doc.email_betreff || '(kein Betreff)'}
        </h3>
        <div className="text-sm text-gray-500 mt-1">
          {doc.email_von_name && <span>{doc.email_von_name} </span>}
          <span className="text-gray-400">&lt;{doc.email_von_email}&gt;</span>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {formatDate(doc.created_at)} | Postfach: {doc.email_postfach}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Current Categories */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email-Kategorie (KI)
            </label>
            <div className="flex items-center gap-2">
              <span className="px-3 py-2 bg-gray-100 rounded-lg text-sm">
                {currentEmailKategorie || '-'}
              </span>
              {doc.email_kategorie_confidence !== null && (
                <span className={`text-sm font-medium ${getConfidenceColor(doc.email_kategorie_confidence)}`}>
                  {(doc.email_kategorie_confidence * 100).toFixed(0)}%
                </span>
              )}
              {doc.email_kategorie_manual && (
                <span className="text-xs text-blue-600">(manuell)</span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dokument-Kategorie
            </label>
            <div className="flex items-center gap-2">
              <span className="px-3 py-2 bg-gray-100 rounded-lg text-sm">
                {currentKategorie || '-'}
              </span>
              {doc.kategorie_manual && (
                <span className="text-xs text-blue-600">(manuell)</span>
              )}
            </div>
          </div>
        </div>

        {/* Processing Status */}
        {doc.processing_status === 'error' && doc.processing_last_error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="text-sm font-medium text-red-800">Verarbeitungsfehler:</div>
            <div className="text-sm text-red-600 mt-1">{doc.processing_last_error}</div>
          </div>
        )}

        {/* Review Status */}
        {doc.reviewed_at && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="text-sm text-green-800">
              Reviewed: {formatDate(doc.reviewed_at)} von {doc.reviewed_by}
            </div>
          </div>
        )}

        {/* Attachments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Anhaenge ({doc.email_anhaenge_count || 0})
          </label>
          <AttachmentList attachments={doc.email_anhaenge_meta} api={api} />
        </div>

        {/* Correction Form */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Korrektur</h4>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Email-Kategorie korrigieren
              </label>
              <select
                value={selectedEmailKategorie}
                onChange={(e) => setSelectedEmailKategorie(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Keine Aenderung --</option>
                {categories?.email_kategorien.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Dokument-Kategorie korrigieren
              </label>
              <select
                value={selectedKategorie}
                onChange={(e) => setSelectedKategorie(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Keine Aenderung --</option>
                {categories?.dokument_kategorien.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
              {success}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={isSubmitting || doc.review_status === 'approved'}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Bestaetigen
            </button>
            <button
              onClick={handleCorrect}
              disabled={isSubmitting || (!selectedEmailKategorie && !selectedKategorie)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Korrigieren
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
