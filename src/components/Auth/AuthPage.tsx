import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../i18n/i18nContext';
import toast from 'react-hot-toast';
import { LogIn, Activity, TrendingUp } from 'lucide-react';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const { t } = useI18n();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(t.auth.loginButton);
        onAuthSuccess();
      } else {
        if (password !== confirmPassword) {
          toast.error('Passwords do not match');
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success(t.auth.registerSuccess);
        onAuthSuccess();
      }
    } catch (error: any) {
      toast.error(error.message || (isLogin ? t.auth.loginError : t.auth.registerError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black bg-grid flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-blue rounded-2xl mb-4" style={{ boxShadow: '0 0 30px rgba(59,130,246,0.4)' }}>
            <Activity className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t.app.title}</h1>
          <p className="text-sm text-[#6B7280] mt-1">{t.app.tagline}</p>
        </div>

        <div className="bg-[#111111] rounded-2xl border border-[#3B82F6]/30 p-7" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(59,130,246,0.1)' }}>
          <div className="flex rounded-xl bg-[#000000] p-1 mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-smooth ${
                isLogin ? 'bg-primary-blue text-white shadow-sm' : 'text-[#6B7280] hover:text-white'
              }`}
            >
              {t.auth.login}
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-smooth ${
                !isLogin ? 'bg-primary-blue text-white shadow-sm' : 'text-[#6B7280] hover:text-white'
              }`}
            >
              {t.auth.register}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1.5">
                {t.auth.email}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-[#000000] border border-[#1F2937] text-white rounded-xl text-sm placeholder-[#374151] focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-fast"
                placeholder="votre@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1.5">
                {t.auth.password}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 bg-[#000000] border border-[#1F2937] text-white rounded-xl text-sm placeholder-[#374151] focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-fast"
                placeholder="••••••••"
              />
            </div>

            {!isLogin && (
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1.5">
                  {t.auth.confirmPassword}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 bg-[#000000] border border-[#1F2937] text-white rounded-xl text-sm placeholder-[#374151] focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-fast"
                  placeholder="••••••••"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-blue text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-primary-blue-hover transition-smooth disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              style={{ boxShadow: '0 4px 14px rgba(59,130,246,0.35)' }}
            >
              <LogIn className="w-4 h-4" />
              {loading ? t.common.loading : isLogin ? t.auth.loginButton : t.auth.registerButton}
            </button>
          </form>
        </div>

        <div className="flex items-center justify-center gap-2 mt-6">
          <TrendingUp className="w-3.5 h-3.5 text-[#1F2937]" />
          <p className="text-[11px] text-[#374151]">Powered by MetaAPI • MT4 & MT5 Integration</p>
        </div>
      </div>
    </div>
  );
};
