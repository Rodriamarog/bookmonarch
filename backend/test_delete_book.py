#!/usr/bin/env python3
"""
Simple test script to verify the delete book functionality.
"""

import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_delete_book():
    """Test the delete book API endpoint."""
    
    # This would normally be a real JWT token from Supabase auth
    # For testing purposes, you'd need to get a real token from your frontend
    test_token = "your_jwt_token_here"
    test_book_id = "your_test_book_id_here"
    
    # API endpoint
    url = f"http://localhost:5000/api/books/{test_book_id}"
    
    # Headers with authorization
    headers = {
        "Authorization": f"Bearer {test_token}",
        "Content-Type": "application/json"
    }
    
    try:
        # Make DELETE request
        response = requests.delete(url, headers=headers)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            print("✅ Book deleted successfully!")
        elif response.status_code == 401:
            print("❌ Authorization failed - check your JWT token")
        elif response.status_code == 404:
            print("❌ Book not found or access denied")
        else:
            print(f"❌ Unexpected error: {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to backend server. Make sure it's running on localhost:5000")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    print("Testing delete book functionality...")
    print("Note: You need to update test_token and test_book_id with real values")
    test_delete_book()