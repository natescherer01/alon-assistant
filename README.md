# Personal AI Assistant

A smart task management system that acts as your personal micromanager, helping you stay organized and productive.

## Features

- **Intelligent Task Prioritization**: Automatically prioritizes tasks based on deadlines, intensity, and dependencies
- **Smart Auto-Detection**: Detects task intensity and waiting-on status from your descriptions
- **Proactive Reminders**: Tracks tasks waiting for responses and prompts you to follow up
- **Prerequisite Suggestions**: Suggests tasks you might need to complete first
- **Deadline Tracking**: Keeps you aware of upcoming and overdue tasks
- **Dependency Management**: Ensures you complete tasks in the right order

## Quick Start

### Using the /assistant Command (Recommended)

The easiest way to use the system is through the `/assistant` slash command in Claude Code:

```
/assistant
```

This launches an interactive session where you can:
- Ask "What's next?" to get your next task
- Say "Add task: [description]" to add new tasks
- Report completions: "I finished [task] and sent it to [person]"
- Check on waiting items and get follow-up prompts

### Direct Python Usage

You can also use the Python CLI directly:

```bash
cd "personal_assistant"

# Add a task
python assistant.py add "Write technical brief" --deadline 2025-11-05 --intensity 4

# See what to do next
python assistant.py next

# Get a light task
python assistant.py next light

# Complete a task
python assistant.py complete 1 "Finished and sent to Luke for review"

# List all tasks
python assistant.py list

# List waiting tasks
python assistant.py list waiting

# List upcoming tasks
python assistant.py list upcoming

# Show task details
python assistant.py show 1

# Update task status
python assistant.py update 1 in_progress "Started working on this"
```

## Task Attributes

Each task tracks:
- **Title & Description**: What needs to be done
- **Deadline**: When it's due (YYYY-MM-DD format)
- **Intensity**: 1-5 scale (1=very light, 5=very heavy)
- **Status**: not_started, in_progress, waiting_on, completed
- **Dependencies**: Other tasks or people this depends on
- **Waiting-on**: Who/what you're waiting for

## Intelligence Features

### Auto-Detect Intensity

The system automatically estimates task intensity from keywords:

- **Light (1-2)**: email, call, meeting, review, check, quick, brief
- **Medium (3)**: write, draft, prepare, update, organize
- **Heavy (4-5)**: project, develop, design, research, build, implement, create

Example: "Quick email to team" → Intensity 2 (Light)

### Auto-Detect Waiting Status

Automatically detects when you're waiting on someone:

- "Sent to Luke" → Status: waiting_on, Waiting on: "Luke's response"
- "Waiting for design approval" → Status: waiting_on, Waiting on: "design approval"

### Prerequisite Suggestions

Suggests tasks you might need to do first:

- "Send report" → Suggests: "Review/proofread before sending"
- "Team meeting" → Suggests: "Prepare agenda for meeting"
- "Give presentation" → Suggests: "Prepare presentation slides"

### Smart Prioritization

Tasks are prioritized based on:
1. **Deadline urgency** (overdue > today > tomorrow > this week)
2. **Task intensity** (higher intensity = higher priority)
3. **Current status** (in_progress tasks get a boost)
4. **Dependencies** (won't show until prerequisites are done)

## Example Workflows

### Morning Check-in

```
/assistant
"What's next?"
```

You'll see:
- Your highest priority task
- Upcoming tasks in the next 7 days
- Tasks waiting for responses (with follow-up prompts if >3 days old)

### Adding a Task

```
/assistant
"Add task: Prepare quarterly sales report, due Nov 10"
```

System will:
- Auto-detect intensity (4-heavy, because "prepare" + "report")
- Suggest prerequisites ("Gather sales data")
- Create the task with proper deadline

### Completing a Task

```
/assistant
"I finished the technical brief and sent it to Luke"
```

System will:
- Mark task as completed
- Auto-detect waiting status
- Create follow-up task to check for Luke's response
- Ask what you want to work on next

### Checking Waiting Items

```
/assistant
"Show me what I'm waiting on"
```

You'll see:
- All tasks in waiting_on status
- How long you've been waiting
- Suggestions to follow up if >3 days

## File Structure

```
personal AI/
├── .claude/
│   └── commands/
│       └── assistant.md          # Slash command definition
├── personal_assistant/
│   ├── assistant.py              # Main Python program
│   ├── data/
│   │   ├── tasks.json           # Task storage
│   │   └── context.json         # System context
│   └── requirements.txt         # Dependencies (none needed!)
└── README.md                    # This file
```

## Requirements

- Python 3.7 or higher
- No external dependencies (uses only Python standard library)

## Data Storage

All data is stored locally in JSON files:
- `personal_assistant/data/tasks.json` - Your tasks
- `personal_assistant/data/context.json` - System state

These files are created automatically on first use.

## Tips for Best Results

1. **Be specific with deadlines**: The system prioritizes based on deadlines
2. **Let auto-detection work**: Just describe tasks naturally, the system will detect intensity and waiting status
3. **Check in regularly**: Use "What's next?" to stay on track
4. **Report completions fully**: Include what happened (sent to who, waiting for what)
5. **Use intensity filters**: "What's next light" when you only have a few minutes

## Future Enhancements (Not in MVP)

Potential additions:
- Recurring tasks
- Time tracking
- Calendar integration
- Email/notification support
- Task templates
- Project grouping
- Analytics and productivity insights

---

Built with Claude Code
