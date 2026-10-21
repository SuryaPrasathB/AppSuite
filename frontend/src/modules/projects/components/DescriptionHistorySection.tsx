import React, { useState, useEffect } from 'react';
import { History, Clock, ChevronDown, ChevronUp, RotateCcw, Copy, Check, User, ArrowRight } from 'lucide-react';
import { fetchProjectDescriptionHistory, fetchTaskDescriptionHistory } from '../api';

interface DescriptionHistoryRecord {
  id: number;
  entity_type: string;
  entity_id: number;
  old_description: string | null;
  new_description: string | null;
  user_id: number | null;
  user_name: string | null;
  created_at: string;
}

interface DescriptionHistorySectionProps {
  entityType: 'project' | 'task';
  projectId?: number;
  entityId?: number;
  onRestore?: (description: string) => void;
  isReadOnly?: boolean;
}

export const DescriptionHistorySection: React.FC<DescriptionHistorySectionProps> = ({
  entityType,
  projectId,
  entityId,
  onRestore,
  isReadOnly = false,
}) => {
  const [history, setHistory] = useState<DescriptionHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [restoredId, setRestoredId] = useState<number | null>(null);

  const loadHistory = async () => {
    if (!entityId) {
      setHistory([]);
      return;
    }
    try {
      setLoading(true);
      let data: DescriptionHistoryRecord[] = [];
      if (entityType === 'project') {
        data = await fetchProjectDescriptionHistory(entityId);
      } else if (entityType === 'task') {
        const effectiveProjectId = projectId || 0;
        data = await fetchTaskDescriptionHistory(effectiveProjectId, entityId);
      }
      setHistory(data);
    } catch (err) {
      console.error(`Failed to load ${entityType} description history:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [entityType, entityId, projectId]);

  const handleCopy = (text: string | null, id: number) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRestore = (text: string | null, id: number) => {
    if (!onRestore) return;
    onRestore(text || '');
    setRestoredId(id);
    setTimeout(() => setRestoredId(null), 2500);
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  // If no entity exists yet (e.g. creating brand new task/project)
  if (!entityId) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mb-2">
        <Clock className="w-3 h-3 text-slate-300" />
        <span>History tracking starts after creation</span>
      </div>
    );
  }

  const latest = history[0];

  return (
    <div className="mb-2.5">
      {/* History Bar Right Below Label */}
      <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100/70">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1 font-semibold text-slate-700 shrink-0">
            <History className="w-3.5 h-3.5 text-indigo-500" />
            <span>History</span>
          </span>

          <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200/60 shrink-0">
            {history.length} {history.length === 1 ? 'version' : 'versions'}
          </span>

          {latest && (
            <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
              Last edit {formatRelativeTime(latest.created_at)}
              {latest.user_name ? ` by ${latest.user_name}` : ''}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline shrink-0 ml-2 cursor-pointer focus:outline-none"
        >
          <span>{isOpen ? 'Hide History' : 'View History'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expandable History Drawer / Container */}
      {isOpen && (
        <div className="mt-2 bg-white border border-slate-200 rounded-xl p-3 shadow-md space-y-3 animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {entityType === 'project' ? 'Project' : 'Task'} Description Timeline
              </h4>
            </div>
            {!isReadOnly && onRestore && (
              <span className="text-[10px] text-slate-400 font-medium">
                Click "Restore" to replace current text
              </span>
            )}
          </div>

          {loading ? (
            <div className="text-center py-4 text-xs text-slate-400">Loading version history...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-4 text-xs text-slate-400">
              No description updates have been tracked yet for this {entityType}.
            </div>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              {history.map((record, index) => {
                const versionNumber = history.length - index;
                const isRestored = restoredId === record.id;
                const isCopied = copiedId === record.id;
                const textToUse = record.new_description || record.old_description || '';

                return (
                  <div
                    key={record.id}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors text-xs"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px]">
                          v{versionNumber}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
                          <User className="w-3 h-3 text-slate-400" />
                          {record.user_name || (record.user_id ? `User #${record.user_id}` : 'System')}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          • {new Date(record.created_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopy(textToUse, record.id)}
                          title="Copy text"
                          className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200/60 transition-colors"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        {!isReadOnly && onRestore && textToUse && (
                          <button
                            type="button"
                            onClick={() => handleRestore(textToUse, record.id)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                              isRestored
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300'
                            }`}
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>{isRestored ? 'Restored!' : 'Restore'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Description Content Preview */}
                    <div className="mt-1 p-2 bg-white rounded border border-slate-100 text-slate-700 text-xs font-normal whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto custom-scrollbar">
                      {textToUse ? (
                        textToUse
                      ) : (
                        <span className="text-slate-400 italic">(Empty description)</span>
                      )}
                    </div>

                    {/* Previous text diff notice if old text exists */}
                    {record.old_description && record.new_description && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                        <ArrowRight className="w-2.5 h-2.5 text-slate-300" />
                        <span>Changed from {record.old_description.length} chars to {record.new_description.length} chars</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
