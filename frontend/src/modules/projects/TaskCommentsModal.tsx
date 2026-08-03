import React, { useState, useEffect } from 'react';
import { X, Send, Trash2, MessageSquare, Clock, User } from 'lucide-react';
import { fetchTaskComments, createTaskComment, deleteTaskComment } from './api';

interface TaskCommentsModalProps {
  task: any;
  isOpen: boolean;
  onClose: () => void;
  onCommentsUpdated?: () => void;
}

export const TaskCommentsModal: React.FC<TaskCommentsModalProps> = ({
  task,
  isOpen,
  onClose,
  onCommentsUpdated
}) => {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && task) {
      loadComments();
    } else {
      setComments([]);
      setNewComment('');
      setError(null);
    }
  }, [isOpen, task]);

  const loadComments = async () => {
    if (!task?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTaskComments(task.project_id, task.id);
      setComments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const added = await createTaskComment(task.project_id, task.id, newComment.trim());
      setComments(prev => [...prev, added]);
      setNewComment('');
      onCommentsUpdated?.();
    } catch (err: any) {
      setError(err.message || 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await deleteTaskComment(task.project_id, task.id, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      onCommentsUpdated?.();
    } catch (err: any) {
      setError('Failed to delete comment');
    }
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 line-clamp-1">{task.title}</h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                <span>Comments & Discussion</span>
                <span>•</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                  task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                  task.status === 'REVIEW' ? 'bg-rose-100 text-rose-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {task.status?.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2 text-sm">
              <Clock className="h-4 w-4 animate-spin" />
              <span>Loading comments...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12 px-4 border-2 border-dashed border-slate-100 rounded-2xl">
              <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">No comments yet</p>
              <p className="text-xs text-slate-400 mt-1">Start the conversation by posting a note below.</p>
            </div>
          ) : (
            comments.map((comment) => {
              const dateStr = comment.created_at ? new Date(comment.created_at).toLocaleString() : '';
              return (
                <div key={comment.id} className="flex gap-3 group">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                    {comment.user_name ? comment.user_name.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">{comment.user_name || 'Anonymous'}</span>
                        {comment.user_role && (
                          <span className="text-[10px] bg-slate-200/60 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                            {comment.user_role}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-slate-400">{dateStr}</span>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-300 hover:text-rose-600 rounded"
                          title="Delete comment"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-normal">
                      {comment.content}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input Footer */}
        <div className="p-4 border-t border-slate-100 bg-white">
          <form onSubmit={handleAddComment} className="flex items-center gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={isSubmitting || !newComment.trim()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Post</span>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
