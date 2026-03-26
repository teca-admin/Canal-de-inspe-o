import React, { useState, useEffect } from "react";
import { Topbar } from "./components/Topbar";
import { Sidebar } from "./components/Sidebar";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { NewTraining } from "./pages/NewTraining";
import { Certificates } from "./pages/Certificates";
import { Users } from "./pages/Users";
import { supabase } from "./lib/supabase";
import { Shield, Loader2 } from "lucide-react";
import { Toaster } from "sonner";

export default function App() {
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState<{ id: string; email: string } | null>(null);
  const [devicePending, setDevicePending] = useState(false);
  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
    setDevicePending(false);
    setActivePage("dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        <Toaster 
          position="top-right" 
          richColors 
          closeButton
          toastOptions={{
            style: {
              borderRadius: '0px',
              border: '1px solid #e5e7eb',
              fontFamily: 'Inter, sans-serif',
            },
          }}
        />
      </div>
    );
  }

  if (devicePending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4 sm:p-6 font-sans">
        <div className="bg-surface border-2 border-accent p-6 sm:p-10 max-w-lg w-full shadow-2xl relative overflow-hidden">
          {/* Security Pattern Background */}
          <div className="absolute top-0 left-0 w-full h-1 bg-accent opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-accent opacity-50"></div>
          
          <div className="space-y-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center border border-accent/20">
                <Shield className="text-accent" size={40} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-accent tracking-tighter uppercase italic">
                  Acesso Negado
                </h2>
                <div className="h-px w-24 bg-accent/30 mx-auto"></div>
                <p className="text-lg font-bold text-text uppercase tracking-tight mt-4">
                  Dispositivo não autorizado a acessar o sistema
                </p>
              </div>
            </div>

            <div className="bg-surface2 border border-border2 p-5 space-y-4 relative">
              <div className="flex justify-between items-center border-b border-border2 pb-2 mb-2">
                <span className="text-[10px] font-mono font-bold text-hint uppercase tracking-widest">Protocolo de Segurança</span>
                <span className="text-[10px] font-mono font-bold text-accent uppercase tracking-widest animate-pulse">Bloqueado</span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="text-[9px] uppercase font-bold text-hint tracking-widest mb-1">Identificador do Terminal (UUID)</div>
                  <div className="font-mono text-[12px] break-all text-text bg-white p-2 border border-border select-all">
                    {getDeviceId()}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <div className="text-[9px] uppercase font-bold text-hint tracking-widest mb-1">Status de Rede</div>
                    <div className="text-[11px] font-mono text-success font-bold">CONECTADO</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-bold text-hint tracking-widest mb-1">Autorização</div>
                    <div className="text-[11px] font-mono text-accent font-bold">PENDENTE</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-accent/5 border-l-4 border-accent text-[12px] text-text leading-relaxed">
                <strong>Aviso de Segurança:</strong> Este terminal não possui as credenciais de hardware necessárias para este nível de acesso. O administrador do sistema foi notificado desta tentativa de conexão.
              </div>
              
              <p className="text-[11px] text-muted text-center italic">
                Para solicitar autorização, informe o UUID acima ao Departamento de TI.
              </p>
            </div>

            <button 
              onClick={handleLogout}
              className="w-full py-3 bg-text hover:bg-black text-white text-[12px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 group"
            >
              <span>Encerrar Sessão de Segurança</span>
            </button>
          </div>
        </div>
        <Toaster 
          position="top-right" 
          richColors 
          closeButton
          toastOptions={{
            style: {
              borderRadius: '0px',
              border: '1px solid #e5e7eb',
              fontFamily: 'Inter, sans-serif',
            },
          }}
        />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Login 
          externalError={authError} 
          onRepairProfile={repairProfile}
          isRepairing={loading}
        />
        <Toaster 
          position="top-right" 
          richColors 
          closeButton
          toastOptions={{
            style: {
              borderRadius: '0px',
              border: '1px solid #e5e7eb',
              fontFamily: 'Inter, sans-serif',
            },
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen h-screen flex flex-col bg-bg overflow-hidden">
      <Topbar 
        userName={user.name} 
        role={user.role} 
        onLogout={handleLogout} 
        onToggleSidebar={() => {
          if (window.innerWidth < 768) {
            setMobileSidebarOpen(!mobileSidebarOpen);
          } else {
            setSidebarCollapsed(!sidebarCollapsed);
          }
        }}
        sidebarCollapsed={sidebarCollapsed}
        mobileSidebarOpen={mobileSidebarOpen}
      />
      <div className="flex flex-1 relative overflow-hidden">
        <Sidebar
          role={user.role}
          activePage={activePage}
          onNavigate={(page) => {
            setActivePage(page);
            setMobileSidebarOpen(false);
          }}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
        <main className="flex-1 p-4 md:p-8 overflow-auto transition-all duration-300 w-full bg-bg">
          <div className="max-w-7xl mx-auto">
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
          </div>
        </main>
      </div>
      <Toaster 
        position="top-right" 
        richColors 
        closeButton
        toastOptions={{
          style: {
            borderRadius: '0px',
            border: '1px solid #e5e7eb',
            fontFamily: 'Inter, sans-serif',
          },
        }}
      />
    </div>
  );
}
