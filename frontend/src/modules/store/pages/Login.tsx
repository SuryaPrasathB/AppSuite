import React, { useState } from 'react';
import { useAuth, UserRole } from '../../../context/AuthContext';
import { apiClient } from '../../../api/apiClient';
import { Warehouse, ShieldAlert, Lock, User } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      setError("Please enter a username.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Send login request to Backend
      const res = await apiClient.auth.login({ username, password: password || 'password' });
      login(res.username, res.role as UserRole, res.token);
    } catch (err: any) {
      setError(err.message || "Authentication failed. Make sure the backend API is running.");
    } finally {
      setLoading(false);
    }
  };

  const selectDemoUser = (user: string) => {
    setUsername(user);
    setPassword('password');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background gradients for premium wow effect */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 -z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary-600/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex bg-primary-600 p-3.5 rounded-2xl text-white shadow-xl shadow-primary-900/30 mb-4 animate-bounce">
          <Warehouse className="h-8 w-8" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">Smart Store</h2>
        <p className="mt-1.5 text-sm text-slate-400 font-medium max-w-sm mx-auto">
          "A Digital Twin for Your Physical Store"
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 py-8 px-6 shadow-2xl rounded-2xl border border-slate-800 sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3.5 flex items-start space-x-3 text-red-300 text-sm">
                <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Username / Profile
              </label>
              <div className="mt-1.5 relative">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  placeholder="e.g. admin, manager, operator..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
                <User className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <div className="mt-1.5 relative">
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
                <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-primary-500 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Authenticating..." : "Sign In"}
              </button>
            </div>
          </form>

          {/* Quick login credentials helper */}
          <div className="mt-6 border-t border-slate-800 pt-6">
            <span className="block text-center text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Select a Demo Role to Login
            </span>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <button
                onClick={() => selectDemoUser('admin')}
                className="bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 py-2 rounded-lg font-medium transition-all"
              >
                Administrator
              </button>
              <button
                onClick={() => selectDemoUser('manager')}
                className="bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 py-2 rounded-lg font-medium transition-all"
              >
                Store Manager
              </button>
              <button
                onClick={() => selectDemoUser('operator')}
                className="bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 py-2 rounded-lg font-medium transition-all"
              >
                Store Operator
              </button>
              <button
                onClick={() => selectDemoUser('purchaser')}
                className="bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 py-2 rounded-lg font-medium transition-all"
              >
                Purchase Team
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
