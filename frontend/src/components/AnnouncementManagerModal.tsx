import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Send, Trash2 } from 'lucide-react';
import { apiClient } from '../api/apiClient';

interface AnnouncementManagerModalProps {
  onClose: () => void;
}

export const AnnouncementManagerModal: React.FC<AnnouncementManagerModalProps> = ({ onClose }) => {
  const [activeAnnouncements, setActiveAnnouncements] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
                  <div key={ann.id} className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start justify-between gap-4">
                    <div className="text-sm text-amber-900 font-medium pt-0.5">
                      {ann.message}
                    </div>
                    <button
                      onClick={() => handleDelete(ann.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors shrink-0"
                      title="Deactivate"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
