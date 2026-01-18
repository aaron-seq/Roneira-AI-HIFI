import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, subDays, subMonths, startOfYear, startOfMonth, endOfMonth, 
         eachDayOfInterval, isSameDay, isSameMonth, isToday, addMonths } from 'date-fns';

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export type PresetRange = '7d' | '30d' | '90d' | '1y' | 'ytd' | 'mtd' | 'custom';

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  placeholder?: string;
}

const presets: { id: PresetRange; label: string; getRange: () => DateRange }[] = [
  { 
    id: '7d', 
    label: 'Last 7 days', 
    getRange: () => ({ start: subDays(new Date(), 6), end: new Date() })
  },
  { 
    id: '30d', 
    label: 'Last 30 days', 
    getRange: () => ({ start: subDays(new Date(), 29), end: new Date() })
  },
  { 
    id: '90d', 
    label: 'Last 90 days', 
    getRange: () => ({ start: subDays(new Date(), 89), end: new Date() })
  },
  { 
    id: '1y', 
    label: 'Last year', 
    getRange: () => ({ start: subMonths(new Date(), 12), end: new Date() })
  },
  { 
    id: 'ytd', 
    label: 'Year to date', 
    getRange: () => ({ start: startOfYear(new Date()), end: new Date() })
  },
  { 
    id: 'mtd', 
    label: 'Month to date', 
    getRange: () => ({ start: startOfMonth(new Date()), end: new Date() })
  },
];

/**
 * DateRangePicker - Date range selection with presets
 * Supports preset ranges (7d, 30d, 90d, 1y, YTD, MTD) and custom calendar selection
 */
export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  className = '',
  minDate,
  maxDate = new Date(),
  placeholder = 'Select date range',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selecting, setSelecting] = useState<'start' | 'end' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDisplayValue = () => {
    if (!value.start && !value.end) return placeholder;
    if (value.start && value.end) {
      return `${format(value.start, 'MMM d, yyyy')} - ${format(value.end, 'MMM d, yyyy')}`;
    }
    if (value.start) return format(value.start, 'MMM d, yyyy');
    return placeholder;
  };

  const handlePresetClick = (preset: typeof presets[0]) => {
    onChange(preset.getRange());
    setIsOpen(false);
  };

  const handleDayClick = (day: Date) => {
    if (!selecting || selecting === 'start') {
      onChange({ start: day, end: null });
      setSelecting('end');
    } else {
      if (value.start && day >= value.start) {
        onChange({ start: value.start, end: day });
        setSelecting(null);
        setIsOpen(false);
      } else {
        onChange({ start: day, end: null });
        setSelecting('end');
      }
    }
  };

  const isInRange = (day: Date) => {
    if (!value.start || !value.end) return false;
    return day >= value.start && day <= value.end;
  };

  const isRangeStart = (day: Date) => value.start && isSameDay(day, value.start);
  const isRangeEnd = (day: Date) => value.end && isSameDay(day, value.end);

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Add padding for week alignment
    const startPadding = monthStart.getDay();
    const paddedDays = [...Array(startPadding).fill(null), ...days];

    return (
      <div className="p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
            className="p-1 rounded-lg transition-colors"
            style={{ color: 'var(--text-2)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-medium" style={{ color: 'var(--text-1)' }}>
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1 rounded-lg transition-colors"
            style={{ color: 'var(--text-2)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
            <div 
              key={day} 
              className="text-center text-xs font-medium py-1"
              style={{ color: 'var(--text-3)' }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {paddedDays.map((day, i) => {
            if (!day) {
              return <div key={`empty-${i}`} className="h-8" />;
            }

            const inRange = isInRange(day);
            const isStart = isRangeStart(day);
            const isEnd = isRangeEnd(day);
            const isTodayDate = isToday(day);
            const isDisabled = (minDate && day < minDate) || (maxDate && day > maxDate);
            const isCurrentMonth = isSameMonth(day, currentMonth);

            return (
              <button
                key={day.toISOString()}
                onClick={() => !isDisabled && handleDayClick(day)}
                disabled={isDisabled}
                className={`
                  h-8 text-sm font-medium rounded-md transition-colors
                  ${isDisabled ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}
                `}
                style={{
                  backgroundColor: isStart || isEnd 
                    ? 'var(--color-primary)' 
                    : inRange 
                      ? 'var(--color-primary-glow)'
                      : 'transparent',
                  color: isStart || isEnd 
                    ? 'white'
                    : !isCurrentMonth 
                      ? 'var(--text-4)'
                      : isTodayDate 
                        ? 'var(--color-primary)'
                        : 'var(--text-1)',
                  border: isTodayDate && !isStart && !isEnd
                    ? '1px solid var(--color-primary)'
                    : 'none',
                }}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>

        {/* Selection hint */}
        {selecting && (
          <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-3)' }}>
            {selecting === 'start' ? 'Select start date' : 'Select end date'}
          </p>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setSelecting('start');
        }}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors w-full"
        style={{
          backgroundColor: 'var(--surface-1)',
          border: '1px solid var(--border-default)',
          color: value.start ? 'var(--text-1)' : 'var(--text-3)',
        }}
      >
        <Calendar size={16} style={{ color: 'var(--text-2)' }} />
        <span className="flex-1 text-left text-sm">{formatDisplayValue()}</span>
        <ChevronDown 
          size={16} 
          style={{ 
            color: 'var(--text-2)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s'
          }} 
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute top-full left-0 mt-2 rounded-xl overflow-hidden z-50"
            style={{
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-card-hover)',
              minWidth: '320px',
            }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex">
              {/* Presets */}
              <div 
                className="py-2 shrink-0"
                style={{ 
                  borderRight: '1px solid var(--border-subtle)',
                  minWidth: '140px'
                }}
              >
                <div 
                  className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-3)' }}
                >
                  Presets
                </div>
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetClick(preset)}
                    className="w-full px-3 py-2 text-left text-sm transition-colors"
                    style={{ color: 'var(--text-1)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Calendar */}
              {renderCalendar()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DateRangePicker;
