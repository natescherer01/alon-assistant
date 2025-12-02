import { useState, useEffect } from 'react';
import type { RecurrenceInput, RecurrenceFrequency, RecurrenceEndType, MonthDayType } from '../../types/event';
import { getDayOfMonth, getRelativeDayPosition } from '../../utils/calendar/dateTime';

interface RecurrenceSelectorProps {
  value: RecurrenceInput | null;
  onChange: (value: RecurrenceInput | null) => void;
  startDate: string;
}

const WEEKDAYS = [
  { label: 'M', value: 'MO', name: 'Monday' },
  { label: 'T', value: 'TU', name: 'Tuesday' },
  { label: 'W', value: 'WE', name: 'Wednesday' },
  { label: 'Th', value: 'TH', name: 'Thursday' },
  { label: 'F', value: 'FR', name: 'Friday' },
  { label: 'Sa', value: 'SA', name: 'Saturday' },
  { label: 'Su', value: 'SU', name: 'Sunday' },
];

/**
 * Comprehensive recurrence selector for event creation
 * Handles daily, weekly, monthly, and yearly recurrence patterns
 */
export default function RecurrenceSelector({
  value,
  onChange,
  startDate,
}: RecurrenceSelectorProps) {
  const [frequency, setFrequency] = useState<RecurrenceFrequency | 'NONE'>('NONE');
  const [endType, setEndType] = useState<RecurrenceEndType>('NEVER');
  const [endDate, setEndDate] = useState('');
  const [count, setCount] = useState('10');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [monthDayType, setMonthDayType] = useState<MonthDayType>('DAY_OF_MONTH');

  // Initialize from value prop
  useEffect(() => {
    if (value) {
      setFrequency(value.frequency);
      setEndType(value.endType);
      setEndDate(value.endDate || '');
      setCount(value.count?.toString() || '10');
      setSelectedDays(value.byDay || []);
      setMonthDayType(value.monthDayType || 'DAY_OF_MONTH');
    } else {
      setFrequency('NONE');
    }
  }, [value]);

  const handleFrequencyChange = (newFrequency: RecurrenceFrequency | 'NONE') => {
    setFrequency(newFrequency);

    if (newFrequency === 'NONE') {
      onChange(null);
      return;
    }

    // Initialize with defaults
    const baseRecurrence: RecurrenceInput = {
      frequency: newFrequency,
      endType: 'NEVER',
    };

    // Set defaults based on frequency
    if (newFrequency === 'WEEKLY') {
      const dayAbbrev = getRelativeDayPosition(startDate).dayAbbrev;
      setSelectedDays([dayAbbrev]);
      baseRecurrence.byDay = [dayAbbrev];
    } else if (newFrequency === 'MONTHLY') {
      const dayOfMonth = getDayOfMonth(startDate);
      baseRecurrence.monthDayType = 'DAY_OF_MONTH';
      baseRecurrence.byMonthDay = dayOfMonth;
    }

    onChange(baseRecurrence);
  };

  const handleEndTypeChange = (newEndType: RecurrenceEndType) => {
    setEndType(newEndType);
    updateRecurrence({ endType: newEndType });
  };

  const handleEndDateChange = (date: string) => {
    setEndDate(date);
    updateRecurrence({ endDate: date, endType: 'DATE' });
  };

  const handleCountChange = (countValue: string) => {
    setCount(countValue);
    const parsedCount = parseInt(countValue, 10);
    if (!isNaN(parsedCount) && parsedCount > 0) {
      updateRecurrence({ count: parsedCount, endType: 'COUNT' });
    }
  };

  const toggleWeekday = (day: string) => {
    const newDays = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];

    setSelectedDays(newDays);
    updateRecurrence({ byDay: newDays });
  };

  const handleMonthDayTypeChange = (type: MonthDayType) => {
    setMonthDayType(type);

    if (type === 'DAY_OF_MONTH') {
      const dayOfMonth = getDayOfMonth(startDate);
      updateRecurrence({
        monthDayType: type,
        byMonthDay: dayOfMonth,
        bySetPos: undefined,
        byDayOfWeek: undefined,
      });
    } else {
      const { position, dayAbbrev } = getRelativeDayPosition(startDate);
      updateRecurrence({
        monthDayType: type,
        bySetPos: position,
        byDayOfWeek: dayAbbrev,
        byMonthDay: undefined,
      });
    }
  };

  const updateRecurrence = (updates: Partial<RecurrenceInput>) => {
    if (!value || frequency === 'NONE') return;

    onChange({
      ...value,
      ...updates,
    });
  };

  if (frequency === 'NONE') {
    return (
      <div className="space-y-4">
        <label htmlFor="recurrence-frequency" className="block text-sm font-medium text-gray-700">
          Repeat
        </label>
        <select
          id="recurrence-frequency"
          value={frequency}
          onChange={(e) => handleFrequencyChange(e.target.value as RecurrenceFrequency | 'NONE')}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="NONE">Does not repeat</option>
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
          <option value="YEARLY">Yearly</option>
        </select>
      </div>
    );
  }

  const dayOfMonth = getDayOfMonth(startDate);
  const { positionName, dayName } = getRelativeDayPosition(startDate);

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <div>
        <label htmlFor="recurrence-frequency" className="block text-sm font-medium text-gray-700 mb-1">
          Repeat
        </label>
        <select
          id="recurrence-frequency"
          value={frequency}
          onChange={(e) => handleFrequencyChange(e.target.value as RecurrenceFrequency | 'NONE')}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="NONE">Does not repeat</option>
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
          <option value="YEARLY">Yearly</option>
        </select>
      </div>

      {/* Weekly: Day Selection */}
      {frequency === 'WEEKLY' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Repeat on
          </label>
          <div className="flex gap-2">
            {WEEKDAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleWeekday(day.value)}
                className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                  selectedDays.includes(day.value)
                    ? 'border-blue-500 bg-blue-100 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
                aria-label={day.name}
                aria-pressed={selectedDays.includes(day.value)}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Monthly: Day Type Selection */}
      {frequency === 'MONTHLY' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Repeat on
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="monthDayType"
                checked={monthDayType === 'DAY_OF_MONTH'}
                onChange={() => handleMonthDayTypeChange('DAY_OF_MONTH')}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Day {dayOfMonth} of the month
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="monthDayType"
                checked={monthDayType === 'RELATIVE_DAY'}
                onChange={() => handleMonthDayTypeChange('RELATIVE_DAY')}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                The {positionName} {dayName}
              </span>
            </label>
          </div>
        </div>
      )}

      {/* End Condition */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Ends
        </label>
        <div className="space-y-3">
          {/* Never */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="endType"
              checked={endType === 'NEVER'}
              onChange={() => handleEndTypeChange('NEVER')}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Never</span>
          </label>

          {/* On Date */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="endType"
              checked={endType === 'DATE'}
              onChange={() => handleEndTypeChange('DATE')}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500 mt-0.5"
            />
            <div className="flex-1 flex items-center gap-2">
              <span className="text-sm text-gray-700">On</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                min={startDate}
                className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={endType !== 'DATE'}
              />
            </div>
          </label>

          {/* After Count */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="endType"
              checked={endType === 'COUNT'}
              onChange={() => handleEndTypeChange('COUNT')}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500 mt-0.5"
            />
            <div className="flex-1 flex items-center gap-2">
              <span className="text-sm text-gray-700">After</span>
              <input
                type="number"
                value={count}
                onChange={(e) => handleCountChange(e.target.value)}
                min="1"
                max="999"
                className="w-20 px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={endType !== 'COUNT'}
              />
              <span className="text-sm text-gray-700">occurrences</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
