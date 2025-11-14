"""Add performance indexes

Revision ID: 001
Revises:
Create Date: 2025-01-13

Implements Critical Issue #4 - Database index optimization

Indexes added:
1. ix_conversations_user_created - For listing conversations by creation time
2. ix_conversations_user_updated - For sorting by recent activity
3. ix_conversations_user_active - Partial index for active conversations only
4. ix_messages_conversation_covering - Covering index with included columns

These indexes eliminate full table scans and enable efficient queries.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """
    Add optimized indexes for performance
    """

    # Create conversations table
    op.create_table(
        'conversations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('archived', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create messages table
    op.create_table(
        'messages',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('conversation_id', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Index 1: For listing conversations by user (basic filter)
    op.create_index(
        'ix_conversations_user_id',
        'conversations',
        ['user_id'],
        unique=False
    )

    # Index 2: Composite index for listing conversations by creation time (Critical Issue #4)
    # This enables efficient queries like: SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC
    op.create_index(
        'ix_conversations_user_created',
        'conversations',
        ['user_id', sa.text('created_at DESC')],
        unique=False,
        postgresql_using='btree'
    )

    # Index 3: Composite index for sorting by recent activity (Critical Issue #4)
    # This enables efficient queries like: SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC
    op.create_index(
        'ix_conversations_user_updated',
        'conversations',
        ['user_id', sa.text('updated_at DESC')],
        unique=False,
        postgresql_using='btree'
    )

    # Index 4: Partial index for active conversations only (High Priority Issue #8)
    # This is much smaller and faster for the common case of listing non-archived conversations
    # PostgreSQL only - conditional indexes
    op.execute("""
        CREATE INDEX ix_conversations_user_active
        ON conversations (user_id, updated_at DESC)
        WHERE archived = false
    """)

    # Index 5: Basic index on conversation_id for messages
    op.create_index(
        'ix_messages_conversation_id',
        'messages',
        ['conversation_id'],
        unique=False
    )

    # Index 6: Covering index for messages (High Priority Issue #8)
    # Includes frequently queried columns to avoid table lookups
    # PostgreSQL INCLUDE syntax for covering indexes
    op.execute("""
        CREATE INDEX ix_messages_conversation_covering
        ON messages (conversation_id, created_at)
        INCLUDE (content, role)
    """)

    # Index 7: Index on created_at for time-based queries
    op.create_index(
        'ix_messages_created_at',
        'messages',
        ['created_at'],
        unique=False
    )


def downgrade():
    """
    Remove all indexes and tables
    """
    # Drop indexes
    op.drop_index('ix_messages_created_at', table_name='messages')
    op.execute('DROP INDEX IF EXISTS ix_messages_conversation_covering')
    op.drop_index('ix_messages_conversation_id', table_name='messages')
    op.execute('DROP INDEX IF EXISTS ix_conversations_user_active')
    op.drop_index('ix_conversations_user_updated', table_name='conversations')
    op.drop_index('ix_conversations_user_created', table_name='conversations')
    op.drop_index('ix_conversations_user_id', table_name='conversations')

    # Drop tables
    op.drop_table('messages')
    op.drop_table('conversations')
