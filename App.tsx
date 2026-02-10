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
  syncError: string | null; // Corrigido aqui
}

// ... Demais interfaces (SettingsViewProps, AdminUsersViewProps, etc) devem seguir o mesmo padrão

// ============================================================================
// View Components
// ============================================================================

const LoginView: React.FC<LoginViewProps> = ({ users, setCurrentUser, setCurrentView }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    // Lógica de simulação de login
    setTimeout(() => {
      const foundUser = users.find(u => u.name.toLowerCase() === email.toLowerCase());
      if (foundUser) {
        setCurrentUser(foundUser);
        setCurrentView('DASHBOARD');
      } else {
        setError('Usuário não encontrado');
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-[1000px] flex bg-white rounded-3xl shadow-soft overflow-hidden">
            <div className="hidden md:flex w-1/2 bg-primary p-12 flex-col justify-center text-white">
                <h1 className="text-4xl font-black mb-4">GCF Logística</h1>
                <p className="text-slate-300">Sistema integrado de gestão de faturamento e expedição.</p>
            </div>
            <div className="w-full md:w-1/2 p-12">
                <h2 className="text-2xl font-bold mb-8">Login</h2>
                <form onSubmit={handleAuth} className="space-y-6">
                    <input 
                      type="text" 
                      placeholder="Usuário" 
                      className="w-full p-4 bg-slate-50 rounded-xl outline-none" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <input 
                      type="password" 
                      placeholder="Senha" 
                      className="w-full p-4 bg-slate-50 rounded-xl outline-none"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button className="w-full bg-primary text-white p-4 rounded-xl font-bold hover:bg-primaryLight transition-all">
                        Acessar Sistema
                    </button>
                </form>
            </div>
        </div>
    </div>
  );
};

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
    await saveLoadMapToDatabase(newMap);
    setSelectedMapId(newMap.id);
    setCurrentView('DASHBOARD');
  };

  return (
    <div className="space-y-8 p-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center pb-6 border-b">
         <div>
           <h1 className="text-4xl font-black text-text-main">Expedição</h1>
           <p className="text-text-secondary mt-2">Selecione as notas para criar um mapa de carga.</p>
         </div>
         <div className="flex gap-4">
              <button onClick={handleSyncErp} disabled={isSyncing} className="bg-white border-2 px-6 py-4 rounded-2xl font-bold flex items-center gap-3">
               <RefreshCcw size={20} className={isSyncing ? "animate-spin" : ""} />
               Sincronizar ERP
             </button>
             <button disabled={selectedInvoiceIds.size === 0} onClick={handleCreateMap} className="bg-primary text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 shadow-lg shadow-primary/20">
               <MapIcon size={20} />
               Criar Mapa ({selectedInvoiceIds.size})
             </button>
         </div>
      </div>

      {syncError && (
           <div className="p-4 bg-red-50 text-red-600 font-bold rounded-2xl flex items-center gap-3">
              <AlertCircle size={20} /> Erro: {syncError}
           </div>
      )}

      <div className="bg-white rounded-3xl shadow-soft overflow-hidden border">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-6 w-10">
                 <input type="checkbox" className="size-5" onChange={(e) => {
                   if (e.target.checked) setSelectedInvoiceIds(new Set(availableInvoices.map(i => i.id)));
                   else setSelectedInvoiceIds(new Set());
                 }} />
              </th>
              <th className="p-6 text-sm font-bold text-text-secondary">NF</th>
              <th className="p-6 text-sm font-bold text-text-secondary">CLIENTE</th>
              <th className="p-6 text-sm font-bold text-text-secondary">CIDADE</th>
              <th className="p-6 text-sm font-bold text-text-secondary text-right">VALOR</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {availableInvoices.map(inv => (
              <tr key={inv.id} onClick={() => toggleInvoice(inv.id)} className={`hover:bg-slate-50 cursor-pointer ${selectedInvoiceIds.has(inv.id) ? 'bg-primary/5' : ''}`}>
                <td className="p-6"><input type="checkbox" checked={selectedInvoiceIds.has(inv.id)} readOnly className="size-5" /></td>
                <td className="p-6 font-bold">{inv.number}</td>
                <td className="p-6">{inv.customerName}</td>
                <td className="p-6">{inv.customerCity}</td>
                <td className="p-6 text-right font-bold text-primary">{formatCurrency(inv.totalValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

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
      setSyncError('Erro ao conectar com o servidor ERP.');
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
          {currentView === 'DASHBOARD' && <DashboardView loadMaps={loadMaps} setCurrentView={setCurrentView} setSelectedMapId={() => {}} getStatusColor={getStatusColor} />}
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
              syncError={syncError}
            />
          )}
        </Layout>
      )}
    </div>
  );
}