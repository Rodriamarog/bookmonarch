"""
Debug script to see raw Gemini output without any processing.
"""

import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

# Configure Gemini
api_key = os.getenv('GEMINI_API_KEY')
genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-2.0-flash-exp')

# Simple test prompt for bullet points
prompt = """Write a short section about keyword research with bullet points. Use markdown formatting with proper line breaks between bullet points.

Example format:
* Point 1
* Point 2  
* Point 3

Write about 3-4 bullet points about keyword research techniques."""

print("Making API call to Gemini...")
response = model.generate_content(prompt)

print("\n" + "="*60)
print("RAW GEMINI OUTPUT:")
print("="*60)
print(repr(response.text))  # Using repr to see exact characters including \n

print("\n" + "="*60)
print("FORMATTED OUTPUT:")
print("="*60)
print(response.text)

print("\n" + "="*60)
print("LINE BY LINE ANALYSIS:")
print("="*60)
lines = response.text.split('\n')
for i, line in enumerate(lines):
    print(f"Line {i:2d}: {repr(line)}")