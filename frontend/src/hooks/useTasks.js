/**
 * Tasks React Query Hooks
 *
 * Features:
 * - Automatic caching and background refetching
 * - Optimistic updates
 * - Conflict resolution
 * - Offline mutation queue
 * - Stale-while-revalidate pattern
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { tasksAPI } from '../api/client';
import { clearEtagCache } from '../services/enhancedApi';

/**
 * Fetch all tasks
 * @param {string} listType - 'all', 'today', 'week', 'overdue'
 * @param {number} days - Number of days to fetch
 * @param {string|null} project - Filter by project
 */
export function useTasks(listType = 'all', days = 7, project = null) {
  return useQuery({
    queryKey: queryKeys.tasks.list({ listType, days, project }),
    queryFn: () => tasksAPI.getTasks(listType, days, project),
    staleTime: 2 * 60 * 1000, // 2 minutes (tasks change frequently)
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

/**
 * Fetch single task
 * @param {string} taskId
 */
export function useTask(taskId) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(taskId),
    queryFn: () => tasksAPI.getTask(taskId),
    enabled: !!taskId, // Only fetch if taskId is provided
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch next task
 * @param {string|null} intensityFilter
 */
export function useNextTask(intensityFilter = null) {
  return useQuery({
    queryKey: queryKeys.tasks.next(intensityFilter),
    queryFn: () => tasksAPI.getNextTask(intensityFilter),
    staleTime: 1 * 60 * 1000, // 1 minute (next task changes frequently)
  });
}

/**
 * Fetch task prerequisites
 * @param {string} taskId
 */
export function useTaskPrerequisites(taskId) {
  return useQuery({
    queryKey: queryKeys.tasks.prerequisites(taskId),
    queryFn: () => tasksAPI.getPrerequisites(taskId),
    enabled: !!taskId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Create new task
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskData) => tasksAPI.createTask(taskData),

    // Optimistic update
    onMutate: async (newTask) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all });

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData(queryKeys.tasks.lists());

      // Optimistically update cache
      queryClient.setQueryData(queryKeys.tasks.lists(), (old) => {
        if (!old) return [newTask];
        return [...old, { ...newTask, id: 'temp-' + Date.now() }];
      });

      return { previousTasks };
    },

    // On success, refetch to get server data
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      clearEtagCache('tasks');
    },

    // On error, rollback
    onError: (error, newTask, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKeys.tasks.lists(), context.previousTasks);
      }
      console.error('Failed to create task:', error);
    },
  });
}

/**
 * Update task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, updates }) => tasksAPI.updateTask(taskId, updates),

    // Optimistic update
    onMutate: async ({ taskId, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.detail(taskId) });

      const previousTask = queryClient.getQueryData(queryKeys.tasks.detail(taskId));

      // Optimistically update
      queryClient.setQueryData(queryKeys.tasks.detail(taskId), (old) => ({
        ...old,
        ...updates,
      }));

      return { previousTask, taskId };
    },

    onSuccess: (data, { taskId }) => {
      // Update with server data
      queryClient.setQueryData(queryKeys.tasks.detail(taskId), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.lists() });
      clearEtagCache('tasks');
    },

    onError: (error, { taskId }, context) => {
      // Check for conflict (412 Precondition Failed)
      if (error.isConflict) {
        console.warn('Conflict detected, refetching latest data');
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) });
        return;
      }

      // Rollback on other errors
      if (context?.previousTask) {
        queryClient.setQueryData(
          queryKeys.tasks.detail(context.taskId),
          context.previousTask
        );
      }
      console.error('Failed to update task:', error);
    },
  });
}

/**
 * Complete task
 */
export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, notes = null }) => tasksAPI.completeTask(taskId, notes),

    onMutate: async ({ taskId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.detail(taskId) });

      const previousTask = queryClient.getQueryData(queryKeys.tasks.detail(taskId));

      // Optimistically mark as completed
      queryClient.setQueryData(queryKeys.tasks.detail(taskId), (old) => ({
        ...old,
        completed: true,
        completed_at: new Date().toISOString(),
      }));

      return { previousTask, taskId };
    },

    onSuccess: (data, { taskId }) => {
      queryClient.setQueryData(queryKeys.tasks.detail(taskId), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.next() });
      clearEtagCache('tasks');
    },

    onError: (error, { taskId }, context) => {
      if (context?.previousTask) {
        queryClient.setQueryData(
          queryKeys.tasks.detail(context.taskId),
          context.previousTask
        );
      }
      console.error('Failed to complete task:', error);
    },
  });
}

/**
 * Delete task
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId) => tasksAPI.deleteTask(taskId),

    onSuccess: (data, taskId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: queryKeys.tasks.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.lists() });
      clearEtagCache('tasks');
    },

    onError: (error) => {
      console.error('Failed to delete task:', error);
    },
  });
}

/**
 * Restore task
 */
export function useRestoreTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId) => tasksAPI.restoreTask(taskId),

    onSuccess: (data, taskId) => {
      queryClient.setQueryData(queryKeys.tasks.detail(taskId), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.lists() });
      clearEtagCache('tasks');
    },

    onError: (error) => {
      console.error('Failed to restore task:', error);
    },
  });
}

/**
 * Prefetch tasks (for preloading)
 */
export function usePrefetchTasks() {
  const queryClient = useQueryClient();

  return (listType = 'all', days = 7) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.tasks.list({ listType, days }),
      queryFn: () => tasksAPI.getTasks(listType, days),
      staleTime: 2 * 60 * 1000,
    });
  };
}
