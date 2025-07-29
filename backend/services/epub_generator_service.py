"""
Service for generating EPUB books with professional formatting and navigation.
"""

import logging
import os
import re
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

from ebooklib import epub
import markdown

from models.book_models import BookData, Chapter
from config import Config
from utils.validation import ValidationError
from lib.supabase_storage import SupabaseStorageService, SupabaseStorageError


class EPUBGenerationError(Exception):
    """Custom exception for EPUB generation failures."""
    pass


class EPUBGeneratorService:
    """Service for generating professional EPUB books."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Initialize Supabase Storage service
        self.storage_service = SupabaseStorageService()
    
    def create_book_epub(self, book_data: BookData, user_id: str, book_id: str) -> str:
        """
        Create a complete EPUB book from book data and upload to Supabase Storage.
        
        Args:
            book_data: Complete book data with chapters
            user_id: User ID for storage path
            book_id: Book ID for storage path
            
        Returns:
            str: Public URL of the uploaded EPUB file
            
        Raises:
            EPUBGenerationError: If EPUB generation fails
        """
        if not book_data.is_complete():
            raise ValueError("Book data is incomplete")
        
        self.logger.info(f"Starting EPUB generation for '{book_data.title}'")
        
        import tempfile
        temp_epub_path = None
        
        try:
            # Create temporary file for EPUB generation
            with tempfile.NamedTemporaryFile(suffix='.epub', delete=False) as temp_file:
                temp_epub_path = temp_file.name
            
            # Create EPUB book structure
            book = self._create_epub_structure(book_data)
            
            # Add chapters to EPUB
            self._add_chapters_to_epub(book, book_data.chapters)
            
            # Create navigation
            self._create_navigation(book, book_data.chapters)
            
            # Write EPUB file
            epub.write_epub(temp_epub_path, book, {})
            
            # Validate the generated EPUB
            self._validate_epub_output(temp_epub_path)
            
            # Generate storage path
            storage_path = self.storage_service.generate_storage_path(user_id, book_id, 'book.epub')
            
            # Upload to Supabase Storage
            public_url = self.storage_service.upload_file(temp_epub_path, storage_path)
            
            self.logger.info(f"Successfully generated and uploaded EPUB: {public_url}")
            return public_url
            
        except SupabaseStorageError as e:
            self.logger.error(f"Failed to upload EPUB to storage: {str(e)}")
            raise EPUBGenerationError(f"EPUB upload failed: {str(e)}") from e
        except Exception as e:
            self.logger.error(f"Failed to generate EPUB: {str(e)}")
            raise EPUBGenerationError(f"EPUB generation failed: {str(e)}") from e
        finally:
            # Clean up temporary file
            if temp_epub_path:
                self.storage_service.cleanup_temp_file(temp_epub_path)
    
    def _create_epub_structure(self, book_data: BookData) -> epub.EpubBook:
        """Create the basic EPUB book structure with metadata."""
        book = epub.EpubBook()
        
        # Set metadata
        book.set_identifier(f"book_{book_data.title.lower().replace(' ', '_')}")
        book.set_title(book_data.title)
        book.set_language('en')
        
        # Add author
        book.add_author(book_data.author)
        
        # Add publication date
        from utils.datetime_utils import get_current_date_string
        book.add_metadata('DC', 'date', get_current_date_string())
        
        # Add description
        book.add_metadata('DC', 'description', f'A comprehensive guide on {book_data.title}')
        
        # Add publisher info
        book.add_metadata('DC', 'publisher', 'AI Book Generator')
        
        # Add CSS styling
        self._add_epub_styles(book)
        
        self.logger.info(f"Created EPUB structure for '{book_data.title}'")
        return book
    
    def _add_epub_styles(self, book: epub.EpubBook):
        """Add CSS styling to the EPUB."""
        css_content = """
        body {
            font-family: "Times New Roman", serif;
            font-size: 12pt;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
        }
        
        h1 {
            font-size: 24pt;
            font-weight: bold;
            text-align: center;
            margin: 40px 0 20px 0;
            page-break-before: always;
        }
        
        h2 {
            font-size: 18pt;
            font-weight: bold;
            margin: 30px 0 15px 0;
            page-break-after: avoid;
        }
        
        h3 {
            font-size: 14pt;
            font-weight: bold;
            margin: 20px 0 10px 0;
            page-break-after: avoid;
        }
        
        p {
            margin: 0 0 12px 0;
            text-align: justify;
            text-indent: 0;
        }
        
        .chapter-title {
            font-size: 20pt;
            font-weight: bold;
            text-align: center;
            margin: 40px 0 30px 0;
            page-break-before: always;
        }
        
        .chapter-number {
            font-size: 16pt;
            font-weight: normal;
            text-align: center;
            margin: 20px 0 10px 0;
        }
        
        .title-page {
            text-align: center;
            margin-top: 100px;
        }
        
        .title-page h1 {
            font-size: 28pt;
            margin-bottom: 40px;
        }
        
        .title-page .author {
            font-size: 18pt;
            font-style: italic;
        }
        
        .toc {
            page-break-before: always;
        }
        
        .toc h1 {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .toc ul {
            list-style: none;
            padding: 0;
        }
        
        .toc li {
            margin: 8px 0;
            font-size: 12pt;
        }
        
        .toc a {
            text-decoration: none;
            color: #000;
        }
        
        .toc a:hover {
            text-decoration: underline;
        }
        """
        
        # Create CSS item
        self.nav_css = epub.EpubItem(
            uid="nav_css",
            file_name="style/nav.css",
            media_type="text/css",
            content=css_content
        )
        book.add_item(self.nav_css)
        
        return self.nav_css
    
    def _add_chapters_to_epub(self, book: epub.EpubBook, chapters: List[Chapter]):
        """Add all chapters to the EPUB book."""
        spine_items = ['nav']
        
        # Add title page
        title_page = self._create_title_page(book)
        book.add_item(title_page)
        spine_items.append(title_page)
        
        # Add each chapter
        for chapter in chapters:
            self.logger.info(f"Adding chapter {chapter.number} to EPUB")
            
            # Convert markdown to HTML
            chapter_html = self._convert_chapter_to_html(chapter)
            
            # Create EPUB chapter item
            chapter_item = epub.EpubHtml(
                title=chapter.title,
                file_name=f'chapter_{chapter.number:02d}.xhtml',
                lang='en'
            )
            
            chapter_item.content = chapter_html
            chapter_item.add_item(self.nav_css)
            
            book.add_item(chapter_item)
            spine_items.append(chapter_item)
        
        # Set spine (reading order)
        book.spine = spine_items
        
        self.logger.info(f"Added {len(chapters)} chapters to EPUB")
    
    def _create_title_page(self, book: epub.EpubBook) -> epub.EpubHtml:
        """Create the title page for the EPUB."""
        # Get author from metadata
        authors = book.get_metadata('DC', 'creator')
        author_name = authors[0][0] if authors else "Unknown Author"
        
        title_html = f"""
        <!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
            <title>Title Page</title>
            <link rel="stylesheet" type="text/css" href="style/nav.css"/>
        </head>
        <body>
            <div class="title-page">
                <h1>{book.title}</h1>
                <p class="author">by {author_name}</p>
            </div>
        </body>
        </html>
        """
        
        title_page = epub.EpubHtml(
            title='Title Page',
            file_name='title_page.xhtml',
            lang='en'
        )
        title_page.content = title_html
        title_page.add_item(self.nav_css)
        
        return title_page
    
    def _convert_chapter_to_html(self, chapter: Chapter) -> str:
        """Convert chapter markdown content to HTML."""
        # Convert markdown to HTML
        md = markdown.Markdown(extensions=['extra', 'codehilite'])
        content_html = md.convert(chapter.content)
        
        # Create full HTML document
        html_content = f"""
        <!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
            <title>{chapter.title}</title>
            <link rel="stylesheet" type="text/css" href="style/nav.css"/>
        </head>
        <body>
            <div class="chapter-number">Chapter {chapter.number}</div>
            <h1 class="chapter-title">{chapter.title}</h1>
            {content_html}
        </body>
        </html>
        """
        
        return html_content
    
    def _create_navigation(self, book: epub.EpubBook, chapters: List[Chapter]):
        """Create table of contents and navigation for the EPUB."""
        # Create table of contents
        toc_items = []
        
        # Add chapters to TOC
        for chapter in chapters:
            toc_items.append(epub.Link(f'chapter_{chapter.number:02d}.xhtml', chapter.title, f'chapter_{chapter.number}'))
        
        book.toc = toc_items
        
        # Add navigation files
        book.add_item(epub.EpubNcx())
        book.add_item(epub.EpubNav())
        
        self.logger.info(f"Created navigation with {len(toc_items)} chapters")
    
    def _validate_epub_output(self, epub_path: str):
        """Validate the generated EPUB file."""
        if not os.path.exists(epub_path):
            raise EPUBGenerationError("EPUB file was not created")
        
        file_size = os.path.getsize(epub_path)
        if file_size < 1000:  # Less than 1KB is suspicious
            raise EPUBGenerationError("Generated EPUB file is too small")
        
        # Basic EPUB structure validation
        try:
            # Try to read the EPUB file to validate structure
            test_book = epub.read_epub(epub_path)
            if not test_book.get_items():
                raise EPUBGenerationError("EPUB file appears to be empty or corrupted")
        except Exception as e:
            raise EPUBGenerationError(f"EPUB validation failed: {str(e)}")
        
        self.logger.info(f"EPUB validation passed: {file_size:,} bytes")
    
    def get_epub_info(self, epub_path: str) -> Dict[str, Any]:
        """Get information about the generated EPUB."""
        if not os.path.exists(epub_path):
            return {}
        
        file_size = os.path.getsize(epub_path)
        
        try:
            book = epub.read_epub(epub_path)
            chapter_count = len([item for item in book.get_items() if isinstance(item, epub.EpubHtml) and 'chapter_' in item.file_name])
        except:
            chapter_count = 0
        
        return {
            'file_path': epub_path,
            'file_size': file_size,
            'file_size_mb': round(file_size / (1024 * 1024), 2),
            'chapter_count': chapter_count,
            'format': 'EPUB 3.0',
            'validation_status': 'Valid' if chapter_count > 0 else 'Unknown'
        }