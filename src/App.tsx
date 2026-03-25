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
  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const handleGlobalError = (event: PromiseRejectionEvent) => {
      if (event.reason?.message === "Failed to fetch") {
        console.error("Global Failed to fetch detected:", event.reason);
        alert("Erro de conexão com o servidor. Verifique sua internet ou se o Supabase está acessível.");
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
        setLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
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
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
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
      if (err.message === "Failed to fetch") {
        alert("Erro de conexão com o Supabase. Verifique sua internet ou se o projeto está ativo.");
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
    return <Login />;
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
