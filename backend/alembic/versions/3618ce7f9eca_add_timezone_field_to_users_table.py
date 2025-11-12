"""Add timezone field to users table

Revision ID: 3618ce7f9eca
Revises: 36bf9a51e39e
Create Date: 2025-11-11 22:35:58.938511

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3618ce7f9eca'
down_revision: Union[str, None] = '36bf9a51e39e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add timezone column to users table with default value 'UTC'
    op.add_column('users', sa.Column('timezone', sa.String(), server_default='UTC', nullable=True))


def downgrade() -> None:
    # Remove timezone column from users table
    op.drop_column('users', 'timezone')
