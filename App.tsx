import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { ProductModal } from './components/ProductModal';
import { UserFormModal } from './components/UserFormModal';
import { CARRIER_LIST } from './constants';
import { Invoice, LoadMap, ViewState, LoadStatus, User, UserRole } from './types';
import { createLoadMap, getStatusColor } from './services/loadService';
import { fetchErpInvoices } from './services/erpService';
import { supabase } from './services/supabase';
import { saveInvoicesToDatabase, loadInvoicesFromDatabase, updateInvoiceAssignedStatus } from './services/invoiceService';
import { saveLoadMapToDatabase, loadLoadMapsFromDatabase, deleteLoadMapFromDatabase } from './services/loadMapService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Plus, Search, Eye, Map as MapIcon, Calendar, Truck, Package, CheckCircle2, 
  AlertCircle, ArrowRight, TrendingUp, Box, Save, FileText, MapPin, Check, 
  Filter, XCircle, Building2, Navigation, Factory, Download, User as UserIcon,
  PlayCircle, CheckSquare, AlertTriangle, Clock, History, LogIn, Activity,
  Trash2, Edit, Shield, X, FileDown, DollarSign, Scale, RefreshCcw, MoreHorizontal,
  ChevronDown, ChevronUp, ChevronRight, ExternalLink, Database, Link, Lock, Wifi, Satellite, Key,
  ClipboardCheck, PackageCheck, AlertOctagon, UserPlus, ShieldCheck, Users, Loader2,
  TrendingDown, PieChart as PieChartIcon, Wallet, Weight, Server, Globe, Printer
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';



// ============================================================================
// View Component Props Interfaces
// ============================================================================

interface LoginViewProps {
  users: User[];
  setCurrentUser: (user: User | null) => void;
  setCurrentView: (view: ViewState) => void;
}

interface DashboardViewProps {
  loadMaps: LoadMap[];
  setCurrentView: (view: ViewState) => void;
  setSelectedMapId: (id: string | null) => void;
  getStatusColor: (status: LoadStatus) => string;
}

interface InvoiceSelectionViewProps {
  invoices: Invoice[];
  searchTerm: string;
  filterStartDate: string;
  filterEndDate: string;
  selectedInvoiceIds: Set<string>;
  setSelectedInvoiceIds: (ids: Set<string>) => void;
  setSearchTerm: (term: string) => void;
  setFilterStartDate: (date: string) => void;
  setFilterEndDate: (date: string) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  setViewingInvoice: (invoice: Invoice | null) => void;
  setInvoices: (invoices: Invoice[] | ((prev: Invoice[]) => Invoice[])) => void;
  setLoadMaps: (maps: LoadMap[] | ((prev: LoadMap[]) => LoadMap[])) => void;
  setSelectedMapId: (id: string | null) => void;
  setCurrentView: (view: ViewState) => void;
  createLoadMap: (invoices: Invoice[]) => LoadMap;
  updateInvoiceAssignedStatus: (ids: string[], status: boolean) => Promise<void>;
  saveLoadMapToDatabase: (map: LoadMap) => Promise<void>;
  formatCurrency: (value: number) => string;
  handleSyncErp: () => Promise<void>;
  isSyncing: boolean;
}

interface SettingsViewProps {
  apiConfig: { baseUrl: string; token: string; isActive: boolean };
  setApiConfig: (config: { baseUrl: string; token: string; isActive: boolean }) => void;
  isSyncing: boolean;
  syncError: string | null;
  handleSaveSettings: () => void;
  handleSyncErp: () => Promise<void>;
}

interface LoadMapsPlannerViewProps {
  loadMaps: LoadMap[];
  setSelectedMapId: (id: string | null) => void;
  setCurrentView: (view: ViewState) => void;
  getStatusColor: (status: LoadStatus) => string;
  getLoadProgress: (status: LoadStatus) => number;
  formatCurrency: (value: number) => string;
  getLogoAsBase64: () => Promise<string>;
}

