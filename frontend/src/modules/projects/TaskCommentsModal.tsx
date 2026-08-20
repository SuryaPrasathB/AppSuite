import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Trash2, MessageSquare, Clock, User, Paperclip, AtSign, Smile, Maximize2 } from 'lucide-react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && task) {
      loadComments();
    } else {
      setComments([]);
      setNewComment('');
      setError(null);
    }
  }, [isOpen, task]);

  useEffect(() => {
    if (comments.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

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

    const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  return (
    <div ref={modalRef} className="fixed right-6 top-24 w-[420px] max-h-[calc(100vh-120px)] z-50 flex flex-col rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-slate-200/60 bg-white overflow-hidden animate-in slide-in-from-right-8 fade-in duration-300">
      
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h3 className="text-[13px] font-bold text-slate-800 line-clamp-1">{task.title}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                task.status === 'REVIEW' ? 'bg-rose-100 text-rose-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {task.status?.replace('_', ' ')}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Comments</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="overflow-y-auto p-5 bg-[#FDFDFD] min-h-[150px]">
        {error && (
          <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 gap-2 text-sm">
            <Clock className="h-4 w-4 animate-spin" />
            <span>Loading...</span>
          </div>
        ) : comments.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3 border border-slate-100">
              <MessageSquare className="h-5 w-5 text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-700">Start the conversation</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">Leave a comment or note to keep everyone in the loop.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {comments.map((comment) => {
              const dateStr = comment.created_at ? new Date(comment.created_at).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric'
              }) : '';
              
              const isMe = comment.user_name === 'Administrator' || comment.user_name === 'You'; // simple heuristic for demo

              return (
                <div key={comment.id} className="flex gap-3 group">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 border border-slate-100 overflow-hidden">
                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user_name || 'User')}&background=random`} alt="avatar" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-[12px] font-bold text-slate-800 truncate">
                        {comment.user_name || 'Anonymous'}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400 shrink-0">{dateStr}</span>
                    </div>
                    <div className="relative group/bubble">
                      <p className="text-[13px] text-slate-700 leading-relaxed font-normal whitespace-pre-wrap break-words">
                        {comment.content}
                      </p>
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="absolute -right-8 top-0 opacity-0 group-hover/bubble:opacity-100 transition-opacity p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 rounded-lg shadow-sm"
                        title="Delete comment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Footer (Sleek dark design like Image 1) */}
      <div className="p-4 bg-white border-t border-slate-100 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
        <form onSubmit={handleAddComment} className="flex flex-col border border-slate-200 rounded-xl bg-[#1E1E24] shadow-inner transition-colors focus-within:border-slate-700 focus-within:ring-1 focus-within:ring-slate-700 overflow-hidden">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="w-full bg-transparent px-4 py-3 text-[13px] text-slate-200 placeholder-slate-400 focus:outline-none font-medium"
            disabled={isSubmitting}
          />
          <div className="px-3 py-2 flex items-center justify-end border-t border-slate-700/50 bg-[#1A1A1E]">
            <button
              type="submit"
              disabled={isSubmitting || !newComment.trim()}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-[11px] uppercase tracking-wide rounded-lg transition-colors flex items-center gap-1.5 shadow-sm">
              <Send className="h-3 w-3" />
              Send
            </button>
          </div>
        </form>
      </div>

    </div>
  );
};

