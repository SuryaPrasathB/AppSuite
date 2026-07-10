import React from 'react';
import { FileText, CheckCircle, AlertTriangle, File, Lock, RefreshCw, UploadCloud, Download, Trash2 } from 'lucide-react';
import { downloadTaskFile, deleteTaskFile } from '../api';
import { useDialog } from '../../../context/DialogContext';

interface DocumentsTabProps {
  project: any;
  staticTasks: any[];
  files: any[];
  uploadingTask: string | null;
  setPreviewFile: (fileInfo: { taskName: string, file: globalThis.File[], objectUrl: string }) => void;
  handleFileUpload: (taskName: string, file: globalThis.File[]) => void;
  onFilesChanged?: () => void;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({
  project, staticTasks, files, uploadingTask, setPreviewFile, handleFileUpload, onFilesChanged
}) => {
  const { showAlert } = useDialog();
  const [fileToDelete, setFileToDelete] = React.useState<number | null>(null);

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
  const isStaticTaskCompleted = (taskName: string) => {
    return files.some(f => f.task_name === taskName);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          Project Documents & Files
        </h3>
        <p className="text-xs text-slate-500">Upload required files and reports.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto custom-scrollbar pb-6 pr-2">
        {staticTasks.map((task: any) => {
          const completed = isStaticTaskCompleted(task.task_name);
          const taskFiles = files.filter((f: any) => f.task_name === task.task_name);
          const isUploading = uploadingTask === task.task_name;
          
          return (
            <div key={task.task_name} className={`bg-white p-5 rounded-2xl border ${completed ? 'border-emerald-500/30 bg-emerald-50/50' : 'border-slate-200'} transition-all hover:border-slate-300`}>
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
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    {taskFiles.length} / {project.no_of_panels} Required
                  </span>
                )}
              </div>
              
              {/* File List */}
              {taskFiles.length > 0 && (
                <div className="mb-4 space-y-2">
                  {taskFiles.map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2 truncate">
                        <File className="h-4 w-4 text-indigo-600" />
                        <span className="truncate" title={f.file_name}>{f.file_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleDownload(f.id)} className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors" title="Download">
                          <Download className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(f.id)} className="p-1 hover:bg-slate-200 rounded text-rose-600 transition-colors" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Control */}
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
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {fileToDelete !== null && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
    </div>
  );
};
