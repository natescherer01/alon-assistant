"""
Task cleanup service for data retention policies
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import Task
from logger import get_logger

logger = get_logger(__name__)


def cleanup_old_completed_tasks(db: Session, retention_days: int = 7) -> int:
    """
    Delete completed tasks older than retention_days

    Args:
        db: Database session
        retention_days: Number of days to keep completed tasks (default: 7)

    Returns:
        Number of tasks deleted
    """
    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)

    # Find and delete old completed tasks
    old_tasks = db.query(Task).filter(
        Task.status == "completed",
        Task.completed_at < cutoff_date
    ).all()

    count = len(old_tasks)

    if count > 0:
        for task in old_tasks:
            db.delete(task)
        db.commit()
        logger.info(f"Deleted {count} completed tasks older than {retention_days} days")
    else:
        logger.debug(f"No completed tasks older than {retention_days} days to delete")

    return count
