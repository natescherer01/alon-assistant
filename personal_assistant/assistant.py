#!/usr/bin/env python3
"""
Personal AI Assistant - Smart Task Management System
"""

import json
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import re

# Path configuration
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
TASKS_FILE = os.path.join(DATA_DIR, "tasks.json")
CONTEXT_FILE = os.path.join(DATA_DIR, "context.json")

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)


class Task:
    """Represents a single task"""

    def __init__(self, task_id: int, title: str, description: str = "",
                 deadline: Optional[str] = None, intensity: int = 3,
                 dependencies: List[str] = None, waiting_on: Optional[str] = None):
        self.id = task_id
        self.title = title
        self.description = description
        self.deadline = deadline  # ISO format: YYYY-MM-DD
        self.intensity = intensity  # 1-5 scale
        self.status = "not_started"  # not_started, in_progress, waiting_on, completed
        self.dependencies = dependencies or []
        self.waiting_on = waiting_on
        self.created_at = datetime.now().isoformat()
        self.updated_at = datetime.now().isoformat()
        self.completed_at = None

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "deadline": self.deadline,
            "intensity": self.intensity,
            "status": self.status,
            "dependencies": self.dependencies,
            "waiting_on": self.waiting_on,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "completed_at": self.completed_at
        }

    @classmethod
    def from_dict(cls, data: Dict):
        task = cls(
            task_id=data["id"],
            title=data["title"],
            description=data.get("description", ""),
            deadline=data.get("deadline"),
            intensity=data.get("intensity", 3),
            dependencies=data.get("dependencies", []),
            waiting_on=data.get("waiting_on")
        )
        task.status = data.get("status", "not_started")
        task.created_at = data.get("created_at", datetime.now().isoformat())
        task.updated_at = data.get("updated_at", datetime.now().isoformat())
        task.completed_at = data.get("completed_at")
        return task


