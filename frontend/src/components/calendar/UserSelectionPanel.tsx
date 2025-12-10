import React, { useState, useMemo, useCallback } from 'react';
import { useCalendarUsers } from '../../hooks/calendar/useCalendarUsers';

interface Props {
  selectedUserIds: string[];
  onSelectionChange: (userIds: string[]) => void;
  currentUserId: string;
}

export function UserSelectionPanel({
  selectedUserIds,
  onSelectionChange,
  currentUserId,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: users = [], isLoading } = useCalendarUsers();

  // Filter users: exclude current user, only show those with calendars
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => String(u.id) !== String(currentUserId))
      .filter((u) => u.hasCalendar)
      .filter(
        (u) =>
          !searchQuery ||
          u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [users, currentUserId, searchQuery]);

  const toggleUser = useCallback(
    (userId: string) => {
      if (selectedUserIds.includes(userId)) {
        onSelectionChange(selectedUserIds.filter((id) => id !== userId));
      } else {
        onSelectionChange([...selectedUserIds, userId]);
      }
    },
    [selectedUserIds, onSelectionChange]
  );

  const selectAll = useCallback(() => {
    onSelectionChange(filteredUsers.map((u) => String(u.id)));
  }, [filteredUsers, onSelectionChange]);

  const clearAll = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  if (isLoading) {
    return (
      <div className="p-4 border-b border-gray-200">
        <div className="text-sm text-gray-500">Loading team members...</div>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-gray-200">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        View Team Calendars
      </h3>

      <input
        type="text"
        placeholder="Search team members..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      <div className="flex gap-2 mb-3">
        <button
          onClick={selectAll}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          Select all
        </button>
        <span className="text-gray-300">|</span>
        <button
          onClick={clearAll}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          Clear
        </button>
      </div>

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <div className="text-sm text-gray-500 py-2">
            {searchQuery
              ? 'No matching team members found'
              : 'No team members with connected calendars'}
          </div>
        ) : (
          filteredUsers.map((user) => (
            <label
              key={user.id}
              className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedUserIds.includes(String(user.id))}
                onChange={() => toggleUser(String(user.id))}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-700 truncate">
                  {user.fullName || user.email.split('@')[0]}
                </div>
                <div className="text-xs text-gray-500 truncate">{user.email}</div>
              </div>
            </label>
          ))
        )}
      </div>

      {selectedUserIds.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
          {selectedUserIds.length} team member
          {selectedUserIds.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}
