export enum LoadStatus {
  PLANNING = 'Planejamento',
  READY_FOR_SEPARATION = 'Aguardando Separação',
  SEPARATION = 'Em Separação',
  IN_SEPARATION = 'Em Separação',
  SEPARATED = 'Separado',
  SEPARATED_WITH_DIVERGENCE = 'Separado com Divergência',
  READY = 'Pronto',
  COLLECTED = 'Coletado',
  IN_TRANSIT = 'Em Trânsito',
  DELIVERED = 'Entregue',
}

export type UserRole = 'ADMIN' | 'LOGISTICA_PLANEJAMENTO' | 'SEPARACAO' | 'STATUS_OPERACAO';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  password?: string;
}

export interface Product {
  sku: string;
  description: string;
  quantity: number;
  unit: string;
  weightKg: number;
  quantityPicked?: number;
}

export interface Invoice {
  id: string;
  number: string;
  customerName: string;
  customerCity: string;
  issueDate: string;
  documentDate: string;
  totalValue: number;
  totalWeight: number;
  items: Product[];
  isAssigned: boolean;
  isModified?: boolean;
  lastModifiedAt?: string;
  isCancelled?: boolean;
  apiHash?: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  status: LoadStatus;
  description: string;
  userId: string;
  userName: string;
}

export interface LoadMap {
  id: string;
  code: string;
  carrierName: string;
  vehiclePlate: string;
  sourceCity: string;
  route: string;
  googleMapsLink?: string;
  status: LoadStatus;
  currentCity: string;
  logisticsNotes: string;
  createdAt: string;
  invoices: Invoice[];
  timeline: TimelineEvent[];
}

export type ViewState =
  | 'LOGIN'
  | 'DASHBOARD'
  | 'INVOICE_SELECT'
  | 'LOAD_MAPS'
  | 'MAP_DETAIL'
  | 'SEPARATION_LIST'
  | 'SEPARATION_DETAIL'
  | 'OPERATION_LIST'
  | 'OPERATION_DETAIL'
  | 'ADMIN_USERS'
  | 'SETTINGS';

export interface SyncSummary {
  cancelledCount: number;
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
  errorsCount: number;
  lastSyncAt: string | null;
}

export const EMPTY_SYNC_SUMMARY: SyncSummary = {
  cancelledCount: 0,
  insertedCount: 0,
  updatedCount: 0,
  unchangedCount: 0,
  errorsCount: 0,
  lastSyncAt: null,
};