import React from 'react';
import { X, UserPlus, Save } from 'lucide-react';
import type { User, UserRole } from '../types';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;

  editingUser: User | null;

  userFormName: string;
  setUserFormName: (value: string) => void;

  userFormRole: UserRole;
  setUserFormRole: (role: UserRole) => void;

  handleSaveUser: (e: React.FormEvent) => void;
}

export const UserFormModal: React.FC<UserFormModalProps> = ({
  isOpen,
  onClose,
  editingUser,
  userFormName,
  setUserFormName,
  userFormRole,
  setUserFormRole,
  handleSaveUser
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111621]/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-[#e7ebf3]">
        <div className="flex items-center justify-between p-8 bg-white border-b border-[#e7ebf3]">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 shadow-sm">
              {editingUser ? (
                <Save className="text-primary" size={28} />
              ) : (
                <UserPlus className="text-primary" size={28} />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0e121b]">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
              <p className="text-base text-gray-500 font-medium">
                {editingUser ? `Atualize os dados de ${editingUser.name}` : 'Cadastre um usuário e defina a permissão.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
            aria-label="Fechar"
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSaveUser} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-[#4e6797]">
              Nome
            </label>
            <input
              value={userFormName}
              onChange={(e) => setUserFormName(e.target.value)}
              className="w-full px-5 py-4 bg-gray-50 rounded-xl border border-[#e7ebf3] focus:outline-none focus:ring-2 focus:ring-primary/20 text-base font-medium text-[#0e121b]"
              placeholder="Ex: Maria Silva"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-[#4e6797]">
              Permissão
            </label>
            <select
              value={userFormRole}
              onChange={(e) => setUserFormRole(e.target.value as UserRole)}
              className="w-full px-5 py-4 bg-gray-50 rounded-xl border border-[#e7ebf3] focus:outline-none focus:ring-2 focus:ring-primary/20 text-base font-bold text-[#0e121b]"
              required
            >
              <option value="ADMIN">Administrador</option>
              <option value="LOGISTICA_PLANEJAMENTO">Planejamento Logístico</option>
              <option value="SEPARACAO">Equipe de Separação</option>
              <option value="STATUS_OPERACAO">Operação & Trânsito</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-white border border-[#e7ebf3] text-[#0e121b] rounded-lg hover:bg-gray-50 font-bold transition-all"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-8 py-3 bg-[#111621] text-white rounded-lg hover:bg-black font-bold transition-all shadow-md flex items-center gap-2"
            >
              <Save size={18} />
              {editingUser ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};