import React from "react";
import { LogOut, Menu, X } from "lucide-react";
import { cn } from "../lib/utils";

interface TopbarProps {
  userName: string;
  role: string;
  onLogout: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({ 
  userName, 
  role, 
  onLogout, 
  onToggleSidebar,
  sidebarCollapsed 
}) => {
  return (
    <div className="bg-surface border-b border-border px-6 h-[52px] flex items-center justify-between sticky top-0 z-100">
      <div className="flex items-center gap-4">
        <button 
          onClick={onToggleSidebar}
          className="p-1.5 hover:bg-surface2 text-muted transition-colors rounded-sm"
        >
          {sidebarCollapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-accent flex items-center justify-center text-white text-[13px] font-bold tracking-tighter">
            CI
          </div>
          <div className="hidden sm:block">
            <div className="text-[13px] font-semibold text-text tracking-tight">
              Canal de Inspeção
            </div>
            <div className="text-[10px] text-muted font-mono uppercase tracking-[0.08em]">
              Sistema de Treinamento
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-[12px] text-muted font-mono hidden md:inline">{userName}</span>
        <span className="text-[10px] font-mono font-medium uppercase tracking-[0.06em] px-[7px] py-[2px] border border-border2 text-muted">
          {role}
        </span>
        <button
          onClick={onLogout}
          className="text-[12px] text-muted bg-transparent border border-border px-[10px] py-[4px] cursor-pointer hover:bg-surface2 transition-colors flex items-center gap-2"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </div>
  );
};
