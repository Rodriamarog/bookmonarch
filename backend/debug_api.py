"""
Debug script to test Gemini API connection and responses.
"""

import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

def test_api_connection():
    """Test basic API connection and response."""
    print("🔍 Testing Gemini API connection...")
    
    # Check API key
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("❌ GEMINI_API_KEY not found in environment variables")
        return False
    
    print(f"✅ API key found: {api_key[:10]}...")
    
    try:
        # Configure API
        genai.configure(api_key=api_key)
        
        # Test with a simple prompt
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        print("📡 Testing simple API call...")
        response = model.generate_content("Hello, please respond with 'API test successful'")
        
        if response.text:
            print(f"✅ API Response: {response.text}")
            return True
        else:
            print("❌ Empty response from API")
            return False
            
    except Exception as e:
        print(f"❌ API Error: {str(e)}")
        return False

def test_outline_prompt():
    """Test the specific outline generation prompt."""
    print("\n🔍 Testing outline generation prompt...")
    
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("❌ API key not available")
        return False
    
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Use the same prompt as our service
        book_title = "Test Book"
        prompt = f"""
You are a professional non-fiction book outline creator. Create a comprehensive outline for a book titled "{book_title}".

Requirements:
- Generate exactly 15 chapters
- Each chapter should have a clear, descriptive title
- Each chapter should have a brief summary (2-3 sentences)
- The outline should provide logical flow and comprehensive coverage of the topic
- Focus on practical, actionable content for readers

Return your response as valid JSON in this exact format:
{{
    "chapters": [
        {{
            "number": 1,
            "title": "Chapter Title Here",
            "summary": "Brief 2-3 sentence summary of what this chapter covers and why it's important."
        }},
        {{
            "number": 2,
            "title": "Chapter Title Here", 
            "summary": "Brief 2-3 sentence summary of what this chapter covers and why it's important."
        }}
        // ... continue for all 15 chapters
    ]
}}

Do not include any text before or after the JSON. Only return valid JSON.
"""
        
        print("📡 Sending outline generation request...")
        
        # Configure generation parameters
        generation_config = genai.types.GenerationConfig(
            temperature=0.7,
            top_p=0.8,
            top_k=40,
            max_output_tokens=8192,
        )
        
        response = model.generate_content(prompt, generation_config=generation_config)
        
        if response.text:
            print(f"✅ Raw Response Length: {len(response.text)} characters")
            print(f"📄 First 200 characters: {response.text[:200]}...")
            
            # Try to parse as JSON
            import json
            try:
                data = json.loads(response.text)
                print(f"✅ Valid JSON with {len(data.get('chapters', []))} chapters")
                return True
            except json.JSONDecodeError as e:
                print(f"❌ Invalid JSON: {str(e)}")
                print(f"📄 Full response: {response.text}")
                return False
        else:
            print("❌ Empty response from API")
            print(f"📄 Response object: {response}")
            
            # Check if there are any safety issues or other problems
            if hasattr(response, 'prompt_feedback'):
                print(f"📄 Prompt feedback: {response.prompt_feedback}")
            
            return False
            
    except Exception as e:
        print(f"❌ Error during outline test: {str(e)}")
        return False

def main():
    """Run all debug tests."""
    print("🚀 Gemini API Debug Tests")
    print("=" * 50)
    
    # Test 1: Basic connection
    if not test_api_connection():
        print("\n❌ Basic API test failed. Check your API key and connection.")
        return
    
    # Test 2: Outline prompt
    if not test_outline_prompt():
        print("\n❌ Outline generation test failed.")
        return
    
    print("\n✅ All tests passed! API is working correctly.")

if __name__ == "__main__":
    main()