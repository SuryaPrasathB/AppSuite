import React, { useState } from 'react';
import { useAuth, UserRole } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { apiClient } from '../../../api/apiClient';
import { Warehouse, ShieldAlert, Lock, User, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { success, error: toastError } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter both username and password.");
      toastError("Please enter both username and password.", "Login Failed");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.auth.login({ username, password });
      login(res.username, res.role as UserRole, res.token, res.name, res.id, res.email, res.department);
      success(`Welcome back, ${res.username}!`, "Login Successful");
    } catch (err: any) {
      const errMsg = err.message || "Authentication failed. Please check your credentials.";
      setError(errMsg);
      toastError(errMsg, "Authentication Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans p-4 relative overflow-hidden">
      {/* Subtle background elements */}
      <div className="absolute top-0 left-0 w-full h-96 bg-primary-600/10 -skew-y-6 origin-top-left -z-10"></div>
      <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-primary-400/5 rounded-full blur-3xl -z-10"></div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative z-10">
        <div className="px-8 pt-10 pb-8">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-primary-50 p-4 rounded-2xl text-primary-600 mb-5 border border-primary-100 shadow-sm">
              <Warehouse className="h-8 w-8" />
            </div>
            <h1 className="font-black text-2xl tracking-tight text-slate-900 text-center uppercase">LSCS App Suite</h1>
            <p className="text-sm text-slate-500 font-medium mt-1.5 uppercase tracking-widest">Enterprise Portal</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-3 text-red-700 text-sm shadow-sm">
                <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <div className="relative">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 focus:bg-white transition-all shadow-sm placeholder-slate-400 font-medium"
                />
                <User className="absolute left-4 top-4 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 focus:bg-white transition-all shadow-sm placeholder-slate-400 font-medium"
                />
                <Lock className="absolute left-4 top-4 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 px-1">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-slate-600 cursor-pointer">
                  Remember me
                </label>
              </div>

              <a href="#" className="text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors">
                Forgot password?
              </a>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Authenticating..." : "Sign In"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>
        <div className="bg-slate-50 border-t border-slate-100 py-4 px-8 text-center">
          <p className="text-xs text-slate-400 font-semibold tracking-wide">Secure access to LSCS Enterprise Resources</p>
        </div>
      </div>
    </div>
  );
};
