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
    Permanently delete completed and deleted tasks older than retention_days

    Args:
        db: Database session
        retention_days: Number of days to keep completed/deleted tasks (default: 7)

    Returns:
        Number of tasks permanently deleted
    """
    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)

    # Find old completed tasks
    old_completed = db.query(Task).filter(
        Task.status == "completed",
        Task.completed_at < cutoff_date
    ).all()

    # Find old deleted tasks (in trash)
    old_deleted = db.query(Task).filter(
        Task.status == "deleted",
        Task.deleted_at < cutoff_date
    ).all()

    total_count = len(old_completed) + len(old_deleted)

    if total_count > 0:
        for task in old_completed + old_deleted:
            db.delete(task)
        db.commit()
        logger.info(f"Permanently deleted {len(old_completed)} completed tasks and {len(old_deleted)} deleted tasks older than {retention_days} days")
    else:
        logger.debug(f"No completed or deleted tasks older than {retention_days} days to delete")

    return total_count
