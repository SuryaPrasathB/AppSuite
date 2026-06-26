import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { fetchProjectDetails, uploadTaskFile, updateProject } from './api';
import { 
  X, CheckCircle, UploadCloud, File, AlertCircle, RefreshCw, FileSpreadsheet, Lock
} from 'lucide-react';

interface ProjectTasksProps {
  projectId: number;
  onClose: () => void;
}

export const ProjectTasks: React.FC<ProjectTasksProps> = ({ projectId, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingTask, setUploadingTask] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{taskName: string, file: File, objectUrl: string} | null>(null);
  const [spreadsheetPreview, setSpreadsheetPreview] = useState<{headers: string[], rows: any[][]} | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchProjectDetails(projectId);
      setData(res);
    } catch (err) {
      console.error(err);
      alert("Failed to load project details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleFileUpload = async (taskName: string, file: globalThis.File) => {
    try {
      setUploadingTask(taskName);
      await uploadTaskFile(projectId, taskName, file);
      await loadData();
      if (previewFile) {
        URL.revokeObjectURL(previewFile.objectUrl);
        setPreviewFile(null);
      }
    } catch (err: any) {
      alert(err.message || "Failed to upload file");
    } finally {
      setUploadingTask(null);
    }
  };

  const handleCancelPreview = () => {
    if (previewFile) {
      URL.revokeObjectURL(previewFile.objectUrl);
      setPreviewFile(null);
    }
  };

  // Cleanup object URLs on unmount and handle spreadsheet parsing
  useEffect(() => {
    if (previewFile && (previewFile.file.name.match(/\.(xlsx?|csv)$/i) || previewFile.file.type.includes('spreadsheet'))) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const json: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          if (json.length > 0) {
            setSpreadsheetPreview({
              headers: json[0].map(String),
              rows: json.slice(1, 11) // Show first 10 rows
            });
          }
        } catch (err) {
          console.error("Failed to parse spreadsheet", err);
        }
      };
      reader.readAsArrayBuffer(previewFile.file);
    } else {
      setSpreadsheetPreview(null);
    }

    return () => {
      if (previewFile) {
        URL.revokeObjectURL(previewFile.objectUrl);
      }
    };
  }, [previewFile]);

  const handleCompleteProject = async () => {
    if (!window.confirm("Mark this project as completed?")) return;
    try {
      await updateProject(projectId, { status: 'COMPLETED' });
      await loadData();
    } catch (err) {
      alert("Failed to mark completed");
    }
  };

  const handleReopenService = async () => {
    if (!window.confirm("Reopen project for Service?")) return;
    try {
      await updateProject(projectId, { status: 'SERVICE' });
      await loadData();
    } catch (err) {
      alert("Failed to reopen");
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-4xl p-8 flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { project, tasks, files } = data;
  
  const isTaskCompleted = (taskName: string) => {
    if (taskName === 'Photos') {
      const photoFiles = files.filter((f: any) => f.task_name === 'Photos');
      return photoFiles.length >= (project.no_of_panels || 1);
    }
    const task = tasks.find((t: any) => t.task_name === taskName);
    return task?.status === 'COMPLETED';
  };

  const allTasksCompleted = tasks.every((t: any) => {
    if (t.task_name === 'Service Report') return true;
    return isTaskCompleted(t.task_name);
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              {project.name}
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                project.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                project.status === 'SERVICE' ? 'bg-orange-100 text-orange-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {project.status}
              </span>
            </h2>
            <p className="text-sm text-slate-500 mt-1">Code: {project.code} | Client: {project.client_name} | Panels: {project.no_of_panels}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tasks.map((task: any) => {
              const completed = isTaskCompleted(task.task_name);
              const taskFiles = files.filter((f: any) => f.task_name === task.task_name);
              const isUploading = uploadingTask === task.task_name;
              
              return (
                <div key={task.task_name} className={`bg-white p-4 rounded-xl border ${completed ? 'border-green-200 shadow-sm' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      {completed ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-slate-400" />
                      )}
                      <h3 className="font-bold text-slate-700">{task.task_name}</h3>
                    </div>
                    {task.task_name === 'Photos' && (
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {taskFiles.length} / {project.no_of_panels} Required
                      </span>
                    )}
                  </div>
                  
                  {/* File List */}
                  {taskFiles.length > 0 && (
                    <div className="mb-3 space-y-1">
                      {taskFiles.map((f: any) => (
                        <div key={f.id} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-1.5 rounded">
                          <File className="h-3.5 w-3.5" />
                          <span className="truncate" title={f.file_name}>{f.file_name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Control */}
                  {['COMPLETED', 'ON_HOLD', 'CANCELLED'].includes(project.status) ? (
                    <div className="mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50">
                      <Lock className="h-4 w-4 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-500">
                        Uploads locked ({project.status})
                      </span>
                    </div>
                  ) : (
                    <label className={`mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed ${completed && task.task_name !== 'Photos' && task.task_name !== 'Service Report' ? 'hidden' : 'border-slate-300 hover:border-primary-400 hover:bg-primary-50 cursor-pointer transition-colors'}`}>
                      {isUploading ? (
                        <RefreshCw className="h-4 w-4 text-slate-400 animate-spin" />
                      ) : (
                        <UploadCloud className="h-4 w-4 text-slate-500" />
                      )}
                      <span className="text-xs font-semibold text-slate-600">
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

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3">
          {project.status === 'COMPLETED' ? (
            <button
              onClick={handleReopenService}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-bold transition-colors"
            >
              Reopen for Service
            </button>
          ) : (
            <button
              onClick={handleCompleteProject}
              disabled={!allTasksCompleted}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                allTasksCompleted 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              Mark Project as Completed
            </button>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-primary-600" />
                Upload to {previewFile.taskName}
              </h3>
              <button onClick={handleCancelPreview} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 bg-slate-50/50 flex flex-col items-center">
              {previewFile.file.type.startsWith('image/') ? (
                <div className="w-full max-h-64 overflow-hidden rounded-xl border border-slate-200 bg-white mb-4 flex items-center justify-center">
                  <img src={previewFile.objectUrl} alt="Preview" className="max-h-64 object-contain" />
                </div>
              ) : previewFile.file.type === 'application/pdf' ? (
                <div className="w-full h-80 overflow-hidden rounded-xl border border-slate-200 bg-white mb-4">
                  <iframe src={previewFile.objectUrl} className="w-full h-full" title="PDF Preview" />
                </div>
              ) : spreadsheetPreview ? (
                <div className="w-full h-64 overflow-auto rounded-xl border border-slate-200 bg-white mb-4 custom-scrollbar">
                  <table className="w-full text-left text-[11px] whitespace-nowrap">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10 shadow-sm">
                      <tr>
                        <th className="w-8 px-2 py-2 text-center text-slate-400 font-medium bg-slate-50 border-r border-slate-200">#</th>
                        {spreadsheetPreview.headers.map((h, i) => (
                          <th key={i} className="px-3 py-2 font-bold text-slate-600 bg-slate-50 border-r border-slate-200 last:border-r-0">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {spreadsheetPreview.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-2 py-1.5 text-center text-slate-400 bg-slate-50/50 border-r border-slate-200">{i + 1}</td>
                          {spreadsheetPreview.headers.map((_, colIdx) => (
                            <td key={colIdx} className="px-3 py-1.5 text-slate-600 border-r border-slate-100 last:border-r-0 truncate max-w-[200px]">
                              {row[colIdx]?.toString() || ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {spreadsheetPreview.rows.length === 10 && (
                    <div className="sticky bottom-0 text-center py-2 text-[10px] text-slate-500 font-bold bg-white/90 backdrop-blur border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                      Showing first 10 rows
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-32 h-32 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200 mb-4">
                  {previewFile.file.name.match(/\.(xlsx?|csv)$/i) || previewFile.file.type.includes('spreadsheet') ? (
                    <FileSpreadsheet className="h-12 w-12 text-green-600" />
                  ) : (
                    <File className="h-12 w-12 text-slate-400" />
                  )}
                </div>
              )}
              
              <div className="text-center w-full">
                <p className="font-bold text-slate-700 truncate px-4">{previewFile.file.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {(previewFile.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={handleCancelPreview}
                disabled={uploadingTask !== null}
                className="px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleFileUpload(previewFile.taskName, previewFile.file)}
                disabled={uploadingTask !== null}
                className="px-5 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors flex items-center gap-2"
              >
                {uploadingTask !== null ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Save File
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
