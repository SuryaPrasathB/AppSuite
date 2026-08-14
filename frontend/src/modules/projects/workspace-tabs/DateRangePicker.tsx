import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string | null;
  dueDate: string | null;
  onSave: (start: string | null, due: string | null) => void;
  triggerClassName?: string;
  triggerElement?: React.ReactNode;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  dueDate,
  onSave,
  triggerClassName = '',
  triggerElement,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStart, setTempStart] = useState<Date | null>(null);
  const [tempDue, setTempDue] = useState<Date | null>(null);
  const [activeSelection, setActiveSelection] = useState<'start' | 'due'>('due');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Initialize temp states from props
  useEffect(() => {
    setTempStart(startDate ? new Date(startDate) : null);
    setTempDue(dueDate ? new Date(dueDate) : null);
    
    if (startDate) {
      setCurrentMonth(new Date(startDate));
    } else if (dueDate) {
      setCurrentMonth(new Date(dueDate));
    }
    
    // Default to editing 'start' if neither is set, otherwise default to 'due'
    if (!startDate && !dueDate) {
      setActiveSelection('start');
    } else {
      setActiveSelection('due');
    }
  }, [startDate, dueDate, isOpen]);

  const updateCoords = () => {
    if (popoverRef.current) {
      const rect = popoverRef.current.getBoundingClientRect();
      const popoverWidth = 500;
      const popoverHeight = 300;
      
      let top = rect.bottom + window.scrollY + 8;
      let left = rect.left + window.scrollX;

      // Check if it overflows screen height at the bottom
      if (rect.bottom + popoverHeight > window.innerHeight) {
        top = rect.top + window.scrollY - popoverHeight - 8;
      }

      // Check if it overflows screen width on the right
      if (rect.left + popoverWidth > window.innerWidth) {
        left = rect.right + window.scrollX - popoverWidth;
      }

      setCoords({ top, left });
    }
  };

  // Handle dynamic placement via React Portal coordinates
  useEffect(() => {
    if (isOpen) {
      updateCoords();
      // Handle page scrolls and window resizing
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    } else {
      setCoords(null);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click was outside both the trigger element and the portal popover
      const portalElement = document.getElementById('date-range-picker-portal');
      const clickedInsideTrigger = popoverRef.current && popoverRef.current.contains(event.target as Node);
      const clickedInsidePortal = portalElement && portalElement.contains(event.target as Node);
      
      if (!clickedInsideTrigger && !clickedInsidePortal) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const formatDateString = (date: Date | null): string => {
    if (!date) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleDayClick = (day: Date) => {
    const clickedDate = new Date(day.getFullYear(), day.getMonth(), day.getDate());

    if (activeSelection === 'start') {
      setTempStart(clickedDate);
      if (tempDue && clickedDate > tempDue) {
        setTempDue(null);
      }
      setActiveSelection('due');
    } else {
      if (tempStart && clickedDate < tempStart) {
        setTempStart(null);
      }
      setTempDue(clickedDate);
    }
  };

  const handleShortcutClick = (shortcut: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let start = new Date(today);
    let end = new Date(today);

    switch (shortcut) {
      case 'today':
        break;
      case 'tomorrow':
        start.setDate(today.getDate() + 1);
        end.setDate(today.getDate() + 1);
        break;
      case 'this-weekend':
        const dayOfWeek = today.getDay();
        const diffToSat = 6 - dayOfWeek;
        start.setDate(today.getDate() + diffToSat);
        end.setDate(today.getDate() + diffToSat + 1);
        break;
      case 'next-week':
        const currentDay = today.getDay();
        const daysToNextMonday = currentDay === 0 ? 1 : 8 - currentDay;
        start.setDate(today.getDate() + daysToNextMonday);
        end.setDate(today.getDate() + daysToNextMonday + 4);
        break;
      case '2-weeks':
        end.setDate(today.getDate() + 14);
        break;
      case '4-weeks':
        end.setDate(today.getDate() + 28);
        break;
      default:
        return;
    }

    setTempStart(start);
    setTempDue(end);
  };


  const clearDates = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeSelection === 'start') {
      setTempStart(null);
    } else {
      setTempDue(null);
    }
  };

  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSave(formatDateString(tempStart), formatDateString(tempDue));
    setIsOpen(false);
  };

  const getDaysInMonth = (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const date = new Date(year, month, 1);
    const days = [];
    const startDayOfWeek = date.getDay();
    for (let i = startDayOfWeek; i > 0; i--) {
      const prevDate = new Date(year, month, 1 - i);
      days.push({ date: prevDate, isCurrentMonth: false });
    }
    while (date.getMonth() === month) {
      days.push({ date: new Date(date), isCurrentMonth: true });
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const days = getDaysInMonth(currentMonth);

  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const isSelected = (day: Date) => {
    if (!tempStart) return false;
    return day.toDateString() === tempStart.toDateString() || (tempDue && day.toDateString() === tempDue.toDateString());
  };

  const isInRange = (day: Date) => {
    if (!tempStart || !tempDue) return false;
    const dTime = day.getTime();
    const startTime = new Date(tempStart.getFullYear(), tempStart.getMonth(), tempStart.getDate()).getTime();
    const dueTime = new Date(tempDue.getFullYear(), tempDue.getMonth(), tempDue.getDate()).getTime();
    return dTime > startTime && dTime < dueTime;
  };

  const isToday = (day: Date) => {
    const today = new Date();
    return day.getDate() === today.getDate() &&
           day.getMonth() === today.getMonth() &&
           day.getFullYear() === today.getFullYear();
  };

  const getHeaderDisplay = () => {
    if (!tempStart) return 'Select dates';
    const startStr = tempStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (!tempDue) return `${startStr} ➔ ...`;
    const dueStr = tempDue.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${startStr} ➔ ${dueStr}`;
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {triggerElement ? (
        <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
          {triggerElement}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm ${triggerClassName}`}
        >
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>{getHeaderDisplay()}</span>
        </button>
      )}

      {isOpen && coords && createPortal(
        <div 
          id="date-range-picker-portal"
          style={{ 
            position: 'absolute', 
            top: `${coords.top}px`, 
            left: `${coords.left}px`, 
            width: '500px' 
          }}
          className="z-[9999] bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 p-4 flex flex-col font-sans transition-all scale-100"
        >
          {/* Header Display Info */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="h-4 w-4 text-indigo-500" />
              {getHeaderDisplay()}
            </span>
            <div className="flex gap-2">
              <button onClick={clearDates} className="px-2.5 py-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors text-xs font-semibold" title={`Clear ${activeSelection} date`}>
                Clear
              </button>
              <button onClick={handleApply} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold text-xs transition-colors">
                Apply
              </button>
            </div>
          </div>

          {/* Mode selection */}
          <div className="flex bg-slate-100 rounded-lg p-1 mb-3">
            <button 
              onClick={() => setActiveSelection('start')} 
              className={`flex-1 text-xs py-1.5 rounded-md font-semibold transition-colors ${activeSelection === 'start' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Select Start Date
            </button>
            <button 
              onClick={() => setActiveSelection('due')} 
              className={`flex-1 text-xs py-1.5 rounded-md font-semibold transition-colors ${activeSelection === 'due' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Select Due Date
            </button>
          </div>

          <div className="flex flex-row gap-4">
            {/* Left Panel: Quick Shortcuts */}
            <div className="w-1/3 flex flex-col border-r border-slate-200 pr-3 space-y-1">
              <button onClick={() => handleShortcutClick('today')} className="text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 hover:text-slate-800 text-slate-600 transition-colors">Today</button>
              <button onClick={() => handleShortcutClick('tomorrow')} className="text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 hover:text-slate-800 text-slate-600 transition-colors">Tomorrow</button>
              <button onClick={() => handleShortcutClick('this-weekend')} className="text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 hover:text-slate-800 text-slate-600 transition-colors">This Weekend</button>
              <button onClick={() => handleShortcutClick('next-week')} className="text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 hover:text-slate-800 text-slate-600 transition-colors">Next Week</button>
              <button onClick={() => handleShortcutClick('2-weeks')} className="text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 hover:text-slate-800 text-slate-600 transition-colors">2 Weeks</button>
              <button onClick={() => handleShortcutClick('4-weeks')} className="text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 hover:text-slate-800 text-slate-600 transition-colors">4 Weeks</button>
            </div>

            {/* Right Panel: Calendar */}
            <div className="w-2/3 flex flex-col">
              {/* Calendar Month Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-sm font-bold text-slate-800">
                  {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </span>
                <div className="flex gap-1">
                  <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Day names */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((dayObj, i) => {
                  const isDaySelected = isSelected(dayObj.date);
                  const isDayInRange = isInRange(dayObj.date);
                  const isTodayDay = isToday(dayObj.date);

                  return (
                    <button
                      key={i}
                      onClick={() => handleDayClick(dayObj.date)}
                      className={`h-7 w-7 text-xs font-semibold flex items-center justify-center transition-all ${
                        !dayObj.isCurrentMonth ? 'text-slate-400 opacity-50' : 'text-slate-700'
                      } ${
                        isDaySelected
                          ? 'bg-indigo-600 text-white rounded-full font-bold shadow-md shadow-indigo-600/30'
                          : isDayInRange
                          ? 'bg-indigo-50 text-indigo-600'
                          : isTodayDay
                          ? 'ring-2 ring-indigo-400 rounded-full bg-indigo-50/50 text-indigo-700 font-bold'
                          : 'hover:bg-slate-100 rounded-full'
                      }`}
                    >
                      {dayObj.date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
