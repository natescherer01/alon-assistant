import { useState, useMemo, useCallback } from 'react';
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
      <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB' }}>
        <span style={{ fontSize: '13px', color: '#666' }}>Loading...</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB' }}>
      {/* Search Input */}
      <input
        type="text"
        placeholder="Search team..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: '13px',
          border: 'none',
          borderRadius: '8px',
          background: '#F3F4F6',
          outline: 'none',
          marginBottom: '8px',
        }}
      />

      {/* Select All / Clear */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
        <button
          onClick={selectAll}
          style={{
            fontSize: '12px',
            color: '#0066FF',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Select all
        </button>
        <button
          onClick={clearAll}
          style={{
            fontSize: '12px',
            color: '#666',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Clear
        </button>
      </div>

      {/* User List */}
      <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
        {filteredUsers.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#999', padding: '8px 0' }}>
            {searchQuery ? 'No matches' : 'No team members with calendars'}
          </div>
        ) : (
          filteredUsers.map((user) => (
            <label
              key={user.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 4px',
                cursor: 'pointer',
                borderRadius: '6px',
              }}
            >
              <input
                type="checkbox"
                checked={selectedUserIds.includes(String(user.id))}
                onChange={() => toggleUser(String(user.id))}
                style={{
                  width: '16px',
                  height: '16px',
                  accentColor: '#0066FF',
                  cursor: 'pointer',
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#333',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {user.fullName || user.email.split('@')[0]}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: '#888',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {user.email}
                </div>
              </div>
            </label>
          ))
        )}
      </div>

      {/* Selection Count */}
      {selectedUserIds.length > 0 && (
        <div style={{
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid #E5E7EB',
          fontSize: '12px',
          color: '#0066FF',
          fontWeight: '500',
        }}>
          {selectedUserIds.length} selected
        </div>
      )}
    </div>
  );
}
