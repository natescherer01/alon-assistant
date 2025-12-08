"""
Recurrence expansion utility for calendar events.

Handles expanding recurring events based on RRULE strings into individual
event instances within a given date range.
"""
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from dateutil.rrule import rrulestr
from dateutil.parser import parse as parse_date

logger = logging.getLogger(__name__)


def expand_recurring_event(
    event: Any,
    range_start: datetime,
    range_end: datetime,
    max_instances: int = 100,
) -> List[Dict[str, Any]]:
    """
    Expand a recurring event into individual instances within a date range.

    Args:
        event: The CalendarEvent model instance
        range_start: Start of the date range to expand into
        range_end: End of the date range to expand into
        max_instances: Maximum number of instances to generate (safety limit)

    Returns:
        List of event dictionaries representing individual instances
    """
    if not event.is_recurring or not event.recurrence_rule:
        return []

    instances = []

    try:
        # Calculate event duration
        duration = event.end_time - event.start_time

        # Parse the RRULE string
        # The rrulestr needs a DTSTART to work correctly
        rrule_str = event.recurrence_rule

        # Create the rrule object with the event's start time as DTSTART
        try:
            rule = rrulestr(rrule_str, dtstart=event.start_time)
        except Exception as e:
            logger.warning(f"Failed to parse RRULE '{rrule_str}': {e}")
            return []

        # Get occurrences within the range
        # We need to include slightly before range_start in case an event
        # starts before but ends within the range
        search_start = range_start - duration

        occurrences = list(rule.between(
            search_start,
            range_end,
            inc=True,
        ))[:max_instances]

        # Parse exception dates if present
        exception_dates = set()
        if event.exception_dates:
            try:
                if isinstance(event.exception_dates, str):
                    # Could be comma-separated or JSON
                    import json
                    try:
                        exdates = json.loads(event.exception_dates)
                    except json.JSONDecodeError:
                        exdates = event.exception_dates.split(',')
                else:
                    exdates = event.exception_dates

                for exdate in exdates:
                    if isinstance(exdate, str):
                        dt = parse_date(exdate.strip())
                        exception_dates.add(dt.date())
            except Exception as e:
                logger.warning(f"Failed to parse exception dates: {e}")

        for occurrence_start in occurrences:
            # Skip exception dates
            if occurrence_start.date() in exception_dates:
                continue

            occurrence_end = occurrence_start + duration

            # Only include if the occurrence overlaps with our range
            if occurrence_end < range_start or occurrence_start > range_end:
                continue

            # Create instance ID (original_id + underscore + date)
            instance_id = f"{event.id}_{occurrence_start.isoformat()}"

            instances.append({
                'id': instance_id,
                'original_event_id': str(event.id),
                'title': event.title,
                'description': event.description,
                'location': event.location,
                'start_time': occurrence_start,
                'end_time': occurrence_end,
                'is_all_day': event.is_all_day,
                'timezone': event.timezone,
                'status': event.status,
                'is_recurring': True,
                'recurrence_rule': event.recurrence_rule,
                'attendees': event.attendees,
                'reminders': event.reminders,
                'html_link': event.html_link,
                'calendar_connection_id': event.calendar_connection_id,
                'calendar_connection': event.calendar_connection,
            })

        logger.debug(
            f"Expanded recurring event '{event.title}' into {len(instances)} "
            f"instances between {range_start} and {range_end}"
        )

    except Exception as e:
        logger.error(f"Error expanding recurring event {event.id}: {e}")
        return []

    return instances


def get_events_with_recurrence_expansion(
    events: List[Any],
    range_start: datetime,
    range_end: datetime,
) -> List[Dict[str, Any]]:
    """
    Process a list of events, expanding recurring ones into instances.

    Non-recurring events within the range are passed through.
    Recurring events are expanded into their instances within the range.

    Args:
        events: List of CalendarEvent model instances
        range_start: Start of the date range
        range_end: End of the date range

    Returns:
        List of event dictionaries (mix of regular and expanded events)
    """
    result = []

    for event in events:
        if event.is_recurring and event.recurrence_rule:
            # Expand recurring event
            instances = expand_recurring_event(event, range_start, range_end)
            result.extend(instances)
        else:
            # Non-recurring event - include if within range
            if event.start_time <= range_end and event.end_time >= range_start:
                result.append({
                    'id': str(event.id),
                    'original_event_id': str(event.id),
                    'title': event.title,
                    'description': event.description,
                    'location': event.location,
                    'start_time': event.start_time,
                    'end_time': event.end_time,
                    'is_all_day': event.is_all_day,
                    'timezone': event.timezone,
                    'status': event.status,
                    'is_recurring': False,
                    'recurrence_rule': None,
                    'attendees': event.attendees,
                    'reminders': event.reminders,
                    'html_link': event.html_link,
                    'calendar_connection_id': event.calendar_connection_id,
                    'calendar_connection': event.calendar_connection,
                })

    # Sort by start time
    result.sort(key=lambda e: e['start_time'])

    return result
