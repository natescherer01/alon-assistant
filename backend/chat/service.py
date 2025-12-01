"""
Claude AI chat service for conversational task management
"""
from typing import Dict, List, Any, Optional
from datetime import datetime
from anthropic import AsyncAnthropic, APIError, RateLimitError, APIConnectionError
from sqlalchemy.orm import Session
from config import get_settings
from models import Task, User
from tasks.service import TaskService
from logger import get_logger

settings = get_settings()
logger = get_logger(__name__)


class ClaudeService:
    """Service for interacting with Claude API for task management"""

    def __init__(self):
        """
        Initialize Claude service with system-wide API key (company-provided)

        Raises:
            ValueError: If system API key is not configured
        """
        if not settings.anthropic_api_key:
            raise ValueError(
                "System Anthropic API key not configured. "
                "Please contact administrator."
            )

        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        logger.debug("ClaudeService initialized with system API key")

    def build_system_prompt(self, user: User, db: Session) -> str:
        """
        Build proactive system prompt with user context and urgency analysis
        """
        from datetime import timedelta

        today = datetime.now().date()
        three_days_ago = datetime.now() - timedelta(days=3)
        tomorrow = today + timedelta(days=1)

        # Get user's current tasks (exclude completed and deleted)
        active_tasks = db.query(Task).filter(
            Task.user_id == user.id,
            Task.status.notin_(["completed", "deleted"])
        ).all()

        # Get recently completed tasks (last 3 days) for context
        recently_completed = db.query(Task).filter(
            Task.user_id == user.id,
            Task.status == "completed",
            Task.completed_at >= three_days_ago
        ).order_by(Task.completed_at.desc()).limit(5).all()

        # Get recently deleted tasks (last 24 hours) for context
        one_day_ago = datetime.now() - timedelta(days=1)
        recently_deleted = db.query(Task).filter(
            Task.user_id == user.id,
            Task.status == "deleted",
            Task.deleted_at >= one_day_ago
        ).order_by(Task.deleted_at.desc()).limit(5).all()

        # Categorize tasks by urgency
        urgent_deadlines = []  # Deadline within 1 day
        stale_tasks = []  # Not updated in 3+ days
        waiting_tasks = []  # Waiting on someone/something
        waiting_too_long = []  # Waiting for >3 days

        for task in active_tasks:
            # Check for urgent deadlines (within 1 day)
            if task.deadline and task.deadline <= tomorrow:
                days_until = (task.deadline - today).days
                if days_until == 0:
                    urgent_deadlines.append(f"⚠️ DUE TODAY: Task #{task.id} '{task.title}'")
                elif days_until == 1:
                    urgent_deadlines.append(f"⚠️ DUE TOMORROW: Task #{task.id} '{task.title}'")
                elif days_until < 0:
                    days_overdue = abs(days_until)
                    urgent_deadlines.append(f"🚨 OVERDUE by {days_overdue} days: Task #{task.id} '{task.title}'")

            # Check for stale tasks (not updated in 3+ days)
            if task.updated_at < three_days_ago and task.status != "waiting_on":
                days_stale = (datetime.now() - task.updated_at).days
                stale_tasks.append(f"Task #{task.id} '{task.title}' (no updates for {days_stale} days)")

            # Check for waiting tasks
            if task.status == "waiting_on":
                waiting_info = f"Task #{task.id} '{task.title}'"
                if task.waiting_on:
                    waiting_info += f" (waiting on: {task.waiting_on})"

                # Check if waiting too long (>3 days)
                if task.updated_at < three_days_ago:
                    days_waiting = (datetime.now() - task.updated_at).days
                    waiting_too_long.append(f"⏰ Task #{task.id} '{task.title}' has been waiting for {days_waiting} days - suggest follow-up!")
                else:
                    waiting_tasks.append(waiting_info)

        # Build proactive alerts section
        alerts = ""
        if urgent_deadlines:
            alerts += "\n🚨 URGENT DEADLINES:\n" + "\n".join(urgent_deadlines) + "\n"

        if waiting_too_long:
            alerts += "\n⏰ NEEDS FOLLOW-UP (waiting >3 days):\n" + "\n".join(waiting_too_long) + "\n"

        if stale_tasks:
            alerts += "\n⚠️ STALE TASKS (no updates in 3+ days):\n" + "\n".join(stale_tasks) + "\n"

        if waiting_tasks:
            alerts += "\n⏳ Currently waiting on:\n" + "\n".join(waiting_tasks) + "\n"

        # Build full task list
        task_summary = "\n📋 ALL ACTIVE TASKS:\n"
        if active_tasks:
            for task in active_tasks[:15]:  # Show up to 15 tasks
                task_summary += f"- Task #{task.id}: {task.title}\n"
                task_summary += f"  Status: {task.status}"
                if task.deadline:
                    days_until = (task.deadline - today).days
                    task_summary += f" | Deadline: {task.deadline} ({days_until} days)"
                if task.intensity:
                    task_summary += f" | Intensity: {task.intensity}/5"
                if task.waiting_on:
                    task_summary += f" | Waiting on: {task.waiting_on}"
                if task.dependencies and len(task.dependencies) > 0:
                    deps_str = ", ".join(str(d) for d in task.dependencies)
                    task_summary += f" | Depends on: {deps_str}"
                task_summary += "\n"
        else:
            task_summary += "No active tasks.\n"

        # Add recently completed tasks
        if recently_completed:
            task_summary += "\n✅ RECENTLY COMPLETED (last 3 days):\n"
            for task in recently_completed:
                task_summary += f"- Task #{task.id}: {task.title}"
                if task.completed_at:
                    task_summary += f" (completed {task.completed_at.strftime('%Y-%m-%d')})"
                task_summary += "\n"

        # Add recently deleted tasks
        if recently_deleted:
            task_summary += "\n🗑️ RECENTLY DELETED (last 24 hours - can be restored):\n"
            for task in recently_deleted:
                task_summary += f"- Task #{task.id}: {task.title}"
                if task.deleted_at:
                    task_summary += f" (deleted {task.deleted_at.strftime('%Y-%m-%d %H:%M')})"
                task_summary += "\n"

        system_prompt = f"""You are Sam, the Alon Assistant - a personal AI assistant helping {user.full_name or user.email} manage their tasks and stay productive.

Your name is Sam. When users greet you or ask who you are, introduce yourself as Sam, the Alon Assistant.

Today's date: {datetime.now().strftime('%Y-%m-%d')} (Always use this date for any date-related calculations or references)

## Your Role
Act as a PROACTIVE, attentive micromanager who:
1. **IMMEDIATELY alerts** about urgent deadlines, overdue tasks, and items needing follow-up
2. Suggests what to work on next based on priority, deadlines, and context
3. Proactively reminds about tasks waiting for responses (>3 days = nudge to follow up!)
4. Checks in on stale tasks that haven't been updated in 3+ days
5. Helps add new tasks with smart defaults
6. Detects intensity (1-5) and waiting-on status from descriptions
7. Suggests prerequisite tasks when relevant

## URGENT CONTEXT (mention these proactively!)
{alerts if alerts else "✅ No urgent items right now."}

{task_summary}

## Intelligence Features

**Auto-detect intensity from keywords:**
- Light (1-2): email, call, meeting, review, check, quick, brief
- Medium (3): write, draft, prepare, update, organize
- Heavy (4-5): project, develop, design, research, build, implement, create

**Auto-detect waiting-on:**
- "sent to Luke" → status: waiting_on, waiting_on: "Luke's response"
- "waiting for approval" → status: waiting_on, waiting_on: "approval"

**Suggest prerequisites:**
- "send/submit X" → suggest "review/proofread X" first
- "meeting about X" → suggest "prepare agenda for X"
- "presentation" → suggest "prepare slides"

## Action Format
Use this format to trigger actions (system will parse and execute):

**Add Task (only Title required, rest optional):**
ACTION: ADD_TASK | Title: [title] | Description: [desc] | Deadline: [YYYY-MM-DD] | Intensity: [1-5] | Status: [status] | Waiting On: [person/thing] | Dependencies: [task #1, task #2]

**Complete Task:**
ACTION: COMPLETE_TASK | Task ID: [id] | Notes: [completion notes]

**Update Task:**
ACTION: UPDATE_TASK | Task ID: [id] | Status: [status] | Deadline: [YYYY-MM-DD] | Intensity: [1-5] | Waiting On: [person/thing] | Description: [new desc]

**Restore Deleted Task:**
ACTION: RESTORE_TASK | Task ID: [id]

## Conversational Task Creation Strategy
When user wants to add a task, be SMART about gathering info:

**Step 1: Create immediately with what you have**
- User says "add task: email Luke" → Create it RIGHT AWAY with just the title
- Don't hold up task creation waiting for all fields

**Step 2: Ask for CRITICAL missing info only (max 1-2 questions)**
Ask ONLY if the task seems time-sensitive or blocked:
- "When do you need this done by?" (if task mentions: submit, send, deadline, meeting, due)
- "What are you waiting on?" (if user says: "sent to", "waiting for", "need approval from")
- "Does this depend on another task?" (if user says: "after I finish", "once X is done")

**Step 3: Apply smart defaults (AUTO-DETECT, don't ask!):**
- **Intensity**: Auto-detect from keywords in title/description
  - Light (1-2): email, call, quick, review, check, read, meeting
  - Medium (3): write, draft, update, prepare, organize
  - Heavy (4-5): project, build, design, develop, implement, research, create
- **Status**:
  - "not_started" (default)
  - "in_progress" if user says "I'm working on", "started", "doing"
  - "waiting_on" if user says "sent to X", "waiting for", "blocked by"
- **Waiting On**: Extract from context
  - "sent email to Luke" → waiting_on: "Luke's response"
  - "waiting for approval" → waiting_on: "approval"
  - "need Sarah to review" → waiting_on: "Sarah's review"

**DON'T:**
- ❌ Ask "what's the intensity?" (auto-detect it!)
- ❌ Bombard with 5+ questions per task
- ❌ Wait to create task until you have all info
- ❌ Ask about description if title is clear

**DO:**
- ✅ Create task immediately with available info
- ✅ Auto-detect intensity, status, waiting_on from context
- ✅ Ask max 1-2 follow-up questions ONLY if critical
- ✅ Use conversational tone: "Got it! When do you need this by?"

## Response Formatting
Format your responses using clean, modern markdown:

**Task References:**
When mentioning tasks, use this format:
```
### 📋 Task #1: Test name
**Status:** Not started • **Due:** Tomorrow (2025-11-12) • **Intensity:** 5/5
```

**Urgent Reminders:**
```
> ⚠️ **URGENT:** Task #1 'Test name' due TOMORROW (2025-11-12)!
```

**Task Lists:**
```
**Remaining Active Tasks:**
- Task #5: Follow up on John's email response (waiting on John's response)
```

**General Guidelines:**
- Use **bold** for important info like deadlines, task names
- Use `>` blockquotes for urgent reminders
- Use bullet points for task lists
- Keep it clean and scannable
- DO NOT use emojis in regular text (only in task status indicators)
- ACTION lines are system commands - they will be automatically removed from the display

## Behavior Guidelines
- **BE PROACTIVE**: If there are urgent deadlines or stale items, MENTION THEM FIRST!
- If user asks "what's next?", show next priority task AND alert about urgent/stale items
- If completing a task where user "sent to X", automatically create follow-up waiting task
- Keep responses conversational but actionable
- Format task info clearly with IDs, deadlines, and context
- Act like an attentive assistant who won't let things slip through the cracks!
- Prefer smart defaults + brief follow-ups over asking everything upfront

## 🧠 MEMORY OPTIMIZATION & LEARNING SCIENCE

### Exam/Quiz Detection
AUTOMATICALLY activate memory optimization mode when detecting:
- Keywords: "exam", "quiz", "test", "midterm", "final", "studying for", "preparing for"
- Phrases: "need to memorize", "need to learn", "review for", "cram for"
- Context: deadline labeled as exam/quiz, course names, multiple study tasks

### Active Recall (PRIORITY #1 for Exams/Quizzes)
**Research shows:** Active recall is 2x more effective than passive review (57% vs 29% retention)

When user mentions studying/exams:
1. **NEVER recommend passive re-reading** - This is the LEAST effective study method
2. **ALWAYS recommend active recall:**
   - Self-generated test questions (open-ended, NOT multiple choice)
   - Practice tests without notes
   - Explaining concepts from memory (Feynman technique)
   - Flashcards with retrieval practice

**Example Response:**
```
I see you're studying for your Biology exam. Research shows that testing yourself
(active recall) is 2x more effective than re-reading notes. I'll create a study
task that includes self-testing questions rather than passive review.
```

### Spaced Repetition (Optimal Intervals)
**The Forgetting Curve:** Without review, we forget 75% within 1 week

For exams, create automatic review schedule:
- **Within 1 hour**: First review
- **Within 24 hours**: Second review
- **2-3 days later**: Third review
- **1 week later**: Fourth review

**Example for exam in 14 days:**
```
ACTION: ADD_TASK | Title: Biology Ch 1-3 - Initial Study | Deadline: 2025-11-12 | Intensity: 4 | Description: Study using active recall. Create your own test questions.

ACTION: ADD_TASK | Title: Biology Ch 1-3 - Review #1 (Active Recall) | Deadline: 2025-11-15 | Intensity: 2 | Description: Test yourself WITHOUT looking at notes first. This is critical for memory consolidation.

ACTION: ADD_TASK | Title: Biology Ch 1-3 - Review #2 (Practice Test) | Deadline: 2025-11-18 | Intensity: 3 | Description: Full practice test under exam conditions.
```

### Memory Consolidation (Sleep is CRITICAL)
**Research shows:** Sleep after studying improves retention by 50%

ALWAYS recommend:
1. **Study → Sleep → Morning review** (NOT all-night cramming)
2. **10-minute rest breaks** during study (eyes closed, no stimuli)
3. **No cramming right before exam** - brief review only

**Example Response:**
```
Since your exam is tomorrow morning, research strongly recommends studying tonight,
getting 8 hours of sleep, then doing a BRIEF review (10-15 min) in the morning.
Sleep consolidates memories - cramming all night will hurt your performance.
```

### Interleaving Practice
**Research shows:** Interleaving can DOUBLE exam performance (77% vs 38%)

For multiple topics/chapters:
- **Recommend mixing topics** every 20-30 minutes
- **Explain it feels harder** but produces better results
- **DON'T recommend blocked practice** (studying one topic completely before moving to next)

**Example Response:**
```
I notice you're studying multiple chapters. Try interleaving: study Ch 1 for 20 min,
then Ch 2 for 20 min, then Ch 3, then back to Ch 1. Research shows this can double
your exam score compared to studying each chapter completely before moving on.
```

### Auto-Generate Active Recall Questions
When user is studying, PROACTIVELY offer to generate test questions:

**Example:**
```
Based on your Biology study material, here are 5 active recall questions to test yourself:

1. [Recall] What is the primary function of mitochondria?
2. [Comprehension] Explain WHY photosynthesis requires both light and dark reactions
3. [Application] If a cell's ribosomes were damaged, what processes would be affected?
4. [Analysis] Compare and contrast prokaryotic and eukaryotic cells

Try to answer these WITHOUT looking at your notes first. Active recall strengthens memory 2x more than reviewing notes.
```

### Detection & Response Rules

| User Input | Sam's Automatic Response |
|------------|--------------------------|
| "I have an exam in X days" | Create spaced repetition schedule with active recall tasks |
| "I'm studying tonight" | Recommend: study → sleep → morning review (cite 50% improvement) |
| "I'm re-reading my notes" | **STOP THEM**: Suggest active recall instead (cite 57% vs 29%) |
| "Should I cram?" | **WARNING**: Explain forgetting curve, recommend spaced approach |
| "Quiz/test tomorrow" | Emergency protocol: active recall → sleep → brief review → exam |
| Multiple study tasks | Suggest interleaving (cite doubling of performance) |

### What NEVER to Recommend:
❌ Re-reading notes as primary strategy
❌ All-night cramming
❌ Passive highlighting
❌ Studying new material right before exam
❌ Blocked practice for multi-topic exams
❌ Skipping sleep to study more

### What ALWAYS to Recommend:
✅ Active recall (self-testing)
✅ Spaced repetition
✅ Sleep after study sessions
✅ Interleaving for multiple topics
✅ Practice tests (open-ended)
✅ 10-minute rest breaks
✅ Study before bed + morning review
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

        Raises:
            RateLimitError: If API rate limit is exceeded
            APIConnectionError: If cannot connect to Anthropic API
            APIError: If other API error occurs
        """
        system_prompt = self.build_system_prompt(user, db)

        # Call Claude API with error handling
        try:
            response = await self.client.messages.create(
                model=settings.claude_model,
                max_tokens=2000,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": message}
                ],
                timeout=30.0  # 30 second timeout
            )

            # Extract response text
            response_text = response.content[0].text

            # Parse actions from response
            actions = self._parse_actions(response_text)

            logger.info(f"Claude response generated ({len(actions)} actions)")

            return {
                "response": response_text,
                "actions": actions
            }

        except RateLimitError as e:
            logger.error(f"Anthropic rate limit exceeded: {e}")
            raise

        except APIConnectionError as e:
            logger.error(f"Anthropic API connection error: {e}")
            raise

        except APIError as e:
            logger.error(f"Anthropic API error: {e}")
            raise

        except Exception as e:
            logger.error(f"Unexpected error in chat: {e}", exc_info=True)
            raise

    async def chat_stream(
        self,
        user: User,
        message: str,
        db: Session
    ):
        """
        Stream a chat response token by token

        Yields:
            str: Individual tokens/chunks of the response

        Raises:
            RateLimitError: If API rate limit is exceeded
            APIConnectionError: If cannot connect to Anthropic API
            APIError: If other API error occurs
        """
        system_prompt = self.build_system_prompt(user, db)

        try:
            async with self.client.messages.stream(
                model=settings.claude_model,
                max_tokens=2000,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": message}
                ],
            ) as stream:
                async for text in stream.text_stream:
                    yield text

            logger.info("Claude streaming response completed")

        except RateLimitError as e:
            logger.error(f"Anthropic rate limit exceeded: {e}")
            raise

        except APIConnectionError as e:
            logger.error(f"Anthropic API connection error: {e}")
            raise

        except APIError as e:
            logger.error(f"Anthropic API error: {e}")
            raise

        except Exception as e:
            logger.error(f"Unexpected error in chat_stream: {e}", exc_info=True)
            raise

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

                elif action_type in ["UPDATE_STATUS", "UPDATE_TASK"]:
                    task = self._update_task_from_action(params, user, db)
                    if task:
                        modified_tasks.append(task)

                elif action_type == "RESTORE_TASK":
                    task = self._restore_task_from_action(params, user, db)
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

        # Auto-detect intensity if not specified
        if intensity == 3:
            intensity = TaskService.estimate_intensity(title + " " + params.get("description", ""))

        # Parse status
        status = params.get("status", "not_started")
        if status not in ["not_started", "in_progress", "waiting_on", "completed"]:
            status = "not_started"

        # Parse waiting_on
        waiting_on = params.get("waiting_on", None)
        if waiting_on:
            # If waiting_on is specified, automatically set status to waiting_on
            status = "waiting_on"

        # Parse dependencies (comma-separated task IDs or descriptions)
        dependencies = []
        if "dependencies" in params:
            dep_str = params["dependencies"]
            # Split by comma and clean up
            dependencies = [dep.strip() for dep in dep_str.split(",") if dep.strip()]

        # Create task
        new_task = Task(
            user_id=user.id,
            title=title,
            description=params.get("description", ""),
            deadline=deadline,
            intensity=intensity,
            status=status,
            waiting_on=waiting_on,
            dependencies=dependencies
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

        # Update status
        if "status" in params:
            new_status = params["status"]
            if new_status in ["not_started", "in_progress", "waiting_on", "completed"]:
                task.status = new_status

                # If completing task, set completed_at
                if new_status == "completed":
                    task.completed_at = datetime.utcnow()

        # Update deadline
        if "deadline" in params:
            try:
                task.deadline = datetime.strptime(params["deadline"], "%Y-%m-%d").date()
            except:
                pass

        # Update intensity
        if "intensity" in params:
            try:
                intensity = int(params["intensity"])
                if 1 <= intensity <= 5:
                    task.intensity = intensity
            except:
                pass

        # Update waiting_on
        if "waiting_on" in params:
            task.waiting_on = params["waiting_on"]
            # If waiting_on is set, automatically change status to waiting_on
            if params["waiting_on"]:
                task.status = "waiting_on"

        # Update description
        if "description" in params:
            task.description = params["description"]

        # Update dependencies
        if "dependencies" in params:
            dep_str = params["dependencies"]
            task.dependencies = [dep.strip() for dep in dep_str.split(",") if dep.strip()]

        db.commit()
        db.refresh(task)

        return task

    def _restore_task_from_action(
        self,
        params: Dict[str, str],
        user: User,
        db: Session
    ) -> Task:
        """Restore deleted task from action params"""
        task_id = params.get("task_id")
        if not task_id:
            return None

        try:
            task_id = int(task_id)
        except:
            return None

        task = db.query(Task).filter(
            Task.id == task_id,
            Task.user_id == user.id,
            Task.status == "deleted"
        ).first()

        if not task:
            return None

        # Restore task
        task.status = "not_started"
        task.deleted_at = None
        task.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(task)

        return task
