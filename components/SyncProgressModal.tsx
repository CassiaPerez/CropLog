import React from 'react';
import { Activity, Clock, CheckCircle2, XCircle } from 'lucide-react';
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
                <span className="text-xs text-gray-500">Notas</span>
              </div>
              <p className="text-lg font-bold text-gray-800">
                {progress.processedInvoices}
              </p>
            </div>
          </div>

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
