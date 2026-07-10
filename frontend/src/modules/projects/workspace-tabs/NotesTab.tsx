import React, { useState, useEffect } from 'react';
import { StickyNote, Send, Clock, User } from 'lucide-react';
import { fetchProjectNotes, createProjectNote } from '../api';
import { useDialog } from '../../../context/DialogContext';

interface NotesTabProps {
  projectId: number;
}

export const NotesTab: React.FC<NotesTabProps> = ({ projectId }) => {
  const { showAlert } = useDialog();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const data = await fetchProjectNotes(projectId);
      setNotes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      setSubmitting(true);
      const userStr = localStorage.getItem('smart_store_user');
      const user = userStr ? JSON.parse(userStr) : { name: 'Unknown User', id: 0 };
      
      await createProjectNote(projectId, {
        content: newNote,
        author_id: user.id || 1,
        author_name: user.name || 'System'
      });
      setNewNote('');
      loadNotes();
    } catch (err) {
      console.error(err);
      showAlert('Failed to post note');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6 text-slate-500">Loading notes...</div>;

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-indigo-600" />
          Project Notes & Comments
        </h3>
        <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full">{notes.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/50">
        {notes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <StickyNote className="h-10 w-10 mb-3 text-slate-300" />
            <p className="text-sm">No notes yet. Be the first to add one!</p>
          </div>
        ) : (
          notes.map(note => (
            <div key={note.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">
                    {note.author_name ? note.author_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="font-bold text-sm text-slate-800">{note.author_name}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400 font-mono">
                  <Clock className="h-3 w-3" />
                  {new Date(note.created_at).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </div>
              <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">{note.content}</p>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-slate-200 bg-white">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Write a note or comment..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting || !newNote.trim()}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
