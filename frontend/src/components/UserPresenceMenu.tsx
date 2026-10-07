import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User as UserIcon, ChevronDown, Clock, MessageSquare, 
  Edit3, Check, Settings, Megaphone, LogOut 
} from 'lucide-react';
import { useAuth, PresenceStatus } from '../context/AuthContext';

interface UserPresenceMenuProps {
  onOpenAnnouncements?: () => void;
  className?: string;
}

export const UserPresenceMenu: React.FC<UserPresenceMenuProps> = ({ 
  onOpenAnnouncements, 
  className = '' 
}) => {
  const { user, logout, updatePresenceStatus } = useAuth();
  const navigate = useNavigate();
  
  const [showMenu, setShowMenu] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [statusNoteText, setStatusNoteText] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.status_message !== undefined) {
      setStatusNoteText(user.status_message || '');
    }
  }, [user?.status_message]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  // Active status - defaults cleanly to 'online' if logged in
  const activeStatusKey: PresenceStatus = (user.presence_status || 'online').toLowerCase() as PresenceStatus;

  const handleSaveStatusNote = async () => {
    await updatePresenceStatus(activeStatusKey, statusNoteText.trim());
    setEditingNote(false);
  };

  const formatLastLoginTime = (dateString?: string) => {
    if (!dateString) return 'First session';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Recently';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today at ${timeStr}`;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${timeStr}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  const getPresenceDetails = (status: string) => {
    switch (status) {
      case 'online':
      case 'available':
        return {
          dot: 'bg-emerald-500',
          label: 'Online',
          badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
      case 'away':
      case 'idle':
        return {
          dot: 'bg-amber-400',
          label: 'Away',
          badgeBg: 'bg-amber-50 text-amber-700 border-amber-200'
        };
      case 'busy':
      case 'dnd':
        return {
          dot: 'bg-rose-500',
          label: 'Busy / In Task',
          badgeBg: 'bg-rose-50 text-rose-700 border-rose-200'
        };
      case 'offline':
        return {
          dot: 'bg-slate-400',
          label: 'Offline',
          badgeBg: 'bg-slate-100 text-slate-600 border-slate-200'
        };
      default:
        return {
          dot: 'bg-emerald-500',
          label: 'Online',
          badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
    }
  };

  const currentPresence = getPresenceDetails(activeStatusKey);

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      {/* Trigger Bar / Avatar */}
      <div 
        className="flex items-center space-x-3 pl-3 sm:pl-4 border-l border-slate-200 cursor-pointer select-none group"
        onClick={() => setShowMenu(!showMenu)}
        title="View Profile & Status"
      >
        <div className="relative shrink-0">
          <div className="bg-slate-100 p-2 rounded-full text-slate-600 group-hover:bg-slate-200 transition-colors shadow-2xs">
            <UserIcon className="h-5 w-5" />
          </div>
          {/* Visible Vibrant Presence Dot */}
          <span 
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-white shadow-xs ${currentPresence.dot}`} 
            title={`Status: ${currentPresence.label}`}
          />
        </div>

        <div className="text-left shrink-0">
          <div className="text-xs font-bold text-slate-800 leading-tight">
            {user.name || user.username || 'User'}
          </div>
          <div className="text-[10px] font-semibold text-slate-400 uppercase leading-none mt-0.5 flex items-center gap-1">
            <span>{user.role || 'Staff'}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 capitalize">{currentPresence.label}</span>
          </div>
        </div>

        <ChevronDown 
          className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            showMenu ? 'rotate-180' : ''
          }`} 
        />
      </div>

      {/* Teams-like User Dropdown Menu */}
      {showMenu && (
        <div className="absolute top-12 right-0 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-[100] overflow-hidden flex flex-col py-2 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header Card */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm uppercase">
                  {(user.name || user.username || 'U').substring(0, 2)}
                </div>
                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white ${currentPresence.dot}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 truncate">
                  {user.name || user.username}
                </div>
                <div className="text-xs text-slate-500 truncate">@{user.username}</div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>
                    Last login: <strong className="text-slate-600 font-semibold">{formatLastLoginTime(user.last_login_at)}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Status Note Banner / Input */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/70">
              {editingNote ? (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    maxLength={80}
                    placeholder="What's your focus? (e.g. In Bay 2, On floor)"
                    value={statusNoteText}
                    onChange={(e) => setStatusNoteText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveStatusNote()}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    autoFocus
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => setEditingNote(false)}
                      className="px-2 py-0.5 text-[11px] text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveStatusNote}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-xs cursor-pointer transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={() => setEditingNote(true)}
                  className="group/note flex items-center justify-between text-xs text-slate-600 bg-white/80 hover:bg-white border border-slate-200/80 rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors"
                  title="Click to update status note"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate italic text-slate-700">
                      {user.status_message ? `"${user.status_message}"` : "Set a status note..."}
                    </span>
                  </div>
                  <Edit3 className="w-3 h-3 text-slate-400 opacity-0 group-hover/note:opacity-100 transition-opacity shrink-0 ml-1" />
                </div>
              )}
            </div>
          </div>

          {/* Quick Status Selection Buttons (Teams Style) */}
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-1.5">
              Set Availability
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { key: 'online', label: 'Available', dot: 'bg-emerald-500' },
                { key: 'busy', label: 'Busy / In Task', dot: 'bg-rose-500' },
                { key: 'away', label: 'Away', dot: 'bg-amber-400' },
                { key: 'offline', label: 'Appear Offline', dot: 'bg-slate-400' },
              ].map((st) => {
                const isActive = activeStatusKey === st.key;
                return (
                  <button
                    key={st.key}
                    onClick={() => updatePresenceStatus(st.key as PresenceStatus)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                      isActive 
                        ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 font-semibold' 
                        : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${st.dot} shrink-0`} />
                    <span className="truncate">{st.label}</span>
                    {isActive && <Check className="w-3 h-3 text-indigo-600 ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Menu Navigation Items */}
          <div className="py-1">
            <button 
              onClick={() => {
                setShowMenu(false);
                navigate('/profile');
              }}
              className="px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors w-full cursor-pointer"
            >
              <Settings className="h-4 w-4 text-slate-400" />
              <span>Account & Preferences</span>
            </button>

            {user?.role === 'Administrator' && onOpenAnnouncements && (
              <button 
                onClick={() => {
                  setShowMenu(false);
                  onOpenAnnouncements();
                }}
                className="px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors w-full cursor-pointer"
              >
                <Megaphone className="h-4 w-4 text-slate-400" />
                <span>Announcements</span>
              </button>
            )}

            <div className="h-px bg-slate-100 my-1 w-full" />

            <button 
              onClick={() => {
                setShowMenu(false);
                logout();
                navigate('/login');
              }}
              className="px-4 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center space-x-2.5 transition-colors w-full cursor-pointer"
            >
              <LogOut className="h-4 w-4 text-rose-500" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
