"""
Task management API routes
"""
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import User, Task
from schemas import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    NextTaskRequest,
    TaskListRequest
)
from auth.dependencies import get_current_user
from tasks.service import TaskService

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new task for the current user

    Auto-detects intensity and waiting_on status if not provided
    """
    # Auto-detect intensity if not explicitly set
    if task_data.intensity == 3:  # Default value
        detected_intensity = TaskService.estimate_intensity(
            f"{task_data.title} {task_data.description}"
        )
        task_data.intensity = detected_intensity

    # Auto-detect waiting_on if not provided
    if not task_data.waiting_on:
        detected_waiting = TaskService.detect_waiting_on(
            f"{task_data.title} {task_data.description}"
        )
        task_data.waiting_on = detected_waiting

    # Create task
    new_task = Task(
        user_id=current_user.id,
        title=task_data.title,
        description=task_data.description,
        deadline=task_data.deadline,
        intensity=task_data.intensity,
        dependencies=task_data.dependencies or [],
        waiting_on=task_data.waiting_on,
        is_recurring=1 if task_data.is_recurring else 0,
        recurrence_type=task_data.recurrence_type,
        recurrence_interval=task_data.recurrence_interval,
        recurrence_end_date=task_data.recurrence_end_date
    )

    # Set status to waiting_on if applicable
    if new_task.waiting_on:
        new_task.status = "waiting_on"

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    return new_task


@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    list_type: str = "all",
    days: int = 7,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List tasks based on filter type

    - all: All active (non-completed, non-deleted) tasks
    - waiting: Tasks waiting on responses
    - upcoming: Tasks due in the next N days
    - completed: All completed tasks (most recent first)
    - deleted: Tasks in trash (most recent first)
    """
    if list_type == "waiting":
        tasks = TaskService.get_waiting_tasks(db, current_user.id)
    elif list_type == "upcoming":
        tasks = TaskService.get_upcoming_tasks(db, current_user.id, days)
    elif list_type == "completed":
        tasks = db.query(Task).filter(
            Task.user_id == current_user.id,
            Task.status == "completed"
        ).order_by(Task.completed_at.desc()).all()
    elif list_type == "deleted":
        tasks = db.query(Task).filter(
            Task.user_id == current_user.id,
            Task.status == "deleted"
        ).order_by(Task.deleted_at.desc()).all()
    else:  # all
        tasks = db.query(Task).filter(
            Task.user_id == current_user.id,
            Task.status.notin_(["completed", "deleted"])
        ).all()

    return tasks


@router.get("/next", response_model=Optional[TaskResponse])
async def get_next_task(
    intensity_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the next task to work on based on priority

    Optional intensity filter: light, medium, heavy
    """
    task = TaskService.get_next_task(db, current_user.id, intensity_filter)
    return task


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific task by ID"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.user_id == current_user.id
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    return task


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    task_update: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a task"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.user_id == current_user.id
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    # Update fields
    update_data = task_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    task.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(task)

    return task


@router.post("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(
    task_id: int,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a task as completed and create next occurrence if recurring"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.user_id == current_user.id
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    # Mark current task as completed
    task.status = "completed"
    task.completed_at = datetime.utcnow()
    task.updated_at = datetime.utcnow()

    if notes:
        task.description += f"\n\nCompleted: {notes}"

    # Handle recurring tasks
    if task.is_recurring and task.recurrence_type and task.deadline:
        # Calculate next deadline
        current_deadline = task.deadline
        interval = task.recurrence_interval or 1

        if task.recurrence_type == "daily":
            next_deadline = current_deadline + timedelta(days=interval)
        elif task.recurrence_type == "weekly":
            next_deadline = current_deadline + timedelta(weeks=interval)
        elif task.recurrence_type == "monthly":
            # Approximate monthly recurrence
            next_deadline = current_deadline + timedelta(days=30 * interval)
        elif task.recurrence_type == "yearly":
            # Approximate yearly recurrence
            next_deadline = current_deadline + timedelta(days=365 * interval)
        else:
            next_deadline = None

        # Check if we should create next occurrence
        should_create_next = True
        if task.recurrence_end_date and next_deadline:
            should_create_next = next_deadline <= task.recurrence_end_date

        # Create next occurrence
        if should_create_next and next_deadline:
            next_task = Task(
                user_id=task.user_id,
                title=task.title,
                description=task.description.split("\n\nCompleted:")[0],  # Remove completion notes
                deadline=next_deadline,
                intensity=task.intensity,
                dependencies=task.dependencies,
                waiting_on=task.waiting_on,
                is_recurring=task.is_recurring,
                recurrence_type=task.recurrence_type,
                recurrence_interval=task.recurrence_interval,
                recurrence_end_date=task.recurrence_end_date
            )

            # Set status to waiting_on if applicable
            if next_task.waiting_on:
                next_task.status = "waiting_on"

            db.add(next_task)

    db.commit()
    db.refresh(task)

    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete a task (move to trash)"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.user_id == current_user.id
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    # Soft delete: set status to deleted and timestamp
    task.status = "deleted"
    task.deleted_at = datetime.utcnow()
    task.updated_at = datetime.utcnow()

    db.commit()

    return None


@router.post("/{task_id}/restore", response_model=TaskResponse)
async def restore_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Restore a deleted task from trash"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.user_id == current_user.id,
        Task.status == "deleted"
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found in trash"
        )

    # Restore task: set status to not_started and clear deleted_at
    task.status = "not_started"
    task.deleted_at = None
    task.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(task)

    return task


@router.get("/{task_id}/prerequisites", response_model=List[str])
async def get_task_prerequisites(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get suggested prerequisite tasks"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.user_id == current_user.id
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    suggestions = TaskService.suggest_prerequisites(task.title)
    return suggestions
