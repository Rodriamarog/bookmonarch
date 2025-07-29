#!/usr/bin/env python3
"""
Test Flask app without authentication for debugging.
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set development environment
os.environ['FLASK_ENV'] = 'development'
os.environ['FLASK_DEBUG'] = 'true'
os.environ['CORS_ORIGINS'] = 'http://localhost:3000'

print("🔧 Starting Flask without authentication for testing...")

# Temporarily disable authentication by modifying the decorator
def mock_require_auth(f):
    """Mock authentication decorator that always passes."""
    def wrapper(*args, **kwargs):
        from flask import g
        g.user_id = "test_user_123"  # Mock user ID
        g.user_email = "test@example.com"
        g.user_role = "authenticated"
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

# Replace the auth decorator
import lib.auth
lib.auth.require_auth = mock_require_auth

# Now import and start the app
from app import app

print("✅ Flask app loaded with mock authentication")
print("🌟 Starting Flask development server...")
print("📍 API available at: http://localhost:5000")
print("📍 Health check: http://localhost:5000/api/health")
print("⚠️  Authentication is DISABLED for testing")

app.run(host='0.0.0.0', port=5000, debug=True)