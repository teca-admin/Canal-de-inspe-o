import React from "react";
import { LayoutDashboard, Users, FileText, PlusCircle, ClipboardList } from "lucide-react";
import { cn } from "../lib/utils";

interface SidebarProps {
  role: string;
  activePage: string;
  onNavigate: (page: string) => void;
  collapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  role, 
  activePage, 
  onNavigate,
  collapsed 
}) => {
  const isAdmin = role === "admin";
  const isTrainer = role === "treinador" || isAdmin;

  return (
    <div className={cn(
      "bg-surface border-r border-border py-5 flex-shrink-0 min-h-[calc(100vh-52px)] transition-all duration-300",
      collapsed ? "w-[64px]" : "w-[220px]"
    )}>
      {isTrainer && (
        <div className="px-4 mb-6">
          {!collapsed && (
            <div className="text-[10px] uppercase tracking-[0.08em] text-hint font-mono font-medium mb-2 px-2">
              Treinamento
            </div>
          )}
          <SidebarItem
            icon={<PlusCircle size={16} />}
            label="Novo Treinamento"
            active={activePage === "novoTreinamento"}
            onClick={() => onNavigate("novoTreinamento")}
            collapsed={collapsed}
          />
          <SidebarItem
            icon={<ClipboardList size={16} />}
            label="Em Andamento"
            active={activePage === "avaliacoes"}
            onClick={() => onNavigate("avaliacoes")}
            collapsed={collapsed}
          />
        </div>
      )}

      {isAdmin && (
        <div className="px-4 mb-6">
          {!collapsed && (
            <div className="text-[10px] uppercase tracking-[0.08em] text-hint font-mono font-medium mb-2 px-2">
              Administração
            </div>
          )}
          <SidebarItem
            icon={<LayoutDashboard size={16} />}
            label="Dashboard"
            active={activePage === "dashboard"}
            onClick={() => onNavigate("dashboard")}
            collapsed={collapsed}
          />
          <SidebarItem
            icon={<Users size={16} />}
            label="Usuários"
            active={activePage === "usuarios"}
            onClick={() => onNavigate("usuarios")}
            collapsed={collapsed}
          />
        </div>
      )}

      <div className="px-4">
        {!collapsed && (
          <div className="text-[10px] uppercase tracking-[0.08em] text-hint font-mono font-medium mb-2 px-2">
            Documentos
          </div>
        )}
        <SidebarItem
          icon={<FileText size={16} />}
          label="Comprovantes"
          active={activePage === "comprovantes"}
          onClick={() => onNavigate("comprovantes")}
          collapsed={collapsed}
        />
      </div>
    </div>
  );
};

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  collapsed?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, active, onClick, collapsed }) => {
  return (
    <div
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-2.5 p-2 text-[13px] cursor-pointer border-l-2 border-transparent transition-all",
        active
          ? "text-accent border-l-accent bg-accent-light font-medium"
          : "text-muted hover:text-text hover:bg-surface2",
        collapsed && "justify-center px-0"
      )}
    >
      <span className="w-[18px] flex justify-center">{icon}</span>
      {!collapsed && (
        <span className="uppercase tracking-[0.08em] font-mono text-[10px]">{label}</span>
      )}
    </div>
  );
};
