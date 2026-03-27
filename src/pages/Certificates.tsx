import React, { useState, useEffect } from "react";
import { Download, Mail, Search, Loader2 } from "lucide-react";
import { cn, maskCPF, unmaskCPF } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CRITERIA_A, CRITERIA_B, SCENARIOS_C } from "../constants";

interface Certificate {
  id: string;
  colaborador_nome: string;
  colaborador_cpf: string;
  colaborador_mat: string;
  tipo_treinamento: string;
  situacao: string;
  treinador_nome?: string;
  iniciado_em: string;
  encerrado_em: string;
  prazo_dias?: number;
  status: string;
  local_treinamento?: string;
  atividades?: string[];
  atividades_status?: Record<string, {
    concluida: boolean;
    notas_a: Record<number, number>;
    notas_b: Record<number, number>;
    resultados_c: Record<number, boolean>;
    tempo_segundos: number;
    assinatura_treinador_url?: string;
    assinatura_aluno_url?: string;
  }>;
  notas_a?: Record<number, number>;
  notas_b?: Record<number, number>;
  resultados_c?: Record<number, boolean>;
  media_a?: number;
  media_b?: number;
  percentual_c?: number;
  observacoes?: string;
  assinatura_treinador_url?: string;
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

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const generatePDF = async (cert: Certificate) => {
    toast.info(`Gerando PDF para ${cert.colaborador_nome}...`);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(18);
      doc.setTextColor(17, 24, 39); // text-text color
      doc.text("Comprovante de Treinamento", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128); // text-muted color
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageWidth / 2, 28, { align: "center" });

