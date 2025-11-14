"""
Integration tests for encrypted database models

Tests cover:
- User model encryption (email, full_name, email_hash)
- Task model encryption (title, description)
- ChatMessage model encryption (message, response)
- Database-level encryption verification
- TypeDecorator integration
"""
import os
import pytest
from cryptography.fernet import Fernet
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from datetime import datetime

# Set test encryption key
os.environ['ENCRYPTION_KEY'] = Fernet.generate_key().decode()

from database import Base
from models import User, Task, ChatMessage


@pytest.fixture(scope="function")
def test_db():
    """Create in-memory SQLite database for testing"""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

    # Create tables
    Base.metadata.create_all(bind=engine)

    # Create session
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    yield session

    # Cleanup
    session.close()
    Base.metadata.drop_all(bind=engine)


class TestUserEncryption:
    """Tests for User model encryption"""

    def test_user_email_encryption(self, test_db):
        """Test that email is encrypted in database but decrypted when accessed"""
        # Create user
        user = User(
            email="test@example.com",
            password_hash="hashed_password",
            full_name="Test User"
        )

        # Set email using helper method (generates email_hash)
        user.set_email("test@example.com")

        test_db.add(user)
        test_db.commit()
        test_db.refresh(user)

        # Access via ORM - should be decrypted
        assert user.email == "test@example.com"
        assert user.full_name == "Test User"

        # Verify email_hash was created
        assert user.email_hash is not None
        assert len(user.email_hash) == 64

        # Query raw database - should be encrypted
        result = test_db.execute(
            text("SELECT email, full_name FROM users WHERE id = :id"),
            {"id": user.id}
        ).fetchone()

        encrypted_email, encrypted_full_name = result

        # Raw values should NOT match plaintext
        assert encrypted_email != "test@example.com"
        assert encrypted_full_name != "Test User"

        # Raw values should be Fernet format
        assert encrypted_email.startswith('gAAAAA')
        assert encrypted_full_name.startswith('gAAAAA')

    def test_user_email_hash_lookup(self, test_db):
        """Test that email_hash enables fast lookups without decryption"""
        from app.core.encryption import get_encryption_service

        # Create user
        user = User(
            email="lookup@example.com",
            password_hash="hashed",
            full_name="Lookup User"
        )
        user.set_email("lookup@example.com")

        test_db.add(user)
        test_db.commit()

        # Lookup by email_hash (fast, no decryption needed)
        service = get_encryption_service()
        search_hash = service.generate_searchable_hash("lookup@example.com")

        found_user = test_db.query(User).filter(User.email_hash == search_hash).first()

        assert found_user is not None
        assert found_user.id == user.id
        assert found_user.email == "lookup@example.com"  # Decrypted automatically

    def test_user_null_full_name(self, test_db):
        """Test that NULL full_name is handled correctly"""
        user = User(
            email="null@example.com",
            password_hash="hashed",
            full_name=None
        )
        user.set_email("null@example.com")

        test_db.add(user)
        test_db.commit()
        test_db.refresh(user)

        # NULL should remain NULL
        assert user.full_name is None


class TestTaskEncryption:
    """Tests for Task model encryption"""

    def test_task_encryption(self, test_db):
        """Test that task title and description are encrypted"""
        # Create user first (foreign key requirement)
        user = User(
            email="task@example.com",
            password_hash="hashed"
        )
        user.set_email("task@example.com")
        test_db.add(user)
        test_db.commit()

        # Create task
        task = Task(
            user_id=user.id,
            title="Confidential Project",
            description="This is a secret project description with sensitive details",
            status="not_started"
        )

        test_db.add(task)
        test_db.commit()
        test_db.refresh(task)

        # Access via ORM - should be decrypted
        assert task.title == "Confidential Project"
        assert task.description == "This is a secret project description with sensitive details"

        # Query raw database - should be encrypted
        result = test_db.execute(
            text("SELECT title, description FROM tasks WHERE id = :id"),
            {"id": task.id}
        ).fetchone()

        encrypted_title, encrypted_description = result

        # Raw values should NOT match plaintext
        assert encrypted_title != "Confidential Project"
        assert encrypted_description != "This is a secret project description with sensitive details"

        # Raw values should be Fernet format
        assert encrypted_title.startswith('gAAAAA')
        assert encrypted_description.startswith('gAAAAA')

    def test_task_empty_description(self, test_db):
        """Test that empty description is handled correctly"""
        user = User(email="user@example.com", password_hash="hashed")
        user.set_email("user@example.com")
        test_db.add(user)
        test_db.commit()

        task = Task(
            user_id=user.id,
            title="Task with no description",
            description="",
            status="not_started"
        )

        test_db.add(task)
        test_db.commit()
        test_db.refresh(task)

        # Empty string should be preserved
        assert task.description == ""


