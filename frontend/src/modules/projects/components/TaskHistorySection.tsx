import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Clock,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Copy,
  Check,
  User,
  ArrowRight,
  Calendar,
  Tag,
  AlignLeft,
  Users,
  GitBranch,
  Sparkles,
} from 'lucide-react';
import { fetchTaskChangeHistory } from '../api';

export interface TaskChangeRecord {
  id: number;
  task_id: number;
  project_id: number | null;
  field_name: string;
  field_label: string;
  old_value: string | null;
  new_value: string | null;
  user_id: number | null;
  user_name: string | null;
  created_at: string;
}

interface TaskHistorySectionProps {
  projectId?: number;
  taskId?: number;
  onRestoreDescription?: (description: string) => void;
  isReadOnly?: boolean;
}

type FilterCategory = 'all' | 'dates' | 'status' | 'details' | 'assignees';

const DATE_FIELDS = new Set(['start_date', 'due_date', 'completed_at']);
const STATUS_FIELDS = new Set(['status', 'priority', 'progress_pct']);
const ASSIGNEE_FIELDS = new Set(['assignees', 'assignee_id']);

function getFieldCategory(fieldName: string): FilterCategory {
  if (DATE_FIELDS.has(fieldName)) return 'dates';
  if (STATUS_FIELDS.has(fieldName)) return 'status';
  if (ASSIGNEE_FIELDS.has(fieldName)) return 'assignees';
  return 'details';
}

function getFieldBadgeStyle(fieldName: string): { bg: string; icon: React.ReactNode } {
  if (fieldName === 'due_date') {
    return {
      bg: 'bg-rose-50 text-rose-700 border-rose-200/80',
      icon: <Calendar className="w-3 h-3 text-rose-500" />,
    };
  }
  if (DATE_FIELDS.has(fieldName)) {
    return {
      bg: 'bg-amber-50 text-amber-700 border-amber-200/80',
      icon: <Calendar className="w-3 h-3 text-amber-500" />,
    };
  }
  if (STATUS_FIELDS.has(fieldName)) {
    return {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      icon: <Tag className="w-3 h-3 text-emerald-500" />,
    };
  }
  if (ASSIGNEE_FIELDS.has(fieldName)) {
    return {
      bg: 'bg-sky-50 text-sky-700 border-sky-200/80',
      icon: <Users className="w-3 h-3 text-sky-500" />,
    };
  }
  if (fieldName === 'dependencies' || fieldName === 'parent_id') {
    return {
      bg: 'bg-violet-50 text-violet-700 border-violet-200/80',
      icon: <GitBranch className="w-3 h-3 text-violet-500" />,
    };
  }
  if (fieldName === 'created') {
    return {
      bg: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: <Sparkles className="w-3 h-3 text-slate-500" />,
    };
  }
  return {
    bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    icon: <AlignLeft className="w-3 h-3 text-indigo-500" />,
  };
}

