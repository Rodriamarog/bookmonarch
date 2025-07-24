"""
Validation utilities for the AI Book Generator.
"""

import re
from typing import List, Dict, Any, Union
from models.book_models import BookData, BookOutline, Chapter, ChapterSummary, BookMetadata


class ValidationError(Exception):
    """Custom exception for validation errors."""
    
    def __init__(self, message: str, errors: List[str]):
        self.message = message
        self.errors = errors
        super().__init__(message)


class BookValidator:
    """Centralized validation for book-related data."""
    
    @staticmethod
    def validate_user_input(title: str, author: str, book_type: str) -> Dict[str, str]:
        """Validate user input from the web form."""
        errors = {}
        
        # Validate title
        if not title or not title.strip():
            errors['title'] = 'Book title is required'
        elif len(title.strip()) > 300:
            errors['title'] = 'Book title cannot exceed 300 characters'
        elif len(title.strip()) < 3:
            errors['title'] = 'Book title must be at least 3 characters'
        
        # Validate author
        if not author or not author.strip():
            errors['author'] = 'Author name is required'
        elif len(author.strip()) > 200:
            errors['author'] = 'Author name cannot exceed 200 characters'
        elif len(author.strip()) < 2:
            errors['author'] = 'Author name must be at least 2 characters'
        
        # Validate book type
        if book_type != 'non-fiction':
            errors['book_type'] = 'Only non-fiction books are supported'
        
        return errors
    
    @staticmethod
    def validate_api_response_format(response: str, expected_format: str) -> List[str]:
        """Validate API response format."""
        errors = []
        
        if not response or not response.strip():
            errors.append("API response is empty")
            return errors
        
        if expected_format == "json":
            try:
                import json
                json.loads(response)
            except json.JSONDecodeError as e:
                errors.append(f"Invalid JSON format: {str(e)}")
        
        elif expected_format == "markdown":
            # Check for basic markdown structure
            if not re.search(r'^#', response, re.MULTILINE):
                errors.append("Response does not appear to be valid markdown (no headers found)")
        
        return errors
    
    @staticmethod
    def validate_outline_json(data: Dict[str, Any]) -> List[str]:
        """Validate outline JSON structure."""
        errors = []
        
        if 'chapters' not in data:
            errors.append("Missing 'chapters' key in outline JSON")
            return errors
        
        chapters = data['chapters']
        if not isinstance(chapters, list):
            errors.append("'chapters' must be a list")
            return errors
        
        if len(chapters) != 15:
            errors.append(f"Expected exactly 15 chapters, found {len(chapters)}")
        
        for i, chapter in enumerate(chapters):
            if not isinstance(chapter, dict):
                errors.append(f"Chapter {i+1} must be a dictionary")
                continue
            
            required_fields = ['number', 'title', 'summary']
            for field in required_fields:
                if field not in chapter:
                    errors.append(f"Chapter {i+1} missing required field: {field}")
                elif not chapter[field]:
                    errors.append(f"Chapter {i+1} has empty {field}")
            
            # Validate chapter number
            if 'number' in chapter and chapter['number'] != i + 1:
                errors.append(f"Chapter {i+1} has incorrect number: {chapter['number']}")
        
        return errors
    
    @staticmethod
    def validate_metadata_json(data: Dict[str, Any]) -> List[str]:
        """Validate metadata JSON structure."""
        errors = []
        
        required_fields = [
            'sales_description',
            'reading_age_range',
            'bisac_categories',
            'keywords',
            'back_cover_description'
        ]
        
        for field in required_fields:
            if field not in data:
                errors.append(f"Missing required field: {field}")
            elif not data[field]:
                errors.append(f"Field '{field}' cannot be empty")
        
        # Validate specific field requirements
        if 'bisac_categories' in data:
            categories = data['bisac_categories']
            if not isinstance(categories, list):
                errors.append("'bisac_categories' must be a list")
            elif len(categories) != 3:
                errors.append(f"Expected exactly 3 BISAC categories, found {len(categories)}")
        
        if 'keywords' in data:
            keywords = data['keywords']
            if not isinstance(keywords, list):
                errors.append("'keywords' must be a list")
            elif len(keywords) != 7:
                errors.append(f"Expected exactly 7 keywords, found {len(keywords)}")
        
        return errors
    
    @staticmethod
    def validate_chapter_content(content: str, target_word_count: int = 1400) -> List[str]:
        """Validate chapter content quality with lenient checks."""
        errors = []
        
        if not content or not content.strip():
            errors.append("Chapter content cannot be empty")
            return errors
        
        # Calculate word count
        text = re.sub(r'[#*_`\[\]()]', '', content)
        text = re.sub(r'\n+', ' ', text)
        words = text.split()
        word_count = len([word for word in words if word.strip()])
        
        # Very lenient word count range
        min_words = 300  # Much lower minimum
        max_words = 3000  # Higher maximum
        
        if word_count < min_words:
            errors.append(f"Chapter too short: {word_count} words (minimum {min_words})")
        elif word_count > max_words:
            errors.append(f"Chapter too long: {word_count} words (maximum {max_words})")
        
        return errors
    
    @staticmethod
    def validate_complete_book(book_data: BookData) -> None:
        """Validate complete book data and raise exception if invalid."""
        errors = book_data.validate()
        
        if errors:
            raise ValidationError(
                f"Book validation failed with {len(errors)} errors",
                errors
            )
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Sanitize filename for safe file system usage."""
        # Remove or replace invalid characters
        filename = re.sub(r'[<>:"/\\|?*]', '', filename)
        filename = re.sub(r'\s+', '_', filename)
        filename = filename.strip('.')
        
        # Limit length
        if len(filename) > 100:
            filename = filename[:100]
        
        return filename or 'untitled'