"""
Client for interacting with Google's Gemini API.
"""

import os
import google.generativeai as genai
from typing import Dict, Optional, Any
import time
import logging
import json
import random
import re
from functools import wraps
from config import Config


def retry_with_exponential_backoff(max_retries: int = 3, base_delay: float = 1.0):
    """Decorator for exponential backoff retry logic."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    
                    # Don't retry on certain types of errors
                    if isinstance(e, (ValueError, TypeError)):
                        raise e
                    
                    if attempt < max_retries - 1:  # Don't sleep on last attempt
                        delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                        logging.getLogger(__name__).warning(
                            f"API call failed (attempt {attempt + 1}/{max_retries}): {str(e)}. "
                            f"Retrying in {delay:.2f} seconds..."
                        )
                        time.sleep(delay)
                    else:
                        logging.getLogger(__name__).error(
                            f"API call failed after {max_retries} attempts: {str(e)}"
                        )
            
            raise last_exception
        return wrapper
    return decorator


class GeminiAPIClient:
    """Client for making API calls to Google's Gemini Flash 2.0."""
    
    def __init__(self):
        # Configure the API client
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash-exp')
        self.logger = logging.getLogger(__name__)
        
        # Configuration
        self.max_retries = Config.MAX_API_RETRIES
        self.base_delay = Config.RETRY_DELAY_BASE
    
    @retry_with_exponential_backoff(max_retries=3, base_delay=1.0)
    def generate_outline(self, book_title: str) -> Dict[str, Any]:
        """Generate a book outline with 15 chapters."""
        prompt = self._create_outline_prompt(book_title)
        
        self.logger.info(f"Generating outline for book: {book_title}")
        
        response = self._make_api_call(prompt)
        
        # Clean and parse JSON response
        try:
            cleaned_response = self._clean_json_response(response)
            self.logger.debug(f"Raw response length: {len(response)}")
            self.logger.debug(f"Cleaned response length: {len(cleaned_response)}")
            outline_data = json.loads(cleaned_response)
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse outline JSON: {e}")
            self.logger.error(f"Raw response: {response[:500]}...")
            self.logger.error(f"Cleaned response: {cleaned_response[:500]}...")
            raise ValueError(f"Invalid JSON response from API: {e}")
        
        # Validate outline structure
        self._validate_outline_response(outline_data)
        
        self.logger.info(f"Successfully generated outline with {len(outline_data.get('chapters', []))} chapters")
        return outline_data
    
    @retry_with_exponential_backoff(max_retries=3, base_delay=1.0)
    def generate_chapter(self, outline: Dict[str, Any], chapter_index: int) -> str:
        """Generate content for a specific chapter."""
        if chapter_index < 0 or chapter_index >= len(outline.get('chapters', [])):
            raise ValueError(f"Invalid chapter index: {chapter_index}")
        
        chapter_info = outline['chapters'][chapter_index]
        prompt = self._create_chapter_prompt(outline, chapter_info, chapter_index)
        
        self.logger.info(f"Generating content for chapter {chapter_index + 1}: {chapter_info.get('title', 'Unknown')}")
        
        response = self._make_api_call(prompt)
        
        # Validate and clean the response
        cleaned_content = self._clean_chapter_response(response)
        
        self.logger.info(f"Successfully generated chapter {chapter_index + 1} ({len(cleaned_content)} characters)")
        return cleaned_content
    
    @retry_with_exponential_backoff(max_retries=3, base_delay=1.0)
    def generate_metadata(self, book_title: str, author: str, content_summary: str) -> Dict[str, Any]:
        """Generate marketing metadata for the book."""
        prompt = self._create_metadata_prompt(book_title, author, content_summary)
        
        self.logger.info(f"Generating metadata for book: {book_title}")
        
        response = self._make_api_call(prompt)
        
        # Parse and validate JSON response
        try:
            cleaned_response = self._clean_json_response(response)
            metadata = json.loads(cleaned_response)
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse metadata JSON: {e}")
            self.logger.error(f"Raw response: {response[:500]}...")
            raise ValueError(f"Invalid JSON response from API: {e}")
        
        # Validate metadata structure
        self._validate_metadata_response(metadata)
        
        self.logger.info("Successfully generated book metadata")
        return metadata
    
    def _make_api_call(self, prompt: str) -> str:
        """Make an API call to Gemini."""
        try:
            # Configure generation parameters
            generation_config = genai.types.GenerationConfig(
                temperature=0.7,
                top_p=0.8,
                top_k=40,
                max_output_tokens=8192,
            )
            
            # Make the API call
            response = self.model.generate_content(
                prompt,
                generation_config=generation_config
            )
            
            if not response.text:
                raise ValueError("Empty response from Gemini API")
            
            return response.text.strip()
            
        except Exception as e:
            self.logger.error(f"Gemini API call failed: {str(e)}")
            raise
    
    def _clean_json_response(self, response: str) -> str:
        """Clean JSON response by removing markdown code blocks."""
        # Remove markdown code blocks
        cleaned = re.sub(r'^```json\s*', '', response, flags=re.MULTILINE)
        cleaned = re.sub(r'^```\s*$', '', cleaned, flags=re.MULTILINE)
        cleaned = cleaned.strip()
        
        # Log the cleaning process for debugging
        if cleaned != response:
            self.logger.debug("Cleaned JSON response by removing markdown code blocks")
        
        return cleaned
    
    def _create_outline_prompt(self, book_title: str) -> str:
        """Create prompt for outline generation."""
        return f"""You are a professional non-fiction book outline creator. Create a comprehensive outline for a book titled "{book_title}".

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
    ]
}}

Do not include any text before or after the JSON. Only return valid JSON."""
    
    def _create_chapter_prompt(self, outline: Dict[str, Any], chapter_info: Dict[str, Any], chapter_index: int) -> str:
        """Create prompt for chapter content generation."""
        book_title = outline.get('title', 'Unknown Book')
        chapter_title = chapter_info.get('title', f'Chapter {chapter_index + 1}')
        chapter_summary = chapter_info.get('summary', '')
        
        # Get context from previous and next chapters
        chapters = outline.get('chapters', [])
        context_info = ""
        
        if chapter_index > 0:
            prev_chapter = chapters[chapter_index - 1]
            context_info += f"Previous chapter: {prev_chapter.get('title', '')}\n"
        
        if chapter_index < len(chapters) - 1:
            next_chapter = chapters[chapter_index + 1]
            context_info += f"Next chapter: {next_chapter.get('title', '')}\n"
        
        return f"""You are a professional non-fiction book writer. Write Chapter {chapter_index + 1} for the book "{book_title}".

Chapter Details:
- Title: {chapter_title}
- Summary: {chapter_summary}

Context:
{context_info}

Complete Book Outline:
{json.dumps(outline, indent=2)}

Requirements:
- Write approximately 1400 words
- Use clear, engaging, and professional writing style
- Format in markdown with proper headers and structure
- Ensure content flows logically and connects to the overall book theme
- Do NOT include any meta commentary, author notes, or explanations about the writing process
- Do NOT use phrases like "In this chapter", "As the author", "Let me explain", etc.
- Start directly with the chapter content

Return only the chapter content in markdown format. No additional commentary or explanations."""
    
    def _create_metadata_prompt(self, book_title: str, author: str, content_summary: str) -> str:
        """Create prompt for metadata generation."""
        return f"""You are a professional book marketing specialist. Create comprehensive marketing metadata for this non-fiction book:

Book Title: {book_title}
Author: {author}
Content Summary: {content_summary}

Generate marketing metadata suitable for Amazon KDP and other publishing platforms.

Return your response as valid JSON in this exact format:
{{
    "sales_description": "Compelling 200-400 word description that would appear on Amazon product page. Focus on benefits to readers, what they'll learn, and why they need this book.",
    "reading_age_range": "Adult",
    "bisac_categories": [
        "Category 1 (e.g., Business & Economics / Leadership)",
        "Category 2 (e.g., Self-Help / Personal Growth)",
        "Category 3 (e.g., Education / Adult & Continuing Education)"
    ],
    "keywords": [
        "keyword1",
        "keyword2", 
        "keyword3",
        "keyword4",
        "keyword5",
        "keyword6",
        "keyword7"
    ],
    "back_cover_description": "Shorter, punchy description for back cover (100-150 words). Include key benefits and a compelling call to action."
}}

Requirements:
- Sales description should be compelling and benefit-focused
- BISAC categories should be accurate and relevant
- Keywords should be searchable terms readers would use
- Back cover description should be concise but compelling
- All content should be professional and market-ready

Do not include any text before or after the JSON. Only return valid JSON."""
    
    def _validate_outline_response(self, outline_data: Dict[str, Any]) -> None:
        """Validate outline response structure."""
        if 'chapters' not in outline_data:
            raise ValueError("Outline response missing 'chapters' key")
        
        chapters = outline_data['chapters']
        if not isinstance(chapters, list):
            raise ValueError("'chapters' must be a list")
        
        if len(chapters) != 15:
            raise ValueError(f"Expected exactly 15 chapters, got {len(chapters)}")
        
        for i, chapter in enumerate(chapters):
            if not isinstance(chapter, dict):
                raise ValueError(f"Chapter {i+1} must be a dictionary")
            
            required_fields = ['number', 'title', 'summary']
            for field in required_fields:
                if field not in chapter or not chapter[field]:
                    raise ValueError(f"Chapter {i+1} missing or empty field: {field}")
            
            if chapter['number'] != i + 1:
                raise ValueError(f"Chapter {i+1} has incorrect number: {chapter['number']}")
    
    def _validate_metadata_response(self, metadata: Dict[str, Any]) -> None:
        """Validate metadata response structure."""
        required_fields = [
            'sales_description',
            'reading_age_range', 
            'bisac_categories',
            'keywords',
            'back_cover_description'
        ]
        
        for field in required_fields:
            if field not in metadata or not metadata[field]:
                raise ValueError(f"Metadata missing or empty field: {field}")
        
        # Validate specific requirements
        if len(metadata['bisac_categories']) != 3:
            raise ValueError(f"Expected exactly 3 BISAC categories, got {len(metadata['bisac_categories'])}")
        
        if len(metadata['keywords']) != 7:
            raise ValueError(f"Expected exactly 7 keywords, got {len(metadata['keywords'])}")
    
    def _clean_chapter_response(self, response: str) -> str:
        """Clean and validate chapter response."""
        # Remove common meta commentary patterns
        meta_patterns = [
            r'\*\*Note:.*?\n',
            r'\*\*Author\'s Note:.*?\n',
            r'\[Author\'s commentary:.*?\]',
            r'\*\*Commentary:.*?\n',
            r'^.*In this chapter.*?\n',
            r'^.*As the author.*?\n',
            r'^.*Let me explain.*?\n'
        ]
        
        cleaned = response
        for pattern in meta_patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE | re.MULTILINE)
        
        # Clean up extra whitespace
        cleaned = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned)
        cleaned = cleaned.strip()
        
        if len(cleaned) < 500:
            raise ValueError("Chapter content too short after cleaning")
        
        return cleaned