class TestChatMessageEncryption:
    """Tests for ChatMessage model encryption"""

    def test_chat_message_encryption(self, test_db):
        """Test that chat messages and responses are encrypted"""
        # Create user
        user = User(email="chat@example.com", password_hash="hashed")
        user.set_email("chat@example.com")
        test_db.add(user)
        test_db.commit()

        # Create chat message
        chat = ChatMessage(
            user_id=user.id,
            message="What is my bank account balance?",
            response="Your current balance is $5,234.56 in account ****1234"
        )

        test_db.add(chat)
        test_db.commit()
        test_db.refresh(chat)

        # Access via ORM - should be decrypted
        assert chat.message == "What is my bank account balance?"
        assert chat.response == "Your current balance is $5,234.56 in account ****1234"

        # Query raw database - should be encrypted
        result = test_db.execute(
            text("SELECT message, response FROM chat_history WHERE id = :id"),
            {"id": chat.id}
        ).fetchone()

        encrypted_message, encrypted_response = result

        # Raw values should NOT match plaintext
        assert encrypted_message != "What is my bank account balance?"
        assert encrypted_response != "Your current balance is $5,234.56 in account ****1234"

        # Sensitive data should not be visible in database
        assert "$5,234.56" not in encrypted_response
        assert "1234" not in encrypted_response

        # Raw values should be Fernet format
        assert encrypted_message.startswith('gAAAAA')
        assert encrypted_response.startswith('gAAAAA')

    def test_large_chat_messages(self, test_db):
        """Test that large chat messages are encrypted correctly"""
        user = User(email="large@example.com", password_hash="hashed")
        user.set_email("large@example.com")
        test_db.add(user)
        test_db.commit()

        # Create large message (simulate long conversation)
        large_message = "A" * 5000
        large_response = "B" * 10000

        chat = ChatMessage(
            user_id=user.id,
            message=large_message,
            response=large_response
        )

        test_db.add(chat)
        test_db.commit()
        test_db.refresh(chat)

        # Should decrypt correctly
        assert chat.message == large_message
        assert chat.response == large_response
        assert len(chat.message) == 5000
        assert len(chat.response) == 10000


class TestDatabaseIntegration:
    """Integration tests for database operations with encryption"""

    def test_query_by_encrypted_field_exact_match(self, test_db):
        """Test exact match queries on encrypted fields"""
        # Create users
        user1 = User(email="alice@example.com", password_hash="hash1")
        user1.set_email("alice@example.com")

        user2 = User(email="bob@example.com", password_hash="hash2")
        user2.set_email("bob@example.com")

        test_db.add_all([user1, user2])
        test_db.commit()

        # Query by encrypted email (using email_hash)
        from app.core.encryption import get_encryption_service
        service = get_encryption_service()

        alice_hash = service.generate_searchable_hash("alice@example.com")
        found = test_db.query(User).filter(User.email_hash == alice_hash).first()

        assert found is not None
        assert found.email == "alice@example.com"

    def test_relationships_with_encryption(self, test_db):
        """Test that relationships work correctly with encrypted fields"""
        # Create user
        user = User(email="rel@example.com", password_hash="hash")
        user.set_email("rel@example.com")
        test_db.add(user)
        test_db.commit()

        # Create tasks
        task1 = Task(user_id=user.id, title="Task 1", description="Desc 1", status="not_started")
        task2 = Task(user_id=user.id, title="Task 2", description="Desc 2", status="not_started")

        test_db.add_all([task1, task2])
        test_db.commit()

        # Access via relationship
        test_db.refresh(user)
        assert len(user.tasks) == 2
        assert user.tasks[0].title in ["Task 1", "Task 2"]
        assert user.tasks[1].title in ["Task 1", "Task 2"]

    def test_bulk_operations(self, test_db):
        """Test bulk insert and query operations"""
        # Bulk create users
        users = [
            User(email=f"user{i}@example.com", password_hash="hash")
            for i in range(100)
        ]

        # Set email and hash for each
        for user in users:
            user.set_email(user.email)

        test_db.add_all(users)
        test_db.commit()

        # Query all
        all_users = test_db.query(User).all()
        assert len(all_users) == 100

        # All should have encrypted emails
        for user in all_users:
            assert "@example.com" in user.email  # Decrypted
            assert user.email_hash is not None


class TestEncryptionErrors:
    """Tests for error handling in encryption"""

    def test_decryption_with_wrong_key(self, test_db):
        """Test that changing encryption key causes decryption errors"""
        # Create user with current key
        user = User(email="error@example.com", password_hash="hash")
        user.set_email("error@example.com")
        test_db.add(user)
        test_db.commit()

        user_id = user.id

        # Change encryption key
        new_key = Fernet.generate_key().decode()
        os.environ['ENCRYPTION_KEY'] = new_key

        # Clear singleton cache to force new key
        from app.core.encryption import get_encryption_service
        get_encryption_service.cache_clear()

        # Try to access encrypted data with wrong key
        with pytest.raises(ValueError, match="Failed to decrypt"):
            user_refresh = test_db.query(User).filter(User.id == user_id).first()
            _ = user_refresh.email  # Triggers decryption


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
