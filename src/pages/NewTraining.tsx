import React, { useState, useEffect, useRef } from "react";
import { Check, ChevronRight, Play, Square, RotateCcw, FileText, Upload, PenTool, Loader2 } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { cn, maskCPF, unmaskCPF } from "../lib/utils";
import { supabase } from "../lib/supabase";
import {
  TrainingType,
  FormType,
  TrainingStatus,
  TraineeData,
  TrainingConfig,
} from "../types";
import {
  CRITERIA_A,
  CRITERIA_B,
  SCENARIOS_C,
  LOCATIONS_AERODROME,
  LOCATIONS_AEREO,
  ACTIVITIES,
} from "../constants";

interface NewTrainingProps {
  onComplete: () => void;
}

export const NewTraining: React.FC<NewTrainingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [trainee, setTrainee] = useState<TraineeData>({
    nome: "",
    cpf: "",
    matricula: "",
  });
  const [config, setConfig] = useState<TrainingConfig>({
    tipoFormulario: FormType.AERODROME,
    tipoTreinamento: TrainingType.FORMACAO,
    local: "",
    atividades: [],
  });

  // Evaluation State
  const [scoresA, setScoresA] = useState<Record<number, number>>({});
  const [scoresB, setScoresB] = useState<Record<number, number>>({});
  const [resultsC, setResultsC] = useState<Record<number, boolean>>({});
  const [observacoes, setObservacoes] = useState("");

  // Timer State
  const [seconds, setSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [startTime, setStartTime] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Signature
  const sigPad = useRef<SignatureCanvas>(null);

  useEffect(() => {
    if (timerActive) {
      if (!startTime) setStartTime(new Date().toISOString());
      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const handleNext = () => {
    if (step === 1) {
      if (!trainee.nome || !trainee.cpf || !trainee.matricula || !config.local) {
        alert("Preencha todos os campos obrigatórios.");
        return;
      }
    }
    setStep(step + 1);
  };

  const handlePrev = () => setStep(step - 1);

  const toggleActivity = (act: string) => {
    setConfig((prev) => ({
      ...prev,
      atividades: prev.atividades.includes(act)
        ? prev.atividades.filter((a) => a !== act)
        : [...prev.atividades, act],
    }));
  };

  const calculateResult = () => {
    const valuesA = Object.values(scoresA) as number[];
    const valuesB = Object.values(scoresB) as number[];
    const avgA = valuesA.length > 0 ? valuesA.reduce((a, b) => a + b, 0) / CRITERIA_A.length : 0;
    const avgB = valuesB.length > 0 ? valuesB.reduce((a, b) => a + b, 0) / CRITERIA_B.length : 0;
    const totalC = Object.keys(resultsC).length;
    const hitsC = (Object.values(resultsC) as boolean[]).filter(Boolean).length;
    const pctC = totalC > 0 ? (hitsC / totalC) * 100 : 0;

    const isApto = avgA >= 7 && avgB >= 7 && pctC >= 70 && totalC >= 20;
    return { avgA, avgB, pctC, hitsC, totalC, isApto };
  };

  const result = calculateResult();

  const handleFinalize = async () => {
    if (sigPad.current?.isEmpty()) {
      alert("Por favor, assine o documento.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Save Signature
      const sigData = sigPad.current?.getTrimmedCanvas().toDataURL("image/png");
      let signatureUrl = "";
      if (sigData) {
        const blob = await (await fetch(sigData)).blob();
        const fileName = `signatures/${user.id}/${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage
          .from('assinaturas')
          .upload(fileName, blob);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('assinaturas')
          .getPublicUrl(fileName);
        
        signatureUrl = publicUrl;
      }

      // 2. Save Training
      const { error: insertError } = await supabase
        .from('treinamentos')
        .insert({
          treinador_id: user.id,
          colaborador_nome: trainee.nome,
          colaborador_cpf: unmaskCPF(trainee.cpf),
          colaborador_mat: trainee.matricula,
          tipo_formulario: config.tipoFormulario,
          tipo_treinamento: config.tipoTreinamento,
          local_treinamento: config.local,
          atividades: config.atividades,
          iniciado_em: startTime,
          encerrado_em: new Date().toISOString(),
          notas_a: scoresA,
          notas_b: scoresB,
          resultados_c: resultsC,
          media_a: result.avgA,
          media_b: result.avgB,
          percentual_c: result.pctC,
          situacao: result.isApto ? 'apto' : 'nao_apto',
          observacoes: observacoes,
          assinatura_treinador_url: signatureUrl,
          status: 'concluido'
        });

      if (insertError) throw insertError;

      alert("Treinamento finalizado e salvo com sucesso!");
      onComplete();
    } catch (err: any) {
      console.error("Error saving training:", err);
      if (err.message === "Failed to fetch") {
        alert("Erro de conexão com o Supabase. Verifique sua internet.");
      } else {
        alert("Erro ao salvar treinamento: " + err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="page-header">
        <h2 className="text-xl font-semibold text-text">Novo Treinamento</h2>
        <p className="text-[13px] text-muted mt-1">
          Preencha os dados do colaborador e inicie a avaliação
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between max-w-3xl mx-auto mb-10 px-2">
        <StepItem num={1} label="Dados" active={step === 1} done={step > 1} />
        <div className="flex-1 h-px bg-border2 mx-2 sm:mx-4" />
        <StepItem num={2} label="Avaliação" active={step === 2} done={step > 2} />
        <div className="flex-1 h-px bg-border2 mx-2 sm:mx-4" />
        <StepItem num={3} label="Resultado" active={step === 3} done={step > 3} />
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <Card title="Dados do Colaborador" tag="Obrigatório">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[12px] font-medium uppercase tracking-wider">Nome Completo *</label>
                <input
                  className="w-full p-2.5 border border-border2 focus:border-accent outline-none"
                  value={trainee.nome}
                  onChange={(e) => setTrainee({ ...trainee, nome: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium uppercase tracking-wider">CPF *</label>
                <input
                  className="w-full p-2.5 border border-border2 focus:border-accent outline-none"
                  value={trainee.cpf}
                  onChange={(e) => setTrainee({ ...trainee, cpf: maskCPF(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium uppercase tracking-wider">Matrícula *</label>
                <input
                  className="w-full p-2.5 border border-border2 focus:border-accent outline-none"
                  value={trainee.matricula}
                  onChange={(e) => setTrainee({ ...trainee, matricula: e.target.value })}
                />
              </div>
            </div>
          </Card>

          <Card title="Configuração do Treinamento" tag="Obrigatório">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium uppercase tracking-wider">Tipo de Formulário *</label>
                <select
                  className="w-full p-2.5 border border-border2 focus:border-accent outline-none bg-surface"
                  value={config.tipoFormulario}
                  onChange={(e) => setConfig({ ...config, tipoFormulario: e.target.value as FormType, local: "" })}
                >
                  <option value={FormType.AERODROME}>Operador Aeródromo</option>
                  <option value={FormType.AEREO}>Operador Aéreo</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium uppercase tracking-wider">Tipo de Treinamento *</label>
                <select
                  className="w-full p-2.5 border border-border2 focus:border-accent outline-none bg-surface"
                  value={config.tipoTreinamento}
                  onChange={(e) => setConfig({ ...config, tipoTreinamento: e.target.value as TrainingType })}
                >
                  <option value={TrainingType.FORMACAO}>Formação</option>
                  <option value={TrainingType.ATUALIZACAO}>Atualização</option>
                  <option value={TrainingType.TROCA_POSTO}>Troca de Posto</option>
                  <option value={TrainingType.RECICLAGEM}>Reciclagem</option>
                  <option value={TrainingType.PROFICIENCIA}>Proficiência</option>
                </select>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[12px] font-medium uppercase tracking-wider">Local do Treinamento *</label>
                <select
                  className="w-full p-2.5 border border-border2 focus:border-accent outline-none bg-surface"
                  value={config.local}
                  onChange={(e) => setConfig({ ...config, local: e.target.value })}
                >
                  <option value="">Selecione o local...</option>
                  {(config.tipoFormulario === FormType.AERODROME ? LOCATIONS_AERODROME : LOCATIONS_AEREO).map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <Card title="Atividades Executadas" tag="Obrigatório">
            <div className="space-y-2">
              {ACTIVITIES.map((act) => (
                <label
                  key={act}
                  className={cn(
                    "flex items-start gap-3 p-3 border cursor-pointer transition-all text-[13px]",
                    config.atividades.includes(act)
                      ? "bg-accent-light border-accent"
                      : "bg-surface border-border hover:bg-surface2"
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-accent"
                    checked={config.atividades.includes(act)}
                    onChange={() => toggleActivity(act)}
                  />
                  <span>{act}</span>
                </label>
              ))}
            </div>
          </Card>

          <div className="flex justify-end gap-3 mt-8">
            <button className="px-5 py-2.5 bg-surface2 hover:bg-surface3 border border-border2 text-[13px] font-medium transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleNext}
              className="px-5 py-2.5 bg-accent hover:bg-accent-dark text-white text-[13px] font-medium transition-colors flex items-center gap-2"
            >
              Próximo: Iniciar Avaliação <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-surface border border-border p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8 shadow-sm">
            <div className="flex items-center justify-between sm:block">
              <div>
                <div className="text-[10px] text-muted font-mono uppercase tracking-wider mb-1">Tempo</div>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-text tracking-wider">{formatTime(seconds)}</div>
              </div>
              <div className="sm:hidden">
                {!timerActive ? (
                  <button
                    onClick={() => setTimerActive(true)}
                    className="p-2 bg-accent text-white rounded-full"
                  >
                    <Play size={20} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    onClick={() => setTimerActive(false)}
                    className="p-2 bg-surface2 border border-border2 text-text rounded-full"
                  >
                    <Square size={20} fill="currentColor" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 border-t sm:border-t-0 sm:border-l border-border pt-4 sm:pt-0 sm:pl-8">
              <div className="text-[11px] text-muted uppercase tracking-wider">Colaborador</div>
              <div className="text-base sm:text-lg font-semibold">{trainee.nome}</div>
              <div className="text-[11px] font-mono text-muted">CPF: {trainee.cpf}</div>
            </div>
            <div className="hidden sm:flex gap-3">
              {!timerActive ? (
                <button
                  onClick={() => setTimerActive(true)}
                  className="px-5 py-2.5 bg-accent hover:bg-accent-dark text-white text-[13px] font-bold flex items-center gap-2"
                >
                  <Play size={16} fill="currentColor" /> INICIAR
                </button>
              ) : (
                <button
                  onClick={() => setTimerActive(false)}
                  className="px-5 py-2.5 bg-surface2 hover:bg-surface3 border border-border2 text-[13px] font-bold flex items-center gap-2"
                >
                  <Square size={16} fill="currentColor" /> ENCERRAR
                </button>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <EvalSection
              title="Avaliação A — Comportamento"
              criteria={CRITERIA_A}
              scores={scoresA}
              onScoreChange={(idx, val) => setScoresA({ ...scoresA, [idx]: val })}
              minScore={7}
            />
            <EvalSection
              title="Avaliação B — Detecção de Ameaças"
              criteria={CRITERIA_B}
              scores={scoresB}
              onScoreChange={(idx, val) => setScoresB({ ...scoresB, [idx]: val })}
              minScore={7}
            />
            <div className="bg-surface border border-border shadow-sm">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <span className="text-[13px] font-semibold text-text">
                  Avaliação C — Testes Aleatórios de Ameaça
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 bg-surface2 border border-border text-muted">
                  Mínimo 70% · ≥20 testes
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface2">
                      <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-2 px-4 border-b border-border">Cenário</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-2 px-4 border-b border-border">Resultado</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-2 px-4 border-b border-border">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {SCENARIOS_C.map((c, i) => (
                      <tr key={i} className="hover:bg-surface2 transition-colors">
                        <td className="p-2.5 px-4 text-[13px]">{c}</td>
                        <td className="p-2.5 px-4">
                          <select
                            className="p-1 border border-border2 text-[12px] outline-none bg-surface"
                            value={resultsC[i] === undefined ? "" : resultsC[i] ? "hit" : "miss"}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "") {
                                const newResults = { ...resultsC };
                                delete newResults[i];
                                setResultsC(newResults);
                              } else {
                                setResultsC({ ...resultsC, [i]: val === "hit" });
                              }
                            }}
                          >
                            <option value="">—</option>
                            <option value="hit">✅ Identificou</option>
                            <option value="miss">❌ Falhou</option>
                          </select>
                        </td>
                        <td className="p-2.5 px-4">
                          {resultsC[i] !== undefined && (
                            <span className={cn("px-2 py-0.5 text-[11px] font-mono font-semibold", resultsC[i] ? "bg-success-light text-success" : "bg-danger-light text-danger")}>
                              {resultsC[i] ? "IDENTIFICOU" : "FALHOU"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 px-5 bg-surface2 border-t border-border flex items-center justify-between">
                <div className="text-[13px] text-muted">Aproveitamento mínimo: <strong>70%</strong> de acertos em no mínimo 20 testes</div>
                <div className={cn("font-mono font-bold text-lg", result.pctC >= 70 && result.totalC >= 20 ? "text-success" : "text-danger")}>
                  {result.pctC.toFixed(0)}% ({result.hitsC}/{result.totalC})
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between gap-3 mt-8">
            <button onClick={handlePrev} className="px-5 py-2.5 bg-surface2 hover:bg-surface3 border border-border2 text-[13px] font-medium transition-colors">
              ← Voltar
            </button>
            <button
              onClick={handleNext}
              className="px-5 py-2.5 bg-accent hover:bg-accent-dark text-white text-[13px] font-medium transition-colors flex items-center gap-2"
            >
              Finalizar e Ver Resultado <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8">
          <div className={cn("p-5 px-6 flex items-center gap-4 border", result.isApto ? "bg-success-light border-green-300" : "bg-danger-light border-red-300")}>
            <div className="text-3xl">{result.isApto ? "✅" : "❌"}</div>
            <div>
              <div className={cn("text-2xl font-bold", result.isApto ? "text-success" : "text-danger")}>
                {result.isApto ? "APTO" : "NÃO APTO"}
              </div>
              <div className="text-[13px] text-muted mt-0.5">Resultado gerado automaticamente com base nas avaliações A, B e C</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Resumo da Avaliação">
              <div className="divide-y divide-border">
                <InfoRow label="Colaborador" value={trainee.nome} />
                <InfoRow label="CPF" value={trainee.cpf} />
                <InfoRow label="Matrícula" value={trainee.matricula} />
                <InfoRow label="Tipo de Treinamento" value={config.tipoTreinamento} />
                <InfoRow label="Local" value={config.local} />
                <InfoRow label="Duração Total" value={formatTime(seconds)} />
                <InfoRow label="Avaliação A (média)" value={`${result.avgA.toFixed(1)} / 10 ${result.avgA >= 7 ? "✅" : "❌"}`} />
                <InfoRow label="Avaliação B (média)" value={`${result.avgB.toFixed(1)} / 10 ${result.avgB >= 7 ? "✅" : "❌"}`} />
                <InfoRow label="Avaliação C (acertos)" value={`${result.pctC.toFixed(0)}% (${result.hitsC}/${result.totalC}) ${result.pctC >= 70 && result.totalC >= 20 ? "✅" : "❌"}`} />
                <InfoRow label="Data/Hora" value={new Date().toLocaleString("pt-BR")} />
              </div>
            </Card>

            <div className="space-y-6">
              <Card title="Observações">
                <textarea
                  className="w-full p-3 border border-border2 focus:border-accent outline-none text-[13px] min-h-[100px]"
                  placeholder="Registre observações técnicas, principais pontos abordados..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </Card>
              <Card title="Assinatura Digital do Treinador">
                <div className="border border-border2 bg-surface relative">
                  <SignatureCanvas
                    ref={sigPad}
                    penColor="#111827"
                    canvasProps={{ className: "w-full h-[120px] cursor-crosshair" }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[12px] text-hint font-mono">
                    Assine aqui
                  </div>
                </div>
                <div className="p-2 bg-surface2 border-t border-border flex justify-end gap-2">
                  <button
                    onClick={() => sigPad.current?.clear()}
                    className="px-2.5 py-1 bg-surface border border-border text-[11px] font-medium hover:bg-surface3"
                  >
                    Limpar
                  </button>
                </div>
              </Card>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button 
              onClick={handlePrev} 
              className="px-5 py-2.5 bg-surface2 hover:bg-surface3 border border-border2 text-[13px] font-medium transition-colors"
              disabled={submitting}
            >
              Voltar
            </button>
            <button
              onClick={handleFinalize}
              disabled={submitting}
              className="px-5 py-2.5 bg-success hover:bg-green-700 text-white text-[13px] font-medium transition-colors flex items-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              Finalizar e Salvar Treinamento
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const StepItem = ({ num, label, active, done }: { num: number; label: string; active: boolean; done: boolean }) => (
  <div className="flex items-center gap-1.5 sm:gap-2">
    <div
      className={cn(
        "w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-[10px] sm:text-[11px] font-mono font-bold border transition-all",
        active ? "bg-accent border-accent text-white" : done ? "bg-success border-success text-white" : "bg-surface border-border2 text-hint"
      )}
    >
      {done ? <Check size={10} /> : num}
    </div>
    <span className={cn("text-[11px] sm:text-[12px] whitespace-nowrap", active ? "text-accent font-medium" : done ? "text-success" : "text-hint", "hidden xs:inline")}>
      {label}
    </span>
  </div>
);

const Card = ({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) => (
  <div className="bg-surface border border-border shadow-sm">
    <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
      <span className="text-[13px] font-semibold text-text">{title}</span>
      {tag && <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 bg-surface2 border border-border text-muted">{tag}</span>}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const EvalSection = ({
  title,
  criteria,
  scores,
  onScoreChange,
  minScore,
}: {
  title: string;
  criteria: string[];
  scores: Record<number, number>;
  onScoreChange: (idx: number, val: number) => void;
  minScore: number;
}) => (
  <div className="bg-surface border border-border shadow-sm">
    <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
      <span className="text-[13px] font-semibold text-text">{title}</span>
      <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 bg-surface2 border border-border text-muted">
        Nota 0–10 · Mínimo {minScore}
      </span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-surface2">
            <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-2 px-4 border-b border-border">Critério</th>
            <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-2 px-4 border-b border-border">Nota (0–10)</th>
            <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-2 px-4 border-b border-border">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {criteria.map((c, i) => (
            <tr key={i} className="hover:bg-surface2 transition-colors">
              <td className="p-2.5 px-4 text-[13px] leading-relaxed">{c}</td>
              <td className="p-2.5 px-4">
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  className="w-16 p-1 border border-border2 text-center font-mono text-[13px] outline-none focus:border-accent"
                  value={scores[i] || ""}
                  onChange={(e) => onScoreChange(i, parseFloat(e.target.value))}
                  placeholder="—"
                />
              </td>
              <td className="p-2.5 px-4">
                {scores[i] !== undefined && (
                  <span className={cn("px-2 py-0.5 text-[11px] font-mono font-semibold", scores[i] >= minScore ? "bg-success-light text-success" : "bg-danger-light text-danger")}>
                    {scores[i] >= minScore ? "APROVADO" : "REPROVADO"}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between py-2.5 text-[13px]">
    <span className="text-muted">{label}</span>
    <span className="font-mono font-medium text-text">{value}</span>
  </div>
);
