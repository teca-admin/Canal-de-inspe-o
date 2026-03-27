import React, { useState, useEffect, useRef } from "react";
import { Play, Square, Clock, AlertCircle, BarChart2, User, FileText, CheckCircle2, XCircle, Search } from "lucide-react";
import { supabase } from "../lib/supabase";
import { OngoingTraining, TrainingSessionRecord, TrainingType } from "../types";
import { toast } from "sonner";
import { cn } from "../lib/utils";

import { CRITERIA_A, CRITERIA_B, SCENARIOS_C, ACTIVITIES } from "../constants";

import { PHASES } from "../constants";
import SignatureCanvas from "react-signature-canvas";

export const OngoingTrainings: React.FC = () => {
  const [trainings, setTrainings] = useState<OngoingTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTraining, setSelectedTraining] = useState<OngoingTraining | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [selectedCriterion, setSelectedCriterion] = useState<"A" | "B" | "C" | "">("");
  const [activityHistory, setActivityHistory] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<TrainingSessionRecord | null>(null);
  const [activeSessions, setActiveSessions] = useState<Record<string, any>>({});
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [filter, setFilter] = useState("");
  const [isEditingEvals, setIsEditingEvals] = useState(false);
  const [expandedEval, setExpandedEval] = useState<"A" | "B" | "C" | null>(null);
  const [showFinalizeActivity, setShowFinalizeActivity] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activityToFinalize, setActivityToFinalize] = useState<string>("");
  
  const trainerSigRef = useRef<SignatureCanvas>(null);
  const traineeSigRef = useRef<SignatureCanvas>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentPhase = selectedTraining?.current_phase || 1;
  const phaseInfo = PHASES.find(p => p.id === currentPhase);
  const phaseActivities = phaseInfo?.activities || [];

  const filteredTrainings = trainings.filter(t => 
    t.colaborador_nome.toLowerCase().includes(filter.toLowerCase()) ||
    t.colaborador_cpf.includes(filter)
  );

  const handleUpdateEval = async (field: string, value: any, activityName?: string) => {
    if (!selectedTraining) return;
    try {
      let updateData: any = { [field]: value };
      
      if (activityName) {
        const currentStatus = selectedTraining.atividades_status || {};
        const activityStatus = currentStatus[activityName] || {
          concluida: false,
          notas_a: {},
          notas_b: {},
          resultados_c: {},
          tempo_segundos: 0
        };
        
        if (field === 'notas_a') activityStatus.notas_a = value;
        if (field === 'notas_b') activityStatus.notas_b = value;
        if (field === 'resultados_c') activityStatus.resultados_c = value;
        
        currentStatus[activityName] = activityStatus;
        updateData = { ...updateData, atividades_status: currentStatus };
      }

      const { error } = await supabase
        .from('treinamentos')
        .update(updateData)
        .eq('id', selectedTraining.id);
      
      if (error) throw error;
      
      const updatedTraining = { ...selectedTraining, ...updateData };
      setSelectedTraining(updatedTraining);
      setTrainings(trainings.map(t => t.id === selectedTraining.id ? updatedTraining : t));
    } catch (err: any) {
      toast.error("Erro ao atualizar avaliação: " + err.message);
    }
  };

  const handleDeleteTraining = async () => {
    if (!selectedTraining) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('treinamentos')
        .delete()
        .eq('id', selectedTraining.id);

      if (error) throw error;

      toast.success("Treinamento excluído com sucesso.");
      setSelectedTraining(null);
      setShowDeleteConfirm(false);
      fetchTrainings();
    } catch (err: any) {
      toast.error("Erro ao excluir treinamento: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeActivity = async () => {
    if (!selectedTraining || !activityToFinalize) return;
    if (trainerSigRef.current?.isEmpty() || traineeSigRef.current?.isEmpty()) {
      toast.error("Assinaturas do treinador e do aluno são obrigatórias.");
      return;
    }

    const status = selectedTraining.atividades_status?.[activityToFinalize];
    if (!status) {
      toast.error("Atividade não iniciada.");
      return;
    }

    // Check if evaluations are complete
    const hasA = Object.keys(status.notas_a || {}).length > 0;
    const hasB = Object.keys(status.notas_b || {}).length > 0;
    const hasC = Object.keys(status.resultados_c || {}).length > 0;

    if (!hasA || !hasB || !hasC) {
      toast.error("Avaliações A, B e C devem estar concluídas para finalizar a atividade.");
      return;
    }

    try {
      setLoading(true);
      
      // Upload signatures
      const trainerSig = trainerSigRef.current?.getTrimmedCanvas().toDataURL('image/png');
      const traineeSig = traineeSigRef.current?.getTrimmedCanvas().toDataURL('image/png');

      if (!trainerSig || !traineeSig) {
        toast.error("Ambas as assinaturas são obrigatórias.");
        return;
      }

      // Check if ABC evaluations are complete
      const activityStatus = selectedTraining.atividades_status?.[activityToFinalize];
      const notasA = activityStatus?.notas_a || {};
      const notasB = activityStatus?.notas_b || {};
      const resultadosC = activityStatus?.resultados_c || {};

      const isAComplete = Object.keys(notasA).length === CRITERIA_A.length;
      const isBComplete = Object.keys(notasB).length === CRITERIA_B.length;
      const isCComplete = Object.keys(resultadosC).length === SCENARIOS_C.length;

      if (!isAComplete || !isBComplete || !isCComplete) {
        toast.error("Todas as avaliações (A, B e C) devem ser preenchidas antes de finalizar a atividade.");
        return;
      }

      const uploadSig = async (dataUrl: string, type: string) => {
        const blob = await (await fetch(dataUrl)).blob();
        const fileName = `${selectedTraining.id}_${activityToFinalize}_${type}_${Date.now()}.png`;
        const { data, error } = await supabase.storage.from('signatures').upload(fileName, blob);
        if (error) throw error;
        return supabase.storage.from('signatures').getPublicUrl(data.path).data.publicUrl;
      };

      const trainerSigUrl = await uploadSig(trainerSig!, 'trainer');
      const traineeSigUrl = await uploadSig(traineeSig!, 'trainee');

      const currentStatus = { ...selectedTraining.atividades_status };
      currentStatus[activityToFinalize] = {
        ...currentStatus[activityToFinalize],
        concluida: true,
        assinatura_treinador_url: trainerSigUrl,
        assinatura_aluno_url: traineeSigUrl
      };

      // Check for phase progression
      let nextPhase = selectedTraining.current_phase;
      const currentPhaseInfo = PHASES.find(p => p.id === selectedTraining.current_phase);
      const allPhaseActivitiesDone = currentPhaseInfo?.activities.every(act => currentStatus[act]?.concluida);
      
      if (allPhaseActivitiesDone && nextPhase < 3) {
        nextPhase += 1;
        const nextPhaseInfo = PHASES.find(p => p.id === nextPhase);
        nextPhaseInfo?.activities.forEach(act => {
          if (!currentStatus[act]) {
            currentStatus[act] = {
              concluida: false,
              notas_a: {},
              notas_b: {},
              resultados_c: {},
              tempo_segundos: 0
            };
          }
        });
        toast.success(`Fase ${selectedTraining.current_phase} concluída! Avançando para Fase ${nextPhase}.`);
      }

      const { error } = await supabase
        .from('treinamentos')
        .update({ 
          atividades_status: currentStatus,
          current_phase: nextPhase
        })
        .eq('id', selectedTraining.id);

      if (error) throw error;

      toast.success("Atividade finalizada com sucesso!");
      setShowFinalizeActivity(false);
      setActivityToFinalize("");
      setSelectedActivity("");
      setSelectedCriterion("");
      fetchTrainings();
    } catch (err: any) {
      toast.error("Erro ao finalizar atividade: " + err.message);
    } finally {
      setLoading(false);
    }
  };
  const handleFinalizeTraining = async () => {
    if (!selectedTraining) return;

    // Calculate overall scores from all activities
    const allStatus = Object.values(selectedTraining.atividades_status || {}) as any[];
    
    let totalA = 0, countA = 0;
    let totalB = 0, countB = 0;
    let totalHitsC = 0, totalTestsC = 0;

    allStatus.forEach(status => {
      const valsA = Object.values(status.notas_a || {}) as number[];
      if (valsA.length > 0) {
        totalA += valsA.reduce((a, b) => a + b, 0);
        countA += valsA.length;
      }

      const valsB = Object.values(status.notas_b || {}) as number[];
      if (valsB.length > 0) {
        totalB += valsB.reduce((a, b) => a + b, 0);
        countB += valsB.length;
      }

      const valsC = Object.values(status.resultados_c || {}) as boolean[];
      if (valsC.length > 0) {
        totalHitsC += valsC.filter(v => v).length;
        totalTestsC += valsC.length;
      }
    });

    const avgA = countA > 0 ? totalA / countA : 0;
    const avgB = countB > 0 ? totalB / countB : 0;
    const pctC = totalTestsC > 0 ? (totalHitsC / totalTestsC) * 100 : 0;

    const hoursMet = (selectedTraining.horas_acumuladas || 0) >= (selectedTraining.horas_necessarias || 0);

    if (!hoursMet) {
      toast.error("Carga horária insuficiente para finalizar.");
      return;
    }

    if (avgA < 7 || avgB < 7 || pctC < 70) {
      toast.error(`Avaliações abaixo da média mínima. (A: ${avgA.toFixed(1)}, B: ${avgB.toFixed(1)}, C: ${pctC.toFixed(0)}%)`);
      return;
    }

    // Check if all phases are complete
    if (selectedTraining.current_phase < 3) {
      toast.error("Todas as fases devem ser concluídas antes de finalizar o treinamento.");
      return;
    }

    try {
      const { error } = await supabase
        .from('treinamentos')
        .update({ 
          status: 'concluido',
          situacao: 'apto',
          encerrado_em: new Date().toISOString(),
          media_a: avgA,
          media_b: avgB,
          percentual_c: pctC
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

      // Fetch all active sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessoes_treinamento')
        .select('*')
        .is('fim', null);

      if (sessionsError) throw sessionsError;
      
      const sessionsMap: Record<string, any> = {};
      sessions?.forEach(s => {
        sessionsMap[s.training_id] = s;
      });
      setActiveSessions(sessionsMap);

      // If there's an active session for the current user (this client), set it
      // Note: In a real app, we might want to track which user started which session
      // For now, if the selected training has an active session, we show it
      if (selectedTraining && sessionsMap[selectedTraining.id]) {
        const session = sessionsMap[selectedTraining.id];
        setActiveSession(session);
        setSelectedActivity(session.metadata?.atividade || "");
        setSelectedCriterion(session.metadata?.criterio || "");
        
        // Calculate elapsed time
        const start = new Date(session.inicio).getTime();
        const now = new Date().getTime();
        setSessionSeconds(Math.floor((now - start) / 1000));
      }
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
    if (!selectedCriterion) {
      toast.error("Selecione qual critério (A, B ou C) será avaliado.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('sessoes_treinamento')
        .insert({
          training_id: training.id,
          inicio: new Date().toISOString(),
          duracao_segundos: 0,
          metadata: { atividade: selectedActivity, criterio: selectedCriterion }
        })
        .select()
        .single();

      if (error) throw error;
      setActiveSession(data);
      setSelectedTraining(training);
      fetchTrainings(); // Refresh to update activeSessions map
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
          criterio: selectedCriterion,
          hora_inicio: activeSession.inicio,
          hora_fim: endTime,
          tempo_execucao: sessionSeconds
        });

      if (historyError) throw historyError;

      // Update accumulated hours in training
      const newAccumulated = (selectedTraining.horas_acumuladas || 0) + sessionSeconds;
      
      // Update atividades_status
      const currentStatus = selectedTraining.atividades_status || {};
      const activityStatus = currentStatus[selectedActivity] || {
        concluida: false,
        notas_a: {},
        notas_b: {},
        resultados_c: {},
        tempo_segundos: 0
      };
      
      activityStatus.tempo_segundos = (activityStatus.tempo_segundos || 0) + sessionSeconds;
      currentStatus[selectedActivity] = activityStatus;

      const { error: trainingError } = await supabase
        .from('treinamentos')
        .update({
          horas_acumuladas: newAccumulated,
          atividades_status: currentStatus
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="page-header">
          <h2 className="text-xl font-semibold text-text">Treinamentos em Andamento</h2>
          <p className="text-[13px] text-muted mt-1">
            Gerencie o progresso e as sessões de treinamento dos colaboradores
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
          <input
            type="text"
            placeholder="Buscar colaborador ou CPF..."
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border focus:border-accent outline-none text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      {activeSession && selectedTraining && (
        <div className="bg-accent/5 border border-accent/20 p-6 shadow-sm animate-pulse-subtle">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-accent text-white rounded-full flex items-center justify-center">
                <Clock size={24} />
              </div>
              <div>
                <div className="text-[11px] text-accent font-bold uppercase tracking-wider">Avaliação em Andamento: {selectedActivity}</div>
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

      <div className="bg-surface border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface2">
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Colaborador</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Tipo</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Fase</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Progresso</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Carga Horária</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Início</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTrainings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted text-[13px]">
                    Nenhum treinamento em andamento encontrado.
                  </td>
                </tr>
              ) : (
                filteredTrainings.map((training) => (
                  <tr 
                    key={training.id} 
                    className={cn(
                      "hover:bg-surface2 transition-colors cursor-pointer",
                      selectedTraining?.id === training.id && "bg-accent/5"
                    )}
                    onClick={() => {
                      if (selectedTraining?.id !== training.id) {
                        setSelectedTraining(training);
                        setSelectedActivity("");
                        setSelectedCriterion("");
                        setIsEditingEvals(false);
                        setExpandedEval(null);
                      }
                    }}
                  >
                    <td className="p-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="text-[13px] font-bold">{training.colaborador_nome}</div>
                        {activeSessions[training.id] && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-accent text-white text-[9px] font-bold uppercase rounded animate-pulse">
                            <Play size={10} fill="currentColor" /> EM SESSÃO
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-muted">{training.colaborador_cpf}</div>
                    </td>
                    <td className="p-3 px-4">
                      <span className="px-2 py-0.5 bg-surface2 border border-border text-[10px] font-mono text-muted uppercase">
                        {training.tipo_treinamento}
                      </span>
                    </td>
                    <td className="p-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-surface2 rounded-full overflow-hidden max-w-[100px]">
                          <div 
                            className="h-full bg-accent" 
                            style={{ width: `${calculateProgress(training)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-accent">{calculateProgress(training).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="p-3 px-4 text-[12px] font-mono">
                      {formatDuration(training.horas_acumuladas || 0)} / {formatDuration(training.horas_necessarias || 0)}
                    </td>
                    <td className="p-3 px-4 text-[12px] text-muted">
                      {new Date(training.iniciado_em).toLocaleDateString()}
                    </td>
                    <td className="p-3 px-4">
                      <span className="px-2 py-0.5 bg-accent/10 border border-accent/20 text-[10px] font-bold text-accent uppercase rounded">
                        Fase {training.current_phase || 1}
                      </span>
                    </td>
                    <td className="p-3 px-4">
                      <button 
                        className="px-4 py-2 bg-accent hover:bg-accent-dark text-white text-[11px] font-bold transition-colors shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTraining(training);
                          setIsEditingEvals(true);
                          // Scroll to details
                          setTimeout(() => {
                            document.getElementById('training-details')?.scrollIntoView({ behavior: 'smooth' });
                          }, 100);
                        }}
                      >
                        AVALIAR / INICIAR
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTraining && (
        <div id="training-details" className="bg-surface border border-border p-6 shadow-sm">
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
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted border-b pb-2">Controle de Sessão</h4>
              <div className="space-y-3 p-4 bg-surface2 border border-border rounded">
                <div className="space-y-2">
                  <label className="text-[10px] text-muted uppercase font-mono">Atividade</label>
                  <select 
                    className="w-full p-2 border border-border text-[12px] bg-surface outline-none focus:border-accent"
                    value={selectedActivity}
                    onChange={(e) => setSelectedActivity(e.target.value)}
                  >
                    <option value="">Selecione a atividade...</option>
                    {(PHASES.find(p => p.id === (selectedTraining.current_phase || 1))?.activities || []).map(act => {
                      const status = selectedTraining.atividades_status?.[act];
                      const isCompleted = status?.concluida;
                      const hasTime = (status?.tempo_segundos || 0) > 0;
                      const session = activeSessions[selectedTraining.id];
                      const isActive = session?.metadata?.atividade === act;
                      
                      return (
                        <option 
                          key={act} 
                          value={act} 
                          disabled={isCompleted}
                          className={cn(
                            isCompleted && "text-success",
                            isActive && "font-bold text-accent"
                          )}
                        >
                          {act} {isCompleted ? "✅" : (isActive ? `⏳ (Critério ${session?.metadata?.criterio})` : (hasTime ? "🕒" : ""))}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-muted uppercase font-mono">Critério de Avaliação</label>
                  <select 
                    className="w-full p-2 border border-border text-[12px] bg-surface outline-none focus:border-accent"
                    value={selectedCriterion}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setSelectedCriterion(val);
                      if (val) setExpandedEval(val);
                    }}
                  >
                    <option value="">Selecione o critério...</option>
                    <option value="A">Critério A — Comportamento</option>
                    <option value="B">Critério B — Detecção</option>
                    <option value="C">Critério C — Testes Aleatórios</option>
                  </select>
                </div>
                <button
                  disabled={!!activeSession || !selectedActivity || !selectedCriterion}
                  onClick={() => handleStartSession(selectedTraining)}
                  className="w-full mt-2 py-2.5 bg-accent hover:bg-accent-dark text-white text-[12px] font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Play size={16} fill="currentColor" /> INICIAR SESSÃO
                </button>
              </div>

              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted border-b pb-2 pt-4">Histórico de Atividades</h4>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                {activityHistory.length === 0 ? (
                  <div className="text-[12px] text-muted italic">Nenhuma atividade registrada.</div>
                ) : (
                  activityHistory.map((hist) => (
                    <div key={hist.id} className="p-3 bg-surface2 border border-border rounded flex flex-col gap-1">
                      <div className="flex justify-between items-start">
                        <span className="text-[11px] font-bold text-accent uppercase">{hist.nome_atividade}</span>
                        <span className="text-[11px] font-mono text-muted">{formatDuration(hist.tempo_execucao)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[10px] uppercase font-bold text-muted">
                          Critério {hist.criterio || 'N/A'}
                        </span>
                        <span className="text-[10px] text-hint">
                          {new Date(hist.hora_inicio).toLocaleTimeString()} — {new Date(hist.hora_fim).toLocaleTimeString()}
                        </span>
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
              <div className="pt-4">
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-[10px] text-danger hover:underline font-bold uppercase flex items-center gap-1"
                >
                  <XCircle size={14} /> Excluir Treinamento
                </button>
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
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted">Avaliações {selectedActivity ? `— ${selectedActivity}` : ""}</h4>
                  <div className="flex gap-2">
                    {selectedActivity && !selectedTraining.atividades_status?.[selectedActivity]?.concluida && (
                      <button 
                        onClick={() => {
                          setActivityToFinalize(selectedActivity);
                          setShowFinalizeActivity(true);
                        }}
                        className="text-[10px] text-success hover:underline font-bold uppercase"
                      >
                        Finalizar Atividade
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        const nextState = !isEditingEvals;
                        setIsEditingEvals(nextState);
                        if (nextState && selectedCriterion) {
                          setExpandedEval(selectedCriterion as any);
                        } else if (!nextState) {
                          setExpandedEval(null);
                        }
                      }}
                      className="text-[10px] text-accent hover:underline font-bold uppercase"
                    >
                      {isEditingEvals ? "Salvar" : "Editar"}
                    </button>
                  </div>
                </div>
                {isEditingEvals ? (
                  <div className="space-y-6">
                    {!selectedActivity ? (
                      <div className="text-[12px] text-muted italic p-4 text-center bg-surface2 border border-dashed border-border">
                        Selecione uma atividade na tabela acima para editar suas avaliações.
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <h5 
                            className="text-[12px] font-bold text-accent uppercase border-b pb-1 cursor-pointer flex justify-between items-center hover:bg-surface2 transition-colors px-1"
                            onClick={() => setExpandedEval(expandedEval === "A" ? null : "A")}
                          >
                            Avaliação A — Comportamento
                            <span className="text-[10px]">{expandedEval === "A" ? "▲" : "▼"}</span>
                          </h5>
                          {expandedEval === "A" && (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin animate-in slide-in-from-top-2 duration-200">
                              {CRITERIA_A.map((criterion, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4 p-2 bg-surface2 border border-border rounded">
                                  <span className="text-[12px] leading-tight">{criterion}</span>
                                  <input 
                                    type="number" 
                                    min="0" max="10" step="0.5"
                                    className="w-16 p-1 border border-border text-center text-sm"
                                    value={selectedTraining.atividades_status?.[selectedActivity]?.notas_a?.[idx] || ""}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      const newNotas = { ...(selectedTraining.atividades_status?.[selectedActivity]?.notas_a || {}), [idx]: val };
                                      handleUpdateEval('notas_a', newNotas, selectedActivity);
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <h5 
                            className="text-[12px] font-bold text-accent uppercase border-b pb-1 cursor-pointer flex justify-between items-center hover:bg-surface2 transition-colors px-1"
                            onClick={() => setExpandedEval(expandedEval === "B" ? null : "B")}
                          >
                            Avaliação B — Detecção
                            <span className="text-[10px]">{expandedEval === "B" ? "▲" : "▼"}</span>
                          </h5>
                          {expandedEval === "B" && (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin animate-in slide-in-from-top-2 duration-200">
                              {CRITERIA_B.map((criterion, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4 p-2 bg-surface2 border border-border rounded">
                                  <span className="text-[12px] leading-tight">{criterion}</span>
                                  <input 
                                    type="number" 
                                    min="0" max="10" step="0.5"
                                    className="w-16 p-1 border border-border text-center text-sm"
                                    value={selectedTraining.atividades_status?.[selectedActivity]?.notas_b?.[idx] || ""}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      const newNotas = { ...(selectedTraining.atividades_status?.[selectedActivity]?.notas_b || {}), [idx]: val };
                                      handleUpdateEval('notas_b', newNotas, selectedActivity);
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <h5 
                            className="text-[12px] font-bold text-accent uppercase border-b pb-1 cursor-pointer flex justify-between items-center hover:bg-surface2 transition-colors px-1"
                            onClick={() => setExpandedEval(expandedEval === "C" ? null : "C")}
                          >
                            Avaliação C — Testes Aleatórios
                            <span className="text-[10px]">{expandedEval === "C" ? "▲" : "▼"}</span>
                          </h5>
                          {expandedEval === "C" && (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin animate-in slide-in-from-top-2 duration-200">
                              {SCENARIOS_C.map((scenario, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4 p-2 bg-surface2 border border-border rounded">
                                  <span className="text-[12px] leading-tight">{scenario}</span>
                                  <select 
                                    className="p-1 border border-border text-sm bg-surface"
                                    value={selectedTraining.atividades_status?.[selectedActivity]?.resultados_c?.[idx] === undefined ? "" : selectedTraining.atividades_status[selectedActivity].resultados_c[idx] ? "hit" : "miss"}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const newResults = { ...(selectedTraining.atividades_status?.[selectedActivity]?.resultados_c || {}) };
                                      if (val === "") delete newResults[idx];
                                      else newResults[idx] = val === "hit";
                                      handleUpdateEval('resultados_c', newResults, selectedActivity);
                                    }}
                                  >
                                    <option value="">—</option>
                                    <option value="hit">✅</option>
                                    <option value="miss">❌</option>
                                  </select>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="cursor-pointer transition-transform active:scale-95" onClick={() => { setIsEditingEvals(true); setExpandedEval("A"); }}>
                      <EvalBox label="A" score={calculateAvg(selectedTraining.atividades_status?.[selectedActivity]?.notas_a)} min={7} />
                    </div>
                    <div className="cursor-pointer transition-transform active:scale-95" onClick={() => { setIsEditingEvals(true); setExpandedEval("B"); }}>
                      <EvalBox label="B" score={calculateAvg(selectedTraining.atividades_status?.[selectedActivity]?.notas_b)} min={7} />
                    </div>
                    <div className="cursor-pointer transition-transform active:scale-95" onClick={() => { setIsEditingEvals(true); setExpandedEval("C"); }}>
                      <EvalBox label="C" score={calculatePctC(selectedTraining.atividades_status?.[selectedActivity]?.resultados_c)} min={70} isPct />
                    </div>
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

      {showFinalizeActivity && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Finalizar Atividade</h3>
                <p className="text-[12px] text-muted">{activityToFinalize}</p>
              </div>
              <button 
                onClick={() => setShowFinalizeActivity(false)}
                className="text-muted hover:text-text"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Assinatura do Treinador</label>
                  <div className="border border-border bg-white rounded overflow-hidden">
                    <SignatureCanvas 
                      ref={trainerSigRef}
                      penColor="black"
                      canvasProps={{ className: "w-full h-40" }}
                    />
                  </div>
                  <button 
                    onClick={() => trainerSigRef.current?.clear()}
                    className="text-[10px] text-accent hover:underline font-bold uppercase"
                  >
                    Limpar
                  </button>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Assinatura do Aluno</label>
                  <div className="border border-border bg-white rounded overflow-hidden">
                    <SignatureCanvas 
                      ref={traineeSigRef}
                      penColor="black"
                      canvasProps={{ className: "w-full h-40" }}
                    />
                  </div>
                  <button 
                    onClick={() => traineeSigRef.current?.clear()}
                    className="text-[10px] text-accent hover:underline font-bold uppercase"
                  >
                    Limpar
                  </button>
                </div>
              </div>
              
              <div className="bg-accent/5 border border-accent/20 p-4 rounded text-[12px] text-accent flex gap-3">
                <AlertCircle size={18} className="shrink-0" />
                <p>
                  Ao finalizar esta atividade, os dados de avaliação e as assinaturas serão registrados permanentemente. 
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            
            <div className="p-6 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => setShowFinalizeActivity(false)}
                className="px-5 py-2.5 bg-surface2 hover:bg-surface3 border border-border2 text-[13px] font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleFinalizeActivity}
                disabled={loading}
                className="px-6 py-2.5 bg-success hover:bg-green-700 text-white text-[13px] font-bold flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? "Processando..." : "Confirmar e Finalizar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-surface border border-border w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-bold text-danger">Excluir Treinamento</h3>
            </div>
            <div className="p-6">
              <p className="text-[14px] text-text">
                Tem certeza que deseja excluir permanentemente o treinamento de <strong className="text-accent">{selectedTraining?.colaborador_nome}</strong>?
              </p>
              <p className="text-[12px] text-muted mt-2">
                Esta ação removerá todo o progresso, avaliações e histórico de atividades. <strong>Não pode ser desfeita.</strong>
              </p>
            </div>
            <div className="p-6 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-surface2 hover:bg-surface3 border border-border2 text-[12px] font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteTraining}
                disabled={loading}
                className="px-5 py-2 bg-danger hover:bg-danger-dark text-white text-[12px] font-bold transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? "Excluindo..." : "Confirmar Exclusão"}
              </button>
            </div>
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
