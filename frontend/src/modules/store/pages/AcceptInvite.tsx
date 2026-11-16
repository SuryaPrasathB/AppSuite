import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, UserRole } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { apiClient } from '../../../api/apiClient';
import { Warehouse, ShieldAlert, Lock, User, ArrowRight, ArrowLeft } from 'lucide-react';

export const AcceptInvite: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { success, error: toastError } = useToast();

  const token = searchParams.get('token') || '';
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Missing invitation token. Please use the link from your email.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.auth.acceptInvite({
        token,
        username,
        password,
        name: name.trim() || undefined,
      });
      login(
        res.username,
        res.role as UserRole,
        res.token,
        res.name,
        res.id,
        res.email,
        res.department,
      );
      success(`Welcome to AppSuite, ${res.name || res.username}!`, 'Account Activated');
      navigate('/');
    } catch (err: any) {
      const errMsg = err.message || 'Failed to activate account.';
      setError(errMsg);
      toastError(errMsg, 'Activation Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-96 bg-primary-600/10 -skew-y-6 origin-top-left -z-10"></div>
      <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-primary-400/5 rounded-full blur-3xl -z-10"></div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative z-10">
        <div className="px-8 pt-10 pb-8">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-primary-50 p-4 rounded-2xl text-primary-600 mb-5 border border-primary-100 shadow-sm">
              <Warehouse className="h-8 w-8" />
            </div>
            <h1 className="font-black text-2xl tracking-tight text-slate-900 text-center uppercase">Accept Invitation</h1>
            <p className="text-sm text-slate-500 font-medium mt-1.5 text-center">Set up your username and password to join</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-3 text-red-700 text-sm shadow-sm">
                <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div className="relative">
              <input
                type="text"
                required
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="appearance-none block w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 focus:bg-white transition-all shadow-sm placeholder-slate-400 font-medium"
              />
              <User className="absolute left-4 top-4 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Full name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="appearance-none block w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 focus:bg-white transition-all shadow-sm placeholder-slate-400 font-medium"
              />
              <User className="absolute left-4 top-4 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative">
              <input
                type="password"
                required
                minLength={8}
                placeholder="Password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none block w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 focus:bg-white transition-all shadow-sm placeholder-slate-400 font-medium"
              />
              <Lock className="absolute left-4 top-4 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative">
              <input
                type="password"
                required
                minLength={8}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="appearance-none block w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 focus:bg-white transition-all shadow-sm placeholder-slate-400 font-medium"
              />
              <Lock className="absolute left-4 top-4 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-all"
            >
              {loading ? 'Activating...' : 'Activate Account'}
              <ArrowRight className="h-4 w-4" />
            </button>

            <div className="text-center pt-2">
              <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-primary-600 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
