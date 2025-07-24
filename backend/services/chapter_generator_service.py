"""
Service for generating individual book chapters using the Gemini API.
"""

import logging
import re
import time
from typing import List, Dict, Any, Optional
from models.book_models import BookOutline, Chapter
from services.gemini_api_client import GeminiAPIClient
from utils.validation import BookValidator, ValidationError
from config import Config


class ChapterGenerationError(Exception):
    """Custom exception for chapter generation failures."""
    pass


class ChapterGeneratorService:
    """Service for generating individual book chapters with content."""
    
    def __init__(self):
        self.api_client = GeminiAPIClient()
        self.logger = logging.getLogger(__name__)
        self.validator = BookValidator()
        self.target_word_count = Config.TARGET_CHAPTER_WORD_COUNT
    
    def generate_all_chapters(self, outline: BookOutline) -> List[Chapter]:
        """
        Generate content for all chapters in the outline sequentially.
        
        Args:
            outline: The book outline containing chapter summaries
            
        Returns:
            List[Chapter]: Complete list of chapters with content
            
        Raises:
            ChapterGenerationError: If chapter generation fails
            ValidationError: If any generated chapter is invalid
        """
        if not outline or not outline.chapters:
            raise ValueError("Outline must contain chapters")
        
        if len(outline.chapters) != 15:
            raise ValueError(f"Expected exactly 15 chapters, got {len(outline.chapters)}")
        
        self.logger.info(f"Starting generation of all {len(outline.chapters)} chapters for '{outline.title}'")
        
        chapters = []
        failed_chapters = []
        
        # Convert outline to dictionary format for API calls
        outline_dict = self._outline_to_dict(outline)
        
        for i, chapter_summary in enumerate(outline.chapters):
            try:
                self.logger.info(f"Generating chapter {i + 1}: {chapter_summary.title}")
                
                chapter = self.generate_single_chapter(outline_dict, i)
                chapters.append(chapter)
                
                self.logger.info(f"Successfully generated chapter {i + 1} ({chapter.word_count} words)")
                
                # Add 10 second delay between chapter generations (except for the last chapter)
                if i < len(outline.chapters) - 1:
                    self.logger.info("Waiting 10 seconds before generating next chapter...")
                    time.sleep(10)
                
            except Exception as e:
                error_msg = f"Failed to generate chapter {i + 1}: {str(e)}"
                self.logger.error(error_msg)
                failed_chapters.append((i + 1, str(e)))
        
        if failed_chapters:
            error_details = "; ".join([f"Chapter {num}: {error}" for num, error in failed_chapters])
            raise ChapterGenerationError(f"Failed to generate {len(failed_chapters)} chapters: {error_details}")
        
        self.logger.info(f"Successfully generated all {len(chapters)} chapters")
        return chapters
    
    def generate_single_chapter(self, outline: Dict[str, Any], chapter_index: int) -> Chapter:
        """
        Generate content for a specific chapter.
        
        Args:
            outline: The complete book outline as dictionary
            chapter_index: Zero-based index of the chapter to generate
            
        Returns:
            Chapter: Complete chapter with content
            
        Raises:
            ChapterGenerationError: If chapter generation fails
            ValidationError: If the generated chapter is invalid
        """
        if chapter_index < 0 or chapter_index >= len(outline.get('chapters', [])):
            raise ValueError(f"Invalid chapter index: {chapter_index}")
        
        chapter_info = outline['chapters'][chapter_index]
        chapter_number = chapter_index + 1
        
        self.logger.info(f"Generating content for chapter {chapter_number}: {chapter_info.get('title', 'Unknown')}")
        
        try:
            # Generate chapter content with retry logic
            content = self._generate_chapter_with_retry(outline, chapter_index, max_retries=3)
            
            # Clean the content
            cleaned_content = self.clean_chapter_content(content, chapter_info.get('title'))
            
            # Create chapter object
            chapter = Chapter(
                number=chapter_number,
                title=chapter_info.get('title', f'Chapter {chapter_number}'),
                content=cleaned_content
            )
            
            # Validate the chapter
            self._validate_generated_chapter(chapter)
            
            self.logger.info(f"Successfully generated chapter {chapter_number} with {chapter.word_count} words")
            return chapter
            
        except Exception as e:
            self.logger.error(f"Failed to generate chapter {chapter_number}: {str(e)}")
            raise ChapterGenerationError(f"Chapter {chapter_number} generation failed: {str(e)}") from e
    
    def _generate_chapter_with_retry(self, outline: Dict[str, Any], chapter_index: int, max_retries: int = 3) -> str:
        """
        Generate chapter content with retry logic.
        
        Args:
            outline: The complete book outline
            chapter_index: Index of the chapter to generate
            max_retries: Maximum number of retry attempts
            
        Returns:
            str: Generated chapter content
            
        Raises:
            ChapterGenerationError: If all retry attempts fail
        """
        last_error = None
        
        for attempt in range(max_retries):
            try:
                self.logger.info(f"Chapter generation attempt {attempt + 1}/{max_retries}")
                
                # Call the API
                content = self.api_client.generate_chapter(outline, chapter_index)
                
                # Success - return the content
                self.logger.info(f"Chapter generation successful on attempt {attempt + 1}")
                return content
                
            except Exception as e:
                last_error = e
                self.logger.warning(f"Chapter generation attempt {attempt + 1} failed: {str(e)}")
                
                if attempt < max_retries - 1:
                    self.logger.info(f"Retrying chapter generation (attempt {attempt + 2}/{max_retries})")
                    continue
        
        # All attempts failed
        error_msg = f"Failed to generate valid chapter after {max_retries} attempts"
        if last_error:
            error_msg += f". Last error: {str(last_error)}"
        
        raise ChapterGenerationError(error_msg)
    
    def clean_chapter_content(self, raw_content: str, chapter_title: str = None) -> str:
        """
        Clean chapter content by fixing basic formatting issues.
        
        Args:
            raw_content: Raw content from API
            chapter_title: The chapter title to remove if it appears at the beginning
            
        Returns:
            str: Cleaned content
        """
        if not raw_content:
            return ""
        
        content = raw_content.strip()
        
        # Remove chapter title if it appears at the beginning of content
        if chapter_title:
            content = self._remove_duplicate_chapter_title(content, chapter_title)
        
        # Only do basic formatting cleanup
        content = self._clean_formatting(content)
        
        return content.strip()
    
    def _remove_duplicate_chapter_title(self, content: str, chapter_title: str) -> str:
        """
        Remove the first instance of the chapter title if it appears in the content.
        
        Args:
            content: The chapter content
            chapter_title: The chapter title to look for and remove
            
        Returns:
            str: Content with duplicate title removed
        """
        if not chapter_title or not content:
            return content
        
        lines = content.split('\n')
        
        # Look for the chapter title in the first few lines
        for i, line in enumerate(lines[:5]):  # Only check first 5 lines
            line_stripped = line.strip()
            
            # Check for exact match or as a header
            if (line_stripped == chapter_title or 
                line_stripped == f"# {chapter_title}" or
                line_stripped == f"## {chapter_title}" or
                line_stripped == f"### {chapter_title}"):
                
                # Remove this line and any immediately following empty lines
                lines.pop(i)
                
                # Remove any empty lines that follow
                while i < len(lines) and not lines[i].strip():
                    lines.pop(i)
                
                self.logger.info(f"Removed duplicate chapter title: {chapter_title}")
                break
        
        return '\n'.join(lines)
    
    def _clean_formatting(self, content: str) -> str:
        """Clean up formatting issues in the content."""
        # Fix multiple consecutive newlines
        content = re.sub(r'\n\s*\n\s*\n+', '\n\n', content)
        
        # Fix spacing around headers
        content = re.sub(r'\n(#+\s+[^\n]+)\n+', r'\n\n\1\n\n', content)
        
        # Fix spacing around list items
        content = re.sub(r'\n(\s*[-*+]\s+[^\n]+)\n+', r'\n\1\n', content)
        
        # Fix spacing around numbered lists
        content = re.sub(r'\n(\s*\d+\.\s+[^\n]+)\n+', r'\n\1\n', content)
        
        # Remove trailing whitespace from lines
        lines = content.split('\n')
        lines = [line.rstrip() for line in lines]
        content = '\n'.join(lines)
        
        return content
    

    
    def validate_chapter_format(self, content: str) -> bool:
        """
        Validate that chapter content is in proper markdown format.
        
        Args:
            content: The content to validate
            
        Returns:
            bool: True if valid markdown format
        """
        if not content or not content.strip():
            return False
        
        # Check for basic markdown structure
        has_headers = bool(re.search(r'^#+\s+', content, re.MULTILINE))
        has_content = len(content.strip()) > 100
        
        # Check word count is reasonable
        word_count = len(re.findall(r'\b\w+\b', content))
        is_reasonable_length = 600 <= word_count <= 2000
        
        return has_headers and has_content and is_reasonable_length
    
    def _validate_generated_chapter(self, chapter: Chapter) -> None:
        """
        Validate the generated chapter using comprehensive checks.
        
        Args:
            chapter: The chapter to validate
            
        Raises:
            ValidationError: If validation fails
        """
        # Use model validation
        validation_errors = chapter.validate()
        
        if validation_errors:
            error_msg = f"Chapter {chapter.number} validation failed with {len(validation_errors)} errors"
            self.logger.error(f"{error_msg}: {validation_errors}")
            raise ValidationError(error_msg, validation_errors)
        
        # Additional quality checks
        self._validate_chapter_quality(chapter)
    
    def _validate_chapter_quality(self, chapter: Chapter) -> None:
        """
        Perform basic quality checks on the chapter.
        
        Args:
            chapter: The chapter to validate
            
        Raises:
            ValidationError: If basic quality checks fail
        """
        errors = []
        
        # Only check for absolute minimum requirements
        if len(chapter.content.strip()) < 500:
            errors.append("Chapter content too short (minimum 500 characters)")
        
        # Check word count is reasonable (very lenient range)
        if chapter.word_count < 300:
            errors.append(f"Chapter too short: {chapter.word_count} words (minimum 300)")
        elif chapter.word_count > 3000:
            errors.append(f"Chapter too long: {chapter.word_count} words (maximum 3000)")
        
        if errors:
            error_msg = f"Chapter {chapter.number} quality validation failed"
            self.logger.warning(f"{error_msg}: {errors}")
            raise ValidationError(error_msg, errors)
    
    def _outline_to_dict(self, outline: BookOutline) -> Dict[str, Any]:
        """Convert BookOutline to dictionary format for API calls."""
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
    
    def get_generation_summary(self, chapters: List[Chapter]) -> str:
        """
        Generate a summary of the chapter generation results.
        
        Args:
            chapters: List of generated chapters
            
        Returns:
            str: Formatted summary
        """
        total_words = sum(chapter.word_count for chapter in chapters)
        avg_words = total_words // len(chapters) if chapters else 0
        
        summary_lines = [
            f"Chapter Generation Summary:",
            f"Total Chapters: {len(chapters)}",
            f"Total Words: {total_words:,}",
            f"Average Words per Chapter: {avg_words:,}",
            "",
            "Chapter Details:"
        ]
        
        for chapter in chapters:
            summary_lines.append(f"  {chapter.number}. {chapter.title} ({chapter.word_count:,} words)")
        
        return "\n".join(summary_lines)