import React from 'react';
import { Truck, Bell, Search, Menu, X, LogOut, ChevronRight, Settings, LayoutDashboard, FileText, Map, User as UserIcon, CheckSquare, Activity } from 'lucide-react';
import { ViewState, User } from '../types';
import { Logo } from './Logo';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  currentUser: User | null;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onChangeView, currentUser, onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const NavItem = ({ view, label, icon: Icon }: { view: ViewState; label: string; icon: any }) => {
    const isActive = currentView === view || (view === 'LOAD_MAPS' && currentView === 'MAP_DETAIL');
    return (
      <button
        onClick={() => {
            onChangeView(view);
            setIsMobileMenuOpen(false);
        }}
        className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 group ${
          isActive 
            ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]' 
            : 'text-text-secondary hover:bg-white hover:text-primary hover:shadow-soft'
        }`}
      >
        <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary transition-colors'} />
        <span className={`text-base font-bold tracking-wide ${isActive ? 'text-white' : ''}`}>{label}</span>
        {isActive && <ChevronRight size={18} className="ml-auto opacity-70" />}
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-background font-sans text-text-main overflow-hidden">
      
      {/* --- Sidebar (Desktop) --- */}
      <aside className="hidden md:flex w-80 flex-col bg-[#f1f5f9] h-full transition-all duration-300 border-r border-transparent">
        {/* Brand */}
        <div className="p-8 flex items-center gap-4">
             {/* Logo Component */}
             <div className="h-16 w-auto flex items-center">
                <Logo className="h-full w-auto text-primary" />
             </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4 px-6 space-y-2">
             <div className="px-4 pb-3 text-xs font-extrabold text-text-light uppercase tracking-widest">Menu Principal</div>
             
             {(currentUser?.role === 'ADMIN' || currentUser?.role === 'LOGISTICA_PLANEJAMENTO') && (
                <>
                    <NavItem view="DASHBOARD" label="Dashboard" icon={LayoutDashboard} />
                    <NavItem view="LOAD_MAPS" label="Cargas & Rotas" icon={Map} />
                    <NavItem view="INVOICE_SELECT" label="Notas Fiscais" icon={FileText} />
                </>
             )}
             
             {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SEPARACAO') && (
                <NavItem view="SEPARATION_LIST" label="Separação" icon={CheckSquare} />
             )}
             
             {(currentUser?.role === 'ADMIN' || currentUser?.role === 'STATUS_OPERACAO') && (
                <NavItem view="OPERATION_LIST" label="Operação" icon={Activity} />
             )}

             {currentUser?.role === 'ADMIN' && (
                 <>
                    <div className="px-4 pb-3 pt-8 text-xs font-extrabold text-text-light uppercase tracking-widest">Administração</div>
                    <NavItem view="ADMIN_USERS" label="Usuários" icon={UserIcon} />
                 </>
             )}
        </div>

        {/* Footer / Settings */}
        <div className="p-6">
            {currentUser?.role === 'ADMIN' && (
                 <button 
                    onClick={() => onChangeView('SETTINGS')}
                    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl mb-4 transition-all group ${currentView === 'SETTINGS' ? 'bg-white text-primary shadow-soft' : 'text-text-secondary hover:bg-white hover:text-primary hover:shadow-soft'}`}
                 >
                    <Settings size={24} className={currentView === 'SETTINGS' ? 'text-primary' : 'text-slate-400 group-hover:text-primary'} />
                    <span className="text-base font-bold">Configurações</span>
                 </button>
            )}
            
            <div className="bg-white p-4 rounded-2xl shadow-soft flex items-center gap-4">
                <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-lg font-bold text-primary border-2 border-slate-50">
                    {currentUser?.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-text-main truncate">{currentUser?.name}</p>
                    <button onClick={onLogout} className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 mt-0.5 uppercase tracking-wide">
                        Sair do Sistema
                    </button>
                </div>
            </div>
        </div>
      </aside>

      {/* --- Main Content Wrapper --- */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-background relative">
        
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between bg-white px-6 py-4 shadow-sm z-20">
             <div className="flex items-center gap-2 h-10">
                <Logo className="h-full w-auto text-primary" />
             </div>
             <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-text-main bg-slate-100 rounded-xl">
                {isMobileMenuOpen ? <X size={28}/> : <Menu size={28}/>}
             </button>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
            <div className="md:hidden absolute inset-0 z-50 bg-background flex flex-col p-6">
                <div className="flex items-center justify-between mb-8">
                    <span className="font-bold text-2xl text-text-main">Menu</span>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-white rounded-full shadow-sm"><X size={28}/></button>
                </div>
                <div className="space-y-3 overflow-y-auto flex-1">
                     {(currentUser?.role === 'ADMIN' || currentUser?.role === 'LOGISTICA_PLANEJAMENTO') && (
                        <>
                            <NavItem view="DASHBOARD" label="Dashboard" icon={LayoutDashboard} />
                            <NavItem view="LOAD_MAPS" label="Cargas & Rotas" icon={Map} />
                        </>
                     )}
                     {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SEPARACAO') && (
                         <NavItem view="SEPARATION_LIST" label="Separação" icon={CheckSquare} />
                     )}
                     {(currentUser?.role === 'ADMIN' || currentUser?.role === 'STATUS_OPERACAO') && (
                         <NavItem view="OPERATION_LIST" label="Operação" icon={Activity} />
                     )}
                     {currentUser?.role === 'ADMIN' && (
                        <>
                            <div className="h-px bg-slate-200 my-4"></div>
                            <NavItem view="SETTINGS" label="Configurações" icon={Settings} />
                        </>
                     )}
                     <div className="mt-8">
                        <button onClick={onLogout} className="w-full py-4 flex items-center justify-center gap-2 text-red-600 bg-red-50 rounded-2xl font-bold text-lg"><LogOut size={24}/> Sair</button>
                     </div>
                </div>
            </div>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-auto scroll-smooth">
            {/* Top Bar (Search/Notifications) for Desktop */}
            <div className="sticky top-0 z-30 flex items-center justify-between px-10 py-6 bg-background/95 backdrop-blur-md">
                {/* Search Bar - Larger and cleaner */}
                <div className="flex-1 max-w-2xl">
                     <div className="flex w-full items-center bg-white rounded-2xl shadow-soft px-6 h-14 focus-within:ring-2 focus-within:ring-primary/20 transition-all border border-transparent focus-within:border-primary/20">
                        <Search size={24} className="text-slate-400" />
                        <input type="text" placeholder="Pesquisar cargas, notas ou clientes..." className="flex-1 h-full ml-4 outline-none text-base font-medium bg-transparent text-text-main placeholder:text-text-light" />
                     </div>
                </div>
                <div className="flex items-center gap-6 ml-6">
                     <button className="size-14 rounded-2xl bg-white text-text-secondary hover:text-primary shadow-soft relative transition-all hover:-translate-y-1 hover:shadow-lg flex items-center justify-center">
                        <Bell size={24} />
                        <span className="absolute top-3 right-4 size-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                     </button>
                </div>
            </div>

            <div className="px-6 sm:px-10 pb-12 max-w-[1800px] mx-auto">
                 {children}
            </div>
        </main>
      </div>
    </div>
  );
};