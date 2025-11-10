"""
Task management service - business logic migrated from personal_assistant/assistant.py
"""
from datetime import datetime, timedelta
from typing import List, Optional
import re
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models import Task, User


class TaskService:
    """Task management service for multi-user system"""

    @staticmethod
    def estimate_intensity(text: str) -> int:
        """
        Estimate task intensity from text (1-5 scale)
        Migrated from PersonalAssistant.estimate_intensity()
        """
        text_lower = text.lower()

        # Light tasks (1-2)
        light_keywords = ['email', 'call', 'meeting', 'review', 'check', 'quick', 'brief']
        # Medium tasks (3)
        medium_keywords = ['write', 'draft', 'prepare', 'update', 'organize']
        # Heavy tasks (4-5)
        heavy_keywords = ['project', 'develop', 'design', 'research', 'build', 'implement', 'create']

        if any(kw in text_lower for kw in heavy_keywords):
            return 4
        elif any(kw in text_lower for kw in light_keywords):
            return 2
        elif any(kw in text_lower for kw in medium_keywords):
            return 3

        return 3  # Default to medium

    @staticmethod
    def detect_waiting_on(text: str) -> Optional[str]:
        """
        Detect if task involves waiting on someone/something
        Migrated from PersonalAssistant.detect_waiting_on()
        """
        text_lower = text.lower()

        # Pattern: "waiting (for|on) [person/thing]"
        wait_match = re.search(r'waiting (?:for|on) ([^.,;]+)', text_lower)
        if wait_match:
            return wait_match.group(1).strip()

        # Pattern: "sent to [person]"
        sent_match = re.search(r'sent to ([^.,;]+)', text_lower)
        if sent_match:
            return f"{sent_match.group(1).strip()}'s response"

        return None

    @staticmethod
    def calculate_priority(task: Task) -> float:
        """
        Calculate priority score for a task (higher = more urgent)
        Migrated from PersonalAssistant.calculate_priority()
        """
        score = 0.0

        # Deadline urgency (0-100 points)
        if task.deadline:
            try:
                deadline_date = datetime.combine(task.deadline, datetime.min.time())
                days_until = (deadline_date - datetime.now()).days

                if days_until < 0:
                    score += 100  # Overdue
                elif days_until == 0:
                    score += 90  # Due today
                elif days_until == 1:
                    score += 80  # Due tomorrow
                elif days_until <= 3:
                    score += 70
                elif days_until <= 7:
                    score += 50
                elif days_until <= 14:
                    score += 30
                else:
                    score += 10
            except:
                pass

        # Intensity (0-25 points) - higher intensity = higher priority
        score += task.intensity * 5

        # Status boost (in_progress tasks get priority)
        if task.status == "in_progress":
            score += 15

        return score

    @staticmethod
    def get_next_task(
        db: Session,
        user_id: int,
        intensity_filter: Optional[str] = None
    ) -> Optional[Task]:
        """
        Get the next task to work on based on priority
        Migrated from PersonalAssistant.get_next_task()
        """
        # Query available tasks
        query = db.query(Task).filter(
            and_(
                Task.user_id == user_id,
                Task.status.notin_(["completed", "waiting_on"])
            )
        )

        available_tasks = query.all()

        # Apply intensity filter
        if intensity_filter:
            filtered_tasks = []
            for task in available_tasks:
                if intensity_filter == "light" and task.intensity <= 2:
                    filtered_tasks.append(task)
                elif intensity_filter == "medium" and 2 < task.intensity < 4:
                    filtered_tasks.append(task)
                elif intensity_filter == "heavy" and task.intensity >= 4:
                    filtered_tasks.append(task)
            available_tasks = filtered_tasks

        if not available_tasks:
            return None

        # Sort by priority
        available_tasks.sort(key=TaskService.calculate_priority, reverse=True)
        return available_tasks[0]

    @staticmethod
    def get_waiting_tasks(db: Session, user_id: int) -> List[Task]:
        """
        Get all tasks waiting on someone/something
        Migrated from PersonalAssistant.get_waiting_tasks()
        """
        tasks = db.query(Task).filter(
            and_(
                Task.user_id == user_id,
                Task.status == "waiting_on"
            )
        ).order_by(Task.updated_at).all()

        return tasks

    @staticmethod
    def get_upcoming_tasks(db: Session, user_id: int, days: int = 7) -> List[Task]:
        """
        Get tasks due in the next N days
        Migrated from PersonalAssistant.get_upcoming_tasks()
        """
        cutoff_date = (datetime.now() + timedelta(days=days)).date()

        tasks = db.query(Task).filter(
            and_(
                Task.user_id == user_id,
                Task.status != "completed",
                Task.deadline.isnot(None),
                Task.deadline <= cutoff_date
            )
        ).order_by(Task.deadline).all()

        return tasks

    @staticmethod
    def suggest_prerequisites(task_title: str) -> List[str]:
        """
        Suggest prerequisite tasks based on task description
        Migrated from PersonalAssistant.suggest_prerequisites()
        """
        suggestions = []
        title_lower = task_title.lower()

        # Common prerequisite patterns
        if "send" in title_lower or "submit" in title_lower:
            if "review" not in title_lower:
                suggestions.append("Review/proofread before sending")

        if "meeting" in title_lower:
            if "prepare" not in title_lower and "agenda" not in title_lower:
                suggestions.append("Prepare agenda for meeting")

        if "present" in title_lower or "presentation" in title_lower:
            if "prepare" not in title_lower and "slides" not in title_lower:
                suggestions.append("Prepare presentation slides")

        return suggestions

    @staticmethod
    def format_task_for_display(task: Task, include_details: bool = False) -> str:
        """
        Format task for display
        Migrated from PersonalAssistant.format_task()
        """
        intensity_labels = {1: "Very Light", 2: "Light", 3: "Medium", 4: "Heavy", 5: "Very Heavy"}

        output = f"[Task #{task.id}] {task.title}"

        if task.deadline:
            try:
                deadline_date = datetime.combine(task.deadline, datetime.min.time())
                days_until = (deadline_date - datetime.now()).days

                if days_until < 0:
                    output += f" (OVERDUE by {abs(days_until)} days!)"
                elif days_until == 0:
                    output += " (DUE TODAY!)"
                elif days_until == 1:
                    output += " (Due tomorrow)"
                else:
                    output += f" (Due in {days_until} days)"
            except:
                output += f" (Due: {task.deadline})"

        if include_details:
            output += f"\n  Intensity: {intensity_labels.get(task.intensity, 'Medium')}"
            output += f"\n  Status: {task.status.replace('_', ' ').title()}"

            if task.waiting_on:
                output += f"\n  Waiting on: {task.waiting_on}"

            if task.description:
                output += f"\n  Description: {task.description}"

        return output
