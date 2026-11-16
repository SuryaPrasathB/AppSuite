import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import { apiClient } from '../../../api/apiClient';
import { Warehouse, ShieldAlert, Mail, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const { error: toastError } = useToast();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.auth.forgotPassword({ email: email.trim() });
      setSubmitted(true);
    } catch (err: any) {
      const errMsg = err.message || 'Unable to process request.';
      setError(errMsg);
      toastError(errMsg, 'Request Failed');
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
            <h1 className="font-black text-2xl tracking-tight text-slate-900 text-center uppercase">Forgot Password</h1>
            <p className="text-sm text-slate-500 font-medium mt-1.5 text-center">Enter your email to receive a reset link</p>
          </div>

          {submitted ? (
            <div className="space-y-6 text-center">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col items-center gap-2 text-emerald-800 text-sm">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                <p className="font-medium">
                  If an account exists for <span className="font-bold">{email}</span>, a password reset link has been sent.
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Return to Login
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-3 text-red-700 text-sm shadow-sm">
                  <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="Work email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 focus:bg-white transition-all shadow-sm placeholder-slate-400 font-medium"
                />
                <Mail className="absolute left-4 top-4 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-all"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
                <ArrowRight className="h-4 w-4" />
              </button>

              <div className="text-center pt-2">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-primary-600 transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
