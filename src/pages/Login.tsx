import React, { useState } from "react";
import { User, Lock } from "lucide-react";
import { supabase } from "../lib/supabase";

export const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
    } catch (err: any) {
      setError(err.message || "Erro ao realizar login");
    } finally {
      setLoading(false);
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
              E-mail <span className="text-accent">*</span>
            </label>
            <div className="relative">
              <input
                type="email"
                className="w-full p-2.5 pl-10 border border-border2 bg-surface font-sans text-sm outline-none focus:border-accent transition-colors"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
                required
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            </div>
          </div>

          {error && (
            <div className="bg-danger-light border border-red-300 p-2.5 text-[12px] text-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-dark text-white py-2.5 text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
};
