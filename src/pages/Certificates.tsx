import React from "react";
import { Download, Mail, Search } from "lucide-react";
import { cn } from "../lib/utils";

export const Certificates: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <h2 className="text-xl font-semibold text-text">Comprovantes de Treinamento</h2>
        <p className="text-[13px] text-muted mt-1">
          Documentos armazenados por 5 anos · Acesso auditável
        </p>
      </div>

      <div className="bg-surface border border-border shadow-sm">
        <div className="px-5 py-3.5 border-b border-border">
          <span className="text-[13px] font-semibold text-text">Filtrar Documentos</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium uppercase tracking-wider">CPF do Colaborador</label>
              <input className="w-full p-2.5 border border-border2 focus:border-accent outline-none text-sm" placeholder="000.000.000-00" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium uppercase tracking-wider">Tipo de Treinamento</label>
              <select className="w-full p-2.5 border border-border2 focus:border-accent outline-none bg-surface text-sm">
                <option>Todos</option>
                <option>Formação</option>
                <option>Atualização</option>
                <option>Reciclagem</option>
                <option>Proficiência</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium uppercase tracking-wider">Situação</label>
              <select className="w-full p-2.5 border border-border2 focus:border-accent outline-none bg-surface text-sm">
                <option>Todos</option>
                <option>Apto</option>
                <option>Não Apto</option>
              </select>
            </div>
          </div>
          <button className="px-4 py-2 bg-accent hover:bg-accent-dark text-white text-[13px] font-medium flex items-center gap-2 transition-colors">
            <Search size={14} /> Buscar
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border shadow-sm overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface2">
              <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Colaborador</th>
              <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Tipo</th>
              <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Situação</th>
              <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Treinador</th>
              <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Data</th>
              <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Expira em</th>
              <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <CertificateRow
              name="Maria Costa"
              cpf="987.654.321-00"
              type="Atualização"
              status="Apto"
              statusColor="green"
              trainer="Ana Treinadora"
              date="15/01/2026"
              expires="530 dias"
            />
            <CertificateRow
              name="Pedro Alves"
              cpf="456.123.789-00"
              type="Reciclagem"
              status="Não Apto"
              statusColor="red"
              trainer="Carlos Treinador"
              date="10/01/2026"
              expires="—"
            />
            <CertificateRow
              name="Luisa Ramos"
              cpf="321.654.987-00"
              type="Atualização"
              status="Em Andamento"
              statusColor="yellow"
              trainer="Ana Treinadora"
              date="20/12/2025"
              expires="180 dias"
              warning
            />
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CertificateRow = ({
  name,
  cpf,
  type,
  status,
  statusColor,
  trainer,
  date,
  expires,
  warning,
}: {
  name: string;
  cpf: string;
  type: string;
  status: string;
  statusColor: "green" | "red" | "yellow";
  trainer: string;
  date: string;
  expires: string;
  warning?: boolean;
}) => (
  <tr className={cn("hover:bg-surface2 transition-colors", warning && "bg-warning-light/30")}>
    <td className="p-3 px-4">
      <div className="text-[13px] font-medium">{name} {warning && "⚠️"}</div>
      <div className="text-[11px] font-mono text-muted">{cpf}</div>
    </td>
    <td className="p-3 px-4">
      <span className="px-2 py-0.5 bg-surface2 border border-border text-[11px] font-mono text-muted uppercase">
        {type}
      </span>
    </td>
    <td className="p-3 px-4">
      <span
        className={cn(
          "px-2 py-0.5 text-[11px] font-mono font-semibold uppercase tracking-tight",
          statusColor === "green" && "bg-success-light text-success",
          statusColor === "red" && "bg-danger-light text-danger",
          statusColor === "yellow" && "bg-warning-light text-warning"
        )}
      >
        {status}
      </span>
    </td>
    <td className="p-3 px-4 text-[12px]">{trainer}</td>
    <td className="p-3 px-4 font-mono text-[12px]">{date}</td>
    <td className={cn("p-3 px-4 font-mono text-[12px]", warning && "text-warning font-bold")}>{expires}</td>
    <td className="p-3 px-4">
      <div className="flex gap-2">
        <button className="p-1.5 bg-surface2 hover:bg-surface3 border border-border2 text-muted transition-colors" title="Baixar PDF">
          <Download size={14} />
        </button>
        <button className="p-1.5 bg-surface2 hover:bg-surface3 border border-border2 text-muted transition-colors" title="Enviar por E-mail">
          <Mail size={14} />
        </button>
      </div>
    </td>
  </tr>
);
