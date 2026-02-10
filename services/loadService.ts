import { Invoice, LoadMap, LoadStatus } from '../types';

function randomUUID(): string {
  // Browser moderno
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  // Fallback simples UUID v4
  // (mantém o formato uuid para não quebrar o banco)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateMapCode(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(100 + Math.random() * 900); // 100..999
  return `MAP-${year}-${rand}`;
}

export function getStatusColor(status: LoadStatus): string {
  switch (status) {
    case LoadStatus.PLANNING:
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case LoadStatus.READY_FOR_SEPARATION:
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case LoadStatus.SEPARATION:
    case LoadStatus.IN_SEPARATION:
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case LoadStatus.SEPARATED:
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case LoadStatus.SEPARATED_WITH_DIVERGENCE:
      return 'bg-red-100 text-red-700 border-red-200';
    case LoadStatus.READY:
      return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    case LoadStatus.IN_TRANSIT:
      return 'bg-primary/10 text-primary border-primary/20';
    case LoadStatus.DELIVERED:
      return 'bg-slate-900 text-white border-slate-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function createLoadMap(invoices: Invoice[]): LoadMap {
  const now = new Date().toISOString();

  const map: LoadMap = {
    id: randomUUID(), // ✅ agora é UUID
    code: generateMapCode(),
    status: LoadStatus.PLANNING,
    carrierName: '',
    vehiclePlate: '',
    sourceCity: 'Matriz Central',
    route: '',
    googleMapsLink: '',
    currentCity: '',
    logisticsNotes: '',
    invoices,
    timeline: [
      {
        id: `evt-${Date.now()}`,
        timestamp: now,
        status: LoadStatus.PLANNING,
        description: `Mapa criado com ${invoices.length} nota(s).`,
        userId: 'system',
        userName: 'Sistema',
      },
    ],
  };

  return map;
}