interface SeparationListViewProps {
  loadMaps: LoadMap[];
  setSelectedMapId: (id: string | null) => void;
  setCurrentView: (view: ViewState) => void;
  getStatusColor: (status: LoadStatus) => string;
}

interface PlanningMapDetailViewProps {
  loadMaps: LoadMap[];
  selectedMapId: string | null;
  setLoadMaps: (maps: LoadMap[] | ((prev: LoadMap[]) => LoadMap[])) => void;
  setCurrentView: (view: ViewState) => void;
  addTimelineEvent: (mapId: string, status: LoadStatus, description: string) => Promise<void>;
  formatCurrency: (value: number) => string;
  getStatusColor: (status: LoadStatus) => string;
  getEmbedUrl: (input: string, fallbackRoute: string) => string | null;
  saveLoadMapToDatabase: (map: LoadMap) => Promise<void>;
  deleteLoadMapFromDatabase: (id: string) => Promise<void>;
  updateInvoiceAssignedStatus: (ids: string[], status: boolean) => Promise<void>;
  setInvoices: (invoices: Invoice[] | ((prev: Invoice[]) => Invoice[])) => void;
  getLogoAsBase64: () => Promise<string>;
}

interface SeparationDetailViewProps {
  loadMaps: LoadMap[];
  selectedMapId: string | null;
  setLoadMaps: (maps: LoadMap[] | ((prev: LoadMap[]) => LoadMap[])) => void;
  setCurrentView: (view: ViewState) => void;
  addTimelineEvent: (mapId: string, status: LoadStatus, description: string) => Promise<void>;
  formatCurrency: (value: number) => string;
  getStatusColor: (status: LoadStatus) => string;
  currentUser: User | null;
}

interface OperationListViewProps {
  loadMaps: LoadMap[];
  setSelectedMapId: (id: string | null) => void;
  setCurrentView: (view: ViewState) => void;
  getStatusColor: (status: LoadStatus) => string;
}

interface OperationDetailViewProps {
  loadMaps: LoadMap[];
  selectedMapId: string | null;
  setLoadMaps: (maps: LoadMap[] | ((prev: LoadMap[]) => LoadMap[])) => void;
  setCurrentView: (view: ViewState) => void;
  addTimelineEvent: (mapId: string, status: LoadStatus, description: string) => Promise<void>;
  formatCurrency: (value: number) => string;
  getStatusColor: (status: LoadStatus) => string;
  getEmbedUrl: (input: string, fallbackRoute: string) => string | null;
}

interface AdminUsersViewProps {
  users: User[];
  isUsersLoading: boolean;
  handleOpenNewUser: () => void;
  handleEditUser: (user: User) => void;
  handleDeleteUser: (userId: string) => Promise<void>;
  getRoleLabel: (role: UserRole) => string;
  getRoleColor: (role: UserRole) => string;
  currentUser: User | null;
}


// ============================================================================
// View Components
// ============================================================================

