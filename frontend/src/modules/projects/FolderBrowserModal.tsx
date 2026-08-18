import React, { useState, useEffect } from 'react';
import { X, Folder, ChevronRight, HardDrive, RefreshCw } from 'lucide-react';
import { fetchServerFolders } from './api';
import { useDialog } from '../../context/DialogContext';

interface FolderBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

export function FolderBrowserModal({ isOpen, onClose, onSelect, initialPath }: FolderBrowserModalProps) {
  const { showAlert } = useDialog();
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [folders, setFolders] = useState<{name: string, path: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadFolders(initialPath);
    }
  }, [isOpen, initialPath]);

  const loadFolders = async (path?: string) => {
    setLoading(true);
    try {
      const data = await fetchServerFolders(path);
      setCurrentPath(data.current_path);
      setParentPath(data.parent_path);
      setFolders(data.folders);
      setSelectedPath(data.current_path);
      setManualInput(data.current_path);
    } catch (err: any) {
      showAlert(err.message || 'Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Select Project Folder</h2>
            <p className="text-sm text-slate-500 mt-1">Browse the server filesystem to link a folder.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Manual Path Input */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Selected Path
          </label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
              placeholder="e.g. Z:\projects\Project_123"
            />
            <button
              onClick={() => loadFolders(manualInput)}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Go
            </button>
          </div>
        </div>

        {/* Breadcrumb Navigation */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-2 text-sm text-slate-600 overflow-x-auto shrink-0 whitespace-nowrap">
          <HardDrive className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="font-mono text-slate-800">{currentPath}</span>
        </div>

        {/* Folder List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin mb-4" />
              <p>Loading folders...</p>
            </div>
          ) : (
            <div className="space-y-1">
              {parentPath && (
                <button
                  onClick={() => loadFolders(parentPath)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-left transition-colors text-slate-700"
                >
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Folder className="h-5 w-5 text-slate-400" />
                  </div>
                  <span className="font-medium flex-1">.. (Go Up)</span>
                </button>
              )}
              
              {folders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                  <Folder className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>No subfolders found in this directory.</p>
                </div>
              ) : (
                folders.map(folder => (
                  <button
                    key={folder.path}
                    onClick={() => {
                      setSelectedPath(folder.path);
                      setManualInput(folder.path);
                    }}
                    onDoubleClick={() => loadFolders(folder.path)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${
                      selectedPath === folder.path
                        ? 'bg-indigo-50 border border-indigo-200'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${selectedPath === folder.path ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                        <Folder className="h-5 w-5 fill-current opacity-70" />
                      </div>
                      <span className={`font-medium ${selectedPath === folder.path ? 'text-indigo-900' : 'text-slate-700'}`}>
                        {folder.name}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50 rounded-b-2xl">
          <p className="text-xs text-slate-500 max-w-sm">
            Double-click a folder to enter it. Single-click to select it.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSelect(manualInput)}
              disabled={!manualInput}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Select Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
