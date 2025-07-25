#!/usr/bin/env python3
"""
Simple test to check Supabase connection.
"""

import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

def test_simple_connection():
    """Test basic Supabase connection."""
    
    print("🧪 Testing simple Supabase connection...")
    
    try:
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_KEY')
        
        print(f"URL: {supabase_url}")
        print(f"Key: {supabase_key[:20]}...")
        
        # Create client
        client = create_client(supabase_url, supabase_key)
        print("✅ Client created successfully")
        
        # Test a simple query
        response = client.table('books').select('*').limit(1).execute()
        print(f"✅ Database query successful: {len(response.data)} records")
        
        # Test storage access
        buckets = client.storage.list_buckets()
        print(f"✅ Storage access successful: {len(buckets)} buckets")
        
        for bucket in buckets:
            print(f"  - Bucket: {bucket.name} (public: {bucket.public})")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    test_simple_connection()