const LoginView: React.FC<LoginViewProps> = (props) => {
  const { users, setCurrentUser, setCurrentView } = props;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsLoading(true);

      setTimeout(async () => {
          const foundUser = users.find(u => 
              u.name.toLowerCase().includes(email.toLowerCase()) || 
              u.role.toLowerCase() === email.toLowerCase()
          );

          if (foundUser && password.length > 0) {
              setCurrentUser(foundUser);
              switch (foundUser.role) {
                  case 'ADMIN':
                  case 'LOGISTICA_PLANEJAMENTO':
                      setCurrentView('DASHBOARD');
                      break;
                  case 'SEPARACAO':
                      setCurrentView('SEPARATION_LIST');
                      break;
                  case 'STATUS_OPERACAO':
                      setCurrentView('OPERATION_LIST');
                      break;
              }
          } else {
              setError('Credenciais inválidas. Tente novamente.');
              setIsLoading(false);
          }
      }, 800);
  };

  return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 font-sans transition-colors duration-300">
          <div className="w-full max-w-[1400px] flex flex-col md:flex-row bg-surface rounded-3xl shadow-soft overflow-hidden min-h-[700px]">
              
              {/* Hero Section (Left) */}
              <div className="hidden md:flex md:w-5/12 bg-primary p-16 flex-col justify-between relative overflow-hidden text-white">
                  <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-16">
                           <img src="/assets/images/gcf_logo_05.png" alt="GCF Logística" className="h-16 w-auto brightness-0 invert" />
                      </div>
                      
                      <h1 className="text-6xl font-extrabold mb-8 leading-tight tracking-tight">
                          Gestão <br/><span className="text-accent">Inteligente.</span>
                      </h1>
                      <p className="text-slate-300 text-xl max-w-sm mb-12 font-medium leading-relaxed">
                          Otimize sua logística, integre seu ERP e rastreie cargas em tempo real.
                      </p>
                      
                      <div className="space-y-6">
                          <div className="flex items-center gap-4 text-lg font-medium text-slate-300">
                              <div className="p-2 bg-white/5 rounded-full border border-white/10"><CheckCircle2 className="text-accent" size={24} /></div>
                              <span>Monitoramento 24/7</span>
                          </div>
                          <div className="flex items-center gap-4 text-lg font-medium text-slate-300">
                              <div className="p-2 bg-white/5 rounded-full border border-white/10"><CheckCircle2 className="text-accent" size={24} /></div>
                              <span>Controle de Estoque</span>
                          </div>
                      </div>
                  </div>
                  
                  <div className="relative z-10 pt-12 opacity-40">
                       © {new Date().getFullYear()} GCF Logistics
                  </div>
              </div>

              {/* Form Section (Right) */}
              <div className="w-full md:w-7/12 p-12 md:p-24 flex flex-col justify-center bg-white">
                  <div className="max-w-md mx-auto w-full">
                      <div className="mb-12">
                          <div className="mb-8 md:hidden flex justify-center">
                              <img src="/assets/images/gcf_logo_05.png" alt="GCF Logística" className="h-12 w-auto" />
                          </div>
                          <h2 className="text-4xl font-black text-text-main mb-3">Bem-vindo</h2>
                          <p className="text-xl text-text-secondary">Insira suas credenciais para acessar.</p>
                      </div>

                      <form onSubmit={handleAuth} className="space-y-8">
                          <div className="space-y-3">
                              <label className="text-base font-bold text-text-main block">Usuário</label>
                              <div className="relative group">
                                  <input 
                                      type="text" 
                                      value={email}
                                      onChange={(e) => setEmail(e.target.value)}
                                      className="block w-full px-6 py-5 rounded-2xl bg-background border-2 border-transparent focus:border-primary/20 focus:bg-white text-xl text-text-main placeholder:text-text-light font-medium outline-none transition-all"
                                      placeholder="ex: admin"
                                      required
                                  />
                                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-text-light">
                                      <UserIcon size={24} />
                                  </div>
                              </div>
                          </div>

                          <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                  <label className="text-base font-bold text-text-main">Senha</label>
                              </div>
                              <div className="relative group">
                                  <input 
                                      type="password" 
                                      value={password}
                                      onChange={(e) => setPassword(e.target.value)}
                                      className="block w-full px-6 py-5 rounded-2xl bg-background border-2 border-transparent focus:border-primary/20 focus:bg-white text-xl text-text-main placeholder:text-text-light font-medium outline-none transition-all"
                                      placeholder="••••••••"
                                      required
                                  />
                                   <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-text-light">
                                      <Key size={24} />
                                  </div>
                              </div>
                          </div>

                          {error && (
                              <div className="p-4 bg-red-50 text-red-600 text-base font-bold rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-1">
                                  <AlertCircle size={20} /> {error}
                              </div>
                          )}

                          <button 
                              type="submit"
                              disabled={isLoading}
                              className="w-full bg-primary hover:bg-primaryLight text-white font-bold py-5 px-6 rounded-2xl shadow-lg shadow-primary/20 transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3 text-xl"
                          >
                              {isLoading ? (
                                  <>
                                      <RefreshCcw className="animate-spin" size={24} /> Entrando...
                                  </>
                              ) : (
                                  <>
                                      Acessar Painel <ArrowRight size={24} />
                                  </>
                              )}
                          </button>
                      </form>
                  </div>
              </div>
          </div>
      </div>
  );
};


