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
  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const repairProfile = async () => {
    if (!needsProfile) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: needsProfile.id,
          nome_completo: needsProfile.email.split('@')[0],
          cpf: '00000000000',
          cargo: 'Administrador (Auto-gerado)',
          perfil: 'admin',
          ativo: true
        });

      if (error) throw error;
      
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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error("Profile fetch error details:", error);
        if (error.code === "PGRST116") {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            setNeedsProfile({ id: authUser.id, email: authUser.email || "" });
          }
          throw new Error(`Perfil não encontrado para o usuário ${authUser?.email}. O usuário existe no Auth mas não na tabela 'profiles'.`);
        }
        throw error;
      }

      if (data) {
        setUser({
          id: data.id,
          name: data.nome_completo,
          role: data.perfil
        });
        if (data.perfil === "cliente") {
          setActivePage("comprovantes");
        }
      }
    } catch (err: any) {
      console.error("Error fetching profile:", err);
      setAuthError(err.message || "Erro ao carregar perfil");
      
      // Only sign out if it's NOT a missing profile error
      // This allows the user to stay authenticated so we can "repair" the profile
      if (err.message && !err.message.includes("Perfil não encontrado")) {
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
          {activePage === "usuarios" && <Users />}
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
