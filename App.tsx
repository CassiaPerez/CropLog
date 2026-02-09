import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { ProductModal } from './components/ProductModal';
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

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('LOGIN');
  
  // Data State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadMaps, setLoadMaps] = useState<LoadMap[]>([]);
  
  // User Management State
  const [users, setUsers] = useState<User[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormName, setUserFormName] = useState('');
  const [userFormRole, setUserFormRole] = useState<UserRole>('STATUS_OPERACAO');

  // Settings State
  const [apiConfig, setApiConfig] = useState({
      baseUrl: 'https://arabella-pulverable-davon.ngrok-free.dev/api/Faturamento_Backlog_Wonder?nome_fixo=Faturamento_Backlog_Wonder&page=1&limit=1000&format=json&api_key=a4d8c7f12e3b4c9a9f6e9e2a1b4d7c8f2a3e6d1f8b9c0a2e5f7a8d9c3e4b',
      token: 'a4d8c7f12e3b4c9a9f6e9e2a1b4d7c8f2a3e6d1f8b9c0a2e5f7a8d9c3e4b',
      isActive: false
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Selection State
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);

  // --- Effects ---

  useEffect(() => {
    fetchUsers();
    loadInvoices();
    loadLoadMaps();
    const savedConfig = localStorage.getItem('erp_config');
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        setApiConfig(config);
        if (config.baseUrl && config.isActive) {
          performAutoSync(config.baseUrl, config.token);
        }
    }
  }, []);

  useEffect(() => {
    if (!apiConfig.baseUrl || !apiConfig.isActive) return;

    const intervalId = setInterval(() => {
      performAutoSync(apiConfig.baseUrl, apiConfig.token);
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [apiConfig.baseUrl, apiConfig.token, apiConfig.isActive]);

  const fetchUsers = async () => {
    setIsUsersLoading(true);
    try {
      const { data, error } = await supabase.from('app_users').select('*').order('name');
      if (error) {
        console.error('Erro ao carregar usuários:', error);
      } else {
        setUsers(data as User[]);
      }
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
    } finally {
      setIsUsersLoading(false);
    }
  };

  const loadInvoices = async () => {
    try {
      console.log('Carregando notas do banco de dados...');
      const loadedInvoices = await loadInvoicesFromDatabase();
      console.log(`Carregadas ${loadedInvoices.length} notas do banco`);
      setInvoices(loadedInvoices);
    } catch (error) {
      console.error('Erro ao carregar notas do banco:', error);
    }
  };

  const loadLoadMaps = async () => {
    try {
      console.log('Carregando mapas de carga do banco de dados...');
      const loadedMaps = await loadLoadMapsFromDatabase();
      console.log(`Carregados ${loadedMaps.length} mapas do banco`);
      setLoadMaps(loadedMaps);
    } catch (error) {
      console.error('Erro ao carregar mapas do banco:', error);
    }
  };

  const performAutoSync = async (baseUrl: string, token: string) => {
    try {
      const newInvoices = await fetchErpInvoices(baseUrl, token);
      await saveInvoicesToDatabase(newInvoices);
      const updatedInvoices = await loadInvoicesFromDatabase();
      setInvoices(updatedInvoices);
    } catch (error) {
      console.error('Erro na sincronização automática:', error);
    }
  };

  // --- Helpers ---
  const getEmbedUrl = (input: string, fallbackRoute: string) => {
    try {
        let query = input;
        if (!query && fallbackRoute) query = fallbackRoute;
        if (!query) return null;
        if (query.includes('output=embed')) return query;
        if (query.startsWith('http')) {
             try {
                const url = new URL(query);
                if (url.pathname.includes('/dir/')) {
                     const parts = url.pathname.split('/dir/');
                     if (parts[1]) {
                        const pathParts = parts[1].split('/').filter(p => p);
                        if (pathParts.length >= 2) {
                             return `https://maps.google.com/maps?saddr=${pathParts[0]}&daddr=${pathParts[1]}&output=embed`;
                        }
                     }
                }
                if (url.searchParams.has('q')) query = url.searchParams.get('q')!;
                else if (url.searchParams.has('destination')) query = url.searchParams.get('destination')!;
                else if (fallbackRoute) query = fallbackRoute;
             } catch (e) {
                 if (fallbackRoute) query = fallbackRoute;
             }
        }
        return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=13&ie=UTF8&iwloc=&output=embed`;
    } catch {
        return null;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getLogoAsBase64 = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          reject(new Error('Failed to get canvas context'));
        }
      };
      img.onerror = reject;
      img.src = '/assets/images/gcf_logo_05.png';
    });
  };

  const getLoadProgress = (status: LoadStatus): number => {
      switch (status) {
          case LoadStatus.PLANNING: return 10;
          case LoadStatus.READY_FOR_SEPARATION: return 25;
          case LoadStatus.SEPARATION:
          case LoadStatus.IN_SEPARATION: return 40;
          case LoadStatus.SEPARATED: 
          case LoadStatus.SEPARATED_WITH_DIVERGENCE: return 55;
          case LoadStatus.READY: return 70;
          case LoadStatus.IN_TRANSIT: return 85;
          case LoadStatus.DELIVERED: return 100;
          default: return 0;
      }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('LOGIN');
  };

  // --- API Handlers ---

  const handleSyncErp = async () => {
      if (!apiConfig.baseUrl) {
          alert("Configure a URL da API nas configurações.");
          setCurrentView('SETTINGS');
          return;
      }

      setIsSyncing(true);
      setSyncError(null);

      try {
          const newInvoices = await fetchErpInvoices(apiConfig.baseUrl, apiConfig.token);

          await saveInvoicesToDatabase(newInvoices);

          const updatedInvoices = await loadInvoicesFromDatabase();
          setInvoices(updatedInvoices);

      } catch (error: any) {
          setSyncError(error.message);
      } finally {
          setIsSyncing(false);
      }
  };

  const handleSaveSettings = () => {
      localStorage.setItem('erp_config', JSON.stringify(apiConfig));
      alert("Configurações salvas com sucesso!");
  };

  // --- User Management Handlers ---

  const handleOpenNewUser = () => {
    setEditingUser(null);
    setUserFormName('');
    setUserFormRole('STATUS_OPERACAO');
    setIsUserModalOpen(true);
  };

  const handleEditUser = (user: User) => {
      setEditingUser(user);
      setUserFormName(user.name);
      setUserFormRole(user.role);
      setIsUserModalOpen(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Tem certeza que deseja remover este usuário? Essa ação não pode ser desfeita.')) {
        try {
            const { error } = await supabase.from('app_users').delete().eq('id', userId);
            if (error) throw error;
            setUsers(users.filter(u => u.id !== userId));
        } catch (error) {
            console.error("Erro ao deletar usuário:", error);
            alert("Erro ao deletar usuário. Verifique a conexão com o banco de dados.");
        }
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormName.trim()) return;

    try {
        if (editingUser) {
            const { error } = await supabase
                .from('app_users')
                .update({ name: userFormName, role: userFormRole })
                .eq('id', editingUser.id);
            if (error) throw error;
            setUsers(users.map(u => u.id === editingUser.id ? { ...u, name: userFormName, role: userFormRole } : u));
        } else {
            const { data, error } = await supabase
                .from('app_users')
                .insert([{ name: userFormName, role: userFormRole }])
                .select();
            if (error) throw error;
            if (data && data[0]) {
                setUsers([...users, data[0] as User]);
            }
        }
        setIsUserModalOpen(false);
    } catch (error) {
        console.error("Erro ao salvar usuário:", error);
        alert("Erro ao salvar usuário. Verifique se a tabela 'app_users' existe no Supabase.");
    }
  };

  const getRoleLabel = (role: UserRole) => {
      switch (role) {
          case 'ADMIN': return 'Administrador';
          case 'LOGISTICA_PLANEJAMENTO': return 'Planejamento Logístico';
          case 'SEPARACAO': return 'Equipe de Separação';
          case 'STATUS_OPERACAO': return 'Operação & Trânsito';
          default: return role;
      }
  };

  const getRoleColor = (role: UserRole) => {
      switch (role) {
          case 'ADMIN': return 'bg-slate-800 text-white border-slate-700';
          case 'LOGISTICA_PLANEJAMENTO': return 'bg-blue-100 text-blue-800 border-blue-200';
          case 'SEPARACAO': return 'bg-amber-100 text-amber-800 border-amber-200';
          case 'STATUS_OPERACAO': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
          default: return 'bg-gray-100 text-gray-800';
      }
  };

  // --- Logic Handlers ---

  const addTimelineEvent = async (mapId: string, status: LoadStatus, description: string) => {
    // Fallback if currentUser is lost in state but session is arguably active (simplified for this demo)
    const userId = currentUser ? currentUser.id : 'system';
    const userName = currentUser ? currentUser.name : 'Sistema';

    const newEvent = {
        id: `evt-${Date.now()}`,
        timestamp: new Date().toISOString(),
        status,
        description,
        userId,
        userName
    };

    let updatedMap: LoadMap | null = null;

    setLoadMaps(prev => prev.map(m => {
        if (m.id === mapId) {
            updatedMap = {
                ...m,
                status,
                timeline: [...m.timeline, newEvent]
            };
            return updatedMap;
        }
        return m;
    }));

    // Salvar no banco de dados
    if (updatedMap) {
      try {
        await saveLoadMapToDatabase(updatedMap);
      } catch (error) {
        console.error('Erro ao salvar timeline no banco:', error);
      }
    }
  };

  // --- Views ---

  const LoginView = () => {
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

  const DashboardView = () => {
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

  const InvoiceSelectionView = () => {
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

        <div className="bg-white rounded-3xl shadow-soft overflow-hidden border border-border/50">
            <table className="w-full text-left">
                <thead className="bg-background border-b border-border">
                    <tr>
                        <th className="p-6 w-16 text-center"><input type="checkbox" disabled className="size-6 rounded-lg"/></th>
                        <th className="p-6 text-base font-bold uppercase tracking-wider text-text-light">Número</th>
                        <th className="p-6 text-base font-bold uppercase tracking-wider text-text-light">Data NF</th>
                        <th className="p-6 text-base font-bold uppercase tracking-wider text-text-light">Cliente</th>
                        <th className="p-6 text-base font-bold uppercase tracking-wider text-text-light">Cidade</th>
                        <th className="p-6 text-base font-bold uppercase tracking-wider text-text-light">Peso</th>
                        <th className="p-6 text-base font-bold uppercase tracking-wider text-text-light">Valor</th>
                        <th className="p-6 text-base font-bold uppercase tracking-wider text-text-light text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {availableInvoices.length === 0 ? (
                        <tr><td colSpan={8} className="p-10 text-center text-text-light text-xl">Nenhuma nota disponível.</td></tr>
                    ) : availableInvoices.map(inv => (
                        <tr key={inv.id} className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedInvoiceIds.has(inv.id) ? 'bg-primary/5' : ''}`} onClick={() => toggleInvoice(inv.id)}>
                            <td className="p-6 text-center">
                                <div className={`size-6 rounded-lg border-2 flex items-center justify-center mx-auto transition-all ${selectedInvoiceIds.has(inv.id) ? 'bg-primary border-primary' : 'border-slate-300 bg-white'}`}>
                                    {selectedInvoiceIds.has(inv.id) && <Check size={16} className="text-white"/>}
                                </div>
                            </td>
                            <td className="p-6 font-bold text-text-main text-lg">{inv.number}</td>
                            <td className="p-6 text-text-secondary text-base">
                                {new Date(inv.documentDate).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="p-6 text-text-secondary text-lg font-medium">{inv.customerName}</td>
                            <td className="p-6 text-text-secondary text-lg">{inv.customerCity}</td>
                            <td className="p-6 font-mono font-bold text-text-main text-lg">{inv.totalWeight.toFixed(2)} kg</td>
                            <td className="p-6 font-mono font-bold text-text-main text-lg">R$ {inv.totalValue.toFixed(2)}</td>
                            <td className="p-6 text-right">
                                <button onClick={(e) => {e.stopPropagation(); setViewingInvoice(inv);}} className="p-3 bg-background rounded-xl text-text-secondary hover:text-primary hover:bg-slate-200 transition-colors">
                                    <Eye size={24} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    );
  };

  const SettingsView = () => {
    // ... (no changes needed)
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="pb-6 border-b border-border">
                <h1 className="text-text-main text-5xl font-black leading-tight tracking-tight">Configurações</h1>
                <p className="text-text-secondary mt-2 text-xl">Parâmetros de integração e sistema.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* API ERP Section */}
                <div className="bg-white rounded-3xl shadow-soft p-10 border border-border/50">
                     <div className="flex items-center gap-4 mb-8">
                         <div className="p-4 bg-primary/5 rounded-2xl text-primary"><Database size={32}/></div>
                         <h2 className="text-2xl font-black text-text-main">Integração ERP</h2>
                     </div>

                     <div className="space-y-6">
                         <div className="space-y-2">
                             <label className="text-lg font-bold text-text-secondary uppercase tracking-wide">URL da API ERP</label>
                             <div className="relative">
                                 <input
                                    value={apiConfig.baseUrl}
                                    onChange={e => setApiConfig({...apiConfig, baseUrl: e.target.value})}
                                    type="text"
                                    className="w-full pl-14 pr-4 py-4 bg-background rounded-2xl border-2 border-transparent focus:border-primary/20 text-lg font-medium outline-none transition-all"
                                    placeholder="https://api.erp.com/api/Faturamento_Backlog_Wonder?..."
                                 />
                                 <Globe className="absolute left-5 top-1/2 -translate-y-1/2 text-text-light" size={24} />
                             </div>
                             <p className="text-sm text-text-light pl-2">URL completa da API para buscar notas fiscais do ERP.</p>
                         </div>

                         <div className="space-y-2">
                             <label className="text-lg font-bold text-text-secondary uppercase tracking-wide">API Key</label>
                             <div className="relative">
                                 <input
                                    value={apiConfig.token}
                                    onChange={e => setApiConfig({...apiConfig, token: e.target.value})}
                                    type="password"
                                    className="w-full pl-14 pr-4 py-4 bg-background rounded-2xl border-2 border-transparent focus:border-primary/20 text-lg font-medium outline-none transition-all"
                                    placeholder="a4d8c7f12e3b4c9a9f6e9e2a1b4d7c8f..."
                                 />
                                 <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-text-light" size={24} />
                             </div>
                         </div>

                         <div className="pt-4 flex items-center gap-4">
                             <button 
                                onClick={handleSaveSettings}
                                className="flex-1 bg-primary text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-primaryLight transition-all flex items-center justify-center gap-3"
                             >
                                <Save size={24}/> Salvar Configuração
                             </button>
                             <button 
                                onClick={handleSyncErp}
                                disabled={isSyncing}
                                className="px-6 py-4 border-2 border-slate-200 text-text-main rounded-2xl font-bold text-lg hover:border-primary hover:text-primary transition-all flex items-center justify-center"
                             >
                                <RefreshCcw size={24} className={isSyncing ? "animate-spin" : ""}/>
                             </button>
                         </div>
                         
                         {syncError && (
                             <div className="p-4 bg-red-50 text-red-600 font-bold rounded-xl flex items-center gap-3">
                                <AlertTriangle size={20} /> {syncError}
                             </div>
                         )}
                     </div>
                </div>

                {/* System Status Section */}
                <div className="space-y-8">
                     <div className="bg-white rounded-3xl shadow-soft p-10 border border-border/50">
                         <div className="flex items-center gap-4 mb-6">
                             <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600"><Server size={32}/></div>
                             <h2 className="text-2xl font-black text-text-main">Status do Sistema</h2>
                         </div>
                         
                         <div className="space-y-4">
                             <div className="flex justify-between items-center p-4 bg-background rounded-2xl">
                                 <span className="font-bold text-text-secondary">Conexão Banco de Dados</span>
                                 <span className="flex items-center gap-2 text-emerald-600 font-bold"><CheckCircle2 size={20}/> Conectado</span>
                             </div>
                             <div className="flex justify-between items-center p-4 bg-background rounded-2xl">
                                 <span className="font-bold text-text-secondary">Versão do Cliente</span>
                                 <span className="font-mono font-bold text-text-main">v2.4.0</span>
                             </div>
                             <div className="flex justify-between items-center p-4 bg-background rounded-2xl">
                                 <span className="font-bold text-text-secondary">Ambiente</span>
                                 <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold uppercase">Produção</span>
                             </div>
                         </div>
                     </div>
                </div>
            </div>
        </div>
    );
  };

  // ... (rest of the component logic) ...

  const LoadMapsPlannerView = () => {
      const handleViewMap = (id: string) => {
          setSelectedMapId(id);
          setCurrentView('MAP_DETAIL');
      };

      const handleDownloadReport = async () => {
        const doc = new jsPDF();

        // Add Logo
        try {
          const logoBase64 = await getLogoAsBase64();
          doc.addImage(logoBase64, 'PNG', 14, 10, 40, 12);
        } catch (error) {
          // Logo não disponível
        }

        // Header
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42); // Primary color
        doc.text('Relatório Geral de Cargas', 60, 18);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

        // Table Data
        const tableData = loadMaps.map(m => [
            m.code,
            m.status,
            m.carrierName || '---',
            m.route || '---',
            m.invoices.length.toString(),
            `${m.invoices.reduce((acc, i) => acc + i.totalWeight, 0).toFixed(0)} kg`,
            formatCurrency(m.invoices.reduce((acc, i) => acc + i.totalValue, 0))
        ]);

        autoTable(doc, {
            startY: 38,
            head: [['Código', 'Status', 'Transportadora', 'Rota', 'Qtd Notas', 'Peso Total', 'Valor Total']],
            body: tableData,
            headStyles: { fillColor: [15, 23, 42], fontSize: 10, fontStyle: 'bold' },
            bodyStyles: { fontSize: 9 },
            alternateRowStyles: { fillColor: [241, 245, 249] },
            margin: { top: 38 },
        });

        doc.save(`relatorio-cargas-${new Date().toISOString().split('T')[0]}.pdf`);
      };

      return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center pb-6 border-b border-border">
                <h1 className="text-text-main text-5xl font-black leading-tight tracking-tight">Cargas & Rotas</h1>
                <div className="flex gap-4">
                     <button 
                        onClick={handleDownloadReport} 
                        className="bg-white border-2 border-slate-200 text-text-main px-6 py-4 rounded-2xl font-bold text-lg hover:border-primary hover:text-primary transition-colors flex items-center gap-3"
                    >
                        <FileDown size={24} /> Relatório
                    </button>
                    <button onClick={() => setCurrentView('INVOICE_SELECT')} className="bg-primary text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-primaryLight transition-colors flex items-center gap-3">
                        <Plus size={24} /> Novo Mapa
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {loadMaps.map(map => {
                    const totalValue = map.invoices.reduce((acc, i) => acc + i.totalValue, 0);
                    const totalWeight = map.invoices.reduce((acc, i) => acc + i.totalWeight, 0);
                    const progress = getLoadProgress(map.status);

                    return (
                        <div key={map.id} onClick={() => handleViewMap(map.id)} className="group bg-white rounded-3xl shadow-soft p-8 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all relative overflow-hidden border border-border/50 flex flex-col">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <span className="text-sm font-bold text-text-light uppercase tracking-wider mb-1 block">Código</span>
                                    <h3 className="text-3xl font-black text-text-main group-hover:text-primary transition-colors">{map.code}</h3>
                                </div>
                                <span className={`px-4 py-2 rounded-xl text-sm font-bold border ${getStatusColor(map.status)}`}>{map.status}</span>
                            </div>
                            
                            <div className="space-y-4 mb-8 flex-1">
                                <div className="flex items-center gap-4 text-text-secondary">
                                    <div className="p-2 bg-background rounded-lg"><Truck size={20} className="text-slate-400" /></div>
                                    <span className="font-bold text-lg truncate">{map.carrierName}</span>
                                </div>
                                <div className="flex items-center gap-4 text-text-secondary">
                                    <div className="p-2 bg-background rounded-lg"><MapPin size={20} className="text-slate-400" /></div>
                                    <span className="font-bold text-lg truncate">{map.route || 'Rota não definida'}</span>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-border mt-auto">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-2">
                                        <Wallet size={18} className="text-text-light" />
                                        <span className="font-bold text-text-main">{formatCurrency(totalValue)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Weight size={18} className="text-text-light" />
                                        <span className="font-bold text-text-main">{totalWeight.toFixed(0)} kg</span>
                                    </div>
                                </div>
                                
                                {/* Visual Progress Bar */}
                                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                    <div className="bg-primary h-full rounded-full transition-all duration-500" style={{width: `${progress}%`}}></div>
                                </div>
                                <div className="flex justify-between mt-2 text-xs font-bold text-text-light uppercase tracking-wide">
                                    <span>Progresso</span>
                                    <span>{progress}%</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      );
  };
  
  const SeparationListView = () => {
    // ... (no changes needed)
    const separationMaps = loadMaps.filter(m => [
        LoadStatus.READY_FOR_SEPARATION, LoadStatus.SEPARATION, LoadStatus.IN_SEPARATION,
        LoadStatus.SEPARATED, LoadStatus.SEPARATED_WITH_DIVERGENCE
    ].includes(m.status));

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="pb-6 border-b border-border">
                <h1 className="text-text-main text-5xl font-black leading-tight tracking-tight">Separação</h1>
                <p className="text-text-secondary mt-2 text-xl">Gerenciamento de picking.</p>
            </div>
            
            <div className="grid gap-6">
                 {separationMaps.map(map => (
                     <div key={map.id} className="bg-white rounded-3xl shadow-soft p-8 flex items-center justify-between hover:shadow-lg transition-all border border-border/50">
                        <div className="flex items-center gap-8">
                            <div className="p-5 bg-background rounded-2xl text-text-main">
                                <CheckSquare size={40} strokeWidth={1.5} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-text-main mb-1">{map.code}</h3>
                                <div className="flex items-center gap-3">
                                    <span className={`px-3 py-1 rounded-lg text-sm font-bold border ${getStatusColor(map.status)}`}>{map.status}</span>
                                    <span className="text-text-light font-medium">• {map.invoices.length} notas</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-12">
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-bold text-text-light uppercase tracking-wider">Peso Total</p>
                                <p className="text-2xl font-black text-text-main">{map.invoices.reduce((acc, i) => acc + i.totalWeight, 0).toFixed(0)} kg</p>
                            </div>
                            <button onClick={() => {setSelectedMapId(map.id); setCurrentView('SEPARATION_DETAIL');}} className="bg-text-main text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-primary transition-colors">
                                Acessar
                            </button>
                        </div>
                     </div>
                 ))}
            </div>
        </div>
    );
  };

  const PlanningMapDetailView = () => {
    const map = loadMaps.find(m => m.id === selectedMapId);
    if (!map) return <div>Mapa não encontrado</div>;
    
    // Logic/State
    const [notes, setNotes] = useState(map.logisticsNotes || '');
    const [carrierName, setCarrierName] = useState(map.carrierName || '');
    const [route, setRoute] = useState(map.route || '');
    const [sourceCity, setSourceCity] = useState(map.sourceCity || 'Matriz Central');
    const [vehiclePlate, setVehiclePlate] = useState(map.vehiclePlate || '');
    const [googleMapsLink, setGoogleMapsLink] = useState(map.googleMapsLink || '');

    // Calculated stats
    const totalValue = map.invoices.reduce((acc, i) => acc + i.totalValue, 0);
    const totalWeight = map.invoices.reduce((acc, i) => acc + i.totalWeight, 0);
    const totalItems = map.invoices.reduce((acc, i) => acc + i.items.reduce((sum, item) => sum + item.quantity, 0), 0);

    // Auto-generate Google Maps link when Source and Route (Destination) change
    useEffect(() => {
        if (sourceCity && route) {
            // Encode the parameters for the URL
            const origin = encodeURIComponent(sourceCity);
            const destination = encodeURIComponent(route);
            
            // Standard Google Maps Directory Link
            // https://www.google.com/maps/dir/?api=1&origin={origin}&destination={destination}
            const newLink = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
            setGoogleMapsLink(newLink);
        }
    }, [sourceCity, route]);

    // Autocomplete State
    const [carrierSuggestions, setCarrierSuggestions] = useState<string[]>([]);
    const [showCarrierSuggestions, setShowCarrierSuggestions] = useState(false);

    const handleCarrierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setCarrierName(value);
        if (value.length > 0) {
            const filtered = CARRIER_LIST.filter(c => c.toLowerCase().includes(value.toLowerCase()));
            setCarrierSuggestions(filtered);
            setShowCarrierSuggestions(true);
        } else {
            setShowCarrierSuggestions(false);
        }
    };

    const handleSelectCarrier = (name: string) => {
        setCarrierName(name);
        setShowCarrierSuggestions(false);
    };

    const handleCarrierBlur = () => {
        // Delay hiding suggestions to allow click event to register
        setTimeout(() => setShowCarrierSuggestions(false), 200);
    };
    
    const saveChanges = async () => {
        let updatedMap: LoadMap | null = null;

        setLoadMaps(prev => prev.map(m => {
          if (m.id === map.id) {
            updatedMap = {
              ...m,
              logisticsNotes: notes,
              carrierName,
              route,
              sourceCity,
              vehiclePlate,
              googleMapsLink
            };
            return updatedMap;
          }
          return m;
        }));

        if (updatedMap) {
          try {
            await saveLoadMapToDatabase(updatedMap);
            alert('Salvo!');
          } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar!');
          }
        }
    };
    const releaseToSeparation = async () => {
        await addTimelineEvent(map.id, LoadStatus.READY_FOR_SEPARATION, "Liberado para separação");
        setCurrentView('LOAD_MAPS');
    };
    
    const generateManifestPDF = async () => {
        const doc = new jsPDF();

        // Add Logo
        try {
          const logoBase64 = await getLogoAsBase64();
          doc.addImage(logoBase64, 'PNG', 14, 8, 40, 12);
        } catch (error) {
          // Logo não disponível
        }

        doc.setFontSize(22);
        doc.text(`Manifesto de Carga: ${map.code}`, 14, 28);

        doc.setFontSize(10);
        doc.text(`Transportadora: ${carrierName}`, 14, 38);
        doc.text(`Placa: ${vehiclePlate}`, 14, 43);
        doc.text(`Rota: ${route}`, 14, 48);
        doc.text(`Data: ${new Date().toLocaleDateString()}`, 150, 38);

        const tableData = map.invoices.map(inv => [
            inv.number,
            new Date(inv.documentDate).toLocaleDateString('pt-BR'),
            inv.customerName,
            inv.customerCity,
            `${inv.totalWeight.toFixed(2)} kg`,
            inv.items.reduce((acc, i) => acc + i.quantity, 0).toString(),
            formatCurrency(inv.totalValue)
        ]);

        autoTable(doc, {
            startY: 56,
            head: [['NF', 'Data NF', 'Cliente', 'Cidade', 'Peso', 'Vol.', 'Valor']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42] },
        });

        // Totals Footer
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.text(`Total Peso: ${totalWeight.toFixed(2)} kg`, 14, finalY);
        doc.text(`Total Valor: ${formatCurrency(totalValue)}`, 14, finalY + 6);
        doc.text(`Total Volumes: ${totalItems}`, 14, finalY + 12);

        doc.save(`manifesto-${map.code}.pdf`);
    };

    // Header Widget Component
    const SummaryWidget = ({ icon: Icon, label, value, color }: any) => (
        <div className="bg-white rounded-3xl p-6 shadow-soft flex items-center gap-5 border border-border/50">
            <div className={`p-4 rounded-2xl ${color} bg-opacity-10 text-opacity-100`}>
                <Icon size={28} className={color.replace('bg-', 'text-')} />
            </div>
            <div>
                <p className="text-sm font-bold text-text-light uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-black text-text-main">{value}</p>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-8 pb-4 border-b border-border">
                <div>
                     <button onClick={() => setCurrentView('LOAD_MAPS')} className="text-text-secondary hover:text-primary font-bold text-lg flex items-center gap-2 mb-4">
                        <ArrowRight className="rotate-180" size={24}/> Voltar
                     </button>
                     <div className="flex items-center gap-6">
                        <h1 className="text-text-main text-5xl font-black tracking-tight">{map.code}</h1>
                        <span className={`px-4 py-2 rounded-xl text-lg font-bold border ${getStatusColor(map.status)}`}>{map.status}</span>
                     </div>
                </div>
                <div className="flex gap-4">
                     <button onClick={generateManifestPDF} className="px-6 py-4 bg-white border border-slate-200 text-text-main rounded-2xl font-bold text-lg hover:border-primary hover:text-primary transition-all flex items-center gap-2">
                        <Printer size={24}/> Imprimir Manifesto
                     </button>
                     <button onClick={saveChanges} className="px-8 py-4 bg-text-main text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-black transition-all flex items-center gap-2"><Save size={24}/> Salvar</button>
                     {map.status === LoadStatus.PLANNING && (
                        <button onClick={releaseToSeparation} className="px-8 py-4 bg-accent text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-emerald-600 transition-all flex items-center gap-2"><CheckCircle2 size={24}/> Liberar</button>
                     )}
                </div>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SummaryWidget icon={Wallet} label="Valor Total" value={formatCurrency(totalValue)} color="bg-emerald-500" />
                <SummaryWidget icon={Weight} label="Peso Bruto" value={`${totalWeight.toFixed(2)} kg`} color="bg-blue-500" />
                <SummaryWidget icon={Box} label="Volumes Totais" value={totalItems} color="bg-amber-500" />
            </div>

            {/* Inputs Grid - Larger */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-3 relative z-20">
                     <label className="text-lg font-bold text-text-secondary uppercase tracking-wide">Transportadora</label>
                     <div className="relative">
                        <input 
                            value={carrierName} 
                            onChange={handleCarrierChange} 
                            onFocus={() => {
                                if (carrierName) {
                                    setCarrierSuggestions(CARRIER_LIST.filter(c => c.toLowerCase().includes(carrierName.toLowerCase())));
                                    setShowCarrierSuggestions(true);
                                } else {
                                    setCarrierSuggestions(CARRIER_LIST);
                                    setShowCarrierSuggestions(true);
                                }
                            }}
                            onBlur={handleCarrierBlur}
                            className="w-full p-5 bg-white rounded-2xl border-2 border-transparent focus:border-primary/20 text-xl font-medium text-text-main outline-none shadow-soft" 
                            placeholder="Nome da transportadora" 
                            autoComplete="off"
                        />
                        {showCarrierSuggestions && carrierSuggestions.length > 0 && (
                            <ul className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-50">
                                {carrierSuggestions.map((carrier, idx) => (
                                    <li 
                                        key={idx}
                                        onMouseDown={() => handleSelectCarrier(carrier)} // onMouseDown fires before blur
                                        className="px-5 py-3 hover:bg-slate-50 cursor-pointer text-lg font-medium text-text-main border-b border-slate-50 last:border-0"
                                    >
                                        {carrier}
                                    </li>
                                ))}
                            </ul>
                        )}
                     </div>
                 </div>
                 <div className="space-y-3">
                     <label className="text-lg font-bold text-text-secondary uppercase tracking-wide">Placa</label>
                     <input value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value)} className="w-full p-5 bg-white rounded-2xl border-2 border-transparent focus:border-primary/20 text-xl font-medium text-text-main outline-none shadow-soft" placeholder="ABC-1234" />
                 </div>
                 <div className="space-y-3">
                     <label className="text-lg font-bold text-text-secondary uppercase tracking-wide">Cidade de Origem</label>
                     <input value={sourceCity} onChange={e => setSourceCity(e.target.value)} className="w-full p-5 bg-white rounded-2xl border-2 border-transparent focus:border-primary/20 text-xl font-medium text-text-main outline-none shadow-soft" placeholder="Ex: São Paulo" />
                 </div>
                 <div className="space-y-3">
                     <label className="text-lg font-bold text-text-secondary uppercase tracking-wide">Rota / Destino</label>
                     <input value={route} onChange={e => setRoute(e.target.value)} className="w-full p-5 bg-white rounded-2xl border-2 border-transparent focus:border-primary/20 text-xl font-medium text-text-main outline-none shadow-soft" placeholder="Ex: Rio de Janeiro" />
                 </div>
                 <div className="space-y-3 md:col-span-2">
                     <label className="text-lg font-bold text-text-secondary uppercase tracking-wide">Link Google Maps (Automático)</label>
                     <input value={googleMapsLink} onChange={e => setGoogleMapsLink(e.target.value)} className="w-full p-5 bg-slate-50 rounded-2xl border-2 border-slate-200 text-xl font-medium text-text-main outline-none shadow-inner" placeholder="Será gerado automaticamente..." />
                 </div>
                  <div className="space-y-3 md:col-span-2">
                     <label className="text-lg font-bold text-text-secondary uppercase tracking-wide">Notas</label>
                     <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-5 bg-white rounded-2xl border-2 border-transparent focus:border-primary/20 text-lg font-medium text-text-main outline-none shadow-soft min-h-[140px]" placeholder="Observações..." />
                 </div>
            </div>

            {/* Invoices List */}
            <div className="bg-white rounded-3xl shadow-soft p-10 border border-border/50">
                <h3 className="text-2xl font-bold text-text-main mb-8">Notas Fiscais Vinculadas</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b border-border">
                            <tr>
                                <th className="py-4 px-4 text-base font-bold text-text-light uppercase">NF</th>
                                <th className="py-4 px-4 text-base font-bold text-text-light uppercase">Data NF</th>
                                <th className="py-4 px-4 text-base font-bold text-text-light uppercase">Cliente</th>
                                <th className="py-4 px-4 text-base font-bold text-text-light uppercase text-right">Valor</th>
                                <th className="py-4 px-4 text-base font-bold text-text-light uppercase text-right">Peso</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {map.invoices.map(inv => (
                                <tr key={inv.id}>
                                    <td className="py-6 px-4 text-xl font-bold text-text-main">{inv.number}</td>
                                    <td className="py-6 px-4 text-base text-text-secondary">
                                        {new Date(inv.documentDate).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="py-6 px-4 text-xl font-medium text-text-secondary">{inv.customerName}</td>
                                    <td className="py-6 px-4 text-xl font-mono font-bold text-text-main text-right">{formatCurrency(inv.totalValue)}</td>
                                    <td className="py-6 px-4 text-xl font-mono font-bold text-text-main text-right">{inv.totalWeight} kg</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
  };

  const SeparationDetailView = () => {
    // ... (no changes needed)
    const map = loadMaps.find(m => m.id === selectedMapId);
    if (!map) return <div>Mapa não encontrado</div>;

    // Local state for verification checklist in this session
    const [verifiedInvoices, setVerifiedInvoices] = useState<Set<string>>(new Set());

    const toggleVerify = (id: string) => {
        const next = new Set(verifiedInvoices);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setVerifiedInvoices(next);
    };

    const finishSeparation = async () => {
        // Safe check for current user even if state was lost
        const userId = currentUser ? currentUser.id : 'system';
        const userName = currentUser ? currentUser.name : 'Sistema';

        const total = map.invoices.length;
        const verified = verifiedInvoices.size;

        if (verified < total) {
            if (!window.confirm(`Existem notas não conferidas (${total - verified}). Deseja finalizar com divergência?`)) {
                return;
            }
        }

        const newStatus = verified === total ? LoadStatus.SEPARATED : LoadStatus.SEPARATED_WITH_DIVERGENCE;

        await addTimelineEvent(map.id, newStatus, `Conferência finalizada. ${verified}/${total} notas conferidas.`);
        setCurrentView('SEPARATION_LIST');
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
             <div className="flex flex-col md:flex-row justify-between items-start gap-8 pb-6 border-b border-border">
                <div>
                     <button onClick={() => setCurrentView('SEPARATION_LIST')} className="text-text-secondary hover:text-primary font-bold text-lg flex items-center gap-2 mb-4">
                        <ArrowRight className="rotate-180" size={24}/> Voltar
                     </button>
                     <h1 className="text-text-main text-5xl font-black tracking-tight mb-2">Conferência</h1>
                     <p className="text-xl text-text-secondary font-medium">Mapa: <span className="text-text-main font-bold">{map.code}</span></p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right mr-4">
                        <p className="text-sm font-bold text-text-light uppercase">Progresso</p>
                        <p className="text-2xl font-black text-text-main">{verifiedInvoices.size} / {map.invoices.length}</p>
                    </div>
                    <button onClick={finishSeparation} className="px-10 py-5 bg-accent text-white rounded-2xl font-bold text-xl shadow-lg hover:bg-emerald-600 transition-all flex items-center gap-3">
                        <ClipboardCheck size={28}/> Finalizar
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-soft border border-border/50 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-background border-b border-border">
                        <tr>
                            <th className="p-6 text-base font-bold uppercase tracking-wider text-text-light text-center w-24">Status</th>
                            <th className="p-6 text-base font-bold uppercase tracking-wider text-text-light">Nota Fiscal</th>
                            <th className="p-6 text-base font-bold uppercase tracking-wider text-text-light">Cliente</th>
                            <th className="p-6 text-base font-bold uppercase tracking-wider text-text-light text-center">Volumes</th>
                            <th className="p-6 text-base font-bold uppercase tracking-wider text-text-light text-right">Peso</th>
                            <th className="p-6 text-base font-bold uppercase tracking-wider text-text-light text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {map.invoices.map(inv => {
                            const isVerified = verifiedInvoices.has(inv.id);
                            return (
                                <tr key={inv.id} className={`transition-colors ${isVerified ? 'bg-emerald-50/30' : 'hover:bg-slate-50'}`}>
                                    <td className="p-6 text-center">
                                        <button 
                                            onClick={() => toggleVerify(inv.id)}
                                            className={`size-8 rounded-lg border-2 flex items-center justify-center mx-auto transition-all ${isVerified ? 'bg-accent border-accent text-white' : 'border-slate-300 text-transparent hover:border-accent'}`}
                                        >
                                            <Check size={20} strokeWidth={3} />
                                        </button>
                                    </td>
                                    <td className="p-6">
                                        <p className="font-bold text-xl text-text-main">{inv.number}</p>
                                        <p className="text-sm text-text-light">Data Doc: {new Date(inv.documentDate).toLocaleDateString()}</p>
                                    </td>
                                    <td className="p-6 text-lg font-medium text-text-secondary">{inv.customerName}</td>
                                    <td className="p-6 text-center text-xl font-bold text-text-main">{inv.items.reduce((acc, i) => acc + i.quantity, 0)}</td>
                                    <td className="p-6 text-right text-xl font-mono font-bold text-text-main">{inv.totalWeight.toFixed(2)} kg</td>
                                    <td className="p-6 text-right">
                                        <button 
                                            onClick={() => setViewingInvoice(inv)}
                                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-text-secondary hover:text-primary hover:border-primary transition-all flex items-center gap-2 ml-auto"
                                        >
                                            <Eye size={20}/> Ver Itens
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };

  const OperationListView = () => {
    // ... (no changes needed)
     // Filter for loads that are ready or in progress
     const operationMaps = loadMaps.filter(m => [
        LoadStatus.SEPARATED, LoadStatus.SEPARATED_WITH_DIVERGENCE, 
        LoadStatus.READY, LoadStatus.IN_TRANSIT, LoadStatus.DELIVERED
    ].includes(m.status));

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
             <div className="pb-6 border-b border-border">
                <h1 className="text-text-main text-5xl font-black leading-tight tracking-tight">Operação</h1>
                <p className="text-text-secondary mt-2 text-xl">Monitoramento de entregas e trânsito.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {operationMaps.map(map => {
                    const progress = getLoadProgress(map.status);
                    return (
                     <div key={map.id} className="bg-white rounded-3xl shadow-soft p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-lg transition-all border border-border/50 relative overflow-hidden">
                        {/* Progress Background Hint */}
                        <div className="absolute bottom-0 left-0 h-1.5 bg-primary transition-all duration-1000" style={{width: `${progress}%`}}></div>

                        <div className="flex items-start gap-6">
                            <div className={`p-4 rounded-2xl ${map.status === LoadStatus.IN_TRANSIT ? 'bg-primary text-white' : 'bg-slate-100 text-text-secondary'}`}>
                                <Truck size={32} />
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-2xl font-black text-text-main">{map.code}</h3>
                                    <span className={`px-3 py-1 rounded-lg text-sm font-bold border ${getStatusColor(map.status)}`}>{map.status}</span>
                                </div>
                                <div className="space-y-1 text-lg text-text-secondary font-medium">
                                    <div className="flex items-center gap-2"><MapPin size={18}/> {map.route}</div>
                                    <div className="flex items-center gap-2"><Building2 size={18}/> {map.carrierName}</div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-6 pl-4 md:pl-0 md:border-l md:border-slate-100 md:ml-6">
                            <div className="hidden lg:block">
                                <p className="text-xs font-bold text-text-light uppercase tracking-wide mb-1">Último Evento</p>
                                <p className="text-sm font-medium text-text-main max-w-[200px] truncate">
                                    {map.timeline[map.timeline.length - 1]?.description || 'Sem eventos recentes'}
                                </p>
                                <p className="text-xs text-text-light mt-1">
                                    {map.timeline[map.timeline.length - 1]?.timestamp ? new Date(map.timeline[map.timeline.length - 1].timestamp).toLocaleDateString() : '-'}
                                </p>
                            </div>
                            <button 
                                onClick={() => {setSelectedMapId(map.id); setCurrentView('OPERATION_DETAIL');}}
                                className="px-8 py-4 bg-background hover:bg-primary hover:text-white text-text-main rounded-2xl font-bold text-lg transition-all"
                            >
                                Detalhes
                            </button>
                        </div>
                     </div>
                )})}
            </div>
        </div>
    );
  };

  const OperationDetailView = () => {
    // ... (no changes needed)
    const map = loadMaps.find(m => m.id === selectedMapId);
    if (!map) return <div>Mapa não encontrado</div>;

    const embedUrl = getEmbedUrl(map.googleMapsLink || '', map.route);

    const handleStatusUpdate = async (newStatus: LoadStatus, note: string) => {
        if(window.confirm(`Deseja alterar o status para: ${newStatus}?`)) {
             await addTimelineEvent(map.id, newStatus, note);
             // Note: addTimelineEvent handles state update, no need to setLoadMaps twice which caused race condition
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-500 h-[calc(100vh-140px)]">
             {/* Header */}
             <div className="flex justify-between items-start pb-4 border-b border-border shrink-0">
                 <div>
                     <button onClick={() => setCurrentView('OPERATION_LIST')} className="text-text-secondary hover:text-primary font-bold text-lg flex items-center gap-2 mb-2">
                        <ArrowRight className="rotate-180" size={24}/> Voltar
                     </button>
                     <h1 className="text-text-main text-4xl font-black tracking-tight">{map.code}</h1>
                     <div className="flex items-center gap-3 mt-2">
                        <span className={`px-4 py-2 rounded-xl text-lg font-bold border ${getStatusColor(map.status)}`}>{map.status}</span>
                        <span className="text-text-secondary font-medium text-lg flex items-center gap-2"><Truck size={20}/> {map.vehiclePlate}</span>
                     </div>
                 </div>
                 
                 <div className="flex gap-4">
                     {map.status === LoadStatus.READY || map.status === LoadStatus.SEPARATED || map.status === LoadStatus.SEPARATED_WITH_DIVERGENCE ? (
                         <button onClick={() => handleStatusUpdate(LoadStatus.IN_TRANSIT, 'Início de viagem')} className="px-8 py-4 bg-primary text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-primaryLight transition-all flex items-center gap-3">
                             <PlayCircle size={24}/> Iniciar Viagem
                         </button>
                     ) : map.status === LoadStatus.IN_TRANSIT ? (
                         <button onClick={() => handleStatusUpdate(LoadStatus.DELIVERED, 'Entrega confirmada no destino')} className="px-8 py-4 bg-accent text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-emerald-600 transition-all flex items-center gap-3">
                             <CheckCircle2 size={24}/> Confirmar Entrega
                         </button>
                     ) : null}
                 </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0">
                 {/* Left: Map & Info */}
                 <div className="lg:col-span-2 flex flex-col gap-6 h-full min-h-0">
                     <div className="bg-white rounded-3xl shadow-soft p-2 border border-border/50 flex-1 relative overflow-hidden min-h-[400px] group">
                         {embedUrl ? (
                             <>
                                 <iframe 
                                     width="100%" 
                                     height="100%" 
                                     frameBorder="0" 
                                     style={{ border: 0, borderRadius: '1.5rem' }} 
                                     src={embedUrl} 
                                     allowFullScreen
                                     loading="lazy"
                                     referrerPolicy="no-referrer-when-downgrade"
                                 ></iframe>
                                 {/* Floating Open External Button */}
                                 <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <a 
                                        href={map.googleMapsLink || `https://www.google.com/maps/search/${encodeURIComponent(map.route)}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="bg-white text-text-main px-4 py-2 rounded-xl shadow-lg font-bold text-sm flex items-center gap-2 hover:bg-primary hover:text-white transition-colors"
                                     >
                                         <ExternalLink size={16}/> Abrir no Google Maps
                                     </a>
                                 </div>
                             </>
                         ) : (
                             <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-text-light rounded-3xl">
                                 <MapIcon size={64} className="mb-4 opacity-20"/>
                                 <p className="font-bold text-xl">Visualização de mapa indisponível</p>
                                 <p className="text-sm">Rota: {map.route}</p>
                                 <a 
                                    href={`https://www.google.com/maps/search/${encodeURIComponent(map.route)}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="mt-6 bg-white border border-slate-300 text-text-main px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:border-primary hover:text-primary transition-colors"
                                 >
                                     <ExternalLink size={20}/> Abrir Rota Externa
                                 </a>
                             </div>
                         )}
                     </div>
                     
                     <div className="grid grid-cols-2 gap-6 shrink-0">
                         <div className="bg-white p-6 rounded-3xl shadow-soft border border-border/50">
                             <p className="text-sm font-bold text-text-light uppercase tracking-wide mb-1">Destino</p>
                             <p className="text-xl font-bold text-text-main truncate">{map.route}</p>
                         </div>
                         <div className="bg-white p-6 rounded-3xl shadow-soft border border-border/50">
                             <p className="text-sm font-bold text-text-light uppercase tracking-wide mb-1">Transportadora</p>
                             <p className="text-xl font-bold text-text-main truncate">{map.carrierName}</p>
                         </div>
                     </div>
                 </div>

                 {/* Right: Timeline */}
                 <div className="bg-white rounded-3xl shadow-soft p-8 border border-border/50 overflow-y-auto h-full">
                     <h3 className="text-2xl font-bold text-text-main mb-8 flex items-center gap-3"><History size={28}/> Histórico</h3>
                     <div className="relative border-l-2 border-slate-100 pl-8 ml-4 space-y-10">
                         {[...map.timeline].reverse().map((event, idx) => (
                             <div key={event.id} className="relative">
                                 <div className={`absolute -left-[41px] top-1 size-5 rounded-full border-4 border-white ${idx === 0 ? 'bg-primary' : 'bg-slate-300'}`}></div>
                                 <p className="text-sm font-bold text-text-light uppercase tracking-wide mb-1">
                                     {new Date(event.timestamp).toLocaleString('pt-BR')}
                                 </p>
                                 <p className="text-lg font-bold text-text-main mb-1">{event.status}</p>
                                 <p className="text-base text-text-secondary font-medium bg-slate-50 p-3 rounded-xl inline-block">{event.description}</p>
                                 <div className="flex items-center gap-2 mt-2 text-sm text-text-light font-bold">
                                     <UserIcon size={14}/> {event.userName}
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             </div>
        </div>
    );
  };

  const AdminUsersView = () => {
    // ... (no changes needed)
    if (currentUser?.role !== 'ADMIN') {
        return <div className="p-10 text-center text-xl text-red-500 font-bold">Acesso Negado: Você não tem permissão para visualizar esta página.</div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center pb-6 border-b border-border">
                <div>
                     <h1 className="text-text-main text-5xl font-black leading-tight tracking-tight">Gestão de Usuários</h1>
                     <p className="text-text-secondary mt-2 text-xl">Controle de acesso e permissões.</p>
                </div>
                <button 
                    onClick={handleOpenNewUser} 
                    className="bg-primary hover:bg-primaryLight text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 transition-all flex items-center gap-3"
                >
                    <UserPlus size={24} /> Novo Usuário
                </button>
            </div>

            <div className="bg-white rounded-3xl shadow-soft overflow-hidden border border-border/50">
                <table className="w-full text-left">
                    <thead className="bg-background border-b border-border">
                        <tr>
                            <th className="p-6 text-base font-bold uppercase tracking-wider text-text-light">Nome</th>
                            <th className="p-6 text-base font-bold uppercase tracking-wider text-text-light">Função / Permissão</th>
                            <th className="p-6 text-base font-bold uppercase tracking-wider text-text-light text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {isUsersLoading ? (
                            <tr>
                                <td colSpan={3} className="p-10 text-center">
                                    <div className="flex items-center justify-center gap-3 text-text-secondary">
                                        <Loader2 className="animate-spin" /> Carregando usuários...
                                    </div>
                                </td>
                            </tr>
                        ) : users.map(user => (
                            <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-lg font-bold text-text-secondary border-2 border-slate-200">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-bold text-xl text-text-main">{user.name}</span>
                                    </div>
                                </td>
                                <td className="p-6">
                                    <span className={`px-4 py-2 rounded-xl text-sm font-bold border ${getRoleColor(user.role)} uppercase tracking-wide`}>
                                        {getRoleLabel(user.role)}
                                    </span>
                                </td>
                                <td className="p-6 text-right">
                                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleEditUser(user)}
                                            className="p-3 bg-white border border-slate-200 rounded-xl text-text-secondary hover:text-primary hover:border-primary transition-all shadow-sm"
                                        >
                                            <Edit size={20} />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteUser(user.id)}
                                            className="p-3 bg-white border border-slate-200 rounded-xl text-red-500 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };
  
  // ... (UserFormModal and export default App)
  
  const UserFormModal = () => {
    if (!isUserModalOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111621]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-border/50">
                <div className="p-8 border-b border-border flex justify-between items-center bg-background">
                    <h2 className="text-2xl font-black text-text-main">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h2>
                    <button onClick={() => setIsUserModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors text-text-secondary"><X size={24}/></button>
                </div>
                
                <form onSubmit={handleSaveUser} className="p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-base font-bold text-text-secondary uppercase tracking-wide">Nome Completo</label>
                        <input 
                            type="text" 
                            value={userFormName}
                            onChange={e => setUserFormName(e.target.value)}
                            className="w-full p-4 bg-background rounded-2xl border-2 border-transparent focus:border-primary/20 text-lg font-medium text-text-main outline-none transition-all"
                            placeholder="Ex: João Silva"
                            required
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-base font-bold text-text-secondary uppercase tracking-wide">Nível de Permissão</label>
                        <div className="relative">
                            <select 
                                value={userFormRole}
                                onChange={e => setUserFormRole(e.target.value as UserRole)}
                                className="w-full p-4 bg-background rounded-2xl border-2 border-transparent focus:border-primary/20 text-lg font-medium text-text-main outline-none appearance-none transition-all cursor-pointer"
                            >
                                <option value="ADMIN">Administrador (Acesso Total)</option>
                                <option value="LOGISTICA_PLANEJAMENTO">Logística & Planejamento</option>
                                <option value="SEPARACAO">Equipe de Separação</option>
                                <option value="STATUS_OPERACAO">Operação & Trânsito</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" size={20}/>
                        </div>
                        <p className="text-sm text-text-light mt-2 px-1">
                            {userFormRole === 'ADMIN' && 'Acesso irrestrito a todas as áreas do sistema.'}
                            {userFormRole === 'LOGISTICA_PLANEJAMENTO' && 'Pode criar mapas, gerenciar rotas e visualizar dashboard.'}
                            {userFormRole === 'SEPARACAO' && 'Acesso restrito à lista de separação e conferência de itens.'}
                            {userFormRole === 'STATUS_OPERACAO' && 'Acesso restrito ao monitoramento de entregas e atualização de status.'}
                        </p>
                    </div>

                    <div className="pt-4 flex justify-end gap-4">
                        <button 
                            type="button" 
                            onClick={() => setIsUserModalOpen(false)}
                            className="px-6 py-3 bg-white border-2 border-slate-100 rounded-xl font-bold text-text-secondary hover:border-slate-300 transition-all"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primaryLight shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
                        >
                            <Check size={20} /> Salvar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
  };

  if (currentView === 'LOGIN') {
      return <LoginView />;
  }

  return (
    <Layout currentView={currentView} onChangeView={setCurrentView} currentUser={currentUser} onLogout={handleLogout}>
        {currentView === 'DASHBOARD' && <DashboardView />}
        {currentView === 'INVOICE_SELECT' && <InvoiceSelectionView />}
        {currentView === 'LOAD_MAPS' && <LoadMapsPlannerView />}
        {currentView === 'MAP_DETAIL' && <PlanningMapDetailView />}
        {currentView === 'SEPARATION_LIST' && <SeparationListView />}
        {currentView === 'SEPARATION_DETAIL' && <SeparationDetailView />}
        {currentView === 'OPERATION_LIST' && <OperationListView />}
        {currentView === 'OPERATION_DETAIL' && <OperationDetailView />}
        {currentView === 'ADMIN_USERS' && <AdminUsersView />}
        {currentView === 'SETTINGS' && <SettingsView />}
        <UserFormModal />
        <ProductModal invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />
    </Layout>
  );
}

export default App;