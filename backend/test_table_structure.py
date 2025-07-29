import os
from dotenv import load_dotenv
from supabase import create_client
import uuid
from datetime import datetime

def test_table_structure():
    """Test inserting records to see table structure."""
    
    load_dotenv()
    client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_KEY'))
    
    print('🔍 Testing table structure by inserting test records...')
    
    # Test books table
    print('\n📋 Testing BOOKS table structure:')
    try:
        test_book_id = str(uuid.uuid4())
        test_user_id = str(uuid.uuid4())
        
        result = client.table('books').insert({
            'id': test_book_id,
            'user_id': test_user_id,
            'title': 'Test Book',
            'author_name': 'Test Author',
            'genre': 'test',
            'status': 'test',
            'progress': 0,
            'total_chapters': 1,
            'created_at': datetime.utcnow().isoformat()
        }).execute()
        
        print('✅ Successfully inserted test book')
        print('   Columns found:', list(result.data[0].keys()))
        
        # Clean up
        client.table('books').delete().eq('id', test_book_id).execute()
        print('   ✅ Cleaned up test record')
        
    except Exception as e:
        print(f'❌ Error testing books table: {str(e)}')
    
    # Test profiles table
    print('\n📋 Testing PROFILES table structure:')
    try:
        test_profile_id = str(uuid.uuid4())
        
        result = client.table('profiles').insert({
            'id': test_profile_id,
            'full_name': 'Test User',
            'subscription_status': 'free',
            'books_generated_today': 0,
            'created_at': datetime.utcnow().isoformat()
        }).execute()
        
        print('✅ Successfully inserted test profile')
        print('   Columns found:', list(result.data[0].keys()))
        
        # Clean up
        client.table('profiles').delete().eq('id', test_profile_id).execute()
        print('   ✅ Cleaned up test record')
        
    except Exception as e:
        print(f'❌ Error testing profiles table: {str(e)}')
    
    # Test billing_events table
    print('\n📋 Testing BILLING_EVENTS table structure:')
    try:
        test_billing_id = str(uuid.uuid4())
        test_user_id = str(uuid.uuid4())
        
        result = client.table('billing_events').insert({
            'id': test_billing_id,
            'user_id': test_user_id,
            'stripe_event_id': 'test_event_123',
            'event_type': 'test',
            'payload': {'test': 'data'},
            'processed_at': datetime.utcnow().isoformat(),
            'processing_status': 'pending'
        }).execute()
        
        print('✅ Successfully inserted test billing event')
        print('   Columns found:', list(result.data[0].keys()))
        
        # Clean up
        client.table('billing_events').delete().eq('id', test_billing_id).execute()
        print('   ✅ Cleaned up test record')
        
    except Exception as e:
        print(f'❌ Error testing billing_events table: {str(e)}')

if __name__ == "__main__":
    test_table_structure() 