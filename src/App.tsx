import React, { useState, useEffect } from "react";
import { Topbar } from "./components/Topbar";
import { Sidebar } from "./components/Sidebar";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { NewTraining } from "./pages/NewTraining";
import { Certificates } from "./pages/Certificates";
import { Users } from "./pages/Users";
import { supabase } from "./lib/supabase";

export default function App() {
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState<{ id: string; email: string } | null>(null);
  const [devicePending, setDevicePending] = useState(false);
  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const getDeviceId = () => {
    let id = localStorage.getItem("device_id");
    if (!id) {
      id = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem("device_id", id);
    }
    return id;
  };

  const repairProfile = async () => {
    if (!needsProfile) return;
    setLoading(true);
    try {
      const deviceId = getDeviceId();
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: needsProfile.id,
          nome_completo: needsProfile.email.split('@')[0],
          cpf: '00000000000',
          cargo: 'Administrador (Auto-gerado)',
          perfil: 'admin',
          ativo: true,
          device_id: deviceId,
          device_approved: true // Auto-approve first admin
        });

      if (error) {
        if (error.message.includes("row-level security")) {
          throw new Error("Erro de Permissão (RLS): Você precisa configurar as políticas de segurança no Supabase para permitir a criação de perfis. Execute o SQL de configuração no painel do Supabase.");
        }
        throw error;
      }
      
      setAuthError(null);
      setNeedsProfile(null);
      fetchProfile(needsProfile.id);
    } catch (err: any) {
      console.error("Error repairing profile:", err);
      setAuthError("Erro ao criar perfil: " + err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleGlobalError = (event: PromiseRejectionEvent) => {
      if (event.reason?.message === "Failed to fetch") {
        console.error("Global Failed to fetch detected:", event.reason);
        setAuthError("Erro de conexão com o servidor. Verifique sua internet.");
      }
    };

    window.addEventListener("unhandledrejection", handleGlobalError);

    // Check active session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session) {
          fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }
      })
      .catch(err => {
        console.error("Supabase getSession error:", err);
        setAuthError("Erro ao verificar sessão: " + (err.message || "Erro desconhecido"));
        setLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setAuthError(null);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setDevicePending(false);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("unhandledrejection", handleGlobalError);
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    console.log("Fetching profile for userId:", userId);
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error("Profile fetch error details:", error);
        
        // Se der erro de recursão ou não encontrar, tentamos identificar o usuário logado
        if (authUser) {
          setNeedsProfile({ id: authUser.id, email: authUser.email || "" });
          
          if (error.code === "PGRST116") {
            throw new Error(`Perfil não encontrado para o usuário ${authUser.email}. O usuário existe no Auth mas não na tabela 'profiles'.`);
          }
          
          if (error.message?.includes("infinite recursion")) {
            throw new Error(`Erro de Recursão (RLS): O banco de dados está em loop. Use o botão abaixo para tentar recriar seu perfil ou aplique o SQL de correção.`);
          }
        }
        throw error;
      }

      if (data) {
        const currentDeviceId = getDeviceId();
        const isMasterAdmin = data.perfil === 'admin' && authUser?.email === 'testerick@gmail.com';
        
        // Device Approval Logic
        // If device is not registered yet
        if (!data.device_id) {
          await supabase.from('profiles').update({ 
            device_id: currentDeviceId, 
            device_approved: isMasterAdmin // Auto-approve only the master admin on first login
          }).eq('id', userId);
          
          if (!isMasterAdmin) {
            setDevicePending(true);
            setLoading(false);
            return;
          }
        } 
        // If device changed
        else if (data.device_id !== currentDeviceId) {
          await supabase.from('profiles').update({ 
            device_id: currentDeviceId, 
            device_approved: isMasterAdmin // Master admin can switch devices freely
          }).eq('id', userId);
          
          if (!isMasterAdmin) {
            setDevicePending(true);
            setLoading(false);
            return;
          }
        } 
        // If same device but not approved
        else if (!data.device_approved && !isMasterAdmin) {
          setDevicePending(true);
          setLoading(false);
          return;
        }

        setUser({
          id: data.id,
          name: data.nome_completo,
          role: data.perfil
        });
        setDevicePending(false);
        if (data.perfil === "cliente") {
          setActivePage("comprovantes");
        }
      }
    } catch (err: any) {
      console.error("Error fetching profile:", err);
      setAuthError(err.message || "Erro ao carregar perfil");
      
      const isRecoverable = err.message?.includes("Perfil não encontrado") || 
                           err.message?.includes("Recursão") || 
                           err.message?.includes("security policy");

      if (!isRecoverable) {
        await supabase.auth.signOut();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setActivePage("dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (devicePending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-6">
        <div className="bg-surface border border-border p-8 max-w-md w-full text-center space-y-6 shadow-xl">
          <div className="w-16 h-16 bg-warning-light rounded-full flex items-center justify-center mx-auto">
            <Shield className="text-warning" size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-text">Aguardando Aprovação</h2>
            <p className="text-sm text-muted">
              Este dispositivo ainda não foi aprovado para acesso ao sistema corporativo.
            </p>
          </div>
          <div className="bg-surface2 p-4 border border-border2 text-left space-y-2">
            <div className="text-[10px] uppercase font-bold text-hint tracking-widest">ID do Dispositivo</div>
            <div className="font-mono text-[11px] break-all text-text">{getDeviceId()}</div>
          </div>
          <p className="text-[12px] text-muted italic">
            Entre em contato com o administrador para solicitar a liberação deste dispositivo.
          </p>
          <button 
            onClick={handleLogout}
            className="w-full py-2.5 bg-surface2 hover:bg-surface3 border border-border2 text-[13px] font-medium transition-colors"
          >
            Sair do Sistema
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Login 
        externalError={authError} 
        onRepairProfile={repairProfile}
        isRepairing={loading}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <Topbar 
        userName={user.name} 
        role={user.role} 
        onLogout={handleLogout} 
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        sidebarCollapsed={sidebarCollapsed}
      />
      <div className="flex flex-1">
        <Sidebar
          role={user.role}
          activePage={activePage}
          onNavigate={setActivePage}
          collapsed={sidebarCollapsed}
        />
        <main className="flex-1 p-7 md:p-8 overflow-auto transition-all duration-300">
          {activePage === "dashboard" && <Dashboard onNewTraining={() => setActivePage("novoTreinamento")} />}
          {activePage === "novoTreinamento" && <NewTraining onComplete={() => setActivePage("comprovantes")} />}
          {activePage === "comprovantes" && <Certificates />}
          {activePage === "usuarios" && user && <Users currentUser={user} />}
          {activePage === "avaliacoes" && (
            <div className="page-header">
              <h2 className="text-xl font-semibold">Treinamentos em Andamento</h2>
              <p className="text-muted mt-1">Funcionalidade em desenvolvimento...</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
