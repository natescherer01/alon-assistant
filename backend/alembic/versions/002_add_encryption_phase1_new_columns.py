"""
Add encrypted columns - Phase 1 (Blue-Green Migration)

Revision ID: 002_encryption_phase1
Revises: 001_add_performance_indexes
Create Date: 2025-11-13 13:00:00.000000

This is Phase 1 of the encryption migration strategy.
Adds new encrypted columns alongside existing plaintext columns.

Migration Strategy (Blue-Green):
- Phase 1: Add encrypted columns (nullable, this migration)
- Phase 2: Migrate data (encrypt existing plaintext → encrypted columns)
- Phase 3: Switch columns (drop plaintext, rename encrypted → original names)

This allows zero-downtime migration and easy rollback at any stage.

Security Note:
    Requires ENCRYPTION_KEY to be set in environment/secrets manager.
    Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""
from alembic import op
import sqlalchemy as sa


# Revision identifiers
revision = '002_encryption_phase1'
down_revision = '001_add_performance_indexes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add encrypted columns to users, tasks, and chat_history tables.

    Columns added:
    - users: email_encrypted, full_name_encrypted, email_hash
    - tasks: title_encrypted, description_encrypted
    - chat_history: message_encrypted, response_encrypted

    All encrypted columns are nullable initially to allow gradual migration.
    """

    # ========================================================================
    # USERS TABLE - Add encrypted email and full_name
    # ========================================================================
    print("Adding encrypted columns to users table...")

    # Encrypted email (was VARCHAR, now larger for encryption overhead)
    # Original: VARCHAR (unlimited in SQLite)
    # Encrypted: VARCHAR(433) = ceil(255 * 1.5 + 50)
    op.add_column('users',
        sa.Column('email_encrypted', sa.String(433), nullable=True))

    # Encrypted full_name
    op.add_column('users',
        sa.Column('full_name_encrypted', sa.String(433), nullable=True))

    # Searchable email hash (SHA-256) for efficient lookups
    # Allows finding users by email without decryption
    op.add_column('users',
        sa.Column('email_hash', sa.String(64), nullable=True))

    # Add index on email_hash (will be unique after data migration)
    # Note: Using unique=False initially to avoid conflicts during migration
    op.create_index('ix_users_email_hash', 'users', ['email_hash'], unique=False)

    print("✓ Users table updated")

    # ========================================================================
    # TASKS TABLE - Add encrypted title and description
    # ========================================================================
    print("Adding encrypted columns to tasks table...")

    # Encrypted title
    # Original: VARCHAR (unlimited)
    # Encrypted: VARCHAR(800) = ceil(500 * 1.5 + 50)
    op.add_column('tasks',
        sa.Column('title_encrypted', sa.String(800), nullable=True))

    # Encrypted description (TEXT field, no length limit)
    # Fernet handles variable-length data automatically
    op.add_column('tasks',
        sa.Column('description_encrypted', sa.Text, nullable=True))

    print("✓ Tasks table updated")

    # ========================================================================
    # CHAT_HISTORY TABLE - Add encrypted message and response
    # ========================================================================
    print("Adding encrypted columns to chat_history table...")

    # Encrypted user message (TEXT)
    op.add_column('chat_history',
        sa.Column('message_encrypted', sa.Text, nullable=True))

    # Encrypted Claude response (TEXT)
    op.add_column('chat_history',
        sa.Column('response_encrypted', sa.Text, nullable=True))

    print("✓ Chat history table updated")

    print("\nPhase 1 complete! Encrypted columns added.")
    print("\nNext steps:")
    print("1. Run data migration script: python scripts/encrypt_existing_data.py")
    print("2. Verify all data encrypted: Check email_encrypted, etc. are populated")
    print("3. Run Phase 2 migration: alembic upgrade head (when Phase 2 ready)")


def downgrade() -> None:
    """
    Remove encrypted columns (rollback Phase 1).

    This is safe to run because encrypted columns are not yet being used
    by the application (plaintext columns still exist and are in use).

    Data loss: None (only removes empty encrypted columns)
    """

    print("Rolling back Phase 1 - removing encrypted columns...")

    # Drop users encrypted columns
    op.drop_index('ix_users_email_hash', table_name='users')
    op.drop_column('users', 'email_hash')
    op.drop_column('users', 'email_encrypted')
    op.drop_column('users', 'full_name_encrypted')

    # Drop tasks encrypted columns
    op.drop_column('tasks', 'title_encrypted')
    op.drop_column('tasks', 'description_encrypted')

    # Drop chat_history encrypted columns
    op.drop_column('chat_history', 'message_encrypted')
    op.drop_column('chat_history', 'response_encrypted')

    print("✓ Rollback complete - encrypted columns removed")
