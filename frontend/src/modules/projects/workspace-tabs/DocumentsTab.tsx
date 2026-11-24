import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, CheckCircle, AlertTriangle, File, Lock, RefreshCw, UploadCloud, Download, Trash2, Eye, X, FolderOpen, Package, ExternalLink, Sparkles } from 'lucide-react';
import { downloadTaskFile, deleteTaskFile, viewTaskFile, openFileLocation } from '../api';
import { useDialog } from '../../../context/DialogContext';

interface DocumentsTabProps {
  project: any;
  staticTasks: any[];
  files: any[];
  projectBoms?: any[];
  uploadingTask: string | null;
  setPreviewFile: (fileInfo: { taskName: string, file: globalThis.File[], objectUrl: string }) => void;
  handleFileUpload: (taskName: string, file: globalThis.File[]) => void;
  onFilesChanged?: () => Promise<void> | void;
  onOpenProjectBom?: (bomId: number) => void;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({
  project, staticTasks, files, projectBoms = [], uploadingTask, setPreviewFile, handleFileUpload, onFilesChanged, onOpenProjectBom
}) => {
  const navigate = useNavigate();
  const { showAlert } = useDialog();
  const [fileToDelete, setFileToDelete] = useState<number | null>(null);
  const [viewAllModalTask, setViewAllModalTask] = useState<string | null>(null);
  const [previewingFile, setPreviewingFile] = useState<{ url: string, name: string, type: string, id: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleDelete = (fileId: number) => {
    setFileToDelete(fileId);
  };

  const confirmDelete = async () => {
    if (fileToDelete === null) return;
    try {
      await deleteTaskFile(project.id, fileToDelete);
      if (onFilesChanged) onFilesChanged();
    } catch (e: any) {
      showAlert(e.message || "Failed to delete file");
    } finally {
      setFileToDelete(null);
    }
  };

  const handleDownload = async (fileId: number) => {
    try {
      await downloadTaskFile(project.id, fileId);
    } catch (e: any) {
      showAlert(e.message || "Failed to download file");
    }
  };

  const handleView = async (f: any) => {
    try {
      const { objectUrl, type } = await viewTaskFile(project.id, f.id);
      
      let mimeType = type;
      if (!mimeType || mimeType === 'application/octet-stream') {
        const ext = f.file_name.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) mimeType = 'image/' + ext;
        else if (ext === 'pdf') mimeType = 'application/pdf';
        else if (['mp4', 'webm'].includes(ext || '')) mimeType = 'video/' + ext;
        else if (['txt', 'csv', 'md'].includes(ext || '')) mimeType = 'text/plain';
      }

      setPreviewingFile({ url: objectUrl, name: f.file_name, type: mimeType, id: f.id });
    } catch (e: any) {
      showAlert(e.message || "Failed to view file");
    }
  };

  const isStaticTaskCompleted = (taskName: string) => {
    if (taskName === 'BOM' && projectBoms.length > 0) return true;
    return files.some(f => f.task_name === taskName);
  };

  const renderFileList = (taskFiles: any[], limit?: number) => {
    const displayedFiles = limit ? taskFiles.slice(0, limit) : taskFiles;
    return (
      <div className="space-y-2">
        {displayedFiles.map((f: any) => (
          <div key={f.id} className="flex items-center justify-between text-xs text-slate-700 bg-slate-50 p-2 py-1.5 rounded-xl border border-slate-200">
            <div 
              className="flex items-center gap-2 truncate cursor-pointer hover:text-indigo-600 transition-colors"
              onClick={() => handleView(f)}
              title={`View ${f.file_name}`}
            >
              <File className="h-4 w-4 text-indigo-500 shrink-0" />
              <span className="truncate">{f.file_name}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => handleView(f)} className="p-1.5 hover:bg-slate-200 rounded text-indigo-600 transition-colors" title="View">
                <Eye className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => handleDownload(f.id)} className="p-1.5 hover:bg-slate-200 rounded text-slate-600 transition-colors" title="Download">
                <Download className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => handleDelete(f.id)} className="p-1.5 hover:bg-slate-200 rounded text-rose-600 transition-colors" title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            Project Documents & Files
          </h3>
          {onFilesChanged && (
            <button 
              onClick={async () => {
                setIsRefreshing(true);
                try {
                  await onFilesChanged();
                } finally {
                  setIsRefreshing(false);
                }
              }}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
              title="Refresh files"
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
              <span className="text-xs font-medium">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">Upload required files and reports.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto custom-scrollbar pb-6 pr-2">
        {staticTasks.map((task: any) => {
          const completed = isStaticTaskCompleted(task.task_name);
          const taskFiles = files.filter((f: any) => f.task_name === task.task_name);
          const isUploading = uploadingTask === task.task_name;
          
          return (
            <div key={task.task_name} className={`bg-white p-5 rounded-2xl border ${completed ? 'border-emerald-500/30 bg-emerald-50/50' : 'border-slate-200'} transition-all hover:border-slate-300 flex flex-col`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  {completed ? (
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-slate-500" />
                  )}
                  <h3 className="font-bold text-slate-800">{task.task_name}</h3>
                </div>
                {task.task_name === 'Photos' && (
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded shrink-0">
                    {taskFiles.length} / {project.no_of_panels} Req.
                  </span>
                )}
              </div>
              
              {/* File List (Limited to 3) */}
              <div className="flex-1">
                {task.task_name === 'BOM' && projectBoms.length > 0 && (
                  <div className="mb-3 space-y-2">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      Live Linked BOMs ({projectBoms.length})
                    </div>
                    {projectBoms.map((b: any) => {
                      const pendingChanges = (b.pending_additions_count || 0) + (b.pending_modifications_count || 0);
                      return (
                        <div
                          key={b.id}
                          className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200/80 flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Package className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                              <span className="text-xs font-bold text-slate-800 truncate">{b.name}</span>
                              <span className="px-1.5 py-0.5 rounded bg-purple-600 text-white text-[10px] font-extrabold shrink-0">
                                Rev {b.pinned_revision || b.revision || 'A'}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-purple-200 text-purple-700 shrink-0">
                              {b.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span>{b.total_items || 0} items</span>
                              {pendingChanges > 0 ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                                  <Sparkles className="h-2.5 w-2.5" />+{pendingChanges} field change{pendingChanges > 1 ? 's' : ''}
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-semibold">In sync with Rev {b.pinned_revision || 'A'}</span>
                              )}
                              {b.is_outdated && (
                                <span className="text-amber-600 font-bold text-[10px]">
                                  (Rev {b.latest_master_revision} available)
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {onOpenProjectBom && (
                                <button
                                  type="button"
                                  onClick={() => onOpenProjectBom(b.id)}
                                  className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold cursor-pointer"
                                >
                                  Open BOM Tab
                                </button>
                              )}
                              {b.source_bom_id && (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/bom?bomId=${b.source_bom_id}`)}
                                  className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                  title={`Open immutable Master Rev ${b.pinned_revision || 'A'} in BOM Module`}
                                >
                                  <ExternalLink className="h-2.5 w-2.5" />
                                  Master Rev {b.pinned_revision || 'A'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {taskFiles.length > 0 && (
                  <div className="mb-3">
                    {renderFileList(taskFiles, 3)}
                    {taskFiles.length > 3 && (
                      <button 
                        onClick={() => setViewAllModalTask(task.task_name)}
                        className="w-full mt-2 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                      >
                        View all {taskFiles.length} files
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Upload Control */}
              <div className="mt-auto pt-2">
                {['COMPLETED', 'ON_HOLD', 'CANCELLED'].includes(project.status) ? (
                  <div className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
                    <Lock className="h-4 w-4 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-500">
                      Uploads locked ({project.status})
                    </span>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer transition-all">
                    {isUploading ? (
                      <RefreshCw className="h-4 w-4 text-indigo-600 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4 text-slate-500" />
                    )}
                    <span className="text-xs font-semibold text-slate-700">
                      {isUploading ? 'Uploading...' : 'Upload File'}
                    </span>
                    <input 
                      type="file" 
                      multiple
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const filesArray = Array.from(e.target.files);
                          handleFileUpload(task.task_name, filesArray);
                          e.target.value = ''; // reset
                        }
                      }}
                      disabled={isUploading}
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* View All Modal */}
      {viewAllModalTask && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                All Files: {viewAllModalTask}
              </h3>
              <button 
                onClick={() => setViewAllModalTask(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              {renderFileList(files.filter((f: any) => f.task_name === viewAllModalTask))}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {fileToDelete !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Delete File</h3>
              <p className="text-slate-600">Are you sure you want to delete this file? This action cannot be undone.</p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-sm"
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Preview Modal */}
      {previewingFile && (
        <div className="fixed inset-0 bg-slate-900/95 z-[70] flex flex-col animate-in fade-in duration-200">
          <div className="flex justify-between items-center p-4 border-b border-slate-700/50">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <File className="h-4 w-4 text-slate-400" />
              {previewingFile.name}
            </h3>
            <button 
              onClick={() => {
                URL.revokeObjectURL(previewingFile.url);
                setPreviewingFile(null);
              }}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
            {previewingFile.type?.startsWith('image/') ? (
              <img src={previewingFile.url} alt={previewingFile.name} className="max-w-full max-h-full object-contain" />
            ) : previewingFile.type === 'application/pdf' || previewingFile.type?.startsWith('text/') ? (
              <iframe src={previewingFile.url} className="w-full h-full bg-white rounded-lg" />
            ) : previewingFile.type?.startsWith('video/') ? (
              <video src={previewingFile.url} controls className="max-w-full max-h-full" />
            ) : (
              <div className="text-center text-slate-300 max-w-sm">
                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <File className="h-8 w-8 text-slate-500" />
                </div>
                <h4 className="text-lg font-medium text-white mb-2">Preview Not Available</h4>
                <p className="text-sm text-slate-400 mb-6">
                  This file type cannot be previewed in the browser. You can download it or open its location on the server.
                </p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      openFileLocation(project.id, previewingFile.id).catch((e) => showAlert(e.message));
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Open File Location
                  </button>
                  <button 
                    onClick={() => handleDownload(previewingFile.id)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors border border-slate-700"
                  >
                    <Download className="h-4 w-4" />
                    Download File
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
