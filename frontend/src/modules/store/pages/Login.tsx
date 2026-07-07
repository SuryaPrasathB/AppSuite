import React, { useState } from 'react';
import { useAuth, UserRole } from '../../../context/AuthContext';
import { apiClient } from '../../../api/apiClient';
import { Warehouse, ShieldAlert, Lock, User, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.auth.login({ username, password });
      login(res.username, res.role as UserRole, res.token);
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Left side: Login Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 bg-white z-10 shadow-2xl relative">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-primary-600 p-2.5 rounded-xl text-white shadow-lg shadow-primary-500/30">
              <Warehouse className="h-7 w-7" />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight text-slate-900">LSCS APP SUITE</h1>
              <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase block mt-0.5">Enterprise Portal</span>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sign in to your account</h2>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            Enter your enterprise credentials to access the system.
          </p>

          <div className="mt-8">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 text-red-700 text-sm shadow-sm">
                  <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="username" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Username
                </label>
                <div className="relative">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="appearance-none block w-full bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow shadow-xs placeholder-slate-400"
                  />
                  <User className="absolute left-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow shadow-xs placeholder-slate-400"
                  />
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-slate-300 rounded cursor-pointer"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600 cursor-pointer">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <a href="#" className="font-semibold text-primary-600 hover:text-primary-500 transition-colors">
                    Forgot your password?
                  </a>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Authenticating..." : "Sign in securely"}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Right side: Branding/Image */}
      <div className="hidden lg:block relative w-0 flex-1 bg-slate-100 overflow-hidden">
        {/* Abstract pattern / image replacement */}
        <div className="absolute inset-0 h-full w-full object-cover bg-linear-to-br from-primary-600 to-slate-900" />
        <div className="absolute inset-0 bg-white/10 backdrop-blur-3xl" />
        
        {/* Decorative elements */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-400/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center text-white z-10">
          <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-2xl mb-8">
            <Warehouse className="h-16 w-16 text-white" />
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight mb-4">Enterprise Digital Twin</h2>
          <p className="text-lg text-slate-200 max-w-lg font-medium leading-relaxed">
            Unify your physical inventory, automate purchase orders, and manage cross-department workflows securely from one centralized portal.
          </p>
        </div>
      </div>
    </div>
  );
};
