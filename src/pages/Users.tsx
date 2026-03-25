import React, { useState } from "react";
import { UserPlus, Edit2, Shield } from "lucide-react";
import { cn } from "../lib/utils";

export const Users: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [perfil, setPerfil] = useState("");

  return (
    <div className="space-y-6">
      <div className="page-header flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text">Gestão de Usuários</h2>
          <p className="text-[13px] text-muted mt-1">
            Apenas administradores podem criar e gerenciar acessos
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-accent hover:bg-accent-dark text-white text-[13px] font-medium flex items-center gap-2 transition-colors"
        >
          <UserPlus size={16} /> Cadastrar Usuário
        </button>
      </div>

      {showForm && (
        <div className="bg-surface border border-border shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="px-5 py-3.5 border-b border-border">
            <span className="text-[13px] font-semibold text-text">Novo Usuário</span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium uppercase tracking-wider">Perfil *</label>
                <select
                  className="w-full p-2.5 border border-border2 focus:border-accent outline-none bg-surface text-sm"
                  value={perfil}
                  onChange={(e) => setPerfil(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  <option value="treinador">Treinador</option>
                  <option value="generico">Genérico (Cliente / ANAC / GRU / Líder)</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium uppercase tracking-wider">Nome Completo *</label>
                <input className="w-full p-2.5 border border-border2 focus:border-accent outline-none text-sm" placeholder="Nome completo" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium uppercase tracking-wider">CPF *</label>
                <input className="w-full p-2.5 border border-border2 focus:border-accent outline-none text-sm" placeholder="000.000.000-00" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium uppercase tracking-wider">Cargo / Função *</label>
                <input className="w-full p-2.5 border border-border2 focus:border-accent outline-none text-sm" placeholder="Ex: Agente de Segurança" />
              </div>

              {perfil === "treinador" && (
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium uppercase tracking-wider">Certificações Vigentes</label>
                    <input className="w-full p-2.5 border border-border2 focus:border-accent outline-none text-sm" placeholder="Ex: AVSEC Nível 3, RBAC 107" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium uppercase tracking-wider">Tempo de Experiência</label>
                    <input className="w-full p-2.5 border border-border2 focus:border-accent outline-none text-sm" placeholder="Ex: 5 anos" />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium uppercase tracking-wider">Login (matrícula) *</label>
                <input className="w-full p-2.5 border border-border2 focus:border-accent outline-none text-sm" placeholder="Ex: 000123" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium uppercase tracking-wider">Senha *</label>
                <input className="w-full p-2.5 border border-border2 focus:border-accent outline-none text-sm" type="password" placeholder="Senha inicial" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-surface2 hover:bg-surface3 border border-border2 text-[13px] font-medium transition-colors">
                Cancelar
              </button>
              <button className="px-4 py-2 bg-accent hover:bg-accent-dark text-white text-[13px] font-medium transition-colors">
                Cadastrar Usuário
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-surface border border-border shadow-sm overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface2">
              <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Usuário</th>
              <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">CPF</th>
              <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Cargo</th>
              <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Perfil</th>
              <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Status</th>
              <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <UserRow
              name="Carlos Treinador"
              cpf="111.222.333-44"
              role="Agente de Segurança Sr."
              perfil="Treinador"
              status="Ativo"
            />
            <UserRow
              name="Ana Treinadora"
              cpf="555.666.777-88"
              role="Supervisora de Canal"
              perfil="Treinador"
              status="Ativo"
            />
            <UserRow
              name="Admin Sistema"
              cpf="000.000.000-01"
              role="Coordenador Canal Inspeção"
              perfil="Admin"
              status="Ativo"
              isAdmin
            />
          </tbody>
        </table>
      </div>
    </div>
  );
};

const UserRow = ({
  name,
  cpf,
  role,
  perfil,
  status,
  isAdmin,
}: {
  name: string;
  cpf: string;
  role: string;
  perfil: string;
  status: string;
  isAdmin?: boolean;
}) => (
  <tr className="hover:bg-surface2 transition-colors">
    <td className="p-3 px-4 text-[13px] font-medium">{name}</td>
    <td className="p-3 px-4 font-mono text-[12px]">{cpf}</td>
    <td className="p-3 px-4 text-[12px] text-muted">{role}</td>
    <td className="p-3 px-4">
      <span className={cn("px-2 py-0.5 text-[11px] font-mono font-semibold uppercase tracking-tight", isAdmin ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-surface2 border border-border text-muted")}>
        {perfil}
      </span>
    </td>
    <td className="p-3 px-4">
      <span className="px-2 py-0.5 bg-success-light text-success text-[11px] font-mono font-semibold uppercase">
        {status}
      </span>
    </td>
    <td className="p-3 px-4">
      <button className="p-1.5 bg-surface2 hover:bg-surface3 border border-border2 text-muted transition-colors" title="Editar">
        <Edit2 size={14} />
      </button>
    </td>
  </tr>
);
