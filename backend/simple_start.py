#!/usr/bin/env python3
"""
Simple Flask startup script for testing.
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set development environment
os.environ['FLASK_ENV'] = 'development'
os.environ['FLASK_DEBUG'] = 'true'
os.environ['CORS_ORIGINS'] = 'http://localhost:3000'

print("🔧 Environment variables loaded:")
print(f"SUPABASE_URL: {os.getenv('SUPABASE_URL', 'NOT SET')[:30]}...")
print(f"SECRET_KEY: {os.getenv('SECRET_KEY', 'NOT SET')[:20]}...")
print(f"GEMINI_API_KEY: {os.getenv('GEMINI_API_KEY', 'NOT SET')[:20]}...")

try:
    from app import app
    print("✅ Flask app imported successfully")
    
    print("🌟 Starting Flask development server...")
    print("📍 API available at: http://localhost:5000")
    print("📍 Health check: http://localhost:5000/api/health")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
    
except Exception as e:
    print(f"❌ Error starting Flask app: {e}")
    import traceback
    traceback.print_exc()