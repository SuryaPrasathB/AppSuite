import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';

export const SubscriptionBanner: React.FC = () => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [billing, setBilling] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      setBilling(null);
      return;
    }
    apiClient.billing.getStatus().then(setBilling).catch(() => {});
  }, [user]);

  if (!user || !billing) return null;
  if (!billing.is_grace_period && !billing.is_expired) return null;

  const isExpired = Boolean(billing.is_expired);
  const isAdmin = hasRole(['Administrator', 'company_admin']);

  return (
    <div
      className={`px-6 py-2.5 text-xs font-bold flex items-center justify-between gap-4 shrink-0 ${
        isExpired
          ? 'bg-rose-600 text-white'
          : 'bg-amber-400 text-slate-950'
      }`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          {isExpired
            ? 'Subscription Expired — Write access is paused. Renew your plan to restore full access.'
            : `Subscription Past Due (Grace Period) — Renew before ${billing.grace_period_end ? billing.grace_period_end.split('T')[0] : 'expiry'} to avoid lockout.`}
        </span>
      </div>
      {isAdmin && (
        <button
          onClick={() => navigate('/company-admin')}
          className={`px-3 py-1 rounded-lg text-xs font-black transition ${
            isExpired
              ? 'bg-white text-rose-700 hover:bg-rose-50'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          Renew Plan
        </button>
      )}
    </div>
  );
};
