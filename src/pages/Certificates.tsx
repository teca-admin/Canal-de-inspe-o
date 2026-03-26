import React, { useState, useEffect } from "react";
import { Download, Mail, Search, Loader2 } from "lucide-react";
import { cn, maskCPF, unmaskCPF } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";

interface Certificate {
  id: string;
  colaborador_nome: string;
  colaborador_cpf: string;
  tipo_treinamento: string;
  situacao: string;
  treinador_nome?: string;
  iniciado_em: string;
  encerrado_em: string;
  prazo_dias?: number;
  status: string;
}

export const Certificates: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [filters, setFilters] = useState({
    cpf: "",
    tipo: "Todos",
    situacao: "Todos",
  });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("treinamentos")
        .select(`
          *,
          profiles:treinador_id (nome_completo)
        `)
        .order("encerrado_em", { ascending: false });

      if (filters.cpf) {
        query = query.eq("colaborador_cpf", unmaskCPF(filters.cpf));
      }
      if (filters.tipo !== "Todos") {
        query = query.eq("tipo_treinamento", filters.tipo.toLowerCase());
      }
      if (filters.situacao !== "Todos") {
        if (filters.situacao === "Em Andamento") {
          query = query.eq("status", "em_andamento");
        } else {
          query = query.eq("situacao", filters.situacao.toLowerCase());
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedData = data.map((item: any) => ({
        ...item,
        treinador_nome: item.profiles?.nome_completo || "N/A",
      }));

      setCertificates(formattedData);
    } catch (err: any) {
      toast.error("Erro ao buscar certificados: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, []);

  const handleCpfChange = async (val: string) => {
    const masked = maskCPF(val);
    setFilters({ ...filters, cpf: masked });

    if (val.length >= 3) {
      const { data } = await supabase
        .from("treinamentos")
        .select("colaborador_cpf")
        .ilike("colaborador_cpf", `${unmaskCPF(val)}%`)
        .limit(5);
      
      if (data) {
        const uniqueCpfs = Array.from(new Set(data.map(d => maskCPF(d.colaborador_cpf))));
        setSuggestions(uniqueCpfs);
        setShowSuggestions(true);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const calculateExpiration = (dateStr: string, days?: number) => {
    if (!days) return "—";
    const date = new Date(dateStr);
    const expirationDate = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
    const now = new Date();
    const diffTime = expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "Expirado";
    return `${diffDays} dias`;
  };

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
            <div className="space-y-1.5 relative">
              <label className="text-[12px] font-medium uppercase tracking-wider">CPF do Colaborador</label>
              <input 
                className="w-full p-2.5 border border-border2 focus:border-accent outline-none text-sm" 
                placeholder="000.000.000-00" 
                value={filters.cpf}
                onChange={(e) => handleCpfChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full bg-surface border border-border shadow-lg mt-1 max-h-40 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-surface2 transition-colors border-b border-border last:border-0"
                      onClick={() => {
                        setFilters({ ...filters, cpf: s });
                        setShowSuggestions(false);
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium uppercase tracking-wider">Tipo de Treinamento</label>
              <select 
                className="w-full p-2.5 border border-border2 focus:border-accent outline-none bg-surface text-sm"
                value={filters.tipo}
                onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}
              >
                <option>Todos</option>
                <option value="formacao">Formação</option>
                <option value="atualizacao">Atualização</option>
                <option value="reciclagem">Reciclagem</option>
                <option value="proficiencia">Proficiência</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium uppercase tracking-wider">Situação</label>
              <select 
                className="w-full p-2.5 border border-border2 focus:border-accent outline-none bg-surface text-sm"
                value={filters.situacao}
                onChange={(e) => setFilters({ ...filters, situacao: e.target.value })}
              >
                <option>Todos</option>
                <option value="apto">Apto</option>
                <option value="nao_apto">Não Apto</option>
                <option value="Em Andamento">Em Andamento</option>
              </select>
            </div>
          </div>
          <button 
            onClick={fetchCertificates}
            disabled={loading}
            className="px-4 py-2 bg-accent hover:bg-accent-dark text-white text-[13px] font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Buscar
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border shadow-sm overflow-x-auto scrollbar-thin">
        <div className="min-w-[900px]">
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
              {certificates.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted text-sm">
                    Nenhum certificado encontrado.
                  </td>
                </tr>
              ) : (
                certificates.map((cert) => (
                  <CertificateRow
                    key={cert.id}
                    name={cert.colaborador_nome}
                    cpf={maskCPF(cert.colaborador_cpf)}
                    type={cert.tipo_treinamento}
                    status={cert.status === 'em_andamento' ? 'Em Andamento' : cert.situacao}
                    statusColor={
                      cert.status === 'em_andamento' ? 'yellow' : 
                      cert.situacao === 'apto' ? 'green' : 'red'
                    }
                    trainer={cert.treinador_nome || "N/A"}
                    date={new Date(cert.encerrado_em || cert.iniciado_em).toLocaleDateString()}
                    expires={calculateExpiration(cert.encerrado_em || cert.iniciado_em, cert.prazo_dias)}
                    warning={cert.status === 'em_andamento'}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const CertificateRow: React.FC<{
  name: string;
  cpf: string;
  type: string;
  status: string;
  statusColor: "green" | "red" | "yellow";
  trainer: string;
  date: string;
  expires: string;
  warning?: boolean;
}> = ({
  name,
  cpf,
  type,
  status,
  statusColor,
  trainer,
  date,
  expires,
  warning,
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
