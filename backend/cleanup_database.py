#!/usr/bin/env python3
"""
Database cleanup script - removes all user data for fresh start.
Use with caution - this will delete all user profiles and associated data.
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client

def cleanup_database():
    """Clean all user data from database for fresh start."""
    
    load_dotenv()
    
    # Create clients
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_service_key = os.getenv('SECRET_KEY')  # Your env file uses SECRET_KEY
    
    if not supabase_url or not supabase_service_key:
        print("❌ Missing SUPABASE_URL or SECRET_KEY environment variables")
        print(f"SUPABASE_URL: {'✅ Found' if supabase_url else '❌ Missing'}")
        print(f"SECRET_KEY: {'✅ Found' if supabase_service_key else '❌ Missing'}")
        return False
    
    # Use service key for cleanup operations
    service_client = create_client(supabase_url, supabase_service_key)
    
    print("🧹 Starting database cleanup...")
    print("=" * 50)
    
    # Step 1: Check current state
    print("\n1. Checking current database state...")
    
    try:
        # Check profiles
        profiles_result = service_client.table('profiles').select('*').execute()
        profile_count = len(profiles_result.data) if profiles_result.data else 0
        print(f"   Profiles found: {profile_count}")
        
        if profiles_result.data:
            for profile in profiles_result.data:
                print(f"   - Profile ID: {profile.get('id')} ({profile.get('full_name', 'No name')})")
        
        # Check books  
        books_result = service_client.table('books').select('*').execute()
        book_count = len(books_result.data) if books_result.data else 0
        print(f"   Books found: {book_count}")
        
        if books_result.data:
            for book in books_result.data[:5]:  # Show first 5
                user_id = book.get('user_id', 'anonymous')
                anonymous_id = book.get('anonymous_user_id', 'none')
                print(f"   - Book: {book.get('title')} (user: {user_id}, anon: {anonymous_id})")
        
        # Check billing events
        billing_result = service_client.table('billing_events').select('*').execute()
        billing_count = len(billing_result.data) if billing_result.data else 0
        print(f"   Billing events found: {billing_count}")
        
    except Exception as e:
        print(f"   ❌ Error checking database state: {str(e)}")
        return False
    
    # Step 2: Confirm deletion
    if profile_count == 0 and book_count == 0 and billing_count == 0:
        print("✅ Database is already clean - no data to delete")
        return True
    
    print(f"\n⚠️  About to delete:")
    print(f"   - {profile_count} profiles")
    print(f"   - {book_count} books")  
    print(f"   - {billing_count} billing events")
    
    # Auto-proceed for development cleanup
    print("\n🔥 PROCEEDING WITH DELETION (development mode)")
    print("    In production, this would require confirmation")
    
    # Step 3: Delete data
    print("\n2. Deleting data...")
    
    try:
        # Delete billing events first (may have foreign keys)
        if billing_count > 0:
            billing_delete = service_client.table('billing_events').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
            print(f"   ✅ Deleted billing events")
        
        # Delete books
        if book_count > 0:
            books_delete = service_client.table('books').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
            print(f"   ✅ Deleted books")
        
        # Delete profiles last
        if profile_count > 0:
            profiles_delete = service_client.table('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
            print(f"   ✅ Deleted profiles")
        
    except Exception as e:
        print(f"   ❌ Error during deletion: {str(e)}")
        return False
    
    # Step 4: Verify cleanup
    print("\n3. Verifying cleanup...")
    
    try:
        profiles_check = service_client.table('profiles').select('*').execute()
        books_check = service_client.table('books').select('*').execute()
        billing_check = service_client.table('billing_events').select('*').execute()
        
        remaining_profiles = len(profiles_check.data) if profiles_check.data else 0
        remaining_books = len(books_check.data) if books_check.data else 0
        remaining_billing = len(billing_check.data) if billing_check.data else 0
        
        print(f"   Profiles remaining: {remaining_profiles}")
        print(f"   Books remaining: {remaining_books}")
        print(f"   Billing events remaining: {remaining_billing}")
        
        if remaining_profiles == 0 and remaining_books == 0 and remaining_billing == 0:
            print("\n✅ Database cleanup completed successfully!")
            print("   You can now test fresh OAuth sign-in.")
            return True
        else:
            print("\n⚠️  Some data may still remain - check manually if needed")
            return False
            
    except Exception as e:
        print(f"   ❌ Error verifying cleanup: {str(e)}")
        return False

def check_rls_policies():
    """Check RLS policies on profiles table."""
    
    load_dotenv()
    service_client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))
    
    print("\n4. Checking RLS policies...")
    
    try:
        # This would require PostgreSQL admin access to check policies
        # For now, just test table access with different clients
        
        regular_client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_KEY'))
        
        print("   Testing table access...")
        print("   - Service client access: ", end="")
        try:
            service_client.table('profiles').select('*').limit(1).execute()
            print("✅ OK")
        except Exception as e:
            print(f"❌ Failed - {str(e)[:50]}")
        
        print("   - Regular client access: ", end="")
        try:
            regular_client.table('profiles').select('*').limit(1).execute()
            print("✅ OK")
        except Exception as e:
            print(f"❌ Failed - {str(e)[:50]}")
            
    except Exception as e:
        print(f"   ❌ Error checking policies: {str(e)}")

if __name__ == "__main__":
    print("🧹 Database Cleanup Script")
    print("This will delete ALL user data for a fresh start")
    print("=" * 50)
    
    success = cleanup_database()
    
    if success:
        check_rls_policies()
        print("\n🎉 Ready for fresh start!")
        print("Next steps:")
        print("1. Test Google OAuth sign-in")
        print("2. Verify profile creation works")
        print("3. Test book generation flow")
    else:
        print("\n❌ Cleanup failed - check errors above")
        sys.exit(1)