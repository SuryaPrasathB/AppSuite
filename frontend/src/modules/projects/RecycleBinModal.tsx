import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCcw, AlertTriangle, X } from 'lucide-react';
import { fetchDeletedProjects, restoreProject, forceDeleteProject } from './api';
import { useDialog } from '../../context/DialogContext';

interface RecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: () => void;
}

export const RecycleBinModal: React.FC<RecycleBinModalProps> = ({ isOpen, onClose, onRestore }) => {
  const [deletedProjects, setDeletedProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { showConfirm, showAlert } = useDialog();

  useEffect(() => {
    const userStr = localStorage.getItem('smart_store_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setIsAdmin(user.role === 'Administrator');
      } catch (e) {}
    }
  }, []);

  const loadDeletedProjects = async () => {
    if (!isAdmin) return;
    try {
      setLoading(true);
      const data = await fetchDeletedProjects();
      setDeletedProjects(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDeletedProjects();
    }
  }, [isOpen]);

  const handleRestore = async (id: number) => {
    try {
      await restoreProject(id);
      onRestore(); // trigger refresh of main list
      loadDeletedProjects();
    } catch (err: any) {
      showAlert(err.message || 'Failed to restore project');
    }
  };

  const handleForceDelete = async (id: number) => {
    const confirmed = await showConfirm(
      "Are you sure you want to permanently delete this project? This cannot be undone.",
      "Permanently Delete Project?",
      true
    );
    if (!confirmed) return;
    
    try {
      await forceDeleteProject(id, true);
      loadDeletedProjects();
    } catch (err: any) {
      showAlert(err.message || 'Failed to permanently delete project');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Recycle Bin</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Projects are kept for 30 days before permanent deletion.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {!isAdmin ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
              <h3 className="text-lg font-bold text-slate-800">Access Denied</h3>
              <p className="text-sm text-slate-500 max-w-sm mt-2">Only Administrators have access to the Recycle Bin.</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : deletedProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Recycle Bin is Empty</h3>
              <p className="text-sm text-slate-500 max-w-sm mt-2">No deleted projects found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deletedProjects.map((p) => {
                const deletedDate = new Date(p.deleted_at);
                const expiryDate = new Date(deletedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
                const daysLeft = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

                return (
                  <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-800 text-sm">{p.name}</h4>
                        <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded font-mono font-bold">{p.code}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                        <span>Deleted on: {deletedDate.toLocaleDateString()}</span>
                        <span className="flex items-center gap-1 text-amber-600 font-bold">
                          <AlertTriangle className="h-3 w-3" />
                          {daysLeft > 0 ? `${daysLeft} days left` : 'Expiring soon'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestore(p.id)}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Restore
                      </button>
                      <button
                        onClick={() => handleForceDelete(p.id)}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Permanently
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