class PersonalAssistant:
    """Main assistant system"""

    def __init__(self):
        self.tasks: Dict[int, Task] = {}
        self.context: Dict = {}
        self.load_data()

    def load_data(self):
        """Load tasks and context from JSON files"""
        # Load tasks
        if os.path.exists(TASKS_FILE):
            with open(TASKS_FILE, 'r') as f:
                tasks_data = json.load(f)
                self.tasks = {int(k): Task.from_dict(v) for k, v in tasks_data.items()}

        # Load context
        if os.path.exists(CONTEXT_FILE):
            with open(CONTEXT_FILE, 'r') as f:
                self.context = json.load(f)

    def save_data(self):
        """Save tasks and context to JSON files"""
        # Save tasks
        with open(TASKS_FILE, 'w') as f:
            tasks_data = {k: v.to_dict() for k, v in self.tasks.items()}
            json.dump(tasks_data, f, indent=2)

        # Save context
        with open(CONTEXT_FILE, 'w') as f:
            json.dump(self.context, f, indent=2)

    def estimate_intensity(self, text: str) -> int:
        """Estimate task intensity from text (1-5 scale)"""
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

    def detect_waiting_on(self, text: str) -> Optional[str]:
        """Detect if task involves waiting on someone/something"""
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

    def add_task(self, title: str, description: str = "", deadline: Optional[str] = None,
                 intensity: Optional[int] = None, dependencies: List[str] = None,
                 waiting_on: Optional[str] = None) -> Task:
        """Add a new task"""
        task_id = max(self.tasks.keys(), default=0) + 1

        # Auto-detect intensity if not provided
        if intensity is None:
            intensity = self.estimate_intensity(title + " " + description)

        # Auto-detect waiting_on if not provided
        if waiting_on is None:
            waiting_on = self.detect_waiting_on(title + " " + description)

        task = Task(task_id, title, description, deadline, intensity, dependencies, waiting_on)

        # Set status to waiting_on if applicable
        if waiting_on:
            task.status = "waiting_on"

        self.tasks[task_id] = task
        self.save_data()

        return task

    def complete_task(self, task_id: int, notes: str = "") -> Optional[Task]:
        """Mark a task as completed"""
        if task_id not in self.tasks:
            return None

        task = self.tasks[task_id]
        task.status = "completed"
        task.completed_at = datetime.now().isoformat()
        task.updated_at = datetime.now().isoformat()

        # Add completion notes to description
        if notes:
            task.description += f"\n\nCompleted: {notes}"

        self.save_data()
        return task

    def update_task_status(self, task_id: int, status: str, notes: str = "") -> Optional[Task]:
        """Update task status"""
        if task_id not in self.tasks:
            return None

        task = self.tasks[task_id]
        task.status = status
        task.updated_at = datetime.now().isoformat()

        if notes:
            task.description += f"\n\nUpdate: {notes}"

        self.save_data()
        return task

    def calculate_priority(self, task: Task) -> float:
        """Calculate priority score for a task (higher = more urgent)"""
        score = 0.0

        # Deadline urgency (0-100 points)
        if task.deadline:
            try:
                deadline_date = datetime.fromisoformat(task.deadline)
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

    def get_next_task(self, intensity_filter: Optional[str] = None) -> Optional[Task]:
        """Get the next task to work on based on priority"""
        available_tasks = []

        for task in self.tasks.values():
            if task.status in ["completed"]:
                continue

            # Skip waiting_on tasks unless checking on them
            if task.status == "waiting_on":
                continue

            # Check if dependencies are met
            if task.dependencies:
                deps_met = all(
                    self.tasks.get(dep_id, Task(0, "")).status == "completed"
                    if isinstance(dep_id, int) else True
                    for dep_id in task.dependencies
                )
                if not deps_met:
                    continue

            # Apply intensity filter if specified
            if intensity_filter:
                if intensity_filter == "light" and task.intensity > 2:
                    continue
                elif intensity_filter == "medium" and (task.intensity < 2 or task.intensity > 4):
                    continue
                elif intensity_filter == "heavy" and task.intensity < 4:
                    continue

            available_tasks.append(task)

        if not available_tasks:
            return None

        # Sort by priority
        available_tasks.sort(key=self.calculate_priority, reverse=True)
        return available_tasks[0]

    def get_waiting_tasks(self) -> List[Task]:
        """Get all tasks waiting on someone/something"""
        waiting = []
        for task in self.tasks.values():
            if task.status == "waiting_on":
                waiting.append(task)

        # Sort by how long we've been waiting
        waiting.sort(key=lambda t: t.updated_at)
        return waiting

    def get_upcoming_tasks(self, days: int = 7) -> List[Task]:
        """Get tasks due in the next N days"""
        upcoming = []
        cutoff_date = datetime.now() + timedelta(days=days)

        for task in self.tasks.values():
            if task.status == "completed":
                continue

            if task.deadline:
                try:
                    deadline_date = datetime.fromisoformat(task.deadline)
                    if deadline_date <= cutoff_date:
                        upcoming.append(task)
                except:
                    pass

        # Sort by deadline
        upcoming.sort(key=lambda t: t.deadline or "9999-12-31")
        return upcoming

    def format_task(self, task: Task, include_details: bool = False) -> str:
        """Format task for display"""
        intensity_labels = {1: "Very Light", 2: "Light", 3: "Medium", 4: "Heavy", 5: "Very Heavy"}

        output = f"[Task #{task.id}] {task.title}"

        if task.deadline:
            try:
                deadline_date = datetime.fromisoformat(task.deadline)
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

    def suggest_prerequisites(self, task_title: str) -> List[str]:
        """Suggest prerequisite tasks based on task description"""
        suggestions = []
        title_lower = task_title.lower()

        # Common prerequisite patterns
        if "send" in title_lower or "submit" in title_lower:
            if "review" not in title_lower:
                suggestions.append(f"Review/proofread before sending")

        if "meeting" in title_lower:
            if "prepare" not in title_lower and "agenda" not in title_lower:
                suggestions.append(f"Prepare agenda for meeting")

        if "present" in title_lower or "presentation" in title_lower:
            if "prepare" not in title_lower and "slides" not in title_lower:
                suggestions.append(f"Prepare presentation slides")

        return suggestions


