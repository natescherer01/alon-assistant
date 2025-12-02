"""add_calendar_integration_tables

Revision ID: dad1d16b7176
Revises: 35d74489f769
Create Date: 2025-12-01 20:18:24.400392

This migration adds calendar integration tables to support:
- Google Calendar OAuth connections
- Microsoft Calendar OAuth connections
- ICS calendar subscriptions
- Calendar events storage and sync
- Event attendees and reminders
- Webhook subscriptions for real-time sync
- Audit logging

The calendar tables are designed to work with the existing users table.
Calendar users are linked to main app users via the email field.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'dad1d16b7176'
down_revision: Union[str, None] = '35d74489f769'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add calendar integration tables and enums.

    Tables added:
    - calendar_users: Calendar-specific user data (linked to main users via email)
    - oauth_states: OAuth CSRF protection tokens
    - calendar_connections: OAuth/ICS calendar connections
    - calendar_events: Synced calendar events
    - event_attendees: Event participants
    - event_reminders: Event notifications
    - webhook_subscriptions: Real-time sync webhooks
    - calendar_audit_logs: Calendar-specific audit trail

    Note: All tables use UUID primary keys for security and scalability.
    """

    # ========================================================================
    # CREATE ENUMS
    # ========================================================================
    print("Creating calendar enums...")

    # Calendar provider enum
    calendar_provider = postgresql.ENUM(
        'GOOGLE', 'MICROSOFT', 'APPLE', 'ICS',
        name='calendar_provider',
        create_type=True
    )
    calendar_provider.create(op.get_bind(), checkfirst=True)

    # Event status enum
    event_status = postgresql.ENUM(
        'CONFIRMED', 'TENTATIVE', 'CANCELLED',
        name='event_status',
        create_type=True
    )
    event_status.create(op.get_bind(), checkfirst=True)

    # Sync status enum
    sync_status = postgresql.ENUM(
        'PENDING', 'SYNCED', 'FAILED', 'DELETED',
        name='sync_status',
        create_type=True
    )
    sync_status.create(op.get_bind(), checkfirst=True)

    # Recurrence frequency enum
    recurrence_frequency = postgresql.ENUM(
        'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY',
        name='recurrence_frequency',
        create_type=True
    )
    recurrence_frequency.create(op.get_bind(), checkfirst=True)

    # RSVP status enum
    rsvp_status = postgresql.ENUM(
        'NEEDS_ACTION', 'ACCEPTED', 'DECLINED', 'TENTATIVE',
        name='rsvp_status',
        create_type=True
    )
    rsvp_status.create(op.get_bind(), checkfirst=True)

    # Reminder method enum
    reminder_method = postgresql.ENUM(
        'EMAIL', 'POPUP', 'SMS',
        name='reminder_method',
        create_type=True
    )
    reminder_method.create(op.get_bind(), checkfirst=True)

    # Day of week enum
    day_of_week = postgresql.ENUM(
        'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY',
        'THURSDAY', 'FRIDAY', 'SATURDAY',
        name='day_of_week',
        create_type=True
    )
    day_of_week.create(op.get_bind(), checkfirst=True)

    # Recurrence end type enum
    recurrence_end_type = postgresql.ENUM(
        'NEVER', 'DATE', 'COUNT',
        name='recurrence_end_type',
        create_type=True
    )
    recurrence_end_type.create(op.get_bind(), checkfirst=True)

    # Month day type enum
    month_day_type = postgresql.ENUM(
        'DAY_OF_MONTH', 'RELATIVE_DAY',
        name='month_day_type',
        create_type=True
    )
    month_day_type.create(op.get_bind(), checkfirst=True)

    # Event importance enum
    event_importance = postgresql.ENUM(
        'LOW', 'NORMAL', 'HIGH',
        name='event_importance',
        create_type=True
    )
    event_importance.create(op.get_bind(), checkfirst=True)

    # Audit status enum
    calendar_audit_status = postgresql.ENUM(
        'SUCCESS', 'FAILURE',
        name='calendar_audit_status',
        create_type=True
    )
    calendar_audit_status.create(op.get_bind(), checkfirst=True)

    print("✓ Enums created")

    # ========================================================================
    # CREATE CALENDAR_USERS TABLE
    # ========================================================================
    print("Creating calendar_users table...")

    op.create_table(
        'calendar_users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False, server_default=''),
        sa.Column('first_name', sa.String(100), nullable=True),
        sa.Column('last_name', sa.String(100), nullable=True),
        sa.Column('timezone', sa.String(100), nullable=False, server_default='UTC'),
        sa.Column('sleep_start_time', sa.String(5), nullable=True),
        sa.Column('sleep_end_time', sa.String(5), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
    )

    op.create_index('ix_calendar_users_email', 'calendar_users', ['email'])
    op.create_index('ix_calendar_users_deleted_at', 'calendar_users', ['deleted_at'])

    print("✓ calendar_users table created")

    # ========================================================================
    # CREATE CALENDAR_SESSIONS TABLE
    # ========================================================================
    print("Creating calendar_sessions table...")

    op.create_table(
        'calendar_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('token_hash', sa.String(255), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('user_agent', sa.Text, nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['calendar_users.id'], ondelete='CASCADE'),
    )

    op.create_index('ix_calendar_sessions_user_id', 'calendar_sessions', ['user_id'])
    op.create_index('ix_calendar_sessions_expires_at', 'calendar_sessions', ['expires_at'])
    op.create_index('ix_calendar_sessions_token_hash', 'calendar_sessions', ['token_hash'])

    print("✓ calendar_sessions table created")

    # ========================================================================
    # CREATE OAUTH_STATES TABLE
    # ========================================================================
    print("Creating oauth_states table...")

    op.create_table(
        'oauth_states',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider', postgresql.ENUM('GOOGLE', 'MICROSOFT', 'APPLE', 'ICS',
                  name='calendar_provider', create_type=False), nullable=False),
        sa.Column('state', sa.String(255), unique=True, nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('consumed', sa.Boolean, nullable=False, server_default=sa.text('FALSE')),
        sa.ForeignKeyConstraint(['user_id'], ['calendar_users.id'], ondelete='CASCADE'),
    )

    op.create_index('ix_oauth_states_state', 'oauth_states', ['state'])
    op.create_index('ix_oauth_states_expires_at', 'oauth_states', ['expires_at'])
    op.create_index('ix_oauth_states_user_provider', 'oauth_states', ['user_id', 'provider'])

    print("✓ oauth_states table created")

    # ========================================================================
    # CREATE CALENDAR_CONNECTIONS TABLE
    # ========================================================================
    print("Creating calendar_connections table...")

    op.create_table(
        'calendar_connections',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider', postgresql.ENUM('GOOGLE', 'MICROSOFT', 'APPLE', 'ICS',
                  name='calendar_provider', create_type=False), nullable=False),
        sa.Column('calendar_id', sa.String(255), nullable=False),
        sa.Column('calendar_name', sa.String(255), nullable=False),
        sa.Column('access_token', sa.Text, nullable=True),
        sa.Column('refresh_token', sa.Text, nullable=True),
        sa.Column('token_expires_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('calendar_color', sa.String(7), nullable=True),
        sa.Column('is_primary', sa.Boolean, nullable=False, server_default=sa.text('FALSE')),
        sa.Column('is_connected', sa.Boolean, nullable=False, server_default=sa.text('TRUE')),
        sa.Column('last_synced_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('sync_token', sa.Text, nullable=True),
        sa.Column('delegate_email', sa.String(255), nullable=True),
        sa.Column('ics_etag', sa.String(255), nullable=True),
        sa.Column('ics_last_modified', sa.String(255), nullable=True),
        sa.Column('ics_url', sa.Text, nullable=True),
        sa.Column('is_read_only', sa.Boolean, nullable=False, server_default=sa.text('FALSE')),
        sa.ForeignKeyConstraint(['user_id'], ['calendar_users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'provider', 'calendar_id', name='unique_user_calendar'),
    )

    op.create_index('ix_calendar_connections_user_id', 'calendar_connections', ['user_id'])
    op.create_index('ix_calendar_connections_provider', 'calendar_connections', ['provider'])
    op.create_index('ix_calendar_connections_is_connected', 'calendar_connections', ['is_connected'])
    op.create_index('ix_calendar_connections_last_synced', 'calendar_connections', ['last_synced_at'])
    op.create_index('ix_calendar_connections_deleted_at', 'calendar_connections', ['deleted_at'])
    op.create_index('ix_calendar_connections_delegate', 'calendar_connections', ['delegate_email'])

    print("✓ calendar_connections table created")

    # ========================================================================
    # CREATE WEBHOOK_SUBSCRIPTIONS TABLE
    # ========================================================================
    print("Creating webhook_subscriptions table...")

    op.create_table(
        'webhook_subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('calendar_connection_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider', postgresql.ENUM('GOOGLE', 'MICROSOFT', 'APPLE', 'ICS',
                  name='calendar_provider', create_type=False), nullable=False),
        sa.Column('subscription_id', sa.String(255), nullable=False),
        sa.Column('resource_path', sa.String(500), nullable=False),
        sa.Column('expiration_datetime', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('client_state', sa.String(255), nullable=True),
        sa.Column('notification_url', sa.Text, nullable=False),
        sa.Column('last_notification_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.text('TRUE')),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['calendar_connection_id'], ['calendar_connections.id'],
                               ondelete='CASCADE'),
        sa.UniqueConstraint('subscription_id', 'provider', name='unique_provider_subscription'),
    )

    op.create_index('ix_webhook_subs_connection', 'webhook_subscriptions', ['calendar_connection_id'])
    op.create_index('ix_webhook_subs_sub_id', 'webhook_subscriptions', ['subscription_id'])
    op.create_index('ix_webhook_subs_expiration', 'webhook_subscriptions', ['expiration_datetime'])
    op.create_index('ix_webhook_subs_is_active', 'webhook_subscriptions', ['is_active'])
    op.create_index('ix_webhook_subs_provider', 'webhook_subscriptions', ['provider'])

    print("✓ webhook_subscriptions table created")

    # ========================================================================
    # CREATE CALENDAR_EVENTS TABLE
    # ========================================================================
    print("Creating calendar_events table...")

    op.create_table(
        'calendar_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('calendar_connection_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider_event_id', sa.String(255), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('location', sa.String(500), nullable=True),
        sa.Column('start_time', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('end_time', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('is_all_day', sa.Boolean, nullable=False, server_default=sa.text('FALSE')),
        sa.Column('timezone', sa.String(100), nullable=False, server_default='UTC'),
        sa.Column('status', postgresql.ENUM('CONFIRMED', 'TENTATIVE', 'CANCELLED',
                  name='event_status', create_type=False), nullable=False,
                  server_default='CONFIRMED'),
        sa.Column('sync_status', postgresql.ENUM('PENDING', 'SYNCED', 'FAILED', 'DELETED',
                  name='sync_status', create_type=False), nullable=False,
                  server_default='SYNCED'),
        sa.Column('is_recurring', sa.Boolean, nullable=False, server_default=sa.text('FALSE')),
        sa.Column('recurrence_rule', sa.Text, nullable=True),
        sa.Column('recurrence_frequency', postgresql.ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY',
                  name='recurrence_frequency', create_type=False), nullable=True),
        sa.Column('recurrence_interval', sa.Integer, nullable=True),
        sa.Column('recurrence_end_date', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('recurrence_count', sa.Integer, nullable=True),
        sa.Column('parent_event_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('attendees', postgresql.JSON, nullable=True),
        sa.Column('reminders', postgresql.JSON, nullable=True),
        sa.Column('provider_metadata', postgresql.JSON, nullable=True),
        sa.Column('html_link', sa.Text, nullable=True),
        sa.Column('last_synced_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('importance', postgresql.ENUM('LOW', 'NORMAL', 'HIGH',
                  name='event_importance', create_type=False), nullable=True,
                  server_default='NORMAL'),
        sa.Column('outlook_categories', sa.Text, nullable=True),
        sa.Column('conversation_id', sa.String(255), nullable=True),
        sa.Column('series_master_id', sa.String(255), nullable=True),
        sa.Column('teams_enabled', sa.Boolean, nullable=False, server_default=sa.text('FALSE')),
        sa.Column('teams_meeting_url', sa.Text, nullable=True),
        sa.Column('teams_conference_id', sa.String(255), nullable=True),
        sa.Column('teams_dial_in_url', sa.Text, nullable=True),
        sa.Column('recurrence_end_type', postgresql.ENUM('NEVER', 'DATE', 'COUNT',
                  name='recurrence_end_type', create_type=False), nullable=True),
        sa.Column('recurrence_by_day', sa.String(100), nullable=True),
        sa.Column('month_day_type', postgresql.ENUM('DAY_OF_MONTH', 'RELATIVE_DAY',
                  name='month_day_type', create_type=False), nullable=True),
        sa.Column('recurrence_by_month_day', sa.Integer, nullable=True),
        sa.Column('recurrence_by_set_pos', sa.Integer, nullable=True),
        sa.Column('recurrence_by_day_of_week', postgresql.ENUM(
                  'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY',
                  'THURSDAY', 'FRIDAY', 'SATURDAY',
                  name='day_of_week', create_type=False), nullable=True),
        sa.Column('recurrence_by_month', sa.String(50), nullable=True),
        sa.Column('exception_dates', sa.Text, nullable=True),
        sa.ForeignKeyConstraint(['calendar_connection_id'], ['calendar_connections.id'],
                               ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_event_id'], ['calendar_events.id'],
                               ondelete='CASCADE'),
        sa.UniqueConstraint('calendar_connection_id', 'provider_event_id',
                           name='unique_calendar_provider_event'),
    )

    # Create comprehensive indexes for calendar_events
    op.create_index('ix_cal_events_connection', 'calendar_events', ['calendar_connection_id'])
    op.create_index('ix_cal_events_provider_id', 'calendar_events', ['provider_event_id'])
    op.create_index('ix_cal_events_start_time', 'calendar_events', ['start_time'])
    op.create_index('ix_cal_events_end_time', 'calendar_events', ['end_time'])
    op.create_index('ix_cal_events_status', 'calendar_events', ['status'])
    op.create_index('ix_cal_events_sync_status', 'calendar_events', ['sync_status'])
    op.create_index('ix_cal_events_is_recurring', 'calendar_events', ['is_recurring'])
    op.create_index('ix_cal_events_parent', 'calendar_events', ['parent_event_id'])
    op.create_index('ix_cal_events_deleted_at', 'calendar_events', ['deleted_at'])
    op.create_index('ix_cal_events_recurrence_freq', 'calendar_events', ['recurrence_frequency'])
    op.create_index('ix_cal_events_recurrence_end', 'calendar_events', ['recurrence_end_date'])
    op.create_index('ix_cal_events_importance', 'calendar_events', ['importance'])
    op.create_index('ix_cal_events_conversation', 'calendar_events', ['conversation_id'])
    op.create_index('ix_cal_events_series_master', 'calendar_events', ['series_master_id'])
    op.create_index('ix_cal_events_teams', 'calendar_events', ['teams_enabled'])
    op.create_index('ix_cal_events_connection_time', 'calendar_events',
                   ['calendar_connection_id', 'start_time', 'end_time'])
    op.create_index('ix_cal_events_connection_sync', 'calendar_events',
                   ['calendar_connection_id', 'sync_status'])

    print("✓ calendar_events table created")

    # ========================================================================
    # CREATE EVENT_ATTENDEES TABLE
    # ========================================================================
    print("Creating event_attendees table...")

    op.create_table(
        'event_attendees',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('display_name', sa.String(255), nullable=True),
        sa.Column('rsvp_status', postgresql.ENUM('NEEDS_ACTION', 'ACCEPTED', 'DECLINED', 'TENTATIVE',
                  name='rsvp_status', create_type=False), nullable=False,
                  server_default='NEEDS_ACTION'),
        sa.Column('is_organizer', sa.Boolean, nullable=False, server_default=sa.text('FALSE')),
        sa.Column('is_optional', sa.Boolean, nullable=False, server_default=sa.text('FALSE')),
        sa.Column('comment', sa.Text, nullable=True),
        sa.Column('response_time', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['event_id'], ['calendar_events.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('event_id', 'email', name='unique_event_attendee'),
    )

    op.create_index('ix_event_attendees_event', 'event_attendees', ['event_id'])
    op.create_index('ix_event_attendees_email', 'event_attendees', ['email'])
    op.create_index('ix_event_attendees_rsvp', 'event_attendees', ['rsvp_status'])
    op.create_index('ix_event_attendees_organizer', 'event_attendees', ['is_organizer'])
    op.create_index('ix_event_attendees_event_rsvp', 'event_attendees', ['event_id', 'rsvp_status'])

    print("✓ event_attendees table created")

    # ========================================================================
    # CREATE EVENT_REMINDERS TABLE
    # ========================================================================
    print("Creating event_reminders table...")

    op.create_table(
        'event_reminders',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('method', postgresql.ENUM('EMAIL', 'POPUP', 'SMS',
                  name='reminder_method', create_type=False), nullable=False,
                  server_default='POPUP'),
        sa.Column('minutes_before', sa.Integer, nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['event_id'], ['calendar_events.id'], ondelete='CASCADE'),
    )

    op.create_index('ix_event_reminders_event', 'event_reminders', ['event_id'])
    op.create_index('ix_event_reminders_minutes', 'event_reminders', ['minutes_before'])
    op.create_index('ix_event_reminders_event_minutes', 'event_reminders',
                   ['event_id', 'minutes_before'])

    print("✓ event_reminders table created")

    # ========================================================================
    # CREATE CALENDAR_AUDIT_LOGS TABLE
    # ========================================================================
    print("Creating calendar_audit_logs table...")

    op.create_table(
        'calendar_audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('resource_type', sa.String(50), nullable=True),
        sa.Column('resource_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('status', postgresql.ENUM('SUCCESS', 'FAILURE',
                  name='calendar_audit_status', create_type=False), nullable=False),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.Text, nullable=True),
        sa.Column('metadata', postgresql.JSON, nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['user_id'], ['calendar_users.id']),
    )

    op.create_index('ix_cal_audit_user', 'calendar_audit_logs', ['user_id'])
    op.create_index('ix_cal_audit_action', 'calendar_audit_logs', ['action'])
    op.create_index('ix_cal_audit_created', 'calendar_audit_logs', ['created_at'])
    op.create_index('ix_cal_audit_status', 'calendar_audit_logs', ['status'])
    op.create_index('ix_cal_audit_resource', 'calendar_audit_logs', ['resource_type', 'resource_id'])

    print("✓ calendar_audit_logs table created")

    print("\n✅ Calendar integration tables migration complete!")
    print("\nTables created:")
    print("  - calendar_users (linked to main users via email)")
    print("  - calendar_sessions")
    print("  - oauth_states")
    print("  - calendar_connections")
    print("  - webhook_subscriptions")
    print("  - calendar_events")
    print("  - event_attendees")
    print("  - event_reminders")
    print("  - calendar_audit_logs")


def downgrade() -> None:
    """
    Remove all calendar integration tables and enums.

    WARNING: This will delete all calendar data!
    Ensure you have backups before running this downgrade.
    """
    print("⚠️  WARNING: Downgrading will delete all calendar data!")
    print("Rolling back calendar integration tables...")

    # Drop tables in reverse order (respecting foreign key constraints)
    print("Dropping calendar_audit_logs...")
    op.drop_table('calendar_audit_logs')

    print("Dropping event_reminders...")
    op.drop_table('event_reminders')

    print("Dropping event_attendees...")
    op.drop_table('event_attendees')

    print("Dropping calendar_events...")
    op.drop_table('calendar_events')

    print("Dropping webhook_subscriptions...")
    op.drop_table('webhook_subscriptions')

    print("Dropping calendar_connections...")
    op.drop_table('calendar_connections')

    print("Dropping oauth_states...")
    op.drop_table('oauth_states')

    print("Dropping calendar_sessions...")
    op.drop_table('calendar_sessions')

    print("Dropping calendar_users...")
    op.drop_table('calendar_users')

    # Drop enums
    print("Dropping enums...")

    op.execute('DROP TYPE IF EXISTS calendar_audit_status CASCADE')
    op.execute('DROP TYPE IF EXISTS event_importance CASCADE')
    op.execute('DROP TYPE IF EXISTS month_day_type CASCADE')
    op.execute('DROP TYPE IF EXISTS recurrence_end_type CASCADE')
    op.execute('DROP TYPE IF EXISTS day_of_week CASCADE')
    op.execute('DROP TYPE IF EXISTS reminder_method CASCADE')
    op.execute('DROP TYPE IF EXISTS rsvp_status CASCADE')
    op.execute('DROP TYPE IF EXISTS recurrence_frequency CASCADE')
    op.execute('DROP TYPE IF EXISTS sync_status CASCADE')
    op.execute('DROP TYPE IF EXISTS event_status CASCADE')
    op.execute('DROP TYPE IF EXISTS calendar_provider CASCADE')

    print("✓ Rollback complete - calendar tables removed")