const DashboardView: React.FC<DashboardViewProps> = (props) => {
  const { loadMaps, setCurrentView, setSelectedMapId, getStatusColor } = props;
  // ... (no changes in Dashboard logic, just rendering)
  const statusCounts = loadMaps.reduce((acc, map) => {
    acc[map.status] = (acc[map.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.values(LoadStatus).map(status => ({
    name: status,
    count: statusCounts[status] || 0
  })).filter(d => d.count > 0);

  const pieData = [
      { name: 'Em Trânsito', value: statusCounts[LoadStatus.IN_TRANSIT] || 0, color: '#10b981' },
      { name: 'Planejamento', value: statusCounts[LoadStatus.PLANNING] || 0, color: '#94a3b8' },
      { name: 'Separação', value: statusCounts[LoadStatus.SEPARATION] || statusCounts[LoadStatus.IN_SEPARATION] || 0, color: '#f59e0b' },
      { name: 'Entregue', value: statusCounts[LoadStatus.DELIVERED] || 0, color: '#0f172a' },
  ].filter(d => d.value > 0);

  const recentActivities = loadMaps
      .flatMap(m => m.timeline.map(t => ({...t, mapCode: m.code})))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);

  const StatCard = ({ title, value, icon: Icon, colorClass, trend }: any) => (
     <div className="flex flex-col gap-4 rounded-3xl p-8 bg-white shadow-soft hover:shadow-lg transition-all duration-300 border border-border/50 group">
        <div className="flex items-center justify-between">
           <div className="p-4 bg-background rounded-2xl text-text-secondary group-hover:text-primary transition-colors">
               <Icon size={32} />
           </div>
           <div className={`flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              {trend > 0 ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
              {Math.abs(trend)}%
           </div>
        </div>
        <div>
          <span className="text-base font-bold uppercase tracking-wide text-text-light">{title}</span>
          <p className={`text-6xl font-black mt-2 tracking-tight ${colorClass || 'text-text-main'}`}>{value}</p>
        </div>
     </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6 border-b border-border">
         <div>
            <h1 className="text-text-main text-5xl font-black leading-tight tracking-tight">Dashboard</h1>
            <div className="flex items-center gap-3 text-text-secondary mt-3">
               <Calendar size={24} />
               <p className="text-xl font-medium">{new Date().toLocaleDateString('pt-BR', {weekday: 'long', day: 'numeric', month: 'long'})}</p>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard title="Planejamento" value={statusCounts[LoadStatus.PLANNING] || 0} icon={MapIcon} trend={5} />
        <StatCard title="Separação" value={statusCounts[LoadStatus.IN_SEPARATION] || 0} icon={CheckSquare} colorClass="text-amber-600" trend={-2} />
        <StatCard title="Trânsito" value={statusCounts[LoadStatus.IN_TRANSIT] || 0} icon={Truck} colorClass="text-primary" trend={12} />
        <StatCard title="Entregues" value={statusCounts[LoadStatus.DELIVERED] || 0} icon={CheckCircle2} colorClass="text-accent" trend={8} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Bar Chart */}
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-soft p-10 border border-border/50">
              <h3 className="text-2xl font-bold text-text-main mb-10">Volume Operacional</h3>
              <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                          <XAxis dataKey="name" fontSize={14} tickLine={false} axisLine={false} dy={10} interval={0} tick={{fill: '#475569', fontWeight: 600}} />
                          <YAxis fontSize={14} tickLine={false} axisLine={false} allowDecimals={false} tick={{fill: '#475569', fontWeight: 600}} />
                          <Tooltip 
                              cursor={{fill: '#f8fafc'}}
                              contentStyle={{ 
                                  borderRadius: '16px', 
                                  border: 'none', 
                                  boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.1)', 
                                  padding: '20px',
                                  fontWeight: 'bold',
                                  color: '#0f172a'
                              }} 
                          />
                          <Bar dataKey="count" fill="#0f172a" radius={[12, 12, 0, 0]} barSize={60} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Side Content: Pie Chart & Activity */}
          <div className="space-y-8">
              <div className="bg-white rounded-3xl shadow-soft p-8 border border-border/50">
                  <h3 className="text-xl font-bold text-text-main mb-6 flex items-center gap-2"><PieChartIcon size={20}/> Distribuição</h3>
                  <div className="h-[250px]">
                       <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie
                                  data={pieData}
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={5}
                                  dataKey="value"
                              >
                                  {pieData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                              </Pie>
                              <Tooltip />
                              <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                          </PieChart>
                       </ResponsiveContainer>
                  </div>
              </div>

              <div className="bg-white rounded-3xl shadow-soft p-8 border border-border/50 flex-1">
                   <h3 className="text-xl font-bold text-text-main mb-6 flex items-center gap-2"><History size={20}/> Recentes</h3>
                   <div className="space-y-6">
                      {recentActivities.map(activity => (
                           <div key={activity.id} className="flex gap-4 items-start relative pl-4 border-l-2 border-slate-100">
                               <div className="absolute -left-[5px] top-1 size-2.5 rounded-full bg-slate-300"></div>
                               <div className="flex-1">
                                   <p className="text-sm font-bold text-text-main">{activity.mapCode}</p>
                                   <p className="text-xs text-text-secondary line-clamp-1">{activity.description}</p>
                                   <p className="text-[10px] text-text-light font-bold mt-1 uppercase">{new Date(activity.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                               </div>
                           </div>
                      ))}
                   </div>
              </div>
          </div>
      </div>
    </div>
  );
};


const InvoiceSelectionView: React.FC<InvoiceSelectionViewProps> = (props) => {
  const { invoices, searchTerm, filterStartDate, filterEndDate, selectedInvoiceIds, setSelectedInvoiceIds, setSearchTerm, setFilterStartDate, setFilterEndDate, showFilters, setShowFilters, setViewingInvoice, setInvoices, setLoadMaps, setSelectedMapId, setCurrentView, createLoadMap, updateInvoiceAssignedStatus, saveLoadMapToDatabase, formatCurrency, handleSyncErp, isSyncing } = props;
  const availableInvoices = useMemo(() => {
    let filtered = invoices.filter(inv => !inv.isAssigned);

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.number.toLowerCase().includes(term) ||
        inv.customerName.toLowerCase().includes(term) ||
        inv.customerCity.toLowerCase().includes(term)
      );
    }

    if (filterStartDate) {
      const startDate = new Date(filterStartDate);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(inv => {
        const invDate = new Date(inv.documentDate);
        invDate.setHours(0, 0, 0, 0);
        return invDate >= startDate;
      });
    }

    if (filterEndDate) {
      const endDate = new Date(filterEndDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(inv => {
        const invDate = new Date(inv.documentDate);
        return invDate <= endDate;
      });
    }

    return filtered;
  }, [invoices, searchTerm, filterStartDate, filterEndDate]);

  const toggleInvoice = (id: string) => {
    const next = new Set(selectedInvoiceIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedInvoiceIds(next);
  };

  const handleCreateMap = async () => {
    if (selectedInvoiceIds.size === 0) return;
    const selectedInvs = invoices.filter(inv => selectedInvoiceIds.has(inv.id));
    const newMap = createLoadMap(selectedInvs);
    setLoadMaps(prev => [newMap, ...prev]);
    setInvoices(prev => prev.map(inv => selectedInvoiceIds.has(inv.id) ? { ...inv, isAssigned: true } : inv));

    try {
      await updateInvoiceAssignedStatus(Array.from(selectedInvoiceIds), true);
      await saveLoadMapToDatabase(newMap);
    } catch (error) {
      console.error('Erro ao atualizar status das notas:', error);
    }

    setSelectedInvoiceIds(new Set());
    setSelectedMapId(newMap.id);
    setCurrentView('MAP_DETAIL');
  };

  const handleDownloadPickingList = () => {
    if (selectedInvoiceIds.size === 0) return;

    const selectedInvs = invoices.filter(inv => selectedInvoiceIds.has(inv.id));
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('Lista de Separação', 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);
    doc.text(`Total de Notas: ${selectedInvs.length}`, 14, 34);

    let yPosition = 45;

    selectedInvs.forEach((inv, invIndex) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(`NF: ${inv.number} - ${inv.customerName}`, 14, yPosition);
      yPosition += 6;

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Data NF: ${new Date(inv.documentDate).toLocaleDateString('pt-BR')} | Cidade: ${inv.customerCity}`, 14, yPosition);
      yPosition += 5;
      doc.text(`Valor Total: R$ ${inv.totalValue.toFixed(2)} | Peso Total: ${inv.totalWeight.toFixed(2)} kg`, 14, yPosition);
      yPosition += 8;

      const tableData = inv.items.map(item => [
        item.sku,
        item.description,
        item.quantity.toString(),
        item.unit,
        `${item.weightKg.toFixed(2)} kg`,
        ''
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['SKU', 'Descrição', 'Qtd', 'UN', 'Peso', 'Separado']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        margin: { left: 14, right: 14 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    });

    doc.save(`lista-separacao-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center pb-6 border-b border-border">
         <div>
           <h1 className="text-text-main text-5xl font-black leading-tight tracking-tight">Expedição</h1>
           <p className="text-text-secondary mt-2 text-xl">Selecione as notas para criar um novo mapa.</p>
         </div>
         <div className="flex gap-4">
              <button
               onClick={handleSyncErp}
               disabled={isSyncing}
               className="bg-white border-2 border-slate-200 text-text-secondary hover:text-primary hover:border-primary px-6 py-5 rounded-2xl font-bold text-lg transition-all flex items-center gap-3"
             >
               <RefreshCcw size={24} className={isSyncing ? "animate-spin" : ""} />
               {isSyncing ? "Sincronizando..." : "Sincronizar ERP"}
             </button>
             <button
               disabled={selectedInvoiceIds.size === 0}
               onClick={handleDownloadPickingList}
               className="bg-white border-2 border-slate-200 text-text-secondary hover:text-emerald-600 hover:border-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-5 rounded-2xl font-bold text-lg transition-all flex items-center gap-3"
             >
               <Download size={24} />
               Download Lista
             </button>
             <button
               disabled={selectedInvoiceIds.size === 0}
               onClick={handleCreateMap}
               className="bg-primary hover:bg-primaryLight disabled:opacity-50 disabled:cursor-not-allowed text-white px-10 py-5 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 transition-all flex items-center gap-3"
             >
               <MapIcon size={24} />
               Criar Mapa ({selectedInvoiceIds.size})
             </button>
         </div>
      </div>

      {syncError && (
           <div className="p-4 bg-red-50 text-red-600 font-bold rounded-2xl flex items-center gap-3 mb-6">
              <AlertCircle size={20} /> Falha na sincronização: {syncError}
           </div>
      )}

      <div className="bg-white rounded-3xl shadow-soft p-6 border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Filter size={24} className="text-primary" />
            <h3 className="text-xl font-bold text-text-main">Filtros</h3>
            <span className="text-sm text-text-light">({availableInvoices.length} notas encontradas)</span>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-text-secondary hover:bg-background transition-colors"
          >
            {showFilters ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            {showFilters ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
            <div className="md:col-span-1">
              <label className="text-sm font-bold text-text-secondary uppercase tracking-wide mb-2 block flex items-center gap-2">
                <Search size={16} /> Pesquisar
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="NF, Cliente ou Cidade..."
                className="w-full px-4 py-3 bg-background rounded-xl border-2 border-transparent focus:border-primary/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-text-secondary uppercase tracking-wide mb-2 block flex items-center gap-2">
                <Calendar size={16} /> Data Inicial
              </label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full px-4 py-3 bg-background rounded-xl border-2 border-transparent focus:border-primary/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-text-secondary uppercase tracking-wide mb-2 block flex items-center gap-2">
                <Calendar size={16} /> Data Final
              </label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full px-4 py-3 bg-background rounded-xl border-2 border-transparent focus:border-primary/20 outline-none transition-all"
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-6 py-2 bg-slate-100 hover:bg-slate-200 text-text-secondary rounded-xl font-bold transition-all"
              >
                <XCircle size={18} />
                Limpar Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3x













Resolver erro 

App.tsx:604 Uncaught ReferenceError: syncError is not defined
    at InvoiceSelectionView (App.tsx:604:8)
    at Object.react_stack_bottom_frame (react-dom_client.js?v=8f7622d5:18509:20)
    at renderWithHooks (react-dom_client.js?v=8f7622d5:5654:24)
    at updateFunctionComponent (react-dom_client.js?v=8f7622d5:7475:21)
    at beginWork (react-dom_client.js?v=8f7622d5:8525:20)
    at runWithFiberInDEV (react-dom_client.js?v=8f7622d5:997:72)
    at performUnitOfWork (react-dom_client.js?v=8f7622d5:12561:98)
    at workLoopSync (react-dom_client.js?v=8f7622d5:12424:43)
    at renderRootSync (react-dom_client.js?v=8f7622d5:12408:13)
    at performWorkOnRoot (react-dom_client.js?v=8f7622d5:11827:37)
InvoiceSelectionView @ App.tsx:604
react_stack_bottom_frame @ react-dom_client.js?v=8f7622d5:18509
renderWithHooks @ react-dom_client.js?v=8f7622d5:5654
updateFunctionComponent @ react-dom_client.js?v=8f7622d5:7475
beginWork @ react-dom_client.js?v=8f7622d5:8525
runWithFiberInDEV @ react-dom_client.js?v=8f7622d5:997
performUnitOfWork @ react-dom_client.js?v=8f7622d5:12561
workLoopSync @ react-dom_client.js?v=8f7622d5:12424
renderRootSync @ react-dom_client.js?v=8f7622d5:12408
performWorkOnRoot @ react-dom_client.js?v=8f7622d5:11827
performSyncWorkOnRoot @ react-dom_client.js?v=8f7622d5:13517
flushSyncWorkAcrossRoots_impl @ react-dom_client.js?v=8f7622d5:13414
processRootScheduleInMicrotask @ react-dom_client.js?v=8f7622d5:13437
(anônimo) @ react-dom_client.js?v=8f7622d5:13531
<InvoiceSelectionView>
exports.jsxDEV @ react_jsx-dev-runtime.js?v=8f7622d5:247
App @ App.tsx:2019
react_stack_bottom_frame @ react-dom_client.js?v=8f7622d5:18509
renderWithHooksAgain @ react-dom_client.js?v=8f7622d5:5729
renderWithHooks @ react-dom_client.js?v=8f7622d5:5665
updateFunctionComponent @ react-dom_client.js?v=8f7622d5:7475
beginWork @ react-dom_client.js?v=8f7622d5:8525
runWithFiberInDEV @ react-dom_client.js?v=8f7622d5:997
performUnitOfWork @ react-dom_client.js?v=8f7622d5:12561
workLoopSync @ react-dom_client.js?v=8f7622d5:12424
renderRootSync @ react-dom_client.js?v=8f7622d5:12408
performWorkOnRoot @ react-dom_client.js?v=8f7622d5:11827
performSyncWorkOnRoot @ react-dom_client.js?v=8f7622d5:13517
flushSyncWorkAcrossRoots_impl @ react-dom_client.js?v=8f7622d5:13414
processRootScheduleInMicrotask @ react-dom_client.js?v=8f7622d5:13437
(anônimo) @ react-dom_client.js?v=8f7622d5:13531
<App>
exports.jsxDEV @ react_jsx-dev-runtime.js?v=8f7622d5:247
(anônimo) @ index.tsx:13Entenda o erro
App.tsx:2019 An error occurred in the <InvoiceSelectionView> component.

Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://react.dev/link/error-boundaries to learn more about error boundaries.

Paginas em branco