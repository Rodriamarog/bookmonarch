#!/usr/bin/env python3
"""
Setup script to create the books storage bucket in Supabase.
"""

import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

def setup_storage_bucket():
    """Create the books storage bucket if it doesn't exist."""
    
    print("🔧 Setting up Supabase Storage bucket...")
    
    try:
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_KEY')
        
        # Create client
        client = create_client(supabase_url, supabase_key)
        print("✅ Connected to Supabase")
        
        # Check existing buckets
        buckets = client.storage.list_buckets()
        bucket_names = [bucket.name for bucket in buckets]
        
        print(f"📁 Existing buckets: {bucket_names}")
        
        # Create books bucket if it doesn't exist
        if 'books' not in bucket_names:
            print("📁 Creating 'books' storage bucket...")
            
            result = client.storage.create_bucket(
                id='books',
                name='books',
                public=False,  # Private bucket - users need signed URLs
                file_size_limit=50 * 1024 * 1024,  # 50MB limit per file
                allowed_mime_types=['application/pdf', 'application/epub+zip', 'application/json']
            )
            
            print("✅ Books bucket created successfully!")
        else:
            print("✅ Books bucket already exists")
        
        # List buckets again to confirm
        buckets = client.storage.list_buckets()
        print(f"📁 Final buckets: {[bucket.name for bucket in buckets]}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error setting up storage bucket: {e}")
        return False

if __name__ == "__main__":
    if setup_storage_bucket():
        print("\n🎉 Storage bucket setup complete!")
    else:
        print("\n❌ Storage bucket setup failed!")