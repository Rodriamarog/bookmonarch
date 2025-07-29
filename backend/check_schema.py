import os
from dotenv import load_dotenv
from supabase import create_client

def check_database_schema():
    """Check the complete database schema by testing each table."""
    
    load_dotenv()
    client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_KEY'))
    
    print('🔍 Checking database tables and their structure...')
    
    # List of tables to check
    tables_to_check = [
        'books', 'profiles', 'billing_events', 
        'users', 'auth_users', 'storage_objects', 
        'auth_sessions', 'auth_identities', 'auth_mfa_factors',
        'auth_mfa_challenges', 'auth_mfa_amr_claims', 'auth_refresh_tokens'
    ]
    
    existing_tables = []
    
    for table in tables_to_check:
        try:
            # Try to get a sample record to see structure
            result = client.table(table).select('*').limit(1).execute()
            existing_tables.append(table)
            print(f'✅ {table} table exists')
            
            # If there's data, show the columns
            if result.data:
                print(f'   Columns: {list(result.data[0].keys())}')
            else:
                print(f'   Table is empty')
                
        except Exception as e:
            print(f'❌ {table} table does not exist: {str(e)[:50]}...')
    
    print(f'\n📊 Summary: {len(existing_tables)} tables found')
    print('Existing tables:', existing_tables)
    
    # Now get detailed structure for existing tables
    print('\n📋 Detailed Table Structure:')
    print('=' * 80)
    
    for table in existing_tables:
        try:
            result = client.table(table).select('*').limit(1).execute()
            if result.data:
                print(f'\n📋 {table.upper()} TABLE:')
                print('-' * 40)
                for column in result.data[0].keys():
                    print(f'  - {column}')
            else:
                print(f'\n📋 {table.upper()} TABLE (empty):')
                print('  - No columns to show (table is empty)')
        except Exception as e:
            print(f'\n❌ Error getting {table} structure: {str(e)}')

def check_table_records():
    """Check how many records are in each table."""
    
    load_dotenv()
    client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_KEY'))
    
    print('\n📊 Checking table record counts...')
    
    tables_to_check = ['books', 'profiles', 'billing_events']
    
    for table in tables_to_check:
        try:
            result = client.table(table).select('*', count='exact').execute()
            count = result.count if hasattr(result, 'count') else len(result.data)
            print(f'📊 {table}: {count} records')
        except Exception as e:
            print(f'❌ {table}: Error getting count - {str(e)[:50]}...')

if __name__ == "__main__":
    check_database_schema()
    check_table_records() 