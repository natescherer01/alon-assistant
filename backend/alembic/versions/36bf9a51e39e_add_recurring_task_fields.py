"""add_recurring_task_fields

Revision ID: 36bf9a51e39e
Revises: 220103bd8c49
Create Date: 2025-11-11 01:41:25.360831

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '36bf9a51e39e'
down_revision: Union[str, None] = '220103bd8c49'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add recurring task fields
    op.add_column('tasks', sa.Column('is_recurring', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('tasks', sa.Column('recurrence_type', sa.String(), nullable=True))
    op.add_column('tasks', sa.Column('recurrence_interval', sa.Integer(), nullable=True, server_default='1'))
    op.add_column('tasks', sa.Column('recurrence_end_date', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Remove recurring task fields
    op.drop_column('tasks', 'recurrence_end_date')
    op.drop_column('tasks', 'recurrence_interval')
    op.drop_column('tasks', 'recurrence_type')
    op.drop_column('tasks', 'is_recurring')
