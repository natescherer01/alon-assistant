import { useState, useEffect, CSSProperties } from 'react';
import type { RecurrenceInput, RecurrenceFrequency, RecurrenceEndType, MonthDayType } from '../../types/event';
import { getDayOfMonth, getRelativeDayPosition } from '../../utils/calendar/dateTime';

interface RecurrenceSelectorProps {
  value: RecurrenceInput | null;
  onChange: (value: RecurrenceInput | null) => void;
  startDate: string;
  disabled?: boolean;
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

const selectStyle: CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  fontSize: '15px',
  border: '1px solid rgba(0, 0, 0, 0.1)',
  borderRadius: '8px',
  outline: 'none',
  background: '#fff',
  cursor: 'pointer',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: '500',
  color: '#374151',
  marginBottom: '8px',
};

const radioLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  cursor: 'pointer',
  fontSize: '14px',
  color: '#374151',
};

const inputStyle: CSSProperties = {
  padding: '8px 12px',
  fontSize: '14px',
  border: '1px solid rgba(0, 0, 0, 0.1)',
  borderRadius: '6px',
  outline: 'none',
};

/**
 * Comprehensive recurrence selector for event creation
 * Handles daily, weekly, monthly, and yearly recurrence patterns
 */
export default function RecurrenceSelector({
  value,
  onChange,
  startDate,
  disabled = false,
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
      <div>
        <label htmlFor="recurrence-frequency" style={labelStyle}>
          Repeat
        </label>
        <select
          id="recurrence-frequency"
          value={frequency}
          onChange={(e) => handleFrequencyChange(e.target.value as RecurrenceFrequency | 'NONE')}
          disabled={disabled}
          style={{
            ...selectStyle,
            background: disabled ? '#F9FAFB' : '#fff',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label htmlFor="recurrence-frequency" style={labelStyle}>
          Repeat
        </label>
        <select
          id="recurrence-frequency"
          value={frequency}
          onChange={(e) => handleFrequencyChange(e.target.value as RecurrenceFrequency | 'NONE')}
          disabled={disabled}
          style={{
            ...selectStyle,
            background: disabled ? '#F9FAFB' : '#fff',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
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
          <label style={labelStyle}>Repeat on</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {WEEKDAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleWeekday(day.value)}
                disabled={disabled}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: selectedDays.includes(day.value) ? '2px solid #0066FF' : '2px solid rgba(0, 0, 0, 0.1)',
                  background: selectedDays.includes(day.value) ? '#E6F0FF' : '#fff',
                  color: selectedDays.includes(day.value) ? '#0066FF' : '#374151',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
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
          <label style={labelStyle}>Repeat on</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={radioLabelStyle}>
              <input
                type="radio"
                name="monthDayType"
                checked={monthDayType === 'DAY_OF_MONTH'}
                onChange={() => handleMonthDayTypeChange('DAY_OF_MONTH')}
                disabled={disabled}
                style={{ width: '16px', height: '16px', accentColor: '#0066FF' }}
              />
              <span>Day {dayOfMonth} of the month</span>
            </label>
            <label style={radioLabelStyle}>
              <input
                type="radio"
                name="monthDayType"
                checked={monthDayType === 'RELATIVE_DAY'}
                onChange={() => handleMonthDayTypeChange('RELATIVE_DAY')}
                disabled={disabled}
                style={{ width: '16px', height: '16px', accentColor: '#0066FF' }}
              />
              <span>The {positionName} {dayName}</span>
            </label>
          </div>
        </div>
      )}

      {/* End Condition */}
      <div>
        <label style={labelStyle}>Ends</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Never */}
          <label style={radioLabelStyle}>
            <input
              type="radio"
              name="endType"
              checked={endType === 'NEVER'}
              onChange={() => handleEndTypeChange('NEVER')}
              disabled={disabled}
              style={{ width: '16px', height: '16px', accentColor: '#0066FF' }}
            />
            <span>Never</span>
          </label>

          {/* On Date */}
          <label style={{ ...radioLabelStyle, alignItems: 'flex-start' }}>
            <input
              type="radio"
              name="endType"
              checked={endType === 'DATE'}
              onChange={() => handleEndTypeChange('DATE')}
              disabled={disabled}
              style={{ width: '16px', height: '16px', accentColor: '#0066FF', marginTop: '2px' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <span>On</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                min={startDate}
                disabled={disabled || endType !== 'DATE'}
                style={{
                  ...inputStyle,
                  flex: 1,
                  background: (disabled || endType !== 'DATE') ? '#F9FAFB' : '#fff',
                  cursor: (disabled || endType !== 'DATE') ? 'not-allowed' : 'pointer',
                }}
              />
            </div>
          </label>

          {/* After Count */}
          <label style={{ ...radioLabelStyle, alignItems: 'flex-start' }}>
            <input
              type="radio"
              name="endType"
              checked={endType === 'COUNT'}
              onChange={() => handleEndTypeChange('COUNT')}
              disabled={disabled}
              style={{ width: '16px', height: '16px', accentColor: '#0066FF', marginTop: '2px' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>After</span>
              <input
                type="number"
                value={count}
                onChange={(e) => handleCountChange(e.target.value)}
                min="1"
                max="999"
                disabled={disabled || endType !== 'COUNT'}
                style={{
                  ...inputStyle,
                  width: '80px',
                  background: (disabled || endType !== 'COUNT') ? '#F9FAFB' : '#fff',
                  cursor: (disabled || endType !== 'COUNT') ? 'not-allowed' : 'text',
                }}
              />
              <span>occurrences</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
