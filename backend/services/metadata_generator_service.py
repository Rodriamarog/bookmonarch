"""
Service for generating book marketing metadata using the Gemini API.
"""

import logging
from typing import Dict, Any, List
from datetime import datetime

from models.book_models import BookMetadata, BookData
from services.gemini_api_client import GeminiAPIClient
from utils.validation import BookValidator, ValidationError
from config import Config
from lib.supabase_storage import SupabaseStorageService, SupabaseStorageError


class MetadataGenerationError(Exception):
    """Custom exception for metadata generation failures."""
    pass


class MetadataGeneratorService:
    """Service for generating book marketing metadata."""
    
    def __init__(self):
        self.api_client = GeminiAPIClient()
        self.logger = logging.getLogger(__name__)
        self.validator = BookValidator()
        
        # Initialize Supabase Storage service
        self.storage_service = SupabaseStorageService()
    
    def generate_book_metadata(self, book_title: str, author: str, content_summary: str) -> BookMetadata:
        """
        Generate comprehensive marketing metadata for a book.
        
        Args:
            book_title: Title of the book
            author: Author name
            content_summary: Summary of the book content
            
        Returns:
            BookMetadata: Complete metadata object
            
        Raises:
            MetadataGenerationError: If metadata generation fails
            ValidationError: If generated metadata is invalid
        """
        self.logger.info(f"Starting metadata generation for '{book_title}' by {author}")
        
        try:
            # Generate metadata with retry logic
            metadata_dict = self._generate_metadata_with_retry(book_title, author, content_summary, max_retries=3)
            
            # Create metadata object
            metadata = BookMetadata.from_dict(metadata_dict)
            
            # Validate the metadata
            self._validate_generated_metadata(metadata)
            
            self.logger.info(f"Successfully generated metadata for '{book_title}'")
            return metadata
            
        except Exception as e:
            self.logger.error(f"Failed to generate metadata for '{book_title}': {str(e)}")
            raise MetadataGenerationError(f"Metadata generation failed: {str(e)}") from e
    
    def _generate_metadata_with_retry(self, book_title: str, author: str, content_summary: str, max_retries: int = 3) -> Dict[str, Any]:
        """
        Generate metadata with retry logic.
        
        Args:
            book_title: Title of the book
            author: Author name
            content_summary: Summary of the book content
            max_retries: Maximum number of retry attempts
            
        Returns:
            Dict[str, Any]: Generated metadata dictionary
            
        Raises:
            MetadataGenerationError: If all retry attempts fail
        """
        last_error = None
        
        for attempt in range(max_retries):
            try:
                self.logger.info(f"Metadata generation attempt {attempt + 1}/{max_retries}")
                
                # Call the API
                metadata_dict = self.api_client.generate_metadata(book_title, author, content_summary)
                
                # Validate the structure
                self._validate_metadata_structure(metadata_dict)
                
                # Success - return the metadata
                self.logger.info(f"Metadata generation successful on attempt {attempt + 1}")
                return metadata_dict
                
            except Exception as e:
                last_error = e
                self.logger.warning(f"Metadata generation attempt {attempt + 1} failed: {str(e)}")
                
                if attempt < max_retries - 1:
                    self.logger.info(f"Retrying metadata generation (attempt {attempt + 2}/{max_retries})")
                    continue
        
        # All attempts failed
        error_msg = f"Failed to generate valid metadata after {max_retries} attempts"
        if last_error:
            error_msg += f". Last error: {str(last_error)}"
        
        raise MetadataGenerationError(error_msg)
    
    def _validate_metadata_structure(self, metadata_dict: Dict[str, Any]) -> None:
        """
        Validate the structure of metadata dictionary from API.
        
        Args:
            metadata_dict: Metadata dictionary to validate
            
        Raises:
            ValueError: If structure is invalid
        """
        required_fields = [
            'sales_description',
            'reading_age_range',
            'bisac_categories',
            'keywords',
            'back_cover_description'
        ]
        
        for field in required_fields:
            if field not in metadata_dict or not metadata_dict[field]:
                raise ValueError(f"Metadata missing or empty field: {field}")
        
        # Validate specific requirements
        if not isinstance(metadata_dict['bisac_categories'], list):
            raise ValueError("BISAC categories must be a list")
        
        if len(metadata_dict['bisac_categories']) != 3:
            raise ValueError(f"Expected exactly 3 BISAC categories, got {len(metadata_dict['bisac_categories'])}")
        
        if not isinstance(metadata_dict['keywords'], list):
            raise ValueError("Keywords must be a list")
        
        if len(metadata_dict['keywords']) != 7:
            raise ValueError(f"Expected exactly 7 keywords, got {len(metadata_dict['keywords'])}")
        
        self.logger.info("Metadata structure validation passed")
    
    def _validate_generated_metadata(self, metadata: BookMetadata) -> None:
        """
        Validate the generated metadata using the model's validation.
        
        Args:
            metadata: The metadata to validate
            
        Raises:
            ValidationError: If validation fails
        """
        validation_errors = metadata.validate()
        
        if validation_errors:
            error_msg = f"Metadata validation failed with {len(validation_errors)} errors"
            self.logger.error(f"{error_msg}: {validation_errors}")
            raise ValidationError(error_msg, validation_errors)
        
        self.logger.info("Metadata validation passed")
    
    def create_metadata_document(self, metadata: BookMetadata, book_title: str, author: str, user_id: str, book_id: str) -> str:
        """
        Create a formatted metadata document as PDF for publishing and upload to Supabase Storage.
        
        Args:
            metadata: The metadata object
            book_title: Title of the book
            author: Author name
            user_id: User ID for storage path
            book_id: Book ID for storage path
            
        Returns:
            str: Public URL of the uploaded PDF file
        """
        self.logger.info(f"Creating metadata PDF document for '{book_title}'")
        
        import tempfile
        temp_pdf_path = None
        
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.units import inch
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
            from reportlab.lib import colors
            
            # Create temporary file for PDF generation
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
                temp_pdf_path = temp_file.name
            
            # Create PDF document
            doc = SimpleDocTemplate(
                temp_pdf_path,
                pagesize=letter,
                rightMargin=72,
                leftMargin=72,
                topMargin=72,
                bottomMargin=18
            )
            
            # Create styles
            styles = getSampleStyleSheet()
            
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=18,
                spaceAfter=30,
                alignment=TA_CENTER,
                textColor=colors.black
            )
            
            heading_style = ParagraphStyle(
                'CustomHeading',
                parent=styles['Heading2'],
                fontSize=14,
                spaceBefore=20,
                spaceAfter=12,
                textColor=colors.black
            )
            
            body_style = ParagraphStyle(
                'CustomBody',
                parent=styles['Normal'],
                fontSize=11,
                spaceAfter=12,
                alignment=TA_JUSTIFY,
                textColor=colors.black
            )
            
            info_style = ParagraphStyle(
                'InfoStyle',
                parent=styles['Normal'],
                fontSize=10,
                spaceAfter=8,
                textColor=colors.black
            )
            
            # Build document content
            story = []
            
            # Title
            story.append(Paragraph("Book Metadata Document", title_style))
            
            # Generated date
            current_date = datetime.now().strftime('%Y-%m-%d')
            story.append(Paragraph(f"Generated on: {current_date}", info_style))
            story.append(Spacer(1, 20))
            
            # Basic Information
            story.append(Paragraph("Basic Information", heading_style))
            story.append(Paragraph(f"<b>Title:</b> {book_title}", body_style))
            story.append(Paragraph(f"<b>Author:</b> {author}", body_style))
            story.append(Paragraph(f"<b>Trim Size:</b> {metadata.trim_size}", body_style))
            story.append(Paragraph(f"<b>Bleed Settings:</b> {metadata.bleed_settings}", body_style))
            story.append(Paragraph(f"<b>Reading Age Range:</b> {metadata.reading_age_range}", body_style))
            
            # Sales Description
            story.append(Paragraph("Sales Description", heading_style))
            story.append(Paragraph("<i>(For Amazon KDP product page)</i>", info_style))
            story.append(Paragraph(metadata.sales_description, body_style))
            
            # BISAC Categories
            story.append(Paragraph("BISAC Categories", heading_style))
            story.append(Paragraph("<i>(Select exactly 3 for Amazon KDP)</i>", info_style))
            for i, category in enumerate(metadata.bisac_categories, 1):
                story.append(Paragraph(f"{i}. {category}", body_style))
            
            # Keywords
            story.append(Paragraph("Keywords", heading_style))
            story.append(Paragraph("<i>(For Amazon KDP search optimization)</i>", info_style))
            for i, keyword in enumerate(metadata.keywords, 1):
                story.append(Paragraph(f"{i}. {keyword}", body_style))
            
            # Back Cover Description
            story.append(Paragraph("Back Cover Description", heading_style))
            story.append(Paragraph("<i>(For print book back cover)</i>", info_style))
            story.append(Paragraph(metadata.back_cover_description, body_style))
            
            # Publishing Checklist
            story.append(Spacer(1, 20))
            story.append(Paragraph("Publishing Checklist", heading_style))
            
            checklist_items = [
                "Upload manuscript files (PDF for print, EPUB for digital)",
                "Enter book title and subtitle",
                "Enter author name",
                "Copy sales description to product page",
                "Select all 3 BISAC categories",
                "Enter all 7 keywords",
                "Set reading age range",
                "Upload cover design",
                "Set pricing",
                "Review and publish"
            ]
            
            for item in checklist_items:
                story.append(Paragraph(f"☐ {item}", body_style))
            
            # Notes
            story.append(Spacer(1, 20))
            story.append(Paragraph("Notes", heading_style))
            
            notes = [
                "This metadata was generated using AI assistance",
                "Review all content for accuracy before publishing",
                "Ensure BISAC categories match your book's content",
                "Keywords should be relevant search terms your readers would use",
                f"Trim size is set to {metadata.trim_size} (standard for non-fiction)",
                f"Bleed settings: {metadata.bleed_settings}"
            ]
            
            for note in notes:
                story.append(Paragraph(f"• {note}", body_style))
            
            # Build the PDF
            doc.build(story)
            
            # Generate storage path
            storage_path = self.storage_service.generate_storage_path(user_id, book_id, 'metadata.pdf')
            
            # Upload to Supabase Storage
            public_url = self.storage_service.upload_file(temp_pdf_path, storage_path)
            
            self.logger.info(f"Created and uploaded metadata PDF document: {public_url}")
            return public_url
            
        except SupabaseStorageError as e:
            self.logger.error(f"Failed to upload metadata PDF to storage: {str(e)}")
            raise MetadataGenerationError(f"Metadata PDF upload failed: {str(e)}") from e
        except Exception as e:
            self.logger.error(f"Failed to create metadata PDF: {str(e)}")
            raise MetadataGenerationError(f"Metadata PDF creation failed: {str(e)}") from e
        finally:
            # Clean up temporary file
            if temp_pdf_path:
                self.storage_service.cleanup_temp_file(temp_pdf_path)
    
    def format_metadata_for_kdp(self, metadata: BookMetadata, book_title: str, author: str) -> Dict[str, Any]:
        """
        Format metadata specifically for Amazon KDP.
        
        Args:
            metadata: The metadata object
            book_title: Title of the book
            author: Author name
            
        Returns:
            Dict[str, Any]: KDP-formatted metadata
        """
        kdp_format = {
            'title': book_title,
            'author': author,
            'description': metadata.sales_description,
            'age_range': metadata.reading_age_range,
            'categories': metadata.bisac_categories,
            'keywords': metadata.keywords,
            'back_cover': metadata.back_cover_description,
            'trim_size': metadata.trim_size,
            'bleed': metadata.bleed_settings,
            'generated_date': datetime.now().isoformat()
        }
        
        self.logger.info("Formatted metadata for KDP")
        return kdp_format
    
    def create_content_summary(self, book_data: BookData) -> str:
        """
        Create a content summary from book data for metadata generation.
        
        Args:
            book_data: Complete book data
            
        Returns:
            str: Content summary
        """
        if not book_data.chapters:
            return f"A comprehensive guide on {book_data.title}"
        
        # Create summary from chapter titles and first few words of each chapter
        summary_parts = [f"This book covers {len(book_data.chapters)} key areas:"]
        
        for chapter in book_data.chapters[:10]:  # Limit to first 10 chapters for summary
            # Get first sentence or 50 characters from chapter content
            first_sentence = ""
            if chapter.content:
                sentences = chapter.content.split('.')
                if sentences:
                    first_sentence = sentences[0][:100] + "..."
            
            summary_parts.append(f"- {chapter.title}: {first_sentence}")
        
        if len(book_data.chapters) > 10:
            summary_parts.append(f"...and {len(book_data.chapters) - 10} additional chapters.")
        
        summary = "\n".join(summary_parts)
        self.logger.info(f"Created content summary ({len(summary)} characters)")
        
        return summary
    
    def get_generation_summary(self, metadata: BookMetadata) -> str:
        """
        Generate a summary of the metadata generation results.
        
        Args:
            metadata: Generated metadata
            
        Returns:
            str: Formatted summary
        """
        summary_lines = [
            "Metadata Generation Summary:",
            f"Sales Description: {len(metadata.sales_description)} characters",
            f"BISAC Categories: {len(metadata.bisac_categories)} categories",
            f"Keywords: {len(metadata.keywords)} keywords",
            f"Back Cover Description: {len(metadata.back_cover_description)} characters",
            f"Reading Age Range: {metadata.reading_age_range}",
            f"Trim Size: {metadata.trim_size}",
            "",
            "BISAC Categories:"
        ]
        
        for i, category in enumerate(metadata.bisac_categories, 1):
            summary_lines.append(f"  {i}. {category}")
        
        summary_lines.append("")
        summary_lines.append("Keywords:")
        
        for i, keyword in enumerate(metadata.keywords, 1):
            summary_lines.append(f"  {i}. {keyword}")
        
        return "\n".join(summary_lines)