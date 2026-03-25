export enum TrainingType {
  FORMACAO = "formacao",
  ATUALIZACAO = "atualizacao",
  TROCA_POSTO = "troca_posto",
  RECICLAGEM = "reciclagem",
  PROFICIENCIA = "proficiencia",
}

export enum FormType {
  AERODROME = "aerodrome",
  AEREO = "aereo",
}

export enum TrainingStatus {
  EM_ANDAMENTO = "em_andamento",
  APTO = "apto",
  NAO_APTO = "nao_apto",
  CONCLUIDO = "concluido",
}

export interface TraineeData {
  nome: string;
  cpf: string;
  matricula: string;
}

export interface TrainingConfig {
  tipoFormulario: FormType;
  tipoTreinamento: TrainingType;
  local: string;
  dataFormacaoBase?: string;
  atividades: string[];
}

export interface EvaluationA {
  scores: Record<number, number>; // index -> score (0-10)
}

export interface EvaluationB {
  scores: Record<number, number>; // index -> score (0-10)
}

export interface EvaluationC {
  results: Record<number, boolean>; // index -> identified (true/false)
}

export interface TrainingSession {
  id: string;
  treinadorId: string;
  trainee: TraineeData;
  config: TrainingConfig;
  evalA: EvaluationA;
  evalB: EvaluationB;
  evalC: EvaluationC;
  startTime: number; // timestamp
  endTime?: number; // timestamp
  durationSeconds: number;
  status: TrainingStatus;
  observations?: string;
  signatureUrl?: string;
  ipAddress?: string;
  createdAt: number;
}