def main():
    """Main CLI interface"""
    assistant = PersonalAssistant()

    if len(sys.argv) < 2:
        print("Personal AI Assistant - Usage:")
        print("  python assistant.py add <title> [--deadline YYYY-MM-DD] [--intensity 1-5] [--description text]")
        print("  python assistant.py next [light|medium|heavy]")
        print("  python assistant.py complete <task_id> [notes]")
        print("  python assistant.py update <task_id> <status> [notes]")
        print("  python assistant.py list [all|waiting|upcoming]")
        print("  python assistant.py show <task_id>")
        return

    command = sys.argv[1].lower()

    if command == "add":
        # Parse task details
        if len(sys.argv) < 3:
            print("Error: Task title required")
            return

        title = sys.argv[2]
        deadline = None
        intensity = None
        description = ""

        i = 3
        while i < len(sys.argv):
            if sys.argv[i] == "--deadline" and i + 1 < len(sys.argv):
                deadline = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--intensity" and i + 1 < len(sys.argv):
                intensity = int(sys.argv[i + 1])
                i += 2
            elif sys.argv[i] == "--description" and i + 1 < len(sys.argv):
                description = sys.argv[i + 1]
                i += 2
            else:
                i += 1

        task = assistant.add_task(title, description, deadline, intensity)

        print(f"\nTask added successfully!")
        print(assistant.format_task(task, include_details=True))

        # Check for prerequisite suggestions
        suggestions = assistant.suggest_prerequisites(title)
        if suggestions:
            print(f"\nSuggested prerequisite tasks:")
            for suggestion in suggestions:
                print(f"  - {suggestion}")
            print("\nWould you like to add any of these as tasks?")

    elif command == "next":
        intensity_filter = sys.argv[2] if len(sys.argv) > 2 else None

        next_task = assistant.get_next_task(intensity_filter)

        if next_task:
            print(f"\nYour next task:")
            print(assistant.format_task(next_task, include_details=True))
        else:
            filter_msg = f" ({intensity_filter} intensity)" if intensity_filter else ""
            print(f"\nNo available tasks{filter_msg}. Great job!")

        # Show upcoming tasks
        upcoming = assistant.get_upcoming_tasks(7)
        if upcoming and len(upcoming) > 1:
            print(f"\nUpcoming tasks (next 7 days):")
            for task in upcoming[:5]:  # Show top 5
                if task.id != (next_task.id if next_task else -1):
                    print(f"  {assistant.format_task(task)}")

        # Check on waiting tasks
        waiting = assistant.get_waiting_tasks()
        if waiting:
            print(f"\nTasks waiting on responses:")
            for task in waiting:
                print(f"  {assistant.format_task(task, include_details=True)}")

                # Check how long we've been waiting
                try:
                    updated = datetime.fromisoformat(task.updated_at)
                    days_waiting = (datetime.now() - updated).days

                    if days_waiting >= 3:
                        print(f"    (You've been waiting {days_waiting} days - consider following up?)")
                except:
                    pass

    elif command == "complete":
        if len(sys.argv) < 3:
            print("Error: Task ID required")
            return

        task_id = int(sys.argv[2])
        notes = " ".join(sys.argv[3:]) if len(sys.argv) > 3 else ""

        task = assistant.complete_task(task_id, notes)

        if task:
            print(f"\nTask completed!")
            print(assistant.format_task(task))
            print("\nAny follow-up tasks or updates? (This would be handled interactively in the slash command)")
        else:
            print(f"Error: Task #{task_id} not found")

    elif command == "update":
        if len(sys.argv) < 4:
            print("Error: Task ID and status required")
            return

        task_id = int(sys.argv[2])
        status = sys.argv[3]
        notes = " ".join(sys.argv[4:]) if len(sys.argv) > 4 else ""

        task = assistant.update_task_status(task_id, status, notes)

        if task:
            print(f"\nTask updated!")
            print(assistant.format_task(task, include_details=True))
        else:
            print(f"Error: Task #{task_id} not found")

    elif command == "list":
        list_type = sys.argv[2] if len(sys.argv) > 2 else "all"

        if list_type == "waiting":
            tasks = assistant.get_waiting_tasks()
            print("\nTasks waiting on responses:")
        elif list_type == "upcoming":
            tasks = assistant.get_upcoming_tasks(14)
            print("\nUpcoming tasks (next 14 days):")
        else:
            tasks = [t for t in assistant.tasks.values() if t.status != "completed"]
            print("\nAll active tasks:")

        if tasks:
            for task in tasks:
                print(assistant.format_task(task, include_details=True))
                print()
        else:
            print("No tasks found.")

    elif command == "show":
        if len(sys.argv) < 3:
            print("Error: Task ID required")
            return

        task_id = int(sys.argv[2])

        if task_id in assistant.tasks:
            task = assistant.tasks[task_id]
            print("\n" + assistant.format_task(task, include_details=True))
        else:
            print(f"Error: Task #{task_id} not found")

    else:
        print(f"Unknown command: {command}")


if __name__ == "__main__":
    main()
