import { Invoice, LoadMap, LoadStatus } from '../types';

export const createLoadMap = (invoices: Invoice[]): LoadMap => {
  const id = Math.random().toString(36).substr(2, 9);
  const code = `MAP-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  
  return {
    id,
    code,
    carrierName: 'Não Atribuída',
    vehiclePlate: '---',
    sourceCity: 'Matriz Central',
    route: 'Nova Rota',
    googleMapsLink: '',
    status: LoadStatus.PLANNING,
    currentCity: 'Origem',
    logisticsNotes: '',
    createdAt: new Date().toISOString(),
    invoices,
    timeline: [],
  };
};

export const getStatusColor = (status: LoadStatus): string => {
    switch (status) {
        case LoadStatus.PLANNING: return 'bg-gray-200 text-gray-700';
        case LoadStatus.READY_FOR_SEPARATION: return 'bg-purple-100 text-purple-800 border border-purple-200';
        case LoadStatus.SEPARATION: 
        case LoadStatus.IN_SEPARATION:
            return 'bg-amber-100 text-amber-800 border border-amber-200';
        case LoadStatus.SEPARATED: return 'bg-teal-100 text-teal-800 border border-teal-200';
        case LoadStatus.SEPARATED_WITH_DIVERGENCE: return 'bg-red-100 text-red-800 border border-red-200';
        case LoadStatus.READY: return 'bg-blue-100 text-blue-800 border border-blue-200';
        case LoadStatus.COLLECTED: return 'bg-cyan-100 text-cyan-800 border border-cyan-200';
        case LoadStatus.IN_TRANSIT: return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
        case LoadStatus.DELIVERED: return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
        default: return 'bg-gray-100 text-gray-600';
    }
};