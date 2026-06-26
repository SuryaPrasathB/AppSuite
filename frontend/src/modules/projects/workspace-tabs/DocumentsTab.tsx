import React from 'react';
import { FileText, CheckCircle, AlertTriangle, File, Lock, RefreshCw, UploadCloud } from 'lucide-react';

interface DocumentsTabProps {
  project: any;
  staticTasks: any[];
  files: any[];
  uploadingTask: string | null;
  setPreviewFile: (fileInfo: { taskName: string, file: globalThis.File, objectUrl: string }) => void;
  handleFileUpload: (taskName: string, file: globalThis.File) => void;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({
  project, staticTasks, files, uploadingTask, setPreviewFile, handleFileUpload
}) => {
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
                <label className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed ${completed && task.task_name !== 'Photos' && task.task_name !== 'Service Report' ? 'hidden' : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer transition-all'}`}>
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
                    className="hidden" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        const objectUrl = URL.createObjectURL(file);
                        setPreviewFile({ taskName: task.task_name, file, objectUrl });
                        e.target.value = ''; // reset
                        // Optionally call handleFileUpload here if not using a preview confirmation
                        handleFileUpload(task.task_name, file);
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
    </div>
  );
};
