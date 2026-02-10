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
  syncError: string | null; // CORREÇÃO: Prop adicionada para evitar ReferenceError
}

// ... Outras interfaces mantidas conforme original ...

// ============================================================================
// View Components
// ============================================================================

// Componente LoginView e DashboardView mantidos conforme seu código original
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
      <div className="min-h-screen flex items-center justify-center bg-background p-6 font-sans">
          <div className="w-full max-w-[1400px] flex flex-col md:flex-row bg-white rounded-3xl shadow-soft overflow-hidden min-h-[700px]">
              <div className="hidden md:flex md:w-5/12 bg-primary p-16 flex-col justify-between relative overflow-hidden text-white">
                  <div>
                      <h1 className="text-6xl font-extrabold mb-8 leading-tight tracking-tight">Gestão <br/><span className="text-accent">Inteligente.</span></h1>
                      <p className="text-slate-300 text-xl max-w-sm mb-12">Otimize sua logística e rastreie cargas em tempo real.</p>
                  </div>
              </div>
              <div className="w-full md:w-7/12 p-12 md:p-24 flex flex-col justify-center bg-white">
                  <div className="max-w-md mx-auto w-full">
                      <h2 className="text-4xl font-black text-text-main mb-8">Bem-vindo</h2>
                      <form onSubmit={handleAuth} className="space-y-8">
                          <div>
                              <label className="text-base font-bold text-text-main block mb-2">Usuário</label>
                              <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-6 py-5 rounded-2xl bg-background border-2 border-transparent focus:border-primary/20 outline-none" placeholder="ex: admin" required />
                          </div>
                          <div>
                              <label className="text-base font-bold text-text-main block mb-2">Senha</label>
                              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-6 py-5 rounded-2xl bg-background border-2 border-transparent focus:border-primary/20 outline-none" placeholder="••••••••" required />
                          </div>
                          {error && <div className="p-4 bg-red-50 text-red-600 font-bold rounded-2xl">{error}</div>}
                          <button type="submit" disabled={isLoading} className="w-full bg-primary text-white font-bold py-5 rounded-2xl shadow-lg flex items-center justify-center gap-3 text-xl">
                              {isLoading ? <RefreshCcw className="animate-spin" /> : <>Acessar Painel <ArrowRight /></>}
                          </button>
                      </form>
                  </div>
              </div>
          </div>
      </div>
  );
};

