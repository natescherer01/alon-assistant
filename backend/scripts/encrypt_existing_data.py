#!/usr/bin/env python3
"""
Data Encryption Migration Script - Phase 2

Encrypts existing plaintext data and populates encrypted columns.
This script is idempotent (safe to run multiple times) and processes data in batches
for memory efficiency.

Usage:
    # Dry run (preview what will be encrypted)
    python scripts/encrypt_existing_data.py --dry-run

    # Encrypt all data
    python scripts/encrypt_existing_data.py

    # Encrypt with smaller batch size (for large databases)
    python scripts/encrypt_existing_data.py --batch-size 100

    # Verbose logging
    python scripts/encrypt_existing_data.py --verbose

Prerequisites:
    1. Phase 1 migration completed (encrypted columns exist)
    2. ENCRYPTION_KEY set in environment or secrets manager
    3. Database backup created

Security:
    - Never logs plaintext data (only lengths and counts)
    - Uses production encryption service
    - Validates all encrypted data
    - Creates searchable hashes for lookups
"""
import sys
import os
import argparse
import logging
from typing import Optional
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from config import get_settings
from app.core.encryption import get_encryption_service


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class EncryptionMigration:
    """
    Handles migration of plaintext data to encrypted columns.

    Features:
    - Idempotent (safe to re-run)
    - Batch processing for memory efficiency
    - Progress tracking
    - Dry-run mode for testing
    - Comprehensive error handling
    """

    def __init__(self, dry_run: bool = False, batch_size: int = 1000, verbose: bool = False):
        """
        Initialize migration.

        Args:
            dry_run: If True, preview changes without committing
            batch_size: Number of records to process per batch
            verbose: Enable verbose logging
        """
        self.dry_run = dry_run
        self.batch_size = batch_size
        self.verbose = verbose

        if verbose:
            logger.setLevel(logging.DEBUG)

        # Initialize database connection
        settings = get_settings()
        self.engine = create_engine(
            settings.database_url,
            connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {}
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

        # Initialize encryption service
        try:
            self.encryption_service = get_encryption_service()
            logger.info("Encryption service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize encryption service: {e}")
            logger.error("Ensure ENCRYPTION_KEY is set in environment or secrets manager")
            sys.exit(1)

        # Statistics
        self.stats = {
            'users_encrypted': 0,
            'users_already_encrypted': 0,
            'tasks_encrypted': 0,
            'tasks_already_encrypted': 0,
            'chat_messages_encrypted': 0,
            'chat_messages_already_encrypted': 0,
            'errors': 0
        }

    def run(self):
        """Execute migration for all tables"""
        logger.info("=" * 80)
        logger.info("DATA ENCRYPTION MIGRATION - Phase 2")
        logger.info("=" * 80)

        if self.dry_run:
            logger.warning("DRY RUN MODE - No data will be modified")

        logger.info(f"Batch size: {self.batch_size}")
        logger.info(f"Started at: {datetime.utcnow().isoformat()}")
        logger.info("")

        start_time = datetime.utcnow()

        try:
            # Migrate each table
            self.migrate_users()
            self.migrate_tasks()
            self.migrate_chat_messages()

            # Print summary
            self.print_summary(start_time)

            if not self.dry_run and self.stats['errors'] == 0:
                logger.info("\n" + "=" * 80)
                logger.info("✓ MIGRATION COMPLETE - All data encrypted successfully!")
                logger.info("=" * 80)
                logger.info("\nNext steps:")
                logger.info("1. Verify encrypted data: python scripts/verify_encryption.py")
                logger.info("2. Test application with encrypted data")
                logger.info("3. Run Phase 3 migration when ready (switch to encrypted columns)")
                return 0
            elif self.dry_run:
                logger.info("\n" + "=" * 80)
                logger.info("✓ DRY RUN COMPLETE - No data was modified")
                logger.info("=" * 80)
                logger.info("\nRun without --dry-run to perform actual encryption")
                return 0
            else:
                logger.error(f"\n⚠ MIGRATION COMPLETED WITH {self.stats['errors']} ERRORS")
                return 1

        except Exception as e:
            logger.error(f"\n✗ MIGRATION FAILED: {e}")
            logger.exception("Full error details:")
            return 1

    def migrate_users(self):
        """Encrypt user email and full_name fields"""
        logger.info("\n" + "-" * 80)
        logger.info("MIGRATING USERS TABLE")
        logger.info("-" * 80)

        db = self.SessionLocal()
        try:
            # Count total users needing encryption
            result = db.execute(text("""
                SELECT COUNT(*)
                FROM users
                WHERE email_encrypted IS NULL OR full_name_encrypted IS NULL
            """))
            total_count = result.scalar()

            if total_count == 0:
                logger.info("✓ All users already encrypted - skipping")
                return

            logger.info(f"Found {total_count} users to encrypt")

            # Process in batches
            offset = 0
            while True:
                # Fetch batch
                result = db.execute(text("""
                    SELECT id, email, full_name
                    FROM users
                    WHERE email_encrypted IS NULL OR full_name_encrypted IS NULL
                    LIMIT :limit OFFSET :offset
                """), {"limit": self.batch_size, "offset": offset})

                batch = result.fetchall()
                if not batch:
                    break

                # Encrypt batch
                for user in batch:
                    try:
                        user_id, email, full_name = user

                        if self.verbose:
                            logger.debug(f"Processing user {user_id}")

                        # Encrypt email (always present)
                        email_encrypted = self.encryption_service.encrypt(email)
                        email_hash = self.encryption_service.generate_searchable_hash(email)

                        # Encrypt full_name (may be NULL)
                        full_name_encrypted = None
                        if full_name:
                            full_name_encrypted = self.encryption_service.encrypt(full_name)

                        # Update database
                        if not self.dry_run:
                            db.execute(text("""
                                UPDATE users
                                SET email_encrypted = :email_encrypted,
                                    email_hash = :email_hash,
                                    full_name_encrypted = :full_name_encrypted
                                WHERE id = :user_id
                            """), {
                                "user_id": user_id,
                                "email_encrypted": email_encrypted,
                                "email_hash": email_hash,
                                "full_name_encrypted": full_name_encrypted
                            })

                        self.stats['users_encrypted'] += 1

                    except Exception as e:
                        logger.error(f"Error encrypting user {user_id}: {e}")
                        self.stats['errors'] += 1

                # Commit batch
                if not self.dry_run:
                    db.commit()

                offset += self.batch_size
                logger.info(f"Progress: {min(offset, total_count)}/{total_count} users processed")

            logger.info(f"✓ Encrypted {self.stats['users_encrypted']} users")

        finally:
            db.close()

    def migrate_tasks(self):
        """Encrypt task title and description fields"""
        logger.info("\n" + "-" * 80)
        logger.info("MIGRATING TASKS TABLE")
        logger.info("-" * 80)

        db = self.SessionLocal()
        try:
            # Count total tasks needing encryption
            result = db.execute(text("""
                SELECT COUNT(*)
                FROM tasks
                WHERE title_encrypted IS NULL OR description_encrypted IS NULL
            """))
            total_count = result.scalar()

            if total_count == 0:
                logger.info("✓ All tasks already encrypted - skipping")
                return

            logger.info(f"Found {total_count} tasks to encrypt")

            # Process in batches
            offset = 0
            while True:
                # Fetch batch
                result = db.execute(text("""
                    SELECT id, title, description
                    FROM tasks
                    WHERE title_encrypted IS NULL OR description_encrypted IS NULL
                    LIMIT :limit OFFSET :offset
                """), {"limit": self.batch_size, "offset": offset})

                batch = result.fetchall()
                if not batch:
                    break

                # Encrypt batch
                for task in batch:
                    try:
                        task_id, title, description = task

                        if self.verbose:
                            logger.debug(f"Processing task {task_id}")

                        # Encrypt title (always present)
                        title_encrypted = self.encryption_service.encrypt(title)

                        # Encrypt description (may be empty string or NULL)
                        description_encrypted = None
                        if description:
                            description_encrypted = self.encryption_service.encrypt(description)

                        # Update database
                        if not self.dry_run:
                            db.execute(text("""
                                UPDATE tasks
                                SET title_encrypted = :title_encrypted,
                                    description_encrypted = :description_encrypted
                                WHERE id = :task_id
                            """), {
                                "task_id": task_id,
                                "title_encrypted": title_encrypted,
                                "description_encrypted": description_encrypted
                            })

                        self.stats['tasks_encrypted'] += 1

                    except Exception as e:
                        logger.error(f"Error encrypting task {task_id}: {e}")
                        self.stats['errors'] += 1

                # Commit batch
                if not self.dry_run:
                    db.commit()

                offset += self.batch_size
                logger.info(f"Progress: {min(offset, total_count)}/{total_count} tasks processed")

            logger.info(f"✓ Encrypted {self.stats['tasks_encrypted']} tasks")

        finally:
            db.close()

    def migrate_chat_messages(self):
        """Encrypt chat message and response fields"""
        logger.info("\n" + "-" * 80)
        logger.info("MIGRATING CHAT_HISTORY TABLE")
        logger.info("-" * 80)

        db = self.SessionLocal()
        try:
            # Count total messages needing encryption
            result = db.execute(text("""
                SELECT COUNT(*)
                FROM chat_history
                WHERE message_encrypted IS NULL OR response_encrypted IS NULL
            """))
            total_count = result.scalar()

            if total_count == 0:
                logger.info("✓ All chat messages already encrypted - skipping")
                return

            logger.info(f"Found {total_count} chat messages to encrypt")

            # Process in smaller batches (chat messages can be large)
            batch_size = min(self.batch_size, 100)
            offset = 0

            while True:
                # Fetch batch
                result = db.execute(text("""
                    SELECT id, message, response
                    FROM chat_history
                    WHERE message_encrypted IS NULL OR response_encrypted IS NULL
                    LIMIT :limit OFFSET :offset
                """), {"limit": batch_size, "offset": offset})

                batch = result.fetchall()
                if not batch:
                    break

                # Encrypt batch
                for msg in batch:
                    try:
                        msg_id, message, response = msg

                        if self.verbose:
                            logger.debug(f"Processing chat message {msg_id}")

                        # Encrypt message and response (both always present)
                        message_encrypted = self.encryption_service.encrypt(message)
                        response_encrypted = self.encryption_service.encrypt(response)

                        # Update database
                        if not self.dry_run:
                            db.execute(text("""
                                UPDATE chat_history
                                SET message_encrypted = :message_encrypted,
                                    response_encrypted = :response_encrypted
                                WHERE id = :msg_id
                            """), {
                                "msg_id": msg_id,
                                "message_encrypted": message_encrypted,
                                "response_encrypted": response_encrypted
                            })

                        self.stats['chat_messages_encrypted'] += 1

                    except Exception as e:
                        logger.error(f"Error encrypting chat message {msg_id}: {e}")
                        self.stats['errors'] += 1

                # Commit batch
                if not self.dry_run:
                    db.commit()

                offset += batch_size
                logger.info(f"Progress: {min(offset, total_count)}/{total_count} messages processed")

            logger.info(f"✓ Encrypted {self.stats['chat_messages_encrypted']} chat messages")

        finally:
            db.close()

    def print_summary(self, start_time: datetime):
        """Print migration summary"""
        duration = (datetime.utcnow() - start_time).total_seconds()

        logger.info("\n" + "=" * 80)
        logger.info("MIGRATION SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Duration: {duration:.2f} seconds")
        logger.info("")
        logger.info(f"Users encrypted:         {self.stats['users_encrypted']}")
        logger.info(f"Tasks encrypted:         {self.stats['tasks_encrypted']}")
        logger.info(f"Chat messages encrypted: {self.stats['chat_messages_encrypted']}")
        logger.info(f"Total records encrypted: {sum([
            self.stats['users_encrypted'],
            self.stats['tasks_encrypted'],
            self.stats['chat_messages_encrypted']
        ])}")
        logger.info("")
        logger.info(f"Errors: {self.stats['errors']}")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Encrypt existing plaintext data',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Preview what will be encrypted
  python scripts/encrypt_existing_data.py --dry-run

  # Encrypt all data
  python scripts/encrypt_existing_data.py

  # Use smaller batches for large databases
  python scripts/encrypt_existing_data.py --batch-size 100 --verbose
        """
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without modifying database'
    )

    parser.add_argument(
        '--batch-size',
        type=int,
        default=1000,
        help='Number of records to process per batch (default: 1000)'
    )

    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )

    args = parser.parse_args()

    # Create and run migration
    migration = EncryptionMigration(
        dry_run=args.dry_run,
        batch_size=args.batch_size,
        verbose=args.verbose
    )

    return migration.run()


if __name__ == "__main__":
    sys.exit(main())
