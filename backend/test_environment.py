#!/usr/bin/env python3
"""
Quick environment test script to verify all required variables are loaded.
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_environment():
    """Test that all required environment variables are set."""
    
    print("🔧 Testing Environment Configuration...")
    print("=" * 50)
    
    # Required environment variables
    required_vars = {
        'SUPABASE_URL': 'Supabase project URL',
        'SECRET_KEY': 'Supabase service role key',
        'SUPABASE_KEY': 'Supabase anonymous key',
        'GEMINI_API_KEY': 'Google Gemini API key'
    }
    
    all_good = True
    
    for var_name, description in required_vars.items():
        value = os.getenv(var_name)
        
        if value:
            # Show partial value for security
            if len(value) > 20:
                display_value = value[:10] + "..." + value[-5:]
            else:
                display_value = value[:5] + "..."
            
            print(f"✅ {var_name}: {display_value}")
            print(f"   Description: {description}")
            
            # Additional validation
            if var_name == 'SUPABASE_URL' and not value.startswith('https://'):
                print(f"   ⚠️  Warning: Should start with https://")
            elif var_name == 'GEMINI_API_KEY' and not value.startswith('AI'):
                print(f"   ⚠️  Warning: Should start with 'AI'")
            elif var_name in ['SECRET_KEY', 'SUPABASE_KEY'] and len(value) < 100:
                print(f"   ⚠️  Warning: Seems too short for a JWT token")
                
        else:
            print(f"❌ {var_name}: NOT SET")
            print(f"   Description: {description}")
            all_good = False
        
        print()
    
    # Optional but recommended variables
    optional_vars = {
        'CORS_ORIGINS': 'http://localhost:3000',
        'FLASK_ENV': 'development',
        'LOG_LEVEL': 'INFO'
    }
    
    print("Optional Configuration:")
    print("-" * 30)
    
    for var_name, default_value in optional_vars.items():
        value = os.getenv(var_name, default_value)
        print(f"📋 {var_name}: {value}")
    
    print()
    print("=" * 50)
    
    if all_good:
        print("🎉 All required environment variables are set!")
        print("✅ Ready to run the Flask application")
        return True
    else:
        print("❌ Some required environment variables are missing")
        print("💡 Make sure your .env file is in the backend directory")
        return False

if __name__ == '__main__':
    success = test_environment()
    sys.exit(0 if success else 1)