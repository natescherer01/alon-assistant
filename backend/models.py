"""
SQLAlchemy database models
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Date, CheckConstraint
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    """User account model - SaaS model where company provides API access"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    tasks = relationship("Task", back_populates="owner", cascade="all, delete-orphan")
    chat_history = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")


class Task(Base):
    """Task model - migrated from JSON structure"""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Task details
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    deadline = Column(Date, nullable=True)
    intensity = Column(Integer, default=3)
    status = Column(String, default="not_started")
    project = Column(String, nullable=True)

    # Dependencies and waiting
    dependencies = Column(JSON, default=list)  # List of task IDs or descriptions
    waiting_on = Column(String, nullable=True)

    # Recurring task fields
    is_recurring = Column(Integer, default=0)  # SQLite uses 0/1 for boolean
    recurrence_type = Column(String, nullable=True)  # 'daily', 'weekly', 'monthly', 'yearly'
    recurrence_interval = Column(Integer, default=1)  # Every X days/weeks/months
    recurrence_end_date = Column(Date, nullable=True)  # Optional end date for recurrence

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)

    # Constraints
    __table_args__ = (
        CheckConstraint('intensity >= 1 AND intensity <= 5', name='check_intensity'),
        CheckConstraint("status IN ('not_started', 'in_progress', 'waiting_on', 'completed', 'deleted')", name='check_status'),
    )

    # Relationships
    owner = relationship("User", back_populates="tasks")


class ChatMessage(Base):
    """Chat history model for Claude conversations"""
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Message content
    message = Column(Text, nullable=False)  # User's message
    response = Column(Text, nullable=False)  # Claude's response

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)  # Indexed for efficient cleanup queries

    # Relationships
    user = relationship("User", back_populates="chat_history")
