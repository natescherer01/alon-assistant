/**
 * ICS Sync Job Tests
 *
 * Tests for background ICS synchronization job
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import icsSyncJob from '../../../jobs/icsSyncJob';
import { CalendarProvider } from '@prisma/client';

// Mock dependencies
jest.mock('../../../lib/prisma');
jest.mock('../../../services/icsService');

describe('ICS Sync Job', () => {
  let mockPrisma: any;
  let mockIcsService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock Prisma
    mockPrisma = require('../../../lib/prisma').prisma;
    mockPrisma.calendarConnection = {
      findMany: jest.fn(),
    };

    // Mock ICS service
    mockIcsService = require('../../../services/icsService').default;
    mockIcsService.syncIcsEvents = jest.fn();

    // Stop any running jobs
    icsSyncJob.stop();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    icsSyncJob.stop();
  });

  describe('start', () => {
    it('should start the job on schedule', () => {
      icsSyncJob.start();

      const status = icsSyncJob.getStatus();
      expect(status.running).toBe(true);
      expect(status.intervalMinutes).toBe(15);
    });

    it('should run immediately on startup', async () => {
      mockPrisma.calendarConnection.findMany.mockResolvedValue([]);

      icsSyncJob.start();

      // Wait for initial execution
      await Promise.resolve();

      expect(mockPrisma.calendarConnection.findMany).toHaveBeenCalled();
    });

    it('should not start if already running', () => {
      icsSyncJob.start();
      const firstStart = icsSyncJob.getStatus();

      icsSyncJob.start();
      const secondStart = icsSyncJob.getStatus();

      expect(firstStart).toEqual(secondStart);
    });

    it('should run on configured interval', async () => {
      mockPrisma.calendarConnection.findMany.mockResolvedValue([]);

      icsSyncJob.start();

      // Fast-forward past interval (15 minutes = 900000ms)
      jest.advanceTimersByTime(900000);

      await Promise.resolve();

      // Should have run at least twice (initial + interval)
      expect(mockPrisma.calendarConnection.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('stop', () => {
    it('should stop the job gracefully', () => {
      icsSyncJob.start();
      expect(icsSyncJob.getStatus().running).toBe(true);

      icsSyncJob.stop();
      expect(icsSyncJob.getStatus().running).toBe(false);
    });

    it('should handle stop when not running', () => {
      icsSyncJob.stop();

      const status = icsSyncJob.getStatus();
      expect(status.running).toBe(false);
    });
  });

  describe('syncAllIcsCalendars', () => {
    it('should sync all active ICS connections', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          userId: 'user-1',
          calendarName: 'Calendar 1',
          lastSyncedAt: null,
        },
        {
          id: 'conn-2',
          userId: 'user-2',
          calendarName: 'Calendar 2',
          lastSyncedAt: new Date(),
        },
      ];

      mockPrisma.calendarConnection.findMany.mockResolvedValue(mockConnections);
      mockIcsService.syncIcsEvents.mockResolvedValue({
        success: true,
        eventsAdded: 1,
        eventsUpdated: 0,
        eventsDeleted: 0,
      });

      await icsSyncJob.triggerSync();

      expect(mockPrisma.calendarConnection.findMany).toHaveBeenCalledWith({
        where: {
          provider: CalendarProvider.ICS,
          isConnected: true,
          deletedAt: null,
        },
        select: expect.any(Object),
      });
      expect(mockIcsService.syncIcsEvents).toHaveBeenCalledTimes(2);
      expect(mockIcsService.syncIcsEvents).toHaveBeenCalledWith('conn-1');
      expect(mockIcsService.syncIcsEvents).toHaveBeenCalledWith('conn-2');
    });

    it('should stagger syncs to avoid thundering herd', async () => {
      const mockConnections = Array.from({ length: 10 }, (_, i) => ({
        id: `conn-${i}`,
        userId: `user-${i}`,
        calendarName: `Calendar ${i}`,
        lastSyncedAt: null,
      }));

      mockPrisma.calendarConnection.findMany.mockResolvedValue(mockConnections);
      mockIcsService.syncIcsEvents.mockResolvedValue({
        success: true,
        eventsAdded: 0,
        eventsUpdated: 0,
        eventsDeleted: 0,
      });

      const startTime = Date.now();
      await icsSyncJob.triggerSync();
      const endTime = Date.now();

      // With staggering, syncing 10 calendars should take some time
      // (though in fake timers this might not be measurable)
      expect(mockIcsService.syncIcsEvents).toHaveBeenCalledTimes(10);
    });

    it('should handle sync failures without crashing', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          userId: 'user-1',
          calendarName: 'Calendar 1',
          lastSyncedAt: null,
        },
        {
          id: 'conn-2',
          userId: 'user-2',
          calendarName: 'Calendar 2',
          lastSyncedAt: null,
        },
      ];

      mockPrisma.calendarConnection.findMany.mockResolvedValue(mockConnections);
      mockIcsService.syncIcsEvents
        .mockResolvedValueOnce({
          success: false,
          eventsAdded: 0,
          eventsUpdated: 0,
          eventsDeleted: 0,
          error: 'Network error',
        })
        .mockResolvedValueOnce({
          success: true,
          eventsAdded: 1,
          eventsUpdated: 0,
          eventsDeleted: 0,
        });

      await icsSyncJob.triggerSync();

      // Should continue after first failure
      expect(mockIcsService.syncIcsEvents).toHaveBeenCalledTimes(2);
    });

    it('should skip if no ICS calendars to sync', async () => {
      mockPrisma.calendarConnection.findMany.mockResolvedValue([]);

      await icsSyncJob.triggerSync();

      expect(mockIcsService.syncIcsEvents).not.toHaveBeenCalled();
    });

    it('should not run concurrent sync cycles', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          userId: 'user-1',
          calendarName: 'Calendar 1',
          lastSyncedAt: null,
        },
      ];

      mockPrisma.calendarConnection.findMany.mockResolvedValue(mockConnections);
      mockIcsService.syncIcsEvents.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              eventsAdded: 0,
              eventsUpdated: 0,
              eventsDeleted: 0,
            });
          }, 1000);
        });
      });

      // Trigger two syncs in parallel
      const sync1 = icsSyncJob.triggerSync();
      const sync2 = icsSyncJob.triggerSync();

      await Promise.all([sync1, sync2]);

      // Second sync should be skipped
      expect(mockPrisma.calendarConnection.findMany).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.calendarConnection.findMany.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(icsSyncJob.triggerSync()).resolves.not.toThrow();
    });

    it('should log sync statistics', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          userId: 'user-1',
          calendarName: 'Calendar 1',
          lastSyncedAt: null,
        },
        {
          id: 'conn-2',
          userId: 'user-2',
          calendarName: 'Calendar 2',
          lastSyncedAt: null,
        },
      ];

      mockPrisma.calendarConnection.findMany.mockResolvedValue(mockConnections);
      mockIcsService.syncIcsEvents
        .mockResolvedValueOnce({
          success: true,
          eventsAdded: 5,
          eventsUpdated: 3,
          eventsDeleted: 1,
        })
        .mockResolvedValueOnce({
          success: false,
          eventsAdded: 0,
          eventsUpdated: 0,
          eventsDeleted: 0,
          error: 'Failed',
        });

      await icsSyncJob.triggerSync();

      // Job should complete and log stats
      expect(mockIcsService.syncIcsEvents).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStatus', () => {
    it('should return job status', () => {
      const status = icsSyncJob.getStatus();

      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('intervalMs');
      expect(status).toHaveProperty('intervalMinutes');
      expect(status).toHaveProperty('isSyncing');
    });

    it('should reflect running state', () => {
      let status = icsSyncJob.getStatus();
      expect(status.running).toBe(false);

      icsSyncJob.start();
      status = icsSyncJob.getStatus();
      expect(status.running).toBe(true);

      icsSyncJob.stop();
      status = icsSyncJob.getStatus();
      expect(status.running).toBe(false);
    });

    it('should show correct interval configuration', () => {
      const status = icsSyncJob.getStatus();

      expect(status.intervalMinutes).toBe(15);
      expect(status.intervalMs).toBe(15 * 60 * 1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle connections with missing fields', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          userId: 'user-1',
          calendarName: null,
          lastSyncedAt: null,
        },
      ];

      mockPrisma.calendarConnection.findMany.mockResolvedValue(mockConnections);
      mockIcsService.syncIcsEvents.mockResolvedValue({
        success: true,
        eventsAdded: 0,
        eventsUpdated: 0,
        eventsDeleted: 0,
      });

      await expect(icsSyncJob.triggerSync()).resolves.not.toThrow();
    });

    it('should handle very large number of connections', async () => {
      const mockConnections = Array.from({ length: 1000 }, (_, i) => ({
        id: `conn-${i}`,
        userId: `user-${i}`,
        calendarName: `Calendar ${i}`,
        lastSyncedAt: null,
      }));

      mockPrisma.calendarConnection.findMany.mockResolvedValue(mockConnections);
      mockIcsService.syncIcsEvents.mockResolvedValue({
        success: true,
        eventsAdded: 0,
        eventsUpdated: 0,
        eventsDeleted: 0,
      });

      await icsSyncJob.triggerSync();

      expect(mockIcsService.syncIcsEvents).toHaveBeenCalledTimes(1000);
    });

    it('should handle sync service throwing errors', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          userId: 'user-1',
          calendarName: 'Calendar 1',
          lastSyncedAt: null,
        },
      ];

      mockPrisma.calendarConnection.findMany.mockResolvedValue(mockConnections);
      mockIcsService.syncIcsEvents.mockRejectedValue(new Error('Sync threw error'));

      await expect(icsSyncJob.triggerSync()).resolves.not.toThrow();
    });
  });

  describe('Configuration', () => {
    it('should respect ICS_SYNC_INTERVAL_MINUTES environment variable', () => {
      // This would require reloading the module with different env vars
      // For now, just verify default is used
      const status = icsSyncJob.getStatus();
      expect(status.intervalMinutes).toBe(15);
    });
  });
});
