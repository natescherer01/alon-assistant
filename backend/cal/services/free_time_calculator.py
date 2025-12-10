"""
Calculate mutual free time slots across multiple users.

This module provides algorithms for finding available meeting times
when multiple users' calendars are considered.
"""
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)


class FreeTimeCalculator:
    """Calculator for finding mutual free time across multiple users' calendars."""

    def __init__(
        self,
        excluded_hours: Tuple[int, int] = (0, 6),
        min_slot_minutes: int = 30
    ):
        """
        Initialize calculator with constraints.

        Args:
            excluded_hours: Tuple of (start_hour, end_hour) to exclude
                           (e.g., 0-6 for midnight-6am)
            min_slot_minutes: Minimum duration for a free slot to be valid
        """
        self.excluded_start = excluded_hours[0]
        self.excluded_end = excluded_hours[1]
        self.min_slot_minutes = min_slot_minutes

    def find_free_slots(
        self,
        busy_blocks: List[Dict[str, Any]],
        start_date: datetime,
        end_date: datetime,
        timezone: str = "UTC"
    ) -> List[Dict[str, Any]]:
        """
        Find mutual free time slots.

        Algorithm:
        1. Merge all busy blocks (any user busy = blocked)
        2. Find gaps in the merged busy periods
        3. Filter out excluded hours (midnight-6am)
        4. Filter by minimum slot duration

        Args:
            busy_blocks: List of busy block dicts with start_time, end_time
            start_date: Start of search range
            end_date: End of search range
            timezone: Timezone for calculations

        Returns:
            List of free slot dicts with start_time, end_time, duration_minutes
        """
        logger.info(
            f"Finding free slots from {start_date} to {end_date} "
            f"with {len(busy_blocks)} busy blocks"
        )

        if not busy_blocks:
            # No busy blocks = entire range is free (minus excluded hours)
            return self._generate_free_slots_for_range(start_date, end_date)

        # Step 1: Merge overlapping busy blocks
        merged = self._merge_busy_blocks(busy_blocks)

        # Step 2: Find gaps between busy blocks
        free_slots = []
        current = start_date

        for busy in merged:
            busy_start = busy["start_time"]
            busy_end = busy["end_time"]

            # If there's a gap before this busy block
            if current < busy_start:
                gap_slots = self._extract_valid_slots(current, busy_start)
                free_slots.extend(gap_slots)

            # Move current pointer past this busy block
            current = max(current, busy_end)

        # Check for free time after last busy block
        if current < end_date:
            gap_slots = self._extract_valid_slots(current, end_date)
            free_slots.extend(gap_slots)

        logger.info(f"Found {len(free_slots)} free slots")
        return free_slots

    def _merge_busy_blocks(self, busy_blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Merge overlapping busy periods.

        Args:
            busy_blocks: List of busy block dicts

        Returns:
            List of merged busy blocks (sorted by start time)
        """
        if not busy_blocks:
            return []

        # Sort by start time
        sorted_blocks = sorted(busy_blocks, key=lambda x: x["start_time"])

        merged = [sorted_blocks[0].copy()]

        for current in sorted_blocks[1:]:
            last = merged[-1]

            # If overlapping or adjacent, merge
            if current["start_time"] <= last["end_time"]:
                last["end_time"] = max(last["end_time"], current["end_time"])
            else:
                merged.append(current.copy())

        return merged

    def _extract_valid_slots(
        self,
        start: datetime,
        end: datetime
    ) -> List[Dict[str, Any]]:
        """
        Extract free slots from a time range, excluding blocked hours.

        Args:
            start: Start of range
            end: End of range

        Returns:
            List of valid free slot dicts
        """
        slots = []
        current = start

        # Process day by day to handle excluded hours correctly
        while current < end:
            # Skip if in excluded hours
            if self._is_excluded_hour(current):
                current = self._next_valid_hour(current)
                continue

            # Find end of valid period
            day_end = self._end_of_valid_period(current)
            slot_end = min(end, day_end)

            # Skip if slot_end is before current (shouldn't happen, but safety check)
            if slot_end <= current:
                current = self._next_valid_hour(current)
                continue

            duration = int((slot_end - current).total_seconds() / 60)

            if duration >= self.min_slot_minutes:
                slots.append({
                    "start_time": current,
                    "end_time": slot_end,
                    "duration_minutes": duration
                })

            # Move to next period
            current = slot_end

        return slots

    def _is_excluded_hour(self, dt: datetime) -> bool:
        """
        Check if datetime is in excluded hours (e.g., midnight-6am).

        Args:
            dt: Datetime to check

        Returns:
            True if in excluded hours
        """
        hour = dt.hour
        if self.excluded_start < self.excluded_end:
            # Normal range (e.g., 0-6)
            return self.excluded_start <= hour < self.excluded_end
        else:
            # Wraps around midnight (e.g., 22-6)
            return hour >= self.excluded_start or hour < self.excluded_end

    def _next_valid_hour(self, dt: datetime) -> datetime:
        """
        Get next datetime after excluded hours.

        Args:
            dt: Current datetime in excluded hours

        Returns:
            Next valid datetime
        """
        # Move to the end of excluded hours
        next_dt = dt.replace(
            hour=self.excluded_end,
            minute=0,
            second=0,
            microsecond=0
        )

        # If we're past that time, move to next day
        if next_dt <= dt:
            next_dt += timedelta(days=1)

        return next_dt

    def _end_of_valid_period(self, dt: datetime) -> datetime:
        """
        Get end of current valid period (before next excluded hours).

        Args:
            dt: Current datetime

        Returns:
            End of valid period
        """
        if self.excluded_start == 0:
            # Excluded hours start at midnight = valid until end of day
            return (dt + timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )

        # Valid until excluded_start hour
        end = dt.replace(
            hour=self.excluded_start,
            minute=0,
            second=0,
            microsecond=0
        )

        # If we're past that time, move to next day
        if end <= dt:
            end += timedelta(days=1)

        return end

    def _generate_free_slots_for_range(
        self,
        start: datetime,
        end: datetime
    ) -> List[Dict[str, Any]]:
        """
        Generate free slots for entire range (when no busy blocks).

        Args:
            start: Start of range
            end: End of range

        Returns:
            List of free slot dicts
        """
        return self._extract_valid_slots(start, end)
