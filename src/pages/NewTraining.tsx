import React, { useState, useEffect, useRef } from "react";
import { Check, ChevronRight, Play, Square, RotateCcw, FileText, Upload, PenTool, Loader2, Clock } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "sonner";
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
  PHASES,
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
  const [currentActivity, setCurrentActivity] = useState<string>("");
  const [sessions, setSessions] = useState<Array<{ activity: string, seconds: number, start: string, end: string }>>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Signature
  const sigPad = useRef<SignatureCanvas>(null);
  const [hasSignature, setHasSignature] = useState(false);

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

  const handleToggleTimer = () => {
    if (!timerActive) {
      if (!currentActivity) {
        toast.error("Selecione uma atividade antes de iniciar o tempo.");
        return;
      }
      setStartTime(new Date().toISOString());
      setTimerActive(true);
    } else {
      const endTime = new Date().toISOString();
      if (seconds > 0) {
        setSessions([...sessions, {
          activity: currentActivity,
          seconds: seconds,
          start: startTime!,
          end: endTime
        }]);
      }
      setTimerActive(false);
      setSeconds(0);
      setStartTime(null);
      toast.success(`Sessão de "${currentActivity}" registrada!`);
    }
  };

  const totalSeconds = sessions.reduce((acc, s) => acc + s.seconds, 0) + (timerActive ? seconds : 0);

  const isComplete = 
    trainee.nome && trainee.cpf && trainee.matricula && config.local &&
    Object.keys(scoresA).length === CRITERIA_A.length &&
    Object.keys(scoresB).length === CRITERIA_B.length &&
    Object.keys(resultsC).length >= 20 &&
    hasSignature;

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const handleNext = () => {
    if (step === 1) {
      if (!trainee.nome || !trainee.cpf || !trainee.matricula || !config.local) {
        toast.error("Preencha todos os campos obrigatórios.");
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

  const handleSaveOngoing = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let horasNecessarias = 0;
      let prazoDias = 0;

      if (config.tipoTreinamento === TrainingType.FORMACAO || config.tipoTreinamento === TrainingType.TROCA_POSTO) {
        horasNecessarias = 40 * 3600; // 40 hours in seconds
        prazoDias = 30;
      } else if (config.tipoTreinamento === TrainingType.ATUALIZACAO) {
        horasNecessarias = 12 * 3600; // 12 hours base
        prazoDias = 180;
      }

      const initialAtividadesStatus: Record<string, any> = {};
      config.atividades.forEach(act => {
        initialAtividadesStatus[act] = {
          concluida: false,
          notas_a: {},
          notas_b: {},
          resultados_c: {},
          tempo_segundos: sessions.filter(s => s.activity === act).reduce((acc, s) => acc + s.seconds, 0)
        };
      });

      const { data: trainingData, error: insertError } = await supabase
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
          iniciado_em: new Date().toISOString(),
          horas_acumuladas: totalSeconds,
          horas_necessarias: horasNecessarias,
          prazo_dias: prazoDias,
          status: 'em_andamento',
          notas_a: scoresA,
          notas_b: scoresB,
          resultados_c: resultsC,
          current_phase: 1,
          atividades_status: initialAtividadesStatus
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Save sessions to history
      const finalSessions = [...sessions];
      if (timerActive && seconds > 0) {
        finalSessions.push({
          activity: currentActivity,
          seconds: seconds,
          start: startTime!,
          end: new Date().toISOString()
        });
      }

      if (finalSessions.length > 0) {
        const historyRecords = finalSessions.map(s => ({
          treinamento_id: trainingData.id,
          nome_atividade: s.activity,
          hora_inicio: s.start,
          hora_fim: s.end,
          tempo_execucao: s.seconds
        }));

        const { error: historyError } = await supabase
          .from('historico_atividades')
          .insert(historyRecords);
        
        if (historyError) throw historyError;
      }

      toast.success("Treinamento iniciado e histórico registrado!");
      onComplete();
    } catch (err: any) {
      toast.error("Erro ao salvar treinamento: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalize = async () => {
    if (sigPad.current?.isEmpty()) {
      toast.error("Por favor, assine o documento.");
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
      const { data: trainingData, error: insertError } = await supabase
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
          iniciado_em: startTime || new Date().toISOString(),
          encerrado_em: new Date().toISOString(),
          horas_acumuladas: totalSeconds,
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
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Save sessions to history
      const finalSessions = [...sessions];
      if (timerActive && seconds > 0) {
        finalSessions.push({
          activity: currentActivity,
          seconds: seconds,
          start: startTime!,
          end: new Date().toISOString()
        });
      }

      if (finalSessions.length > 0) {
        const historyRecords = finalSessions.map(s => ({
          treinamento_id: trainingData.id,
          nome_atividade: s.activity,
          hora_inicio: s.start,
          hora_fim: s.end,
          tempo_execucao: s.seconds
        }));

        await supabase.from('historico_atividades').insert(historyRecords);
      }

      toast.success("Treinamento finalizado e salvo com sucesso!");
      onComplete();
    } catch (err: any) {
      console.error("Error saving training:", err);
      if (err.message === "Failed to fetch") {
        toast.error("Erro de conexão com o Supabase. Verifique sua internet.");
      } else {
        toast.error("Erro ao salvar treinamento: " + err.message);
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
        <StepItem 
          num={1} 
          label="Dados" 
          active={step === 1} 
          done={step > 1} 
          onClick={() => setStep(1)}
        />
        <div className="flex-1 h-px bg-border2 mx-2 sm:mx-4" />
        <StepItem 
          num={2} 
          label="Avaliação" 
          active={step === 2} 
          done={step > 2} 
          onClick={() => {
            if (trainee.nome && trainee.cpf && trainee.matricula && config.local) {
              setStep(2);
            } else {
              toast.error("Preencha os dados obrigatórios primeiro.");
            }
          }}
        />
        <div className="flex-1 h-px bg-border2 mx-2 sm:mx-4" />
        <StepItem 
          num={3} 
          label="Resultado" 
          active={step === 3} 
          done={step > 3} 
          onClick={() => {
            if (Object.keys(scoresA).length === CRITERIA_A.length && Object.keys(scoresB).length === CRITERIA_B.length) {
              setStep(3);
            } else {
              toast.error("Complete as avaliações primeiro.");
            }
          }}
        />
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
              {(config.tipoTreinamento === TrainingType.FORMACAO || config.tipoTreinamento === TrainingType.TROCA_POSTO 
                ? PHASES[0].activities 
                : ACTIVITIES
              ).map((act) => (
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
          <div className="bg-surface border border-border p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <div className="flex-1 space-y-4 w-full">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted font-mono uppercase tracking-wider">Atividade Atual</label>
                  <select
                    disabled={timerActive}
                    className="w-full p-2.5 border border-border2 focus:border-accent outline-none bg-surface text-sm"
                    value={currentActivity}
                    onChange={(e) => setCurrentActivity(e.target.value)}
                  >
                    <option value="">Selecione a atividade para cronometrar...</option>
                    {config.atividades.map((act) => (
                      <option key={act} value={act}>{act}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-[10px] text-muted font-mono uppercase tracking-wider mb-1">Tempo da Sessão</div>
                    <div className={cn("text-3xl font-bold font-mono tracking-wider", timerActive ? "text-accent" : "text-text")}>
                      {formatTime(seconds)}
                    </div>
                  </div>
                  <div className="h-10 w-px bg-border mx-2" />
                  <div>
                    <div className="text-[10px] text-muted font-mono uppercase tracking-wider mb-1">Total Acumulado</div>
                    <div className="text-xl font-bold font-mono text-muted">
                      {formatTime(totalSeconds)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 w-full md:w-auto">
                <button
                  onClick={handleToggleTimer}
                  className={cn(
                    "px-8 py-4 text-white text-[13px] font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95",
                    timerActive ? "bg-danger hover:bg-danger-dark" : "bg-accent hover:bg-accent-dark"
                  )}
                >
                  {timerActive ? (
                    <><Square size={18} fill="currentColor" /> PARAR SESSÃO</>
                  ) : (
                    <><Play size={18} fill="currentColor" /> INICIAR SESSÃO</>
                  )}
                </button>
                {sessions.length > 0 && (
                  <div className="text-[11px] text-center text-muted font-medium">
                    {sessions.length} sessões registradas
                  </div>
                )}
              </div>
            </div>

            {sessions.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border">
                <div className="text-[10px] text-muted font-mono uppercase tracking-wider mb-3">Histórico desta Avaliação</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sessions.map((s, i) => (
                    <div key={i} className="p-3 bg-surface2 border border-border rounded flex justify-between items-center">
                      <div className="truncate pr-2">
                        <div className="text-[11px] font-bold truncate">{s.activity}</div>
                        <div className="text-[10px] text-muted">{new Date(s.start).toLocaleTimeString()}</div>
                      </div>
                      <div className="text-[12px] font-mono font-bold text-accent">{formatTime(s.seconds)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                <InfoRow label="Duração Total" value={formatTime(totalSeconds)} />
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
                    onEnd={() => setHasSignature(true)}
                  />
                  {!hasSignature && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[12px] text-hint font-mono">
                      Assine aqui
                    </div>
                  )}
                </div>
                <div className="p-2 bg-surface2 border-t border-border flex justify-end gap-2">
                  <button
                    onClick={() => {
                      sigPad.current?.clear();
                      setHasSignature(false);
                    }}
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
              onClick={handleSaveOngoing}
              disabled={submitting}
              className="px-5 py-2.5 bg-accent hover:bg-accent-dark text-white text-[13px] font-medium transition-colors flex items-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
              Salvar como Em Andamento
            </button>
            {isComplete && (
              <button
                onClick={handleFinalize}
                disabled={submitting}
                className="px-5 py-2.5 bg-success hover:bg-green-700 text-white text-[13px] font-medium transition-colors flex items-center gap-2"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                Finalizar e Salvar Treinamento
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const StepItem = ({ num, label, active, done, onClick }: { num: number; label: string; active: boolean; done: boolean; onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="flex items-center gap-1.5 sm:gap-2 group outline-none"
  >
    <div
      className={cn(
        "w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-[10px] sm:text-[11px] font-mono font-bold border transition-all",
        active ? "bg-accent border-accent text-white" : done ? "bg-success border-success text-white" : "bg-surface border-border2 text-hint group-hover:border-accent"
      )}
    >
      {done ? <Check size={10} /> : num}
    </div>
    <span className={cn("text-[11px] sm:text-[12px] whitespace-nowrap", active ? "text-accent font-medium" : done ? "text-success" : "text-hint group-hover:text-accent", "hidden xs:inline")}>
      {label}
    </span>
  </button>
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
