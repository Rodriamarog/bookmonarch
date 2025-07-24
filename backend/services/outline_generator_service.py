"""
Service for generating book outlines using the Gemini API.
"""

import logging
from typing import Dict, Any, List
from models.book_models import BookOutline, ChapterSummary
from services.gemini_api_client import GeminiAPIClient
from utils.validation import BookValidator, ValidationError


class OutlineGenerationError(Exception):
    """Custom exception for outline generation failures."""
    pass


class OutlineGeneratorService:
    """Service for generating structured book outlines."""
    
    def __init__(self):
        self.api_client = GeminiAPIClient()
        self.logger = logging.getLogger(__name__)
        self.validator = BookValidator()
    
    def generate_book_outline(self, book_title: str) -> BookOutline:
        """
        Generate a complete book outline with 15 chapters.
        
        Args:
            book_title: The title of the book to generate an outline for
            
        Returns:
            BookOutline: Complete outline with 15 chapters
            
        Raises:
            OutlineGenerationError: If outline generation fails
            ValidationError: If the generated outline is invalid
        """
        if not book_title or not book_title.strip():
            raise ValueError("Book title cannot be empty")
        
        self.logger.info(f"Starting outline generation for: {book_title}")
        
        try:
            # Generate outline using API with retry logic
            outline_data = self.retry_outline_generation(book_title, max_retries=3)
            
            # Convert to BookOutline model
            book_outline = self._create_book_outline_from_data(book_title, outline_data)
            
            # Validate the complete outline
            self._validate_generated_outline(book_outline)
            
            self.logger.info(f"Successfully generated outline for '{book_title}' with {len(book_outline.chapters)} chapters")
            return book_outline
            
        except Exception as e:
            self.logger.error(f"Failed to generate outline for '{book_title}': {str(e)}")
            raise OutlineGenerationError(f"Outline generation failed: {str(e)}") from e
    
    def retry_outline_generation(self, book_title: str, max_retries: int = 3) -> Dict[str, Any]:
        """
        Generate outline with retry logic for malformed responses.
        
        Args:
            book_title: The title of the book
            max_retries: Maximum number of retry attempts
            
        Returns:
            Dict containing the outline data
            
        Raises:
            OutlineGenerationError: If all retry attempts fail
        """
        last_error = None
        
        for attempt in range(max_retries):
            try:
                self.logger.info(f"Outline generation attempt {attempt + 1}/{max_retries} for: {book_title}")
                
                # Call the API
                outline_data = self.api_client.generate_outline(book_title)
                
                # Validate the structure
                validation_errors = self.validator.validate_outline_json(outline_data)
                if validation_errors:
                    error_msg = f"Outline validation failed: {'; '.join(validation_errors)}"
                    self.logger.warning(f"Attempt {attempt + 1} failed validation: {error_msg}")
                    
                    if attempt < max_retries - 1:
                        continue
                    else:
                        raise ValidationError(error_msg, validation_errors)
                
                # Success - return the valid outline
                self.logger.info(f"Outline generation successful on attempt {attempt + 1}")
                return outline_data
                
            except Exception as e:
                last_error = e
                self.logger.warning(f"Outline generation attempt {attempt + 1} failed: {str(e)}")
                
                if attempt < max_retries - 1:
                    self.logger.info(f"Retrying outline generation (attempt {attempt + 2}/{max_retries})")
                    continue
        
        # All attempts failed
        error_msg = f"Failed to generate valid outline after {max_retries} attempts"
        if last_error:
            error_msg += f". Last error: {str(last_error)}"
        
        raise OutlineGenerationError(error_msg)
    
    def validate_outline_structure(self, outline_json: Dict[str, Any]) -> bool:
        """
        Validate that outline JSON has the correct structure.
        
        Args:
            outline_json: The outline data to validate
            
        Returns:
            bool: True if valid, False otherwise
        """
        try:
            validation_errors = self.validator.validate_outline_json(outline_json)
            return len(validation_errors) == 0
        except Exception as e:
            self.logger.error(f"Error validating outline structure: {str(e)}")
            return False
    
    def _create_book_outline_from_data(self, book_title: str, outline_data: Dict[str, Any]) -> BookOutline:
        """
        Create a BookOutline model from API response data.
        
        Args:
            book_title: The title of the book
            outline_data: Raw outline data from API
            
        Returns:
            BookOutline: Structured outline model
        """
        chapters = []
        
        for chapter_data in outline_data.get('chapters', []):
            chapter_summary = ChapterSummary(
                number=chapter_data.get('number', 0),
                title=chapter_data.get('title', ''),
                summary=chapter_data.get('summary', '')
            )
            chapters.append(chapter_summary)
        
        return BookOutline(
            title=book_title,
            chapters=chapters
        )
    
    def _validate_generated_outline(self, outline: BookOutline) -> None:
        """
        Validate the generated outline using the model's validation.
        
        Args:
            outline: The outline to validate
            
        Raises:
            ValidationError: If validation fails
        """
        validation_errors = outline.validate()
        
        if validation_errors:
            error_msg = f"Generated outline validation failed with {len(validation_errors)} errors"
            self.logger.error(f"{error_msg}: {validation_errors}")
            raise ValidationError(error_msg, validation_errors)
        
        # Additional business logic validation
        self._validate_outline_quality(outline)
    
    def _validate_outline_quality(self, outline: BookOutline) -> None:
        """
        Perform additional quality checks on the outline.
        
        Args:
            outline: The outline to validate
            
        Raises:
            ValidationError: If quality checks fail
        """
        errors = []
        
        # Check for duplicate chapter titles
        titles = [chapter.title.lower().strip() for chapter in outline.chapters]
        if len(titles) != len(set(titles)):
            errors.append("Outline contains duplicate chapter titles")
        
        # Check for overly short summaries
        for i, chapter in enumerate(outline.chapters):
            if len(chapter.summary.split()) < 10:
                errors.append(f"Chapter {i+1} summary is too short (less than 10 words)")
        
        # Check for overly long titles
        for i, chapter in enumerate(outline.chapters):
            if len(chapter.title) > 100:
                errors.append(f"Chapter {i+1} title is too long (over 100 characters)")
        
        # Check for generic or placeholder titles
        generic_patterns = [
            'chapter', 'introduction', 'conclusion', 'overview', 
            'getting started', 'basics', 'fundamentals'
        ]
        
        for i, chapter in enumerate(outline.chapters):
            title_lower = chapter.title.lower()
            if any(pattern in title_lower and len(title_lower.split()) <= 2 for pattern in generic_patterns):
                errors.append(f"Chapter {i+1} title appears too generic: '{chapter.title}'")
        
        if errors:
            error_msg = f"Outline quality validation failed with {len(errors)} issues"
            self.logger.warning(f"{error_msg}: {errors}")
            raise ValidationError(error_msg, errors)
    
    def get_outline_summary(self, outline: BookOutline) -> str:
        """
        Generate a summary of the outline for logging or display.
        
        Args:
            outline: The outline to summarize
            
        Returns:
            str: A formatted summary of the outline
        """
        summary_lines = [
            f"Book Title: {outline.title}",
            f"Total Chapters: {len(outline.chapters)}",
            "",
            "Chapter Overview:"
        ]
        
        for chapter in outline.chapters:
            summary_lines.append(f"  {chapter.number}. {chapter.title}")
            # Truncate long summaries for display
            summary = chapter.summary
            if len(summary) > 100:
                summary = summary[:97] + "..."
            summary_lines.append(f"     {summary}")
            summary_lines.append("")
        
        return "\n".join(summary_lines)
    
    def export_outline_to_dict(self, outline: BookOutline) -> Dict[str, Any]:
        """
        Export outline to dictionary format for serialization.
        
        Args:
            outline: The outline to export
            
        Returns:
            Dict containing the outline data
        """
        return {
            'title': outline.title,
            'chapters': [
                {
                    'number': chapter.number,
                    'title': chapter.title,
                    'summary': chapter.summary
                }
                for chapter in outline.chapters
            ]
        }