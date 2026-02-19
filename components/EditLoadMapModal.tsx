import React, { useState, useMemo } from 'react';
import { X, Plus, Search, Package } from 'lucide-react';
import { LoadMap, Invoice } from '../types';

interface EditLoadMapModalProps {
  loadMap: LoadMap;
  availableInvoices: Invoice[];
  onClose: () => void;
  onSave: (updatedLoadMap: LoadMap) => Promise<void>;
}

export function EditLoadMapModal({
  loadMap,
  availableInvoices,
  onClose,
  onSave,
}: EditLoadMapModalProps) {
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const currentInvoiceIds = new Set(loadMap.invoices.map(inv => inv.id));

  const filteredInvoices = useMemo(() => {
    return availableInvoices.filter(invoice => {
      if (currentInvoiceIds.has(invoice.id)) return false;

      const searchLower = searchTerm.toLowerCase();
      return (
        invoice.number.toLowerCase().includes(searchLower) ||
        invoice.customerName.toLowerCase().includes(searchLower) ||
        invoice.customerCity.toLowerCase().includes(searchLower)
      );
    });
  }, [availableInvoices, searchTerm, currentInvoiceIds]);

  const toggleInvoiceSelection = (invoiceId: string) => {
    const newSelection = new Set(selectedInvoiceIds);
    if (newSelection.has(invoiceId)) {
      newSelection.delete(invoiceId);
    } else {
      newSelection.add(invoiceId);
    }
    setSelectedInvoiceIds(newSelection);
  };

  const handleSave = async () => {
    if (selectedInvoiceIds.size === 0) {
      alert('Selecione pelo menos uma nota fiscal para adicionar');
      return;
    }

    setIsSaving(true);
    try {
      const invoicesToAdd = availableInvoices.filter(inv =>
        selectedInvoiceIds.has(inv.id)
      );

      const updatedLoadMap: LoadMap = {
        ...loadMap,
        invoices: [...loadMap.invoices, ...invoicesToAdd],
      };

      await onSave(updatedLoadMap);
      onClose();
    } catch (error) {
      console.error('Erro ao adicionar notas:', error);
      alert('Erro ao adicionar notas fiscais ao mapa de carga');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedInvoicesData = useMemo(() => {
    return availableInvoices.filter(inv => selectedInvoiceIds.has(inv.id));
  }, [availableInvoices, selectedInvoiceIds]);

  const totalNewWeight = selectedInvoicesData.reduce((sum, inv) => sum + inv.totalWeight, 0);
  const totalNewValue = selectedInvoicesData.reduce((sum, inv) => sum + inv.totalValue, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Adicionar Notas ao Mapa {loadMap.code}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Selecione notas fiscais disponíveis para adicionar ao mapa de carga
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 border-b bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por número, cliente ou cidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {selectedInvoiceIds.size > 0 && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-sm text-gray-600">Notas selecionadas</p>
                    <p className="text-2xl font-bold text-blue-700">{selectedInvoiceIds.size}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Peso total</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {totalNewWeight.toFixed(2)} kg
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Valor total</p>
                    <p className="text-2xl font-bold text-blue-700">
                      R$ {totalNewValue.toFixed(2)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedInvoiceIds(new Set())}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Limpar seleção
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <Package size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 text-lg">
                {searchTerm
                  ? 'Nenhuma nota fiscal encontrada com esse filtro'
                  : 'Não há notas fiscais disponíveis para adicionar'}
              </p>
              {!searchTerm && (
                <p className="text-gray-500 text-sm mt-2">
                  Todas as notas não atribuídas já estão neste mapa
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredInvoices.map((invoice) => {
                const isSelected = selectedInvoiceIds.has(invoice.id);
                return (
                  <button
                    key={invoice.id}
                    onClick={() => toggleInvoiceSelection(invoice.id)}
                    className={`text-left p-4 border-2 rounded-lg transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-gray-300'
                            }`}
                          >
                            {isSelected && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="3"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path d="M5 13l4 4L19 7"></path>
                              </svg>
                            )}
                          </div>
                          <span className="font-bold text-gray-900">NF {invoice.number}</span>
                        </div>
                        <div className="mt-2 ml-8 space-y-1">
                          <p className="text-sm font-medium text-gray-700">
                            {invoice.customerName}
                          </p>
                          <p className="text-sm text-gray-600">{invoice.customerCity}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {[...new Set(invoice.items.map(i => i.lote).filter(Boolean))].map(lote => (
                              <span key={lote} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-mono font-bold">{lote}</span>
                            ))}
                            {[...new Set(invoice.items.map(i => i.unit).filter(Boolean))].map(unit => (
                              <span key={unit} className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded text-xs font-bold">{unit}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-bold text-gray-900">
                          {invoice.totalWeight.toFixed(2)} kg
                        </p>
                        <p className="text-sm text-gray-600">
                          R$ {invoice.totalValue.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {invoice.items.length} {invoice.items.length === 1 ? 'item' : 'itens'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={selectedInvoiceIds.size === 0 || isSaving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Plus size={20} />
                Adicionar {selectedInvoiceIds.size} {selectedInvoiceIds.size === 1 ? 'Nota' : 'Notas'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
