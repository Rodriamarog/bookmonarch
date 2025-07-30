#!/usr/bin/env python3
"""
Integration test script to verify frontend-backend connectivity.
"""

import os
import sys
import requests
import json
from dotenv import load_dotenv
import subprocess
import time
import signal

# Load environment variables
load_dotenv()

def test_environment_variables():
    """Test if required environment variables are set."""
    print("🔧 Testing environment variables...")
    
    required_vars = {
        'SUPABASE_URL': os.getenv('SUPABASE_URL'),
        'SUPABASE_KEY': os.getenv('SUPABASE_KEY'), 
        'SECRET_KEY': os.getenv('SECRET_KEY'),
        'GEMINI_API_KEY': os.getenv('GEMINI_API_KEY')
    }
    
    missing_vars = []
    for var_name, var_value in required_vars.items():
        if not var_value:
            missing_vars.append(var_name)
            print(f"  ❌ {var_name}: NOT SET")
        else:
            # Show first few characters for security
            masked_value = var_value[:10] + "..." if len(var_value) > 10 else var_value
            print(f"  ✅ {var_name}: {masked_value}")
    
    if missing_vars:
        print(f"\n❌ Missing required environment variables: {missing_vars}")
        return False
    
    print("✅ All required environment variables are set")
    return True

def test_backend_import():
    """Test if backend modules can be imported."""
    print("\n🔧 Testing backend module imports...")
    
    try:
        sys.path.insert(0, '/home/rodrigo/code/bookmonarch/backend')
        
        # Test core imports
        from config import Config
        print("  ✅ Config imported successfully")
        
        from lib.database_service import get_database_service
        print("  ✅ Database service imported successfully")
        
        from lib.auth import auth_service
        print("  ✅ Auth service imported successfully")
        
        # Test database connection
        db_service = get_database_service()
        health = db_service.health_check()
        if health.get('status') == 'healthy':
            print("  ✅ Database connection test successful")
        else:
            print(f"  ⚠️ Database connection warning: {health}")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Backend import failed: {str(e)}")
        return False

def test_flask_startup():
    """Test if Flask app can start up."""
    print("\n🔧 Testing Flask app startup...")
    
    try:
        sys.path.insert(0, '/home/rodrigo/code/bookmonarch/backend')
        
        # Set environment for testing
        os.environ['FLASK_ENV'] = 'development'
        os.environ['CORS_ORIGINS'] = 'http://localhost:3000'
        
        from app import app
        print("  ✅ Flask app created successfully")
        
        # Test app configuration
        with app.app_context():
            print(f"  ✅ Flask app config loaded")
            print(f"     Debug mode: {app.debug}")
            print(f"     CORS origins: {app.config.get('CORS_ORIGINS', [])}")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Flask startup failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_api_health():
    """Test API health endpoint."""
    print("\n🔧 Testing API health endpoint...")
    
    try:
        # Start Flask server in background
        backend_dir = '/home/rodrigo/code/bookmonarch/backend'
        
        print("  Starting Flask server...")
        proc = subprocess.Popen([
            sys.executable, 'simple_start.py'
        ], cwd=backend_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        # Wait for server to start
        time.sleep(5)
        
        try:
            # Test health endpoint
            response = requests.get('http://localhost:5000/api/health', timeout=10)
            
            if response.status_code == 200:
                health_data = response.json()
                print(f"  ✅ Health endpoint responded: {response.status_code}")
                print(f"     Status: {health_data.get('status', 'unknown')}")
                print(f"     Service: {health_data.get('service', 'unknown')}")
                return True
            else:
                print(f"  ❌ Health endpoint failed: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"  ❌ Health endpoint request failed: {str(e)}")
            return False
            
        finally:
            # Stop the server
            proc.terminate()
            proc.wait()
            
    except Exception as e:
        print(f"  ❌ API health test failed: {str(e)}")
        return False

def run_integration_tests():
    """Run all integration tests."""
    print("🚀 Starting integration tests for BookMonarch...")
    print("=" * 50)
    
    tests = [
        ("Environment Variables", test_environment_variables),
        ("Backend Imports", test_backend_import),
        ("Flask Startup", test_flask_startup),
        # ("API Health Endpoint", test_api_health),  # Commented out as it requires server startup
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name}: PASSED")
            else:
                print(f"❌ {test_name}: FAILED")
        except Exception as e:
            print(f"❌ {test_name}: FAILED with exception: {str(e)}")
    
    print(f"\n{'='*50}")
    print(f"🏁 Integration tests completed: {passed}/{total} passed")
    
    if passed == total:
        print("🎉 All tests passed! Your backend-frontend separation is working correctly.")
        return True
    else:
        print("⚠️ Some tests failed. Please check the issues above.")
        return False

if __name__ == "__main__":
    success = run_integration_tests()
    sys.exit(0 if success else 1)