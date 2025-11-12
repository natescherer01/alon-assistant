"""
Pydantic schemas for request/response validation
"""
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


# ==================== User Schemas ====================

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    timezone: Optional[str] = "UTC"


class UserCreate(UserBase):
    password: str


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
