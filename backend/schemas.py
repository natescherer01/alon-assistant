"""
Pydantic schemas for request/response validation
"""
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, validator


# ==================== User Schemas ====================

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    timezone: Optional[str] = "UTC"


class UserCreate(UserBase):
    password: str

    @validator('password')
    def validate_password(cls, v):
        """
        Validate password according to NIST SP 800-63B (2025) guidelines

        Requirements:
        - Minimum 15 characters (NIST recommended)
        - Maximum 64 characters
        - No complexity requirements (per NIST 2025)
        - Check against compromised passwords
        """
        from auth.password_validator import validate_password_strength

        is_valid, error_message = validate_password_strength(v)
        if not is_valid:
            raise ValueError(error_message)

        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    timezone: Optional[str] = None


class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenData(BaseModel):
    email: Optional[str] = None


# ==================== Task Schemas ====================

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = ""
    deadline: Optional[date] = None
    intensity: Optional[int] = Field(default=3, ge=1, le=5)
    project: Optional[str] = None
    dependencies: Optional[List] = []
    waiting_on: Optional[str] = None
    is_recurring: Optional[bool] = False
    recurrence_type: Optional[str] = Field(default=None, pattern="^(daily|weekly|monthly|yearly)$")
    recurrence_interval: Optional[int] = Field(default=1, ge=1)
    recurrence_end_date: Optional[date] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    deadline: Optional[date] = None
    intensity: Optional[int] = Field(default=None, ge=1, le=5)
    project: Optional[str] = None
    status: Optional[str] = None
    dependencies: Optional[List] = None
    waiting_on: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurrence_type: Optional[str] = Field(default=None, pattern="^(daily|weekly|monthly|yearly)$")
    recurrence_interval: Optional[int] = Field(default=None, ge=1)
    recurrence_end_date: Optional[date] = None


class TaskResponse(TaskBase):
    id: int
    user_id: int
    status: str
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== Chat Schemas ====================

class ChatMessageCreate(BaseModel):
    message: str = Field(..., min_length=1)


class ChatMessageResponse(BaseModel):
    id: int
    user_id: int
    message: str
    response: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatResponse(BaseModel):
    """Real-time chat response (not saved to DB immediately)"""
    response: str
    task_updates: Optional[List[TaskResponse]] = []
    suggested_actions: Optional[List[str]] = []


# ==================== Task Priority/Next Schemas ====================

class NextTaskRequest(BaseModel):
    intensity_filter: Optional[str] = Field(default=None, pattern="^(light|medium|heavy)$")


class TaskListRequest(BaseModel):
    list_type: Optional[str] = Field(default="all", pattern="^(all|waiting|upcoming)$")
    days: Optional[int] = Field(default=7, ge=1, le=365)


# ==================== Study Session Schemas ====================

class StudySessionBase(BaseModel):
    subject: str
    session_type: Optional[str] = "initial"
    duration_minutes: Optional[int] = None
    review_number: Optional[int] = 0
    next_review_date: Optional[datetime] = None
    confidence_level: Optional[int] = Field(default=None, ge=1, le=5)
    questions_attempted: Optional[int] = 0
    questions_correct: Optional[int] = 0
    used_active_recall: Optional[bool] = False
    used_interleaving: Optional[bool] = False
    slept_after_session: Optional[bool] = False
    notes: Optional[str] = ""


class StudySessionCreate(StudySessionBase):
    task_id: Optional[int] = None


class StudySessionUpdate(BaseModel):
    session_type: Optional[str] = None
    duration_minutes: Optional[int] = None
    next_review_date: Optional[datetime] = None
    confidence_level: Optional[int] = Field(default=None, ge=1, le=5)
    questions_attempted: Optional[int] = None
    questions_correct: Optional[int] = None
    used_active_recall: Optional[bool] = None
    used_interleaving: Optional[bool] = None
    slept_after_session: Optional[bool] = None
    notes: Optional[str] = None
    completed_at: Optional[datetime] = None


class StudySessionResponse(StudySessionBase):
    id: int
    user_id: int
    task_id: Optional[int] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== Active Recall Question Schemas ====================

class ActiveRecallQuestionBase(BaseModel):
    subject: str
    question_type: Optional[str] = "recall"
    question_text: str
    suggested_answer: Optional[str] = None


class ActiveRecallQuestionCreate(ActiveRecallQuestionBase):
    study_session_id: Optional[int] = None
    task_id: Optional[int] = None


class ActiveRecallQuestionUpdate(BaseModel):
    user_answer: Optional[str] = None
    was_correct: Optional[bool] = None
    difficulty_rating: Optional[int] = Field(default=None, ge=1, le=5)
    times_reviewed: Optional[int] = None
    last_reviewed: Optional[datetime] = None
    next_review: Optional[datetime] = None
    easiness_factor: Optional[int] = None


class ActiveRecallQuestionResponse(ActiveRecallQuestionBase):
    id: int
    user_id: int
    study_session_id: Optional[int] = None
    task_id: Optional[int] = None
    user_answer: Optional[str] = None
    was_correct: Optional[bool] = None
    difficulty_rating: Optional[int] = None
    times_reviewed: int
    last_reviewed: Optional[datetime] = None
    next_review: Optional[datetime] = None
    easiness_factor: int
    created_at: datetime

    class Config:
        from_attributes = True
