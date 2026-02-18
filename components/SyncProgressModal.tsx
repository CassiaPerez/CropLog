import React from 'react';
import { Activity, Clock, CheckCircle2, XCircle, Plus, RefreshCw, Minus, AlertCircle } from 'lucide-react';
import { SyncProgress } from '../services/erpService';

interface SyncProgressModalProps {
  isOpen: boolean;
  progress: SyncProgress | null;
  syncType: 'full' | 'incremental';
  onCancel?: () => void;
}

export const SyncProgressModal: React.FC<SyncProgressModalProps> = ({
  isOpen,
  progress,
  syncType,
  onCancel,
}) => {
  if (!isOpen || !progress) return null;

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.ceil(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-100 rounded-xl">
            <Activity className="w-6 h-6 text-blue-600 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Sincronizando com ERP
            </h2>
            <p className="text-sm text-gray-500">
              Sincronização {syncType === 'full' ? 'Completa' : 'Incremental'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-600">
                Progresso
              </span>
              <span className="text-sm font-bold text-blue-600">
                {Math.round(progress.percentage)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-300 ease-out"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>

          {progress.status && (
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-sm text-blue-800 font-medium">
                {progress.status}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-xs text-gray-500">Páginas</span>
              </div>
              <p className="text-lg font-bold text-gray-800">
                {progress.currentPage} / {progress.totalPages}
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-gray-500">Notas Processadas</span>
              </div>
              <p className="text-lg font-bold text-gray-800">
                {progress.processedInvoices}
              </p>
            </div>
          </div>

          {(progress.newInvoices !== undefined || progress.updatedInvoices !== undefined) && (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-600 mb-3">Detalhes da Sincronização</p>

              <div className="grid grid-cols-2 gap-3">
                {progress.newInvoices !== undefined && progress.newInvoices > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-green-100 rounded-lg">
                      <Plus className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Novas</p>
                      <p className="text-sm font-bold text-green-700">{progress.newInvoices}</p>
                    </div>
                  </div>
                )}

                {progress.updatedInvoices !== undefined && progress.updatedInvoices > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 rounded-lg">
                      <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Atualizadas</p>
                      <p className="text-sm font-bold text-blue-700">{progress.updatedInvoices}</p>
                    </div>
                  </div>
                )}

                {progress.unchangedInvoices !== undefined && progress.unchangedInvoices > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gray-200 rounded-lg">
                      <Minus className="w-3.5 h-3.5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Inalteradas</p>
                      <p className="text-sm font-bold text-gray-700">{progress.unchangedInvoices}</p>
                    </div>
                  </div>
                )}

                {progress.cancelledInvoices !== undefined && progress.cancelledInvoices > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-red-100 rounded-lg">
                      <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Canceladas</p>
                      <p className="text-sm font-bold text-red-700">{progress.cancelledInvoices}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {progress.estimatedTimeRemaining !== undefined && progress.estimatedTimeRemaining > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 rounded-xl p-3">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>
                Tempo estimado restante:{' '}
                <span className="font-semibold">
                  {formatTime(progress.estimatedTimeRemaining)}
                </span>
              </span>
            </div>
          )}

          {syncType === 'incremental' && progress.currentPage < progress.totalPages && progress.percentage >= 99 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-yellow-900 mb-1">
                    Sincronização Incremental Parou Cedo
                  </p>
                  <p className="text-xs text-yellow-800">
                    Foram processadas {progress.currentPage} de {progress.totalPages} páginas.
                    Use "Sincronização Completa" se precisar de todas as notas.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-6 w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <XCircle className="w-5 h-5" />
            Cancelar Sincronização
          </button>
        )}
      </div>
    </div>
  );
};
