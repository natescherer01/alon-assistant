"""add_study_sessions_and_active_recall_tables

Revision ID: 0a61bbb1cba0
Revises: 4a80191f29d3
Create Date: 2025-11-12 23:39:29.471643

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0a61bbb1cba0'
down_revision: Union[str, None] = '4a80191f29d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create study_sessions table
    op.create_table(
        'study_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=True),
        sa.Column('subject', sa.String(), nullable=False),
        sa.Column('session_type', sa.String(), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('review_number', sa.Integer(), nullable=True),
        sa.Column('next_review_date', sa.DateTime(), nullable=True),
        sa.Column('confidence_level', sa.Integer(), nullable=True),
        sa.Column('questions_attempted', sa.Integer(), nullable=True),
        sa.Column('questions_correct', sa.Integer(), nullable=True),
        sa.Column('used_active_recall', sa.Integer(), nullable=True),
        sa.Column('used_interleaving', sa.Integer(), nullable=True),
        sa.Column('slept_after_session', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_study_sessions_created_at'), 'study_sessions', ['created_at'], unique=False)
    op.create_index(op.f('ix_study_sessions_id'), 'study_sessions', ['id'], unique=False)
    op.create_index(op.f('ix_study_sessions_user_id'), 'study_sessions', ['user_id'], unique=False)

    # Create active_recall_questions table
    op.create_table(
        'active_recall_questions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('study_session_id', sa.Integer(), nullable=True),
        sa.Column('task_id', sa.Integer(), nullable=True),
        sa.Column('subject', sa.String(), nullable=False),
        sa.Column('question_type', sa.String(), nullable=True),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('suggested_answer', sa.Text(), nullable=True),
        sa.Column('user_answer', sa.Text(), nullable=True),
        sa.Column('was_correct', sa.Integer(), nullable=True),
        sa.Column('difficulty_rating', sa.Integer(), nullable=True),
        sa.Column('times_reviewed', sa.Integer(), nullable=True),
        sa.Column('last_reviewed', sa.DateTime(), nullable=True),
        sa.Column('next_review', sa.DateTime(), nullable=True),
        sa.Column('easiness_factor', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['study_session_id'], ['study_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_active_recall_questions_id'), 'active_recall_questions', ['id'], unique=False)
    op.create_index(op.f('ix_active_recall_questions_user_id'), 'active_recall_questions', ['user_id'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index(op.f('ix_active_recall_questions_user_id'), table_name='active_recall_questions')
    op.drop_index(op.f('ix_active_recall_questions_id'), table_name='active_recall_questions')
    op.drop_table('active_recall_questions')

    op.drop_index(op.f('ix_study_sessions_user_id'), table_name='study_sessions')
    op.drop_index(op.f('ix_study_sessions_id'), table_name='study_sessions')
    op.drop_index(op.f('ix_study_sessions_created_at'), table_name='study_sessions')
    op.drop_table('study_sessions')
