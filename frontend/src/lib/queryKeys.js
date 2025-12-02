/**
 * Query Key Factory
 *
 * Normalized, hierarchical query keys for React Query
 * Prevents cache key collisions and enables efficient cache invalidation
 *
 * Structure:
 * - ['resource'] - All items of resource
 * - ['resource', 'list', filters] - Filtered list
 * - ['resource', 'detail', id] - Single item
 * - ['resource', 'infinite', filters] - Infinite query
 */

export const queryKeys = {
  // Tasks
  tasks: {
    all: ['tasks'],
    lists: () => [...queryKeys.tasks.all, 'list'],
    list: (filters = {}) => [...queryKeys.tasks.lists(), filters],
    details: () => [...queryKeys.tasks.all, 'detail'],
    detail: (id) => [...queryKeys.tasks.details(), id],
    next: (intensityFilter) => [...queryKeys.tasks.all, 'next', intensityFilter],
    prerequisites: (id) => [...queryKeys.tasks.detail(id), 'prerequisites'],
  },

  // Chat/Conversations
  chat: {
    all: ['chat'],
    history: (limit) => [...queryKeys.chat.all, 'history', limit],
  },

  // Auth/User
  auth: {
    all: ['auth'],
    currentUser: () => [...queryKeys.auth.all, 'me'],
  },

  // Notes (if you add notes in future)
  notes: {
    all: ['notes'],
    lists: () => [...queryKeys.notes.all, 'list'],
    list: (filters = {}) => [...queryKeys.notes.lists(), filters],
    details: () => [...queryKeys.notes.all, 'detail'],
    detail: (id) => [...queryKeys.notes.details(), id],
  },

  // Preferences (if you add preferences)
  preferences: {
    all: ['preferences'],
    get: () => [...queryKeys.preferences.all, 'current'],
  },

  // Calendar
  calendar: {
    all: ['calendar'],
    calendars: () => [...queryKeys.calendar.all, 'calendars'],
    events: (params = {}) => [...queryKeys.calendar.all, 'events', params],
    eventsForRange: (startDate, endDate) => [...queryKeys.calendar.all, 'events', { startDate, endDate }],
  },
};

/**
 * Helper to invalidate all queries for a resource
 * Usage: queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
 */

export default queryKeys;
