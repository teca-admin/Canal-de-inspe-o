import React, { useState, useEffect, useRef } from "react";
import { Play, Square, Clock, AlertCircle, BarChart2, User, FileText, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { OngoingTraining, TrainingSessionRecord, TrainingType } from "../types";
import { toast } from "sonner";
import { cn } from "../lib/utils";

export const OngoingTrainings: React.FC = () => {
  const [trainings, setTrainings] = useState<OngoingTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTraining, setSelectedTraining] = useState<OngoingTraining | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [activityHistory, setActivityHistory] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<TrainingSessionRecord | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [isEditingEvals, setIsEditingEvals] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleUpdateEval = async (field: string, value: any) => {
    if (!selectedTraining) return;
    try {
      const { error } = await supabase
        .from('treinamentos')
        .update({ [field]: value })
        .eq('id', selectedTraining.id);
      
      if (error) throw error;
      
      setSelectedTraining({ ...selectedTraining, [field]: value });
      setTrainings(trainings.map(t => t.id === selectedTraining.id ? { ...t, [field]: value } : t));
    } catch (err: any) {
      toast.error("Erro ao atualizar avaliação: " + err.message);
    }
  };

  const handleFinalizeTraining = async () => {
    if (!selectedTraining) return;

    const avgA = calculateAvg(selectedTraining.notas_a);
    const avgB = calculateAvg(selectedTraining.notas_b);
    const pctC = calculatePctC(selectedTraining.resultados_c);
    const hoursMet = (selectedTraining.horas_acumuladas || 0) >= (selectedTraining.horas_necessarias || 0);

    if (!hoursMet) {
      toast.error("Carga horária insuficiente para finalizar.");
      return;
    }

    if (avgA < 7 || avgB < 7 || pctC < 70) {
      toast.error("Avaliações abaixo da média mínima.");
      return;
    }

    try {
      const { error } = await supabase
        .from('treinamentos')
        .update({ 
          status: 'concluido',
          situacao: 'apto',
          encerrado_em: new Date().toISOString()
        })
        .eq('id', selectedTraining.id);

      if (error) throw error;

      toast.success("Treinamento finalizado com sucesso!");
      setSelectedTraining(null);
      fetchTrainings();
    } catch (err: any) {
      toast.error("Erro ao finalizar treinamento: " + err.message);
    }
  };

  const fetchActivityHistory = async (trainingId: string) => {
    try {
      const { data, error } = await supabase
        .from('historico_atividades')
        .select('*')
        .eq('treinamento_id', trainingId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setActivityHistory(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar histórico:", err);
    }
  };

  useEffect(() => {
    if (selectedTraining) {
      fetchActivityHistory(selectedTraining.id);
    }
  }, [selectedTraining]);

  // Fetch ongoing trainings
  const fetchTrainings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('treinamentos')
        .select('*')
        .eq('status', 'em_andamento')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrainings(data || []);
    } catch (err: any) {
      toast.error("Erro ao carregar treinamentos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainings();
  }, []);

  // Timer logic
  useEffect(() => {
    if (activeSession) {
      timerRef.current = setInterval(() => {
        setSessionSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setSessionSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSession]);

  const handleStartSession = async (training: OngoingTraining) => {
    if (!selectedActivity) {
      toast.error("Selecione uma atividade para iniciar.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('sessoes_treinamento')
        .insert({
          training_id: training.id,
          inicio: new Date().toISOString(),
          duracao_segundos: 0
        })
        .select()
        .single();

      if (error) throw error;
      setActiveSession(data);
      setSelectedTraining(training);
      toast.success(`Sessão iniciada para: ${selectedActivity}`);
    } catch (err: any) {
      toast.error("Erro ao iniciar sessão: " + err.message);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession || !selectedTraining) return;

    try {
      const endTime = new Date().toISOString();
      const { error: sessionError } = await supabase
        .from('sessoes_treinamento')
        .update({
          fim: endTime,
          duracao_segundos: sessionSeconds
        })
        .eq('id', activeSession.id);

      if (sessionError) throw sessionError;

      // Save to historico_atividades
      const { error: historyError } = await supabase
        .from('historico_atividades')
        .insert({
          treinamento_id: selectedTraining.id,
          nome_atividade: selectedActivity,
          hora_inicio: activeSession.inicio,
          hora_fim: endTime,
          tempo_execucao: sessionSeconds
        });

      if (historyError) throw historyError;

      // Update accumulated hours in training
      const newAccumulated = (selectedTraining.horas_acumuladas || 0) + sessionSeconds;
      const { error: trainingError } = await supabase
        .from('treinamentos')
        .update({
          horas_acumuladas: newAccumulated
        })
        .eq('id', selectedTraining.id);

      if (trainingError) throw trainingError;

      toast.success("Sessão encerrada e histórico registrado!");
      setActiveSession(null);
      setSelectedActivity("");
      fetchTrainings(); // Refresh list
      fetchActivityHistory(selectedTraining.id);
    } catch (err: any) {
      toast.error("Erro ao encerrar sessão: " + err.message);
    }
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const calculateProgress = (training: OngoingTraining) => {
    if (!training.horas_necessarias) return 0;
    return Math.min((training.horas_acumuladas / training.horas_necessarias) * 100, 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h2 className="text-xl font-semibold text-text">Treinamentos em Andamento</h2>
        <p className="text-[13px] text-muted mt-1">
          Gerencie o progresso e as sessões de treinamento dos colaboradores
        </p>
      </div>

      {activeSession && selectedTraining && (
        <div className="bg-accent/5 border border-accent/20 p-6 shadow-sm animate-pulse-subtle">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-accent text-white rounded-full flex items-center justify-center">
                <Clock size={24} />
              </div>
              <div>
                <div className="text-[11px] text-accent font-bold uppercase tracking-wider">Sessão em Andamento: {selectedActivity}</div>
                <div className="text-lg font-bold text-text">{selectedTraining.colaborador_nome}</div>
                <div className="text-[12px] text-muted">{selectedTraining.tipo_treinamento} — {selectedTraining.local_treinamento}</div>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <div className="text-[10px] text-muted uppercase font-mono">Duração Atual</div>
                <div className="text-2xl font-mono font-bold text-accent">{formatDuration(sessionSeconds)}</div>
              </div>
              <button
                onClick={handleEndSession}
                className="px-6 py-3 bg-danger hover:bg-danger-dark text-white text-[13px] font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95"
              >
                <Square size={18} fill="currentColor" /> ENCERRAR SESSÃO
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trainings.map((training) => (
          <div
            key={training.id}
            className={cn(
              "bg-surface border border-border p-5 hover:border-accent/50 transition-all group cursor-pointer relative overflow-hidden",
              selectedTraining?.id === training.id && "border-accent ring-1 ring-accent/20"
            )}
            onClick={() => setSelectedTraining(training)}
          >
            {/* Progress Bar Background */}
            <div className="absolute bottom-0 left-0 h-1 bg-accent/10 w-full">
              <div 
                className="h-full bg-accent transition-all duration-500" 
                style={{ width: `${calculateProgress(training)}%` }}
              />
            </div>

            <div className="flex justify-between items-start mb-4">
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-muted uppercase tracking-wider">
                  {training.tipo_treinamento}
                </div>
                <h3 className="text-base font-bold text-text group-hover:text-accent transition-colors">
                  {training.colaborador_nome}
                </h3>
              </div>
              <div className={cn(
                "px-2 py-0.5 text-[10px] font-bold rounded uppercase",
                training.tipo_treinamento === TrainingType.FORMACAO ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
              )}>
                {calculateProgress(training).toFixed(0)}%
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-[12px] text-muted">
                <Clock size={14} />
                <span>{formatDuration(training.horas_acumuladas || 0)} / {formatDuration(training.horas_necessarias || 0)}</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-muted">
                <AlertCircle size={14} />
                <span>Início: {new Date(training.iniciado_em).toLocaleDateString()}</span>
              </div>
              
              {!activeSession && (
                <div className="pt-2">
                  <select
                    className="w-full p-2 border border-border2 text-[11px] bg-surface outline-none focus:border-accent"
                    value={selectedTraining?.id === training.id ? selectedActivity : ""}
                    onChange={(e) => {
                      setSelectedTraining(training);
                      setSelectedActivity(e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="">Selecione a atividade...</option>
                    {(training as any).atividades?.map((act: string) => (
                      <option key={act} value={act}>{act}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {!activeSession && (
              <button
                disabled={selectedTraining?.id !== training.id || !selectedActivity}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartSession(training);
                }}
                className={cn(
                  "w-full py-2 border text-[12px] font-bold flex items-center justify-center gap-2 transition-all",
                  selectedTraining?.id === training.id && selectedActivity
                    ? "bg-accent text-white border-accent hover:bg-accent-dark"
                    : "bg-surface2 border-border2 text-muted cursor-not-allowed"
                )}
              >
                <Play size={14} fill="currentColor" /> INICIAR SESSÃO
              </button>
            )}
          </div>
        ))}

        {trainings.length === 0 && (
          <div className="col-span-full bg-surface border border-dashed border-border p-12 text-center">
            <div className="w-16 h-16 bg-surface2 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart2 className="text-muted" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-text">Nenhum treinamento em andamento</h3>
            <p className="text-muted text-[13px] mt-1">Inicie um novo treinamento para vê-lo aqui.</p>
          </div>
        )}
      </div>

      {selectedTraining && (
        <div className="bg-surface border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">Detalhes do Treinamento</h3>
            <button 
              onClick={() => setSelectedTraining(null)}
              className="text-[12px] text-muted hover:text-text"
            >
              Fechar
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted border-b pb-2">Histórico de Atividades</h4>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                {activityHistory.length === 0 ? (
                  <div className="text-[12px] text-muted italic">Nenhuma atividade registrada.</div>
                ) : (
                  activityHistory.map((hist) => (
                    <div key={hist.id} className="p-3 bg-surface2 border border-border rounded">
                      <div className="text-[11px] font-bold text-accent uppercase">{hist.nome_atividade}</div>
                      <div className="text-[13px] font-medium mt-1">{formatDuration(hist.tempo_execucao)}</div>
                      <div className="text-[10px] text-muted mt-1">
                        {new Date(hist.hora_inicio).toLocaleString()} — {new Date(hist.hora_fim).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted border-b pb-2">Informações Gerais</h4>
              <div className="space-y-3">
                <DetailItem label="Colaborador" value={selectedTraining.colaborador_nome} />
                <DetailItem label="CPF" value={selectedTraining.colaborador_cpf} />
                <DetailItem label="Matrícula" value={selectedTraining.colaborador_mat} />
                <DetailItem label="Tipo" value={selectedTraining.tipo_treinamento} />
                <DetailItem label="Local" value={selectedTraining.local_treinamento} />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted border-b pb-2">Progresso da Carga Horária</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="text-2xl font-bold">{formatDuration(selectedTraining.horas_acumuladas || 0)}</div>
                  <div className="text-[12px] text-muted">de {formatDuration(selectedTraining.horas_necessarias || 0)}</div>
                </div>
                <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent" 
                    style={{ width: `${calculateProgress(selectedTraining)}%` }}
                  />
                </div>
                <div className="text-[11px] text-muted italic">
                  Tempo restante: {formatDuration(Math.max((selectedTraining.horas_necessarias || 0) - (selectedTraining.horas_acumuladas || 0), 0))}
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between border-b pb-2 mb-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted">Avaliações</h4>
                  <button 
                    onClick={() => setIsEditingEvals(!isEditingEvals)}
                    className="text-[10px] text-accent hover:underline font-bold uppercase"
                  >
                    {isEditingEvals ? "Salvar" : "Editar"}
                  </button>
                </div>
                {isEditingEvals ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted uppercase">Média A (0-10)</label>
                      <input 
                        type="number" 
                        className="w-full p-2 border border-border text-sm"
                        value={calculateAvg(selectedTraining.notas_a)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          handleUpdateEval('notas_a', { 0: val });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted uppercase">Média B (0-10)</label>
                      <input 
                        type="number" 
                        className="w-full p-2 border border-border text-sm"
                        value={calculateAvg(selectedTraining.notas_b)}
                        onChange={(e) => handleUpdateEval('notas_b', { 0: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted uppercase">Percentual C (%)</label>
                      <input 
                        type="number" 
                        className="w-full p-2 border border-border text-sm"
                        value={calculatePctC(selectedTraining.resultados_c)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          const mockResults: Record<number, boolean> = {};
                          for(let i=0; i<20; i++) mockResults[i] = i < (val/100)*20;
                          handleUpdateEval('resultados_c', mockResults);
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <EvalBox label="A" score={calculateAvg(selectedTraining.notas_a)} min={7} />
                    <EvalBox label="B" score={calculateAvg(selectedTraining.notas_b)} min={7} />
                    <EvalBox label="C" score={calculatePctC(selectedTraining.resultados_c)} min={70} isPct />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-10 flex justify-end gap-3 border-t pt-6">
            <button
              onClick={() => setSelectedTraining(null)}
              className="px-5 py-2.5 bg-surface2 hover:bg-surface3 border border-border2 text-[13px] font-medium transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={handleFinalizeTraining}
              className="px-6 py-2.5 bg-success hover:bg-green-700 text-white text-[13px] font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
            >
              <CheckCircle2 size={18} /> FINALIZAR TREINAMENTO
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[10px] text-muted uppercase font-mono">{label}</div>
    <div className="text-[13px] font-medium">{value}</div>
  </div>
);

const EvalBox = ({ label, score, min, isPct }: { label: string; score: number; min: number; isPct?: boolean }) => {
  const passed = score >= min;
  return (
    <div className={cn(
      "p-3 border text-center space-y-1",
      passed ? "bg-success-light border-success/30" : "bg-danger-light border-danger/30"
    )}>
      <div className="text-[10px] font-bold text-muted">AVAL. {label}</div>
      <div className={cn("text-lg font-bold", passed ? "text-success" : "text-danger")}>
        {score.toFixed(1)}{isPct ? "%" : ""}
      </div>
      <div className={cn("text-[9px] font-bold uppercase", passed ? "text-success" : "text-danger")}>
        {passed ? "Aprovado" : "Pendente"}
      </div>
    </div>
  );
};

const calculateAvg = (scores: Record<number, number> | undefined) => {
  if (!scores) return 0;
  const values = Object.values(scores);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

const calculatePctC = (results: Record<number, boolean> | undefined) => {
  if (!results) return 0;
  const values = Object.values(results);
  if (values.length === 0) return 0;
  const hits = values.filter(Boolean).length;
  return (hits / values.length) * 100;
};
