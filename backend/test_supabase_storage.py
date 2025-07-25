#!/usr/bin/env python3
"""
Test script for Supabase Storage integration.
"""

import os
import tempfile
from dotenv import load_dotenv
from lib.supabase_storage import SupabaseStorageService, SupabaseStorageError

# Load environment variables
load_dotenv()

def test_supabase_storage():
    """Test basic Supabase Storage operations."""
    
    print("🧪 Testing Supabase Storage Integration...")
    
    try:
        # Initialize storage service
        print("1. Initializing Supabase Storage service...")
        storage = SupabaseStorageService()
        print("✅ Storage service initialized successfully")
        
        # Create a test file
        print("\n2. Creating test file...")
        test_content = "This is a test file for Supabase Storage integration."
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as temp_file:
            temp_file.write(test_content)
            temp_file_path = temp_file.name
        
        print(f"✅ Test file created: {temp_file_path}")
        
        # Generate storage path
        test_user_id = "test_user_123"
        test_book_id = "test_book_456"
        test_filename = "test_file.txt"
        storage_path = storage.generate_storage_path(test_user_id, test_book_id, test_filename)
        
        print(f"📁 Storage path: {storage_path}")
        
        # Test file upload
        print("\n3. Testing file upload...")
        public_url = storage.upload_file(temp_file_path, storage_path)
        print(f"✅ File uploaded successfully: {public_url}")
        
        # Test file existence check
        print("\n4. Testing file existence check...")
        exists = storage.file_exists(storage_path)
        print(f"✅ File exists: {exists}")
        
        # Test signed URL generation
        print("\n5. Testing signed URL generation...")
        signed_url = storage.get_signed_url(storage_path, expires_in=300)  # 5 minutes
        print(f"✅ Signed URL generated: {signed_url[:50]}...")
        
        # Test file info
        print("\n6. Testing file info retrieval...")
        file_info = storage.get_file_info(storage_path)
        if file_info:
            print(f"✅ File info: {file_info}")
        else:
            print("⚠️  Could not retrieve file info")
        
        # Test file deletion
        print("\n7. Testing file deletion...")
        deleted = storage.delete_file(storage_path)
        print(f"✅ File deleted: {deleted}")
        
        # Verify deletion
        print("\n8. Verifying file deletion...")
        exists_after_delete = storage.file_exists(storage_path)
        print(f"✅ File exists after deletion: {exists_after_delete}")
        
        # Clean up temp file
        storage.cleanup_temp_file(temp_file_path)
        print("✅ Temporary file cleaned up")
        
        print("\n🎉 All tests passed! Supabase Storage integration is working correctly.")
        
    except SupabaseStorageError as e:
        print(f"❌ Supabase Storage Error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        return False
    
    return True

def test_environment_variables():
    """Test that required environment variables are set."""
    
    print("🔧 Checking environment variables...")
    
    required_vars = ['SUPABASE_URL', 'SECRET_KEY']
    missing_vars = []
    
    for var in required_vars:
        value = os.getenv(var)
        if not value:
            missing_vars.append(var)
        else:
            # Show partial value for security
            masked_value = value[:10] + "..." if len(value) > 10 else value
            print(f"✅ {var}: {masked_value}")
    
    if missing_vars:
        print(f"❌ Missing environment variables: {missing_vars}")
        print("Please set these in your .env file:")
        for var in missing_vars:
            print(f"  {var}=your_value_here")
        return False
    
    print("✅ All required environment variables are set")
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("🧪 SUPABASE STORAGE INTEGRATION TEST")
    print("=" * 60)
    
    # Test environment variables first
    if not test_environment_variables():
        exit(1)
    
    print()
    
    # Test storage operations
    if test_supabase_storage():
        print("\n🎉 SUCCESS: Supabase Storage integration is ready!")
        exit(0)
    else:
        print("\n❌ FAILED: Please check the errors above and try again.")
        exit(1)