import React, { useState, useEffect } from 'react';
import { AlertCircle, Plus, CheckCircle2, Clock, ShieldAlert, X } from 'lucide-react';
import { Combobox } from '../../components/Combobox';

const API_BASE_URL = `http://localhost:8000/api`;

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

export const ServiceTickets = () => {
    const [tickets, setTickets] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Create form state
    const [showForm, setShowForm] = useState(false);
    const [newTicket, setNewTicket] = useState({ project_id: '', title: '', description: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [ticketData, projectData] = await Promise.all([
                apiRequest('/projects/service-tickets/all'),
                apiRequest('/projects?limit=1000') // fetch projects
            ]);
            setTickets(ticketData);
            setProjects(projectData.projects || []);
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTicket.project_id) {
            alert("Please select a project.");
            return;
        }
        setIsSubmitting(true);
        try {
            await apiRequest('/projects/service-tickets', {
                method: 'POST',
                body: JSON.stringify(newTicket)
            });
            setShowForm(false);
            setNewTicket({ project_id: '', title: '', description: '' });
            fetchData();
        } catch (error) {
            console.error('Failed to create ticket', error);
            alert("Error creating ticket");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseTicket = async (ticketId: number) => {
        const notes = prompt("Enter resolution notes:");
        if (notes === null) return;
        try {
            await apiRequest(`/projects/service-tickets/${ticketId}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'CLOSED', resolution_notes: notes })
            });
            fetchData();
        } catch (error) {
            alert("Error closing ticket");
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[400px]">
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
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Select Project</label>
                                <Combobox 
                                    options={projectOptions}
                                    value={newTicket.project_id}
                                    onChange={(val) => setNewTicket({...newTicket, project_id: val})}
                                    placeholder="Search for a project..."
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
                                        
                                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-3 font-medium">
                                            <span className="bg-slate-100 px-2 py-1 rounded text-slate-700 border border-slate-200">
                                                {ticket.project_code}
                                            </span>
                                            <span>•</span>
                                            <span>{ticket.project_name}</span>
                                            <span>•</span>
                                            <span className="flex items-center"><Clock className="h-3 w-3 mr-1"/> {new Date(ticket.created_at).toLocaleDateString()}</span>
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
                                                <p className="text-xs font-bold text-emerald-600/70 mt-2 uppercase tracking-wide">
                                                    Resolved in {ticket.resolution_time_mins} minutes
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
