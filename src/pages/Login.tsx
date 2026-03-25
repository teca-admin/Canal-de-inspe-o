import React, { useState } from "react";
import { User, Lock } from "lucide-react";

interface LoginProps {
  onLogin: (role: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login && password) {
      onLogin("treinador");
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="bg-surface border border-border p-10 w-full max-w-[380px] shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-accent flex items-center justify-center text-white text-lg font-bold">
            CI
          </div>
          <div>
            <h1 className="text-base font-bold text-text leading-tight">
              Canal de Inspeção
            </h1>
            <p className="text-[11px] text-muted font-mono uppercase tracking-[0.06em]">
              Sistema de Treinamento
            </p>
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-1.5">Acesso ao Sistema</h2>
        <p className="text-[13px] text-muted mb-7">
          Insira suas credenciais para continuar
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-text uppercase tracking-wider">
              Login <span className="text-accent">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                className="w-full p-2.5 pl-10 border border-border2 bg-surface font-sans text-sm outline-none focus:border-accent transition-colors"
                placeholder="Matrícula ou e-mail"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
              />
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-text uppercase tracking-wider">
              Senha <span className="text-accent">*</span>
            </label>
            <div className="relative">
              <input
                type="password"
                className="w-full p-2.5 pl-10 border border-border2 bg-surface font-sans text-sm outline-none focus:border-accent transition-colors"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            </div>
          </div>

          {error && (
            <div className="bg-danger-light border border-red-300 p-2.5 text-[12px] text-danger">
              Credenciais inválidas. Tente novamente.
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-accent hover:bg-accent-dark text-white py-2.5 text-[13px] font-medium transition-colors"
          >
            Entrar
          </button>
        </form>

        <div className="mt-7 pt-4 border-t border-border">
          <p className="text-[11px] text-hint mb-2 font-mono uppercase tracking-wider">
            ACESSO RÁPIDO (DEMO):
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onLogin("treinador")}
              className="px-3 py-1.5 bg-surface2 hover:bg-surface3 border border-border2 text-[12px] text-text transition-colors"
            >
              👤 Treinador
            </button>
            <button
              onClick={() => onLogin("admin")}
              className="px-3 py-1.5 bg-surface2 hover:bg-surface3 border border-border2 text-[12px] text-text transition-colors"
            >
              🔑 Admin
            </button>
            <button
              onClick={() => onLogin("cliente")}
              className="px-3 py-1.5 bg-surface2 hover:bg-surface3 border border-border2 text-[12px] text-text transition-colors"
            >
              📋 Cliente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
