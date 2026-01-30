import React from 'react';
import { X, PackageSearch } from 'lucide-react';
import { Invoice } from '../types';

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
                 <PackageSearch className="text-primary" size={28} />
             </div>
             <div>
                 <h2 className="text-xl font-bold text-[#0e121b]">Itens da Nota</h2>
                 <p className="text-base text-gray-500 font-medium">NF: {invoice.number}</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="p-0 overflow-y-auto flex-1">
          <table className="w-full text-left">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr className="border-b border-[#e7ebf3] text-[#4e6797]">
                <th className="py-4 px-8 text-sm font-bold uppercase tracking-wider">SKU</th>
                <th className="py-4 px-8 text-sm font-bold uppercase tracking-wider">Descrição</th>
                <th className="py-4 px-8 text-sm font-bold uppercase tracking-wider text-center">Unidade</th>
                <th className="py-4 px-8 text-sm font-bold uppercase tracking-wider text-right">Qtd</th>
                <th className="py-4 px-8 text-sm font-bold uppercase tracking-wider text-right">Peso (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7ebf3]">
              {invoice.items.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="py-5 px-8 text-base font-bold text-gray-600 font-mono">{item.sku}</td>
                  <td className="py-5 px-8 text-base font-medium text-[#0e121b]">{item.description}</td>
                  <td className="py-5 px-8 text-center text-base text-gray-500">{item.unit}</td>
                  <td className="py-5 px-8 text-right text-base font-bold text-[#0e121b]">{item.quantity}</td>
                  <td className="py-5 px-8 text-right text-base text-gray-600">{(item.weightKg * item.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-[#e7ebf3]">
                 <tr>
                    <td colSpan={3} className="py-5 px-8 text-base font-bold text-[#0e121b] text-right">Totais:</td>
                    <td className="py-5 px-8 text-right text-base font-bold text-primary">
                        {invoice.items.reduce((acc, i) => acc + i.quantity, 0)}
                    </td>
                     <td className="py-5 px-8 text-right text-base font-bold text-[#0e121b]">
                        {invoice.totalWeight.toFixed(2)} kg
                    </td>
                 </tr>
            </tfoot>
          </table>
        </div>

        <div className="p-6 border-t border-[#e7ebf3] bg-gray-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-[#111621] text-white rounded-lg hover:bg-black font-bold transition-all shadow-md text-base"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};