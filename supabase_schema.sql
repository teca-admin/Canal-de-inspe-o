-- SQL para configurar o banco de dados no Supabase

-- 1. Tabela de Perfis (Profiles)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    nome_completo TEXT NOT NULL,
    cpf TEXT NOT NULL,
    cargo TEXT NOT NULL,
    perfil TEXT NOT NULL CHECK (perfil IN ('admin', 'treinador', 'cliente')),
    ativo BOOLEAN DEFAULT TRUE,
    device_id TEXT,
    device_approved BOOLEAN DEFAULT FALSE,
    experiencia TEXT,
    certificacoes JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Treinamentos
CREATE TABLE public.treinamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    treinador_id UUID REFERENCES public.profiles(id),
    colaborador_nome TEXT NOT NULL,
    colaborador_cpf TEXT NOT NULL,
    colaborador_mat TEXT NOT NULL,
    tipo_formulario TEXT NOT NULL,
    tipo_treinamento TEXT NOT NULL,
    local_treinamento TEXT NOT NULL,
    atividades TEXT[] DEFAULT '{}',
    iniciado_em TIMESTAMPTZ DEFAULT NOW(),
    encerrado_em TIMESTAMPTZ,
    horas_acumuladas INTEGER DEFAULT 0, -- em segundos
    horas_necessarias INTEGER DEFAULT 0, -- em segundos
    prazo_dias INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'em_andamento',
    situacao TEXT, -- 'apto', 'nao_apto'
    notas_a JSONB DEFAULT '{}',
    notas_b JSONB DEFAULT '{}',
    resultados_c JSONB DEFAULT '{}',
    assinatura_url TEXT,
    assinatura_treinador_url TEXT,
    media_a NUMERIC DEFAULT 0,
    media_b NUMERIC DEFAULT 0,
    percentual_c NUMERIC DEFAULT 0,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Sessões de Treinamento
CREATE TABLE public.sessoes_treinamento (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    training_id UUID REFERENCES public.treinamentos(id) ON DELETE CASCADE,
    inicio TIMESTAMPTZ NOT NULL,
    fim TIMESTAMPTZ,
    duracao_segundos INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Histórico de Atividades
CREATE TABLE public.historico_atividades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    treinamento_id UUID REFERENCES public.treinamentos(id) ON DELETE CASCADE,
    nome_atividade TEXT NOT NULL,
    hora_inicio TIMESTAMPTZ NOT NULL,
    hora_fim TIMESTAMPTZ NOT NULL,
    tempo_execucao INTEGER NOT NULL, -- em segundos
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Habilitar RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessoes_treinamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_atividades ENABLE ROW LEVEL SECURITY;

-- 6. Políticas para Profiles
CREATE POLICY "Perfis são visíveis por usuários autenticados" 
ON public.profiles FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários podem atualizar seus próprios perfis" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Admins podem inserir perfis" 
ON public.profiles FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND perfil = 'admin'
    ) OR 
    NOT EXISTS (SELECT 1 FROM public.profiles) -- Permite o primeiro admin
);

-- 6. Políticas para Treinamentos
CREATE POLICY "Treinamentos são visíveis por usuários autenticados" 
ON public.treinamentos FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Treinadores podem inserir treinamentos" 
ON public.treinamentos FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Treinadores podem atualizar seus treinamentos" 
ON public.treinamentos FOR UPDATE 
USING (auth.uid() = treinador_id OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND perfil = 'admin'
));

-- 7. Políticas para Sessões
CREATE POLICY "Sessões são visíveis por usuários autenticados" 
ON public.sessoes_treinamento FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Qualquer autenticado pode gerenciar sessões" 
ON public.sessoes_treinamento FOR ALL 
USING (auth.role() = 'authenticated');

-- 8. Políticas para Histórico de Atividades
CREATE POLICY "Histórico é visível por usuários autenticados" 
ON public.historico_atividades FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Qualquer autenticado pode inserir no histórico" 
ON public.historico_atividades FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- 9. Storage (Buckets para Assinaturas e Certificações)
-- Estes comandos criam os buckets se eles não existirem
INSERT INTO storage.buckets (id, name, public) 
VALUES ('assinaturas', 'assinaturas', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('certificacoes', 'certificacoes', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas para storage.objects
CREATE POLICY "Objetos são públicos" 
ON storage.objects FOR SELECT 
USING (bucket_id IN ('assinaturas', 'certificacoes'));

CREATE POLICY "Usuários autenticados podem subir arquivos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id IN ('assinaturas', 'certificacoes') AND auth.role() = 'authenticated');