export const TaskHistorySection: React.FC<TaskHistorySectionProps> = ({
  projectId,
  taskId,
  onRestoreDescription,
  isReadOnly = false,
}) => {
  const [history, setHistory] = useState<TaskChangeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [restoredId, setRestoredId] = useState<number | null>(null);

  const loadHistory = async () => {
    if (!taskId) {
      setHistory([]);
      return;
    }
    try {
      setLoading(true);
      const data = await fetchTaskChangeHistory(projectId || 0, taskId);
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load task change history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [taskId, projectId]);

  const filteredHistory = useMemo(() => {
    if (activeFilter === 'all') return history;
    return history.filter((r) => getFieldCategory(r.field_name) === activeFilter);
  }, [history, activeFilter]);

  const categoryCounts = useMemo(() => {
    const counts: Record<FilterCategory, number> = {
      all: history.length,
      dates: 0,
      status: 0,
      details: 0,
      assignees: 0,
    };
    for (const r of history) {
      counts[getFieldCategory(r.field_name)] += 1;
    }
    return counts;
  }, [history]);

  const handleCopy = (text: string | null, id: number) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRestore = (text: string | null, id: number) => {
    if (!onRestoreDescription) return;
    onRestoreDescription(text || '');
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

  if (!taskId) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mb-2">
        <Clock className="w-3 h-3 text-slate-300" />
        <span>Task change history starts after creation</span>
      </div>
    );
  }

  const latest = history[0];

  const filterTabs: { key: FilterCategory; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'dates', label: 'Dates' },
    { key: 'status', label: 'Status' },
    { key: 'details', label: 'Details' },
    { key: 'assignees', label: 'Assignees' },
  ];

  return (
    <div className="mb-2.5">
      {/* Unified Task History Bar */}
      <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100/70">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1 font-semibold text-slate-700 shrink-0">
            <History className="w-3.5 h-3.5 text-indigo-500" />
            <span>Task History</span>
          </span>

          <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200/60 shrink-0">
            {history.length} {history.length === 1 ? 'change' : 'changes'}
          </span>

          {latest && (
            <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
              Last edit ({latest.field_label}) {formatRelativeTime(latest.created_at)}
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

      {/* Expandable Change Timeline */}
      {isOpen && (
        <div className="mt-2 bg-white border border-slate-200 rounded-xl p-3 shadow-md space-y-2.5 animate-in fade-in-50 duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                All Task Changes
              </h4>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 flex-wrap">
              {filterTabs.map((tab) => {
                const count = categoryCounts[tab.key];
                if (tab.key !== 'all' && count === 0) return null;
                const active = activeFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveFilter(tab.key)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors border cursor-pointer ${
                      active
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {tab.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-4 text-xs text-slate-400">Loading task history...</div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-4 text-xs text-slate-400">
              No changes have been recorded yet for this task.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
              {filteredHistory.map((record) => {
                const badge = getFieldBadgeStyle(record.field_name);
                const isDescription = record.field_name === 'description';
                const isCreated = record.field_name === 'created';
                const descText = record.new_value || record.old_value || '';
                const isCopied = copiedId === record.id;
                const isRestored = restoredId === record.id;

                return (
                  <div
                    key={record.id}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 font-bold border px-1.5 py-0.5 rounded text-[10px] ${badge.bg}`}
                        >
                          {badge.icon}
                          <span>{record.field_label}</span>
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
                          <User className="w-3 h-3 text-slate-400" />
                          {record.user_name || (record.user_id ? `User #${record.user_id}` : 'System')}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          •{' '}
                          {new Date(record.created_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {isDescription && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopy(descText, record.id)}
                            title="Copy description"
                            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200/60 transition-colors"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {!isReadOnly && onRestoreDescription && descText && (
                            <button
                              type="button"
                              onClick={() => handleRestore(descText, record.id)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
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
                      )}
                    </div>

                    {isCreated ? (
                      <div className="text-xs text-slate-600">
                        Created task{' '}
                        <span className="font-semibold text-slate-800">
                          "{record.new_value || 'Untitled'}"
                        </span>
                      </div>
                    ) : isDescription ? (
                      <div className="space-y-1">
                        <div className="p-2 bg-white rounded border border-slate-100 text-slate-700 text-xs font-normal whitespace-pre-wrap leading-relaxed max-h-28 overflow-y-auto custom-scrollbar">
                          {descText || <span className="text-slate-400 italic">(Empty description)</span>}
                        </div>
                        {record.old_value && record.new_value && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <ArrowRight className="w-2.5 h-2.5 text-slate-300" />
                            <span>
                              Changed from {record.old_value.length} chars to {record.new_value.length} chars
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap text-xs">
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200/80 text-slate-500 line-through decoration-rose-400/70">
                          {record.old_value || <span className="italic no-underline text-slate-400">None</span>}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="px-2 py-0.5 rounded bg-white border border-indigo-200/80 text-slate-800 font-semibold">
                          {record.new_value || <span className="italic font-normal text-slate-400">None</span>}
                        </span>
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