      // Student & Trainer Info
      autoTable(doc, {
        startY: 35,
        head: [["Informações Gerais", ""]],
        body: [
          ["Colaborador:", cert.colaborador_nome],
          ["CPF:", maskCPF(cert.colaborador_cpf)],
          ["Matrícula:", cert.colaborador_mat || "N/A"],
          ["Treinador:", cert.treinador_nome || "N/A"],
          ["Tipo de Treinamento:", cert.tipo_treinamento.toUpperCase()],
          ["Local:", cert.local_treinamento || "N/A"],
          ["Data de Início:", new Date(cert.iniciado_em).toLocaleDateString("pt-BR")],
          ["Data de Término:", cert.encerrado_em ? new Date(cert.encerrado_em).toLocaleDateString("pt-BR") : "Em andamento"],
          ["Situação:", cert.status === 'em_andamento' ? 'EM ANDAMENTO' : (cert.situacao?.toUpperCase() || "N/A")],
        ],
        theme: "striped",
        headStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: "bold" },
        styles: { fontSize: 9 },
      });

      // Activities and Scores
      if (cert.atividades_status && Object.keys(cert.atividades_status).length > 0) {
        Object.entries(cert.atividades_status).forEach(([actName, status], idx) => {
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(31, 41, 55);
          doc.text(`Atividade: ${actName}`, 14, (doc as any).lastAutoTable.finalY + 15);
          
          const avgA = Object.values(status.notas_a).length > 0 
            ? (Object.values(status.notas_a).reduce((a, b) => a + b, 0) / Object.values(status.notas_a).length).toFixed(1)
            : "N/A";
          const avgB = Object.values(status.notas_b).length > 0
            ? (Object.values(status.notas_b).reduce((a, b) => a + b, 0) / Object.values(status.notas_b).length).toFixed(1)
            : "N/A";
          const hitsC = Object.values(status.resultados_c).filter(v => v).length;
          const totalC = Object.values(status.resultados_c).length;
          const pctC = totalC > 0 ? `${((hitsC / totalC) * 100).toFixed(0)}%` : "N/A";

          autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 20,
            head: [["Critério", "Resultado/Média"]],
            body: [
              ["Avaliação A (Comportamento)", avgA],
              ["Avaliação B (Detecção)", avgB],
              ["Avaliação C (Testes)", pctC],
              ["Tempo de Execução", formatDuration(status.tempo_segundos)],
              ["Status", status.concluida ? "CONCLUÍDA" : "EM ANDAMENTO"]
            ],
            theme: "grid",
            headStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: "bold" },
            styles: { fontSize: 8 },
          });
        });
      } else if (cert.atividades && cert.atividades.length > 0) {
        // Fallback for old records
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 10,
          head: [["Atividades Executadas"]],
          body: cert.atividades.map(act => [act]),
          theme: "grid",
          headStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: "bold" },
          styles: { fontSize: 8 },
        });
      }

      // Scores A
      if (cert.notas_a && Object.keys(cert.notas_a).length > 0) {
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 10,
          head: [["Critério A - Comportamento", "Nota"]],
          body: CRITERIA_A.map((c, i) => [c, cert.notas_a![i] || "-"]),
          theme: "grid",
          headStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: "bold" },
          styles: { fontSize: 7 },
          columnStyles: { 1: { cellWidth: 20, halign: "center" } },
        });
      }

      // Scores B
      if (cert.notas_b && Object.keys(cert.notas_b).length > 0) {
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 10,
          head: [["Critério B - Detecção de Ameaças", "Nota"]],
          body: CRITERIA_B.map((c, i) => [c, cert.notas_b![i] || "-"]),
          theme: "grid",
          headStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: "bold" },
          styles: { fontSize: 7 },
          columnStyles: { 1: { cellWidth: 20, halign: "center" } },
        });
      }

      // Results C
      if (cert.resultados_c && Object.keys(cert.resultados_c).length > 0) {
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 10,
          head: [["Critério C - Testes de Ameaça", "Resultado"]],
          body: SCENARIOS_C.map((c, i) => [
            c, 
            cert.resultados_c![i] === undefined ? "-" : cert.resultados_c![i] ? "IDENTIFICOU" : "FALHOU"
          ]),
          theme: "grid",
          headStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: "bold" },
          styles: { fontSize: 7 },
          columnStyles: { 1: { cellWidth: 30, halign: "center" } },
        });
      }

      // Summary
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [["Resumo dos Resultados", ""]],
        body: [
          ["Média Avaliação A:", cert.media_a?.toFixed(1) || "N/A"],
          ["Média Avaliação B:", cert.media_b?.toFixed(1) || "N/A"],
          ["Aproveitamento Avaliação C:", cert.percentual_c ? `${cert.percentual_c.toFixed(0)}%` : "N/A"],
        ],
        theme: "plain",
        styles: { fontSize: 10, fontStyle: "bold" },
      });

      // Observations
      if (cert.observacoes) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Observações:", 14, (doc as any).lastAutoTable.finalY + 15);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const splitObs = doc.splitTextToSize(cert.observacoes, pageWidth - 28);
        doc.text(splitObs, 14, (doc as any).lastAutoTable.finalY + 20);
      }

      // Signature
      if (cert.assinatura_treinador_url) {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = cert.assinatura_treinador_url;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          
          const finalY = (doc as any).lastAutoTable.finalY + (cert.observacoes ? 40 : 20);
          if (finalY + 40 > doc.internal.pageSize.getHeight()) {
            doc.addPage();
            doc.addImage(img, "PNG", pageWidth / 2 - 30, 20, 60, 30);
            doc.line(pageWidth / 2 - 40, 55, pageWidth / 2 + 40, 55);
            doc.text("Assinatura do Treinador", pageWidth / 2, 60, { align: "center" });
          } else {
            doc.addImage(img, "PNG", pageWidth / 2 - 30, finalY, 60, 30);
            doc.line(pageWidth / 2 - 40, finalY + 35, pageWidth / 2 + 40, finalY + 35);
            doc.text("Assinatura do Treinador", pageWidth / 2, finalY + 40, { align: "center" });
          }
        } catch (e) {
          console.error("Erro ao carregar assinatura:", e);
        }
      }

      doc.save(`comprovante_${cert.colaborador_nome.toLowerCase().replace(/\s+/g, "_")}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar PDF: " + err.message);
    }
  };

  const handleEmail = (cert: Certificate) => {
    const subject = encodeURIComponent(`Comprovante de Treinamento - ${cert.colaborador_nome}`);
    const body = encodeURIComponent(`Olá,\n\nSegue o comprovante de treinamento de ${cert.colaborador_nome}.\n\nTipo: ${cert.tipo_treinamento.toUpperCase()}\nSituação: ${cert.status === 'em_andamento' ? 'EM ANDAMENTO' : (cert.situacao?.toUpperCase() || "N/A")}\nData: ${new Date(cert.encerrado_em || cert.iniciado_em).toLocaleDateString("pt-BR")}\n\nAtenciosamente,\nEquipe de Treinamento`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
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
                    cert={cert}
                    onDownload={() => generatePDF(cert)}
                    onEmail={() => handleEmail(cert)}
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
  cert: Certificate;
  onDownload: () => void;
  onEmail: () => void;
}> = ({
  cert,
  onDownload,
  onEmail,
}) => {
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

  const date = new Date(cert.encerrado_em || cert.iniciado_em).toLocaleDateString();
  const expires = calculateExpiration(cert.encerrado_em || cert.iniciado_em, cert.prazo_dias);
  const warning = cert.status === 'em_andamento';
  const status = cert.status === 'em_andamento' ? 'Em Andamento' : cert.situacao;
  const statusColor = cert.status === 'em_andamento' ? 'yellow' : cert.situacao === 'apto' ? 'green' : 'red';

  return (
    <tr className={cn("hover:bg-surface2 transition-colors", warning && "bg-warning-light/30")}>
      <td className="p-3 px-4">
        <div className="text-[13px] font-medium">{cert.colaborador_nome} {warning && "⚠️"}</div>
        <div className="text-[11px] font-mono text-muted">{maskCPF(cert.colaborador_cpf)}</div>
      </td>
      <td className="p-3 px-4">
        <span className="px-2 py-0.5 bg-surface2 border border-border text-[11px] font-mono text-muted uppercase">
          {cert.tipo_treinamento}
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
      <td className="p-3 px-4 text-[12px]">{cert.treinador_nome || "N/A"}</td>
      <td className="p-3 px-4 font-mono text-[12px]">{date}</td>
      <td className={cn("p-3 px-4 font-mono text-[12px]", warning && "text-warning font-bold")}>{expires}</td>
      <td className="p-3 px-4">
        <div className="flex gap-2">
          <button 
            onClick={onDownload}
            className="p-1.5 bg-surface2 hover:bg-surface3 border border-border2 text-muted transition-colors" 
            title="Baixar PDF"
          >
            <Download size={14} />
          </button>
          <button 
            onClick={onEmail}
            className="p-1.5 bg-surface2 hover:bg-surface3 border border-border2 text-muted transition-colors" 
            title="Enviar por E-mail"
          >
            <Mail size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
};
