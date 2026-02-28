import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LotteryResult {
  date: string;
  [key: string]: any;
}

interface CalendarWidgetProps {
  results: LotteryResult[];
  onDateSelect: (date: string) => void;
  selectedDate?: string;
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({ results, onDateSelect, selectedDate }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const daysWithResults = useMemo(() => {
    const set = new Set<string>();
    (results || []).forEach(r => {
      if (!r || !r.date) return;
      // Normalize date format to YYYY-MM-DD for comparison
      // Assuming r.date is JJ/MM/AAAA
      const parts = r.date.split('/');
      if (parts.length === 3) {
        const normalized = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        set.add(normalized);
      } else {
        // Fallback for ISO dates
        const d = new Date(r.date);
        if (!isNaN(d.getTime())) {
          set.add(d.toISOString().split('T')[0]);
        }
      }
    });
    return set;
  }, [results]);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const renderDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const totalDays = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);
    const days = [];

    // Empty slots for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10 w-10" />);
    }

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const hasResult = daysWithResults.has(dateStr);
      const isSelected = selectedDate === dateStr;
      const isToday = new Date().toISOString().split('T')[0] === dateStr;

      days.push(
        <button
          key={day}
          onClick={() => onDateSelect(dateStr)}
          className={cn(
            "h-10 w-10 rounded-xl flex flex-col items-center justify-center relative transition-all duration-200",
            isSelected 
              ? "bg-slate-900 text-white shadow-lg scale-110 z-10" 
              : "hover:bg-slate-100 text-slate-700",
            isToday && !isSelected && "border border-brand-blue/30 text-brand-blue"
          )}
        >
          <span className="text-[11px] font-bold">{day}</span>
          {hasResult && (
            <div className={cn(
              "absolute bottom-1.5 w-1 h-1 rounded-full",
              isSelected ? "bg-brand-gold" : "bg-brand-blue"
            )} />
          )}
        </button>
      );
    }

    return days;
  };

  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));

  const monthName = currentMonth.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-brand-blue" />
          <h3 className="font-serif italic text-lg capitalize">{monthName}</h3>
        </div>
        <div className="flex gap-1">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(d => (
          <div key={d} className="h-8 flex items-center justify-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {renderDays()}
      </div>

      <div className="mt-6 flex items-center gap-4 pt-4 border-t border-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-brand-blue" />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tirage disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-900" />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sélectionné</span>
        </div>
      </div>
    </div>
  );
};
