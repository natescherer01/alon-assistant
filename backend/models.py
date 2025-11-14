"""
SQLAlchemy database models with field-level encryption
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Date, CheckConstraint
from sqlalchemy.orm import relationship
from database import Base
from app.db.types import EncryptedString, EncryptedText


class User(Base):
    """User account model - SaaS model where company provides API access"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column('email_encrypted', EncryptedString(255), nullable=False)  # Maps to email_encrypted column
    email_hash = Column(String(64), unique=True, index=True, nullable=True)  # SHA-256 hash for searchable lookups
    password_hash = Column(String, nullable=False)  # Already hashed with bcrypt, not encrypted
    full_name = Column('full_name_encrypted', EncryptedString(255))  # Maps to full_name_encrypted column
    timezone = Column(String, default="UTC")  # User's timezone for date/time display
    created_at = Column(DateTime, default=datetime.utcnow)

    # Account security - lockout mechanism
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    last_failed_login = Column(DateTime, nullable=True)
    last_successful_login = Column(DateTime, nullable=True)

    # Relationships
    tasks = relationship("Task", back_populates="owner", cascade="all, delete-orphan")
    chat_history = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")

    def set_email(self, email: str):
        """
        Set email and generate searchable hash.

        Args:
            email: User's email address

        Note:
            Always use this method instead of directly assigning to self.email
            to ensure email_hash is updated for searchable lookups.
        """
        from app.core.encryption import get_encryption_service
        self.email = email
        service = get_encryption_service()
        self.email_hash = service.generate_searchable_hash(email)


class Task(Base):
    """Task model - migrated from JSON structure"""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Task details (encrypted for privacy)
    title = Column('title_encrypted', EncryptedString(500), nullable=False)  # Maps to title_encrypted column
    description = Column('description_encrypted', EncryptedText, default="")  # Maps to description_encrypted column
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

    # Message content (encrypted for privacy)
    message = Column('message_encrypted', EncryptedText, nullable=False)  # User's message - maps to message_encrypted column
    response = Column('response_encrypted', EncryptedText, nullable=False)  # Claude's response - maps to response_encrypted column

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)  # Indexed for efficient cleanup queries

    # Relationships
    user = relationship("User", back_populates="chat_history")


class StudySession(Base):
    """Study session tracking for spaced repetition and memory optimization"""
    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True)

    # Session details
    subject = Column(String, nullable=False)  # Subject/topic being studied
    session_type = Column(String, default="initial")  # initial, review, practice_test, final_review
    duration_minutes = Column(Integer, nullable=True)  # How long the session lasted

    # Spaced repetition tracking
    review_number = Column(Integer, default=0)  # 0=initial, 1=first review, 2=second review, etc.
    next_review_date = Column(DateTime, nullable=True)  # When next review should happen

    # Performance tracking
    confidence_level = Column(Integer, nullable=True)  # 1-5 scale: how well did they know it
    questions_attempted = Column(Integer, default=0)
    questions_correct = Column(Integer, default=0)

    # Memory optimization flags
    used_active_recall = Column(Integer, default=0)  # Boolean: Did they use active recall?
    used_interleaving = Column(Integer, default=0)  # Boolean: Did they interleave topics?
    slept_after_session = Column(Integer, default=0)  # Boolean: Did they sleep after studying?

    # Notes
    notes = Column(Text, default="")

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    owner = relationship("User", backref="study_sessions")
    task = relationship("Task", backref="study_sessions")


class ActiveRecallQuestion(Base):
    """Active recall questions generated for study materials"""
    __tablename__ = "active_recall_questions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    study_session_id = Column(Integer, ForeignKey("study_sessions.id", ondelete="CASCADE"), nullable=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True)

    # Question details
    subject = Column(String, nullable=False)
    question_type = Column(String, default="recall")  # recall, comprehension, application, analysis
    question_text = Column(Text, nullable=False)
    suggested_answer = Column(Text, nullable=True)  # Optional: What the answer should cover

    # User's response tracking
    user_answer = Column(Text, nullable=True)
    was_correct = Column(Integer, nullable=True)  # Boolean: Did they answer correctly?
    difficulty_rating = Column(Integer, nullable=True)  # 1-5: How hard was this question?

    # Spaced repetition
    times_reviewed = Column(Integer, default=0)
    last_reviewed = Column(DateTime, nullable=True)
    next_review = Column(DateTime, nullable=True)
    easiness_factor = Column(Integer, default=250)  # SM-2 algorithm: 250 = 2.5, stored as int

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    owner = relationship("User", backref="questions")
    study_session = relationship("StudySession", backref="questions")
    task = relationship("Task", backref="questions")
