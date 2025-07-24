"""
Service for generating individual book chapters using the Gemini API.
"""

import logging
import re
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
            cleaned_content = self.clean_chapter_content(content)
            
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
        Generate chapter content with retry logic for meta commentary.
        
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
                
                # Validate content format and quality
                validation_errors = self.validator.validate_chapter_content(content, self.target_word_count)
                
                if validation_errors:
                    # Check if errors are related to meta commentary
                    meta_commentary_errors = [error for error in validation_errors if 'meta commentary' in error.lower()]
                    
                    if meta_commentary_errors and attempt < max_retries - 1:
                        self.logger.warning(f"Attempt {attempt + 1} contains meta commentary, retrying...")
                        continue
                    
                    # Other validation errors or final attempt
                    error_msg = f"Chapter validation failed: {'; '.join(validation_errors)}"
                    self.logger.warning(f"Attempt {attempt + 1} failed validation: {error_msg}")
                    
                    if attempt < max_retries - 1:
                        continue
                    else:
                        raise ValidationError(error_msg, validation_errors)
                
                # Success - return the valid content
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
    
    def clean_chapter_content(self, raw_content: str) -> str:
        """
        Clean chapter content by removing meta commentary and formatting issues.
        
        Args:
            raw_content: Raw content from API
            
        Returns:
            str: Cleaned content
        """
        if not raw_content:
            return ""
        
        content = raw_content.strip()
        
        # Remove common meta commentary patterns
        meta_patterns = [
            r'\*\*Note:.*?\n',
            r'\*\*Author\'s Note:.*?\n',
            r'\[Author\'s commentary:.*?\]',
            r'\*\*Commentary:.*?\n',
            r'^.*In this chapter, we will.*?\n',
            r'^.*This chapter will cover.*?\n',
            r'^.*As the author.*?\n',
            r'^.*Let me explain.*?\n',
            r'^.*I want to emphasize.*?\n',
            r'^.*It\'s important to note.*?\n'
        ]
        
        for pattern in meta_patterns:
            content = re.sub(pattern, '', content, flags=re.IGNORECASE | re.MULTILINE)
        
        # Clean up formatting issues
        content = self._clean_formatting(content)
        
        # Remove any remaining meta commentary sentences
        content = self._remove_meta_sentences(content)
        
        return content.strip()
    
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
    
    def _remove_meta_sentences(self, content: str) -> str:
        """Remove sentences that contain meta commentary."""
        sentences = re.split(r'(?<=[.!?])\s+', content)
        cleaned_sentences = []
        
        meta_indicators = [
            'in this chapter',
            'this chapter will',
            'as the author',
            'let me explain',
            'i want to emphasize',
            'it\'s important to note',
            'we will explore',
            'we will discuss',
            'this section covers',
            'in the following section'
        ]
        
        for sentence in sentences:
            sentence_lower = sentence.lower()
            is_meta = any(indicator in sentence_lower for indicator in meta_indicators)
            
            if not is_meta:
                cleaned_sentences.append(sentence)
            else:
                self.logger.debug(f"Removed meta sentence: {sentence[:50]}...")
        
        return ' '.join(cleaned_sentences)
    
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
        Perform additional quality checks on the chapter.
        
        Args:
            chapter: The chapter to validate
            
        Raises:
            ValidationError: If quality checks fail
        """
        errors = []
        
        # Check for minimum content structure
        if not re.search(r'^#+\s+', chapter.content, re.MULTILINE):
            errors.append("Chapter lacks proper markdown headers")
        
        # Check for reasonable paragraph structure
        paragraphs = [p.strip() for p in chapter.content.split('\n\n') if p.strip()]
        if len(paragraphs) < 3:
            errors.append("Chapter has too few paragraphs (minimum 3)")
        
        # Check for overly short paragraphs
        short_paragraphs = [p for p in paragraphs if len(p.split()) < 20]
        if len(short_paragraphs) > len(paragraphs) * 0.5:
            errors.append("Too many short paragraphs (less than 20 words)")
        
        # Check for excessive repetitive content (only flag if >20% of sentences are duplicates)
        sentences = re.split(r'[.!?]+', chapter.content)
        sentences = [s.strip().lower() for s in sentences if len(s.strip()) > 20]  # Only check longer sentences
        
        if len(sentences) > 0:
            unique_sentences = len(set(sentences))
            duplicate_ratio = (len(sentences) - unique_sentences) / len(sentences)
            
            if duplicate_ratio > 0.2:  # Only flag if more than 20% are duplicates
                errors.append(f"Chapter contains excessive repetitive sentences ({duplicate_ratio:.1%} duplicates)")
        
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