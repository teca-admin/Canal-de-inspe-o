import React, { useState, useEffect } from "react";
import { Topbar } from "./components/Topbar";
import { Sidebar } from "./components/Sidebar";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { NewTraining } from "./pages/NewTraining";
import { Certificates } from "./pages/Certificates";
import { Users } from "./pages/Users";
import { TrainingStatus } from "./types";

export default function App() {
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Simple login handler
  const handleLogin = (role: string) => {
    const users: Record<string, { name: string; role: string }> = {
      treinador: { name: "Carlos Treinador", role: "treinador" },
      admin: { name: "Admin Sistema", role: "admin" },
      cliente: { name: "Cliente ANAC", role: "cliente" },
    };
    setUser(users[role] || users.treinador);
    setActivePage(role === "cliente" ? "comprovantes" : "dashboard");
  };

  const handleLogout = () => {
    setUser(null);
    setActivePage("dashboard");
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
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
