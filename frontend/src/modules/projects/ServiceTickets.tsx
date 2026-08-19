import React, { useState, useEffect } from 'react';
import { AlertCircle, Plus, CheckCircle2, Clock, ShieldAlert, X } from 'lucide-react';
import { Combobox } from '../../components/Combobox';
import { apiClient } from '../../api/apiClient';

const API_BASE_URL = `/api`;

async function apiRequest(endpoint: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    
    const storedUser = localStorage.getItem('smart_store_user');
    if (storedUser) {
        try {
            const parsed = JSON.parse(storedUser);
            if (parsed && typeof parsed === 'object' && 'token' in parsed) {
                headers.set('Authorization', `Bearer ${parsed.token}`);
            }
        } catch (e) {}
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

const formatMinutes = (totalMinutes: number) => {
    if (!totalMinutes || totalMinutes < 0) return '0 mins';
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const mins = totalMinutes % 60;
    
    const parts = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hr${hours !== 1 ? 's' : ''}`);
    if (mins > 0 || parts.length === 0) parts.push(`${mins} min${mins !== 1 ? 's' : ''}`);
    
    return parts.join(' ');
};

export const ServiceTickets = ({ projectId }: { projectId?: number }) => {
    const [tickets, setTickets] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Create form state
    const [showForm, setShowForm] = useState(false);
    const [newTicket, setNewTicket] = useState({ project_id: projectId ? projectId.toString() : '', custom_project_name: '', title: '', description: '', assignee_id: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isManualProject, setIsManualProject] = useState(false);

    const [employees, setEmployees] = useState<any[]>([]);
    const [resolveModalOpen, setResolveModalOpen] = useState(false);
    const [resolvingTicketId, setResolvingTicketId] = useState<number | null>(null);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [resolutionImages, setResolutionImages] = useState<File[]>([]);
    const [resolutionError, setResolutionError] = useState('');


    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [ticketData, projectData, employeeData] = await Promise.all([
                apiRequest('/projects/service-tickets/all'),
                apiRequest('/projects?limit=1000'), // fetch projects
                apiRequest('/employees') // fetch employees
            ]);
            
            let filteredTickets = ticketData;
            if (projectId) {
                filteredTickets = ticketData.filter((t: any) => t.project_id === projectId);
            }
            
            setTickets(filteredTickets);
            setProjects(projectData.data || projectData.projects || []);
            setEmployees(employeeData || []);
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isManualProject && !newTicket.project_id) {
            alert("Please select a project.");
            return;
        }
        if (isManualProject && !newTicket.custom_project_name) {
            alert("Please enter a project name.");
            return;
        }
        setIsSubmitting(true);
        try {
            await apiRequest('/projects/service-tickets', {
                method: 'POST',
                body: JSON.stringify(newTicket)
            });
            setShowForm(false);
            setNewTicket({ project_id: projectId ? projectId.toString() : '', custom_project_name: '', title: '', description: '', assignee_id: '' });
            fetchData();
            window.dispatchEvent(new Event('ticketsUpdated'));
        } catch (error) {
            console.error('Failed to create ticket', error);
            alert("Error creating ticket");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseTicket = (ticketId: number) => {
        setResolvingTicketId(ticketId);
        setResolutionNotes('');
        setResolutionImages([]);
        setResolutionError('');
        setResolveModalOpen(true);
    };

    const submitResolution = async () => {
        if (!resolvingTicketId) return;
        if (!resolutionNotes.trim()) {
            setResolutionError("Please enter resolution notes.");
            return;
        }
        
        setIsSubmitting(true);
        setResolutionError('');
        try {
            const formData = new FormData();
            formData.append('notes', resolutionNotes);
            resolutionImages.forEach(file => {
                formData.append('images', file);
            });
            
            await apiClient.projects.resolveServiceTicket(resolvingTicketId, formData);
            
            setResolveModalOpen(false);
            fetchData();
            window.dispatchEvent(new Event('ticketsUpdated'));
        } catch (error) {
            console.error(error);
            setResolutionError("Error closing ticket");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReopenTicket = async (ticketId: number) => {
        try {
            await apiClient.projects.updateServiceTicket(ticketId, { status: "OPEN" });
            fetchData();
            window.dispatchEvent(new Event('ticketsUpdated'));
        } catch (error) {
            console.error('Failed to reopen ticket', error);
            alert("Error reopening ticket");
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-100">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    const projectOptions = projects.map(p => ({
        value: p.id,
        label: `${p.code} - ${p.name}`
    }));

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold flex items-center text-slate-800 tracking-tight">
                        <ShieldAlert className="mr-3 h-7 w-7 text-red-500" />
                        Service Dashboard
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 ml-10">Manage active complaints, issues, and service requests.</p>
                </div>
                <button 
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center bg-primary-600 text-white px-5 py-2.5 rounded-lg hover:bg-primary-700 transition-all shadow-md shadow-primary-500/30 font-semibold text-sm active:scale-95"
                >
                    {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    {showForm ? 'Cancel Creation' : 'New Ticket'}
                </button>
            </div>

            {/* Create Form Section */}
            {showForm && (
                <div className="bg-white rounded-xl shadow-lg shadow-slate-200/50 border border-slate-200 p-6 transition-all duration-300 animate-in fade-in slide-in-from-top-4">
                    <h2 className="text-lg font-bold text-slate-800 mb-5 pb-3 border-b border-slate-100">Create New Service Ticket</h2>
                    <form onSubmit={handleCreateTicket} className="space-y-5">
                        <div className="grid grid-cols-1 gap-5">
                            {!projectId && (
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Select Project</label>
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                setIsManualProject(!isManualProject);
                                                setNewTicket({...newTicket, project_id: '', custom_project_name: ''});
                                            }}
                                            className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
                                        >
                                            {isManualProject ? 'Select existing' : 'Enter manually'}
                                        </button>
                                    </div>
                                    {isManualProject ? (
                                        <input 
                                            type="text"
                                            placeholder="Enter manual project name..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
                                            value={newTicket.custom_project_name}
                                            onChange={e => setNewTicket({...newTicket, custom_project_name: e.target.value})}
                                        />
                                    ) : (
                                        <Combobox 
                                            options={projectOptions}
                                            value={newTicket.project_id}
                                            onChange={(val) => setNewTicket({...newTicket, project_id: val})}
                                            placeholder="Search for a project..."
                                        />
                                    )}
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Assign To</label>
                                <Combobox 
                                    options={employees.map(e => ({value: e.id, label: e.name}))}
                                    value={newTicket.assignee_id}
                                    onChange={(val) => setNewTicket({...newTicket, assignee_id: val})}
                                    placeholder="Search for an employee..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Issue Title</label>
                                <input 
                                    required
                                    type="text"
                                    placeholder="Brief summary of the issue..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
                                    value={newTicket.title}
                                    onChange={e => setNewTicket({...newTicket, title: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Detailed Description</label>
                                <textarea 
                                    required
                                    rows={4}
                                    placeholder="Describe the complaint or service request in detail..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors resize-none"
                                    value={newTicket.description}
                                    onChange={e => setNewTicket({...newTicket, description: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button 
                                type="button" 
                                onClick={() => setShowForm(false)} 
                                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-700 transition-all shadow-md shadow-primary-500/30 disabled:opacity-70 disabled:cursor-not-allowed flex items-center"
                            >
                                {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
            
            {/* Tickets List */}
            <div className="space-y-4">
                {tickets.length === 0 ? (
                    <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
                        <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-400 mb-3 opacity-50" />
                        <h3 className="text-slate-700 font-semibold text-lg">No Active Tickets</h3>
                        <p className="text-slate-500 text-sm mt-1">All service requests and complaints are resolved.</p>
                    </div>
                ) : (
                    tickets.map(ticket => (
                        <div 
                            key={ticket.id} 
                            className={`group relative overflow-hidden bg-white rounded-xl shadow-sm border transition-all duration-200 hover:shadow-md ${
                                ticket.status === 'OPEN' 
                                    ? 'border-red-200 hover:border-red-300' 
                                    : 'border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            {/* Accent line for open tickets */}
                            {ticket.status === 'OPEN' && (
                                <div className="absolute top-0 left-0 bottom-0 w-1 bg-red-500"></div>
                            )}
                            
                            <div className="p-5 sm:p-6 ml-1">
                                <div className="flex flex-col sm:flex-row justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-bold text-slate-800">{ticket.title}</h3>
                                            <span className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full ${
                                                ticket.status === 'OPEN' 
                                                    ? 'bg-red-100 text-red-700 border border-red-200' 
                                                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                            }`}>
                                                {ticket.status}
                                            </span>
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-3 font-medium">
                                            <span className="bg-slate-100 px-2 py-1 rounded text-slate-700 border border-slate-200">
                                                {ticket.project_code}
                                            </span>
                                            <span>•</span>
                                            <span>{ticket.project_name}</span>
                                            <span>•</span>
                                            <span className="flex items-center"><Clock className="h-3 w-3 mr-1"/> {new Date(ticket.created_at).toLocaleDateString()}</span>
                                            {ticket.creator_name && (
                                                <>
                                                    <span>•</span>
                                                    <span>Created by {ticket.creator_name}</span>
                                                </>
                                            )}
                                            {ticket.assignee_name && (
                                                <>
                                                    <span>•</span>
                                                    <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100">Assigned to {ticket.assignee_name}</span>
                                                </>
                                            )}
                                        </div>
                                        
                                        <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                                            {ticket.description}
                                        </p>
                                    </div>
                                    
                                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start shrink-0">
                                        {ticket.status === 'OPEN' && (
                                            <button 
                                                onClick={() => handleCloseTicket(ticket.id)}
                                                className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold tracking-wide hover:bg-emerald-600 transition-all shadow-sm shadow-emerald-500/30"
                                            >
                                                Mark as Resolved
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {ticket.status === 'CLOSED' && (
                                    <div className="mt-5 bg-emerald-50/50 rounded-lg p-4 border border-emerald-100 text-sm">
                                        <div className="flex items-start gap-2 text-emerald-800">
                                            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-500" />
                                            <div>
                                                <p className="font-semibold mb-1">Resolution Details</p>
                                                <p className="text-emerald-700/90">{ticket.resolution_notes}</p>
                                                {ticket.resolution_images && (() => {
                                                    try {
                                                        const images = JSON.parse(ticket.resolution_images);
                                                        return images.length > 0 && (
                                                            <div className="flex gap-2 mt-3 flex-wrap">
                                                                {images.map((img: string, idx: number) => (
                                                                    <a key={idx} href={`${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : ''}${img}`} target="_blank" rel="noreferrer">
                                                                        <img src={`${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : ''}${img}`} alt="Resolution" className="h-16 w-16 object-cover rounded border border-emerald-200 hover:opacity-80 transition-opacity" />
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        );
                                                    } catch(e) { return null; }
                                                })()}
                                                <p className="text-xs font-bold text-emerald-600/70 mt-2 uppercase tracking-wide">
                                                    Resolved {ticket.resolver_name ? `by ${ticket.resolver_name} ` : ''}in {formatMinutes(ticket.resolution_time_mins)}
                                                </p>
                                                
                                                <button 
                                                    onClick={() => handleReopenTicket(ticket.id)}
                                                    className="mt-4 bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide hover:bg-emerald-200 transition-colors border border-emerald-200"
                                                >
                                                    Reopen Ticket
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
{/* Resolution Modal */}
            {resolveModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center">
                                <CheckCircle2 className="h-5 w-5 mr-2 text-emerald-500" />
                                Resolve Ticket
                            </h3>
                            <button onClick={() => setResolveModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            {resolutionError && (
                                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg border border-red-200 text-sm flex items-center">
                                    <ShieldAlert className="h-4 w-4 shrink-0 mr-2" />
                                    {resolutionError}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Resolution Notes</label>
                                <textarea 
                                    rows={4}
                                    placeholder="Explain how this issue was resolved..."
                                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none"
                                    value={resolutionNotes}
                                    onChange={e => setResolutionNotes(e.target.value)}
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Supporting Images (Optional)</label>
                                <input 
                                    type="file" 
                                    multiple
                                    accept="image/*"
                                    onChange={(e) => {
                                        if (e.target.files) {
                                            setResolutionImages(Array.from(e.target.files));
                                        }
                                    }}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 transition-all"
                                />
                                {resolutionImages.length > 0 && (
                                    <p className="text-xs text-slate-500 mt-2">{resolutionImages.length} file(s) selected.</p>
                                )}
                            </div>
                        </div>
                        
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button 
                                onClick={() => setResolveModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={submitResolution}
                                disabled={isSubmitting}
                                className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-all disabled:opacity-70 flex items-center shadow-md shadow-emerald-500/30"
                            >
                                {isSubmitting ? 'Submitting...' : 'Mark as Resolved'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
