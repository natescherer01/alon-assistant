"""
Pydantic schemas for request/response validation
"""
from datetime import datetime, date
from typing import Optional, List
import re
from pydantic import BaseModel, EmailStr, Field, validator


# ==================== User Schemas ====================

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=12)

    @validator('password')
    def validate_password(cls, v):
        """
        Validate password meets security requirements:
        - At least 12 characters
        - Contains uppercase letter
        - Contains lowercase letter
        - Contains digit
        - Contains special character
        - Not a common password
        """
        if len(v) < 12:
            raise ValueError('Password must be at least 12 characters long')

        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')

        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')

        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one digit')

        if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;/]', v):
            raise ValueError('Password must contain at least one special character')

        # Check against common passwords
        common_passwords = [
            'password', '123456789', 'qwertyuiop', 'abc123456789',
            'password123', 'admin123', 'welcome123', 'letmein123'
        ]
        if v.lower() in common_passwords:
            raise ValueError('Password is too common. Please choose a more secure password.')

        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


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
