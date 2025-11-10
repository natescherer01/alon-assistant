"""
Claude AI chat service for conversational task management
"""
from typing import Dict, List, Any
from datetime import datetime
from anthropic import Anthropic
from sqlalchemy.orm import Session
from config import get_settings
from models import Task, User
from tasks.service import TaskService

settings = get_settings()


class ClaudeService:
    """Service for interacting with Claude API for task management"""

    def __init__(self):
        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is not set in environment variables")
        self.client = Anthropic(api_key=settings.anthropic_api_key)

    def build_system_prompt(self, user: User, db: Session) -> str:
        """
        Build system prompt with user context and current tasks
        """
        # Get user's current tasks
        active_tasks = db.query(Task).filter(
            Task.user_id == user.id,
            Task.status != "completed"
        ).all()

        # Build task summary
        task_summary = "Current active tasks:\n"
        if active_tasks:
            for task in active_tasks[:10]:  # Limit to 10 most recent
                task_summary += f"- [Task #{task.id}] {task.title} (Status: {task.status}"
                if task.deadline:
                    task_summary += f", Deadline: {task.deadline}"
                task_summary += ")\n"
        else:
            task_summary += "No active tasks.\n"

        system_prompt = f"""You are a Personal AI Assistant helping {user.full_name or user.email} manage their tasks and stay productive.

Your role is to:
1. Help them understand what they should work on next
2. Add new tasks when requested
3. Update task status and details
4. Provide intelligent suggestions about priorities, prerequisites, and follow-ups
5. Act as a proactive micromanager who keeps them on track

{task_summary}

Today's date: {datetime.now().strftime('%Y-%m-%d')}

When the user asks about tasks, you can:
- Suggest what to work on next based on priority and deadlines
- Add new tasks with smart defaults (auto-detect intensity and waiting status)
- Mark tasks as complete
- Update task status
- Check on waiting items and suggest follow-ups

Be conversational, friendly, and proactive. Format your responses clearly.

When you need to perform actions (like adding a task or marking one complete), clearly state what action should be taken. The system will parse your response and execute the appropriate operations.

Use this format for actions:
- To add a task: "ACTION: ADD_TASK | Title: [title] | Deadline: [YYYY-MM-DD] | Intensity: [1-5] | Description: [desc]"
- To complete a task: "ACTION: COMPLETE_TASK | Task ID: [id] | Notes: [notes]"
- To update status: "ACTION: UPDATE_STATUS | Task ID: [id] | Status: [status]"
"""
        return system_prompt

    async def chat(
        self,
        user: User,
        message: str,
        db: Session
    ) -> Dict[str, Any]:
        """
        Process a chat message and return response with any task actions

        Returns:
            {
                "response": str,  # Claude's response
                "actions": List[Dict],  # Parsed actions to execute
            }
        """
        system_prompt = self.build_system_prompt(user, db)

        # Call Claude API
        response = self.client.messages.create(
            model=settings.claude_model,
            max_tokens=2000,
            system=system_prompt,
            messages=[
                {"role": "user", "content": message}
            ]
        )

        # Extract response text
        response_text = response.content[0].text

        # Parse actions from response
        actions = self._parse_actions(response_text)

        return {
            "response": response_text,
            "actions": actions
        }

    def _parse_actions(self, response: str) -> List[Dict[str, Any]]:
        """
        Parse action commands from Claude's response

        Example:
            "ACTION: ADD_TASK | Title: Review code | Deadline: 2025-11-15"
        """
        actions = []
        lines = response.split('\n')

        for line in lines:
            if line.strip().startswith("ACTION:"):
                action = self._parse_action_line(line)
                if action:
                    actions.append(action)

        return actions

    def _parse_action_line(self, line: str) -> Dict[str, Any]:
        """Parse a single action line"""
        try:
            # Remove "ACTION:" prefix
            line = line.replace("ACTION:", "").strip()

            # Split by pipe
            parts = [part.strip() for part in line.split("|")]

            if not parts:
                return None

            action_type = parts[0].strip()
            params = {}

            # Parse key-value pairs
            for part in parts[1:]:
                if ":" in part:
                    key, value = part.split(":", 1)
                    params[key.strip().lower().replace(" ", "_")] = value.strip()

            return {
                "type": action_type,
                "params": params
            }
        except Exception:
            return None

    async def execute_actions(
        self,
        actions: List[Dict[str, Any]],
        user: User,
        db: Session
    ) -> List[Task]:
        """
        Execute parsed actions and return modified tasks

        Args:
            actions: List of action dictionaries
            user: Current user
            db: Database session

        Returns:
            List of created/modified tasks
        """
        modified_tasks = []

        for action in actions:
            action_type = action.get("type")
            params = action.get("params", {})

            try:
                if action_type == "ADD_TASK":
                    task = self._add_task_from_action(params, user, db)
                    if task:
                        modified_tasks.append(task)

                elif action_type == "COMPLETE_TASK":
                    task = self._complete_task_from_action(params, user, db)
                    if task:
                        modified_tasks.append(task)

                elif action_type == "UPDATE_STATUS":
                    task = self._update_task_from_action(params, user, db)
                    if task:
                        modified_tasks.append(task)

            except Exception as e:
                # Log error but continue with other actions
                print(f"Error executing action {action_type}: {str(e)}")
                continue

        return modified_tasks

    def _add_task_from_action(
        self,
        params: Dict[str, str],
        user: User,
        db: Session
    ) -> Task:
        """Create task from action params"""
        title = params.get("title", "")
        if not title:
            return None

        # Parse deadline
        deadline = None
        if "deadline" in params:
            try:
                deadline = datetime.strptime(params["deadline"], "%Y-%m-%d").date()
            except:
                pass

        # Parse intensity
        intensity = 3
        if "intensity" in params:
            try:
                intensity = int(params["intensity"])
            except:
                pass

        # Auto-detect if not specified
        if intensity == 3:
            intensity = TaskService.estimate_intensity(title + " " + params.get("description", ""))

        # Create task
        new_task = Task(
            user_id=user.id,
            title=title,
            description=params.get("description", ""),
            deadline=deadline,
            intensity=intensity
        )

        db.add(new_task)
        db.commit()
        db.refresh(new_task)

        return new_task

    def _complete_task_from_action(
        self,
        params: Dict[str, str],
        user: User,
        db: Session
    ) -> Task:
        """Complete task from action params"""
        task_id = params.get("task_id")
        if not task_id:
            return None

        try:
            task_id = int(task_id)
        except:
            return None

        task = db.query(Task).filter(
            Task.id == task_id,
            Task.user_id == user.id
        ).first()

        if not task:
            return None

        task.status = "completed"
        task.completed_at = datetime.utcnow()

        if "notes" in params:
            task.description += f"\n\nCompleted: {params['notes']}"

        db.commit()
        db.refresh(task)

        return task

    def _update_task_from_action(
        self,
        params: Dict[str, str],
        user: User,
        db: Session
    ) -> Task:
        """Update task from action params"""
        task_id = params.get("task_id")
        if not task_id:
            return None

        try:
            task_id = int(task_id)
        except:
            return None

        task = db.query(Task).filter(
            Task.id == task_id,
            Task.user_id == user.id
        ).first()

        if not task:
            return None

        if "status" in params:
            task.status = params["status"]

        db.commit()
        db.refresh(task)

        return task
