import React from 'react';
import { X, Package, Weight } from 'lucide-react';
import type { Invoice } from '../types';

interface ProductModalProps {
  invoice: Invoice | null;
  onClose: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({ invoice, onClose }) => {
  if (!invoice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111621]/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] border border-[#e7ebf3]">
        <div className="flex items-center justify-between p-8 bg-white border-b border-[#e7ebf3]">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 shadow-sm">
              <Package className="text-primary" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0e121b]">
                Nota Fiscal {invoice.number}
              </h2>
              <p className="text-base text-gray-500 font-medium">
                {invoice.customerName} - {invoice.customerCity}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
            aria-label="Fechar"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-xl border border-[#e7ebf3]">
              <p className="text-xs font-bold uppercase tracking-wider text-[#4e6797] mb-1">Total de Itens</p>
              <p className="text-2xl font-bold text-[#0e121b]">
                {invoice.items.reduce((acc, item) => acc + item.quantity, 0)}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-[#e7ebf3]">
              <p className="text-xs font-bold uppercase tracking-wider text-[#4e6797] mb-1">Peso Total</p>
              <p className="text-2xl font-bold text-[#0e121b]">
                {invoice.totalWeight.toFixed(2)} kg
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-[#e7ebf3]">
              <p className="text-xs font-bold uppercase tracking-wider text-[#4e6797] mb-1">Valor Total</p>
              <p className="text-2xl font-bold text-[#0e121b]">
                R$ {invoice.totalValue.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#4e6797] mb-4">Produtos</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e7ebf3]">
                    <th className="text-left p-3 text-xs font-bold uppercase tracking-wider text-[#4e6797]">SKU</th>
                    <th className="text-left p-3 text-xs font-bold uppercase tracking-wider text-[#4e6797]">Descrição</th>
                    <th className="text-center p-3 text-xs font-bold uppercase tracking-wider text-[#4e6797]">Qtd</th>
                    <th className="text-center p-3 text-xs font-bold uppercase tracking-wider text-[#4e6797]">Unidade</th>
                    <th className="text-right p-3 text-xs font-bold uppercase tracking-wider text-[#4e6797]">Peso</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-[#e7ebf3] hover:bg-gray-50 transition-colors">
                      <td className="p-3 font-mono text-sm font-bold text-[#0e121b]">{item.sku}</td>
                      <td className="p-3 text-sm text-gray-700">{item.description}</td>
                      <td className="p-3 text-center text-sm font-bold text-[#0e121b]">{item.quantity}</td>
                      <td className="p-3 text-center text-sm text-gray-600">{item.unit}</td>
                      <td className="p-3 text-right font-mono text-sm font-bold text-[#0e121b]">{item.weightKg.toFixed(2)} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="p-8 bg-gray-50 border-t border-[#e7ebf3] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-[#111621] text-white rounded-lg hover:bg-black font-bold transition-all shadow-md"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
