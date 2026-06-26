import React, { useState, useEffect } from 'react';
import { Activity, Clock } from 'lucide-react';
import { fetchProjectActivities } from '../api';

interface ActivityTabProps {
  projectId: number;
}

export const ActivityTab: React.FC<ActivityTabProps> = ({ projectId }) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const data = await fetchProjectActivities(projectId);
      setActivities(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [projectId]);

  if (loading) return <div className="p-6 text-slate-500">Loading activities...</div>;

  return (
    <div className="h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
        <Activity className="h-5 w-5 text-indigo-600" />
        <h3 className="font-bold text-slate-800">Project Activity Log</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {activities.length === 0 ? (
          <div className="text-center text-slate-500 mt-10">No activities recorded yet.</div>
        ) : (
          <div className="relative border-l-2 border-indigo-100 ml-3 space-y-6">
            {activities.map((act) => (
              <div key={act.id} className="relative pl-6">
                <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-white border-2 border-indigo-500 shadow-sm" />
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-bold text-slate-800 text-sm">{act.action}</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                      <Clock className="h-3 w-3" />
                      {new Date(act.created_at).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  {act.description && (
                    <p className="text-xs text-slate-600 mt-1">{act.description}</p>
                  )}
                  {act.user_name && (
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">By {act.user_name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
