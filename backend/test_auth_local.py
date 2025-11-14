"""
Test auth functionality locally with Railway database
"""
import os
os.environ['ENCRYPTION_KEY'] = 'lTcAKMYTH7YykUF2MmnfJmcrq0fmyoNPw8seNsnnGHg='
os.environ['DATABASE_URL'] = 'postgresql://postgres:WzCiguXxsRDVTMBkUGKzLFwsUyBNIwLB@mainline.proxy.rlwy.net:21031/railway'
os.environ['SECRET_KEY'] = 'PlAleO1ujA2AeYFwwDNePJXXkgNyCumuryzd4YJo2pM'

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import User
from app.core.encryption import get_encryption_service
from auth.utils import get_password_hash

# Create database session
engine = create_engine(os.environ['DATABASE_URL'])
Session = sessionmaker(bind=engine)
db = Session()

# Test encryption service
encryption_service = get_encryption_service()
print("Encryption service initialized successfully")

# Test creating a user
test_email = "local_test@example.com"
test_password = "TestPassword123456"
test_name = "Local Test User"

# Generate email hash
email_hash = encryption_service.generate_searchable_hash(test_email)
print(f"Email hash generated: {email_hash[:16]}...")

# Check if user exists
existing = db.query(User).filter(User.email_hash == email_hash).first()
if existing:
    print(f"User already exists, deleting...")
    db.delete(existing)
    db.commit()

# Create new user
hashed_password = get_password_hash(test_password)
print("Password hashed successfully")

new_user = User(password_hash=hashed_password)
new_user.set_email(test_email)
new_user.full_name = test_name

print(f"User object created")
print(f"  email (encrypted): {new_user.email[:20] if new_user.email else 'None'}...")
print(f"  email_hash: {new_user.email_hash[:16]}...")
print(f"  full_name (encrypted): {new_user.full_name[:20] if new_user.full_name else 'None'}...")

try:
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    print(f"\n✓ User created successfully! ID: {new_user.id}")

    # Test decryption
    print(f"  Decrypted email: {new_user.email}")
    print(f"  Decrypted name: {new_user.full_name}")

except Exception as e:
    print(f"\n✗ Error creating user: {e}")
    import traceback
    traceback.print_exc()

db.close()
