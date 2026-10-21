import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Send, Trash2, Pencil, Check } from 'lucide-react';
import { apiClient } from '../api/apiClient';

interface AnnouncementManagerModalProps {
  onClose: () => void;
}

export const AnnouncementManagerModal: React.FC<AnnouncementManagerModalProps> = ({ onClose }) => {
  const [activeAnnouncements, setActiveAnnouncements] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchAnnouncements = async () => {
    try {
      const data = await apiClient.announcements.listActive(5);
      setActiveAnnouncements(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handlePost = async () => {
    if (!message.trim()) return;
    setIsLoading(true);
    try {
      // Create new announcement
      await apiClient.announcements.create({ message: message.trim() });
      setMessage('');
      fetchAnnouncements();
    } catch (err) {
      alert("Failed to post announcement");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEdit = (ann: any) => {
    setEditingId(ann.id);
    setEditMessage(ann.message);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditMessage('');
  };

  const handleSaveEdit = async (id: number) => {
    if (!editMessage.trim()) return;
    setIsSavingEdit(true);
    try {
      await apiClient.announcements.update(id, { message: editMessage.trim() });
      setEditingId(null);
      setEditMessage('');
      fetchAnnouncements();
    } catch (err) {
      alert("Failed to update announcement");
      console.error(err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiClient.announcements.deactivate(id);
      fetchAnnouncements();
    } catch (err) {
      alert("Failed to deactivate announcement");
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            System Announcements
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Broadcast New Announcement
            </label>
            <div className="flex gap-2">
              <input 
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. System update in 10 minutes..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                onKeyDown={(e) => e.key === 'Enter' && handlePost()}
              />
              <button
                onClick={handlePost}
                disabled={isLoading || !message.trim()}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
                Post
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Active Announcements</h3>
            {activeAnnouncements.length === 0 ? (
              <div className="text-sm text-slate-500 italic bg-slate-50 p-4 rounded-lg text-center border border-slate-100">
                No active announcements.
              </div>
            ) : (
              <div className="space-y-3">
                {activeAnnouncements.map((ann) => (
                  <div key={ann.id} className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start justify-between gap-3">
                    {editingId === ann.id ? (
                      <div className="flex-1 flex flex-col gap-2">
                        <textarea
                          value={editMessage}
                          onChange={(e) => setEditMessage(e.target.value)}
                          className="w-full bg-white border border-amber-300 rounded-lg p-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none min-h-[60px]"
                          rows={2}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSaveEdit(ann.id);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveEdit(ann.id)}
                            disabled={isSavingEdit || !editMessage.trim()}
                            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            {isSavingEdit ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={isSavingEdit}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded font-medium text-xs transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm text-amber-900 font-medium pt-0.5 break-words flex-1 min-w-0">
                          {ann.message}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleStartEdit(ann)}
                            className="text-amber-700 hover:text-amber-900 hover:bg-amber-100/70 p-1.5 rounded transition-colors"
                            title="Edit Announcement"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(ann.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors"
                            title="Deactivate"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
