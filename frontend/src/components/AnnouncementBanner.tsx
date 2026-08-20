import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { apiClient } from '../api/apiClient';

export const AnnouncementBanner: React.FC = () => {
  const [announcement, setAnnouncement] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(true);

  const fetchAnnouncement = async () => {
    try {
      // Don't fetch if no user is logged in
      const storedUser = localStorage.getItem('smart_store_user');
      if (!storedUser) return;
      
      const activeAnnouncements = await apiClient.announcements.listActive(1);
      if (activeAnnouncements && activeAnnouncements.length > 0) {
        // If it's a new announcement, ensure it's visible again
        if (!announcement || announcement.id !== activeAnnouncements[0].id) {
          setAnnouncement(activeAnnouncements[0]);
          setIsVisible(true);
        }
      } else {
        setAnnouncement(null);
      }
    } catch (err) {
      console.error("Failed to fetch announcements:", err);
    }
  };

  useEffect(() => {
    fetchAnnouncement();
    
    // Poll every 15 seconds
    const interval = setInterval(fetchAnnouncement, 15000);
    
    return () => clearInterval(interval);
  }, []);

  if (!announcement || !isVisible) return null;

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2.5 flex items-center justify-between shadow-md relative z-50">
      <div className="flex items-center gap-3 font-medium text-sm w-full justify-center">
        <AlertTriangle className="h-5 w-5 animate-pulse shrink-0" />
        <span>{announcement.message}</span>
      </div>
      <button 
        onClick={() => setIsVisible(false)}
        className="text-amber-900 hover:text-amber-950 transition-colors p-1 rounded hover:bg-amber-400 shrink-0 absolute right-4"
        title="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