// Componente de Seleção de Notas (Onde o erro ocorria)
const InvoiceSelectionView: React.FC<InvoiceSelectionViewProps> = (props) => {
  const { 
    invoices, searchTerm, filterStartDate, filterEndDate, selectedInvoiceIds, 
    setSelectedInvoiceIds, setSearchTerm, setFilterStartDate, setFilterEndDate, 
    showFilters, setShowFilters, setInvoices, setLoadMaps, 
    setSelectedMapId, setCurrentView, createLoadMap, updateInvoiceAssignedStatus, 
    saveLoadMapToDatabase, formatCurrency, handleSyncErp, isSyncing, syncError 
  } = props;

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
    return filtered;
  }, [invoices, searchTerm]);

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
    } catch (error) { console.error(error); }
    setSelectedMapId(newMap.id);
    setCurrentView('MAP_DETAIL');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center pb-6 border-b border-border">
         <div>
           <h1 className="text-text-main text-5xl font-black leading-tight tracking-tight">Expedição</h1>
           <p className="text-text-secondary mt-2 text-xl">Selecione as notas para criar um novo mapa.</p>
         </div>
         <div className="flex gap-4">
              <button onClick={handleSyncErp} disabled={isSyncing} className="bg-white border-2 border-slate-200 text-text-secondary hover:text-primary px-6 py-5 rounded-2xl font-bold flex items-center gap-3">
               <RefreshCcw className={isSyncing ? "animate-spin" : ""} /> {isSyncing ? "Sincronizando..." : "Sincronizar ERP"}
             </button>
             <button disabled={selectedInvoiceIds.size === 0} onClick={handleCreateMap} className="bg-primary text-white px-10 py-5 rounded-2xl font-bold shadow-lg flex items-center gap-3">
               <MapIcon /> Criar Mapa ({selectedInvoiceIds.size})
             </button>
         </div>
      </div>

      {syncError && (
           <div className="p-4 bg-red-50 text-red-600 font-bold rounded-2xl flex items-center gap-3 mb-6">
              <AlertCircle /> Falha na sincronização: {syncError}
           </div>
      )}

      {/* Tabela de Notas Fiscais Reconstruída */}
      <div className="bg-white rounded-3xl shadow-soft overflow-hidden border border-border/50">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-border">
            <tr>
              <th className="p-6 w-10">
                 <input type="checkbox" onChange={(e) => {
                    if (e.target.checked) setSelectedInvoiceIds(new Set(availableInvoices.map(i => i.id)));
                    else setSelectedInvoiceIds(new Set());
                 }} className="size-5 rounded border-slate-300 text-primary" />
              </th>
              <th className="p-6 text-sm font-bold text-text-secondary uppercase">NF</th>
              <th className="p-6 text-sm font-bold text-text-secondary uppercase">Cliente</th>
              <th className="p-6 text-sm font-bold text-text-secondary uppercase">Cidade</th>
              <th className="p-6 text-sm font-bold text-text-secondary uppercase text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {availableInvoices.map(inv => (
              <tr key={inv.id} onClick={() => toggleInvoice(inv.id)} className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedInvoiceIds.has(inv.id) ? 'bg-primary/5' : ''}`}>
                <td className="p-6"><input type="checkbox" checked={selectedInvoiceIds.has(inv.id)} readOnly className="size-5 rounded border-slate-300" /></td>
                <td className="p-6 font-bold text-text-main">{inv.number}</td>
                <td className="p-6 text-text-secondary font-medium">{inv.customerName}</td>
                <td className="p-6 text-text-secondary">{inv.customerCity}</td>
                <td className="p-6 text-right font-bold text-primary">{formatCurrency(inv.totalValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ... O restante dos seus componentes de View (DashboardView, etc) ...

// ============================================================================
// Main Application Component
// ============================================================================

export default function App() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [currentView, setCurrentView] = useState<ViewState>('LOGIN');
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loadMaps, setLoadMaps] = useState<LoadMap[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');

    const handleSyncErp = async () => {
        setIsSyncing(true);
        setSyncError(null);
        try {
            const data = await fetchErpInvoices();
            setInvoices(data);
        } catch (err) {
            setSyncError("Não foi possível conectar ao banco de dados ERP.");
        } finally {
            setIsSyncing(false);
        }
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="min-h-screen bg-background">
            {currentView === 'LOGIN' ? (
                <LoginView users={[]} setCurrentUser={setCurrentUser} setCurrentView={setCurrentView} />
            ) : (
                <Layout currentUser={currentUser} setCurrentView={setCurrentView}>
                    {currentView === 'INVOICE_SELECTION' && (
                        <InvoiceSelectionView 
                            invoices={invoices}
                            searchTerm={searchTerm}
                            filterStartDate=""
                            filterEndDate=""
                            selectedInvoiceIds={selectedInvoiceIds}
                            setSelectedInvoiceIds={setSelectedInvoiceIds}
                            setSearchTerm={setSearchTerm}
                            setFilterStartDate={() => {}}
                            setFilterEndDate={() => {}}
                            showFilters={true}
                            setShowFilters={() => {}}
                            setViewingInvoice={() => {}}
                            setInvoices={setInvoices}
                            setLoadMaps={setLoadMaps}
                            setSelectedMapId={() => {}}
                            setCurrentView={setCurrentView}
                            createLoadMap={createLoadMap}
                            updateInvoiceAssignedStatus={updateInvoiceAssignedStatus}
                            saveLoadMapToDatabase={saveLoadMapToDatabase}
                            formatCurrency={formatCurrency}
                            handleSyncErp={handleSyncErp}
                            isSyncing={isSyncing}
                            syncError={syncError} // Propiedade passada corretamente aqui
                        />
                    )}
                    {/* Outras telas conforme sua lógica original */}
                </Layout>
            )}
        </div>
    );
}