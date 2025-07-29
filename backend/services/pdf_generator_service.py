"""
Service for generating PDF books with professional formatting using ReportLab.
"""

import logging
import os
import re
from pathlib import Path
from typing import List, Dict, Any, Tuple
from io import BytesIO
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate
from reportlab.platypus.frames import Frame

from models.book_models import BookData, Chapter
from config import Config
from utils.validation import ValidationError
from lib.supabase_storage import SupabaseStorageService, SupabaseStorageError


class PDFGenerationError(Exception):
    """Custom exception for PDF generation failures."""
    pass


class BookPDFTemplate(BaseDocTemplate):
    """Custom PDF template for book formatting."""
    
    def __init__(self, filename, **kwargs):
        self.allowSplitting = 1
        BaseDocTemplate.__init__(self, filename, **kwargs)
        
        # Page dimensions (5x8 inches)
        self.page_width = 5 * inch
        self.page_height = 8 * inch
        
        # Margins as specified in requirements
        self.margin_inside = 0.375 * inch
        self.margin_outside = 0.375 * inch
        self.margin_top = 0.5 * inch
        self.margin_bottom = 0.5 * inch
        
        # Create page templates
        self._create_page_templates()
    
    def _create_page_templates(self):
        """Create page templates for different page types."""
        # Title page template (no page numbers)
        title_frame = Frame(
            self.margin_outside, self.margin_bottom,
            self.page_width - self.margin_inside - self.margin_outside,
            self.page_height - self.margin_top - self.margin_bottom,
            id='title_frame'
        )
        title_template = PageTemplate(id='title', frames=title_frame)
        
        # Regular page template (with page numbers)
        regular_frame = Frame(
            self.margin_outside, self.margin_bottom + 0.3 * inch,  # Space for page numbers
            self.page_width - self.margin_inside - self.margin_outside,
            self.page_height - self.margin_top - self.margin_bottom - 0.3 * inch,
            id='regular_frame'
        )
        regular_template = PageTemplate(id='regular', frames=regular_frame, onPage=self._add_page_number)
        
        self.addPageTemplates([title_template, regular_template])
    
    def _add_page_number(self, canvas, doc):
        """Add page numbers to regular pages."""
        canvas.saveState()
        canvas.setFont('Times-Roman', 10)
        page_num = canvas.getPageNumber()
        
        # Center page number at bottom
        text = str(page_num)
        canvas.drawCentredText(self.page_width / 2, 0.2 * inch, text)
        canvas.restoreState()


class PDFGeneratorService:
    """Service for generating professional PDF books."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Initialize Supabase Storage service
        self.storage_service = SupabaseStorageService()
        
        # PDF configuration from Config
        self.page_width = Config.PDF_PAGE_WIDTH * inch
        self.page_height = Config.PDF_PAGE_HEIGHT * inch
        self.margin_inside = Config.PDF_MARGIN_INSIDE * inch
        self.margin_outside = Config.PDF_MARGIN_OUTSIDE * inch
        self.margin_top = Config.PDF_MARGIN_TOP * inch
        self.margin_bottom = Config.PDF_MARGIN_BOTTOM * inch
        
        # Create styles
        self.styles = self._create_styles()
    
    def create_book_pdf(self, book_data: BookData, user_id: str, book_id: str) -> str:
        """
        Create a complete PDF book from book data and upload to Supabase Storage.
        
        Args:
            book_data: Complete book data with chapters
            user_id: User ID for storage path
            book_id: Book ID for storage path
            
        Returns:
            str: Public URL of the uploaded PDF file
            
        Raises:
            PDFGenerationError: If PDF generation fails
        """
        if not book_data.is_complete():
            raise ValueError("Book data is incomplete")
        
        self.logger.info(f"Starting PDF generation for '{book_data.title}'")
        
        import tempfile
        temp_pdf_path = None
        
        try:
            # Create temporary file for PDF generation
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
                temp_pdf_path = temp_file.name
            
            # Create PDF document
            doc = BookPDFTemplate(
                temp_pdf_path,
                pagesize=(self.page_width, self.page_height),
                title=book_data.title,
                author=book_data.author
            )
            
            # Build document content
            story = []
            
            # Add title page
            self._add_title_page(story, book_data)
            
            # Add table of contents
            self._add_table_of_contents(story, book_data.chapters)
            
            # Add chapters
            self._add_chapters(story, book_data.chapters)
            
            # Add copyright page
            self._add_copyright_page(story, book_data)
            
            # Build the PDF
            doc.build(story)
            
            # Validate the generated PDF
            self._validate_pdf_output(temp_pdf_path)
            
            # Generate storage path
            storage_path = self.storage_service.generate_storage_path(user_id, book_id, 'book.pdf')
            
            # Upload to Supabase Storage
            public_url = self.storage_service.upload_file(temp_pdf_path, storage_path)
            
            self.logger.info(f"Successfully generated and uploaded PDF: {public_url}")
            return public_url
            
        except SupabaseStorageError as e:
            self.logger.error(f"Failed to upload PDF to storage: {str(e)}")
            raise PDFGenerationError(f"PDF upload failed: {str(e)}") from e
        except Exception as e:
            self.logger.error(f"Failed to generate PDF: {str(e)}")
            raise PDFGenerationError(f"PDF generation failed: {str(e)}") from e
        finally:
            # Clean up temporary file
            if temp_pdf_path:
                self.storage_service.cleanup_temp_file(temp_pdf_path)
    
    def _create_styles(self) -> Dict[str, ParagraphStyle]:
        """Create custom paragraph styles for the book."""
        base_styles = getSampleStyleSheet()
        
        styles = {
            'title': ParagraphStyle(
                'BookTitle',
                parent=base_styles['Title'],
                fontName='Times-Bold',
                fontSize=24,
                alignment=TA_CENTER,
                spaceAfter=12,
                textColor=colors.black
            ),
            'author': ParagraphStyle(
                'Author',
                parent=base_styles['Normal'],
                fontName='Times-Roman',
                fontSize=16,
                alignment=TA_CENTER,
                spaceAfter=24,
                textColor=colors.black
            ),
            'chapter_title': ParagraphStyle(
                'ChapterTitle',
                parent=base_styles['Heading1'],
                fontName='Times-Bold',
                fontSize=18,
                alignment=TA_CENTER,
                spaceBefore=24,
                spaceAfter=18,
                textColor=colors.black
            ),
            'heading2': ParagraphStyle(
                'Heading2',
                parent=base_styles['Heading2'],
                fontName='Times-Bold',
                fontSize=14,
                spaceBefore=18,
                spaceAfter=12,
                textColor=colors.black
            ),
            'heading3': ParagraphStyle(
                'Heading3',
                parent=base_styles['Heading3'],
                fontName='Times-Bold',
                fontSize=12,
                spaceBefore=12,
                spaceAfter=8,
                textColor=colors.black
            ),
            'body': ParagraphStyle(
                'BookBody',
                parent=base_styles['Normal'],
                fontName='Times-Roman',
                fontSize=11,
                alignment=TA_JUSTIFY,
                spaceBefore=6,
                spaceAfter=6,
                leftIndent=0,
                rightIndent=0,
                textColor=colors.black
            ),
            'toc_title': ParagraphStyle(
                'TOCTitle',
                parent=base_styles['Heading1'],
                fontName='Times-Bold',
                fontSize=18,
                alignment=TA_CENTER,
                spaceBefore=0,
                spaceAfter=24,
                textColor=colors.black
            ),
            'toc_entry': ParagraphStyle(
                'TOCEntry',
                parent=base_styles['Normal'],
                fontName='Times-Roman',
                fontSize=12,
                spaceBefore=6,
                spaceAfter=6,
                leftIndent=0,
                textColor=colors.black
            ),
            'copyright': ParagraphStyle(
                'Copyright',
                parent=base_styles['Normal'],
                fontName='Times-Roman',
                fontSize=10,
                alignment=TA_CENTER,
                spaceBefore=6,
                spaceAfter=6,
                textColor=colors.black
            ),
            'copyright_title': ParagraphStyle(
                'CopyrightTitle',
                parent=base_styles['Heading2'],
                fontName='Times-Bold',
                fontSize=14,
                alignment=TA_CENTER,
                spaceBefore=24,
                spaceAfter=18,
                textColor=colors.black
            )
        }
        
        return styles
    
    def _add_title_page(self, story: List, book_data: BookData):
        """Add title page to the document."""
        # Use title page template
        story.append(Paragraph('<para alignment="center"><!-- title page --></para>', self.styles['body']))
        
        # Add vertical spacing to center content
        story.append(Spacer(1, 2 * inch))
        
        # Book title
        story.append(Paragraph(book_data.title, self.styles['title']))
        story.append(Spacer(1, 0.5 * inch))
        
        # Author name
        story.append(Paragraph(f"by {book_data.author}", self.styles['author']))
        
        # Page break to next page
        story.append(PageBreak())
    
    def _add_table_of_contents(self, story: List, chapters: List[Chapter]):
        """Add table of contents with clickable links."""
        # TOC title
        story.append(Paragraph("Table of Contents", self.styles['toc_title']))
        story.append(Spacer(1, 0.3 * inch))
        
        # TOC entries
        for chapter in chapters:
            # Create clickable link
            toc_text = f'<a href="#{self._get_chapter_anchor(chapter)}" color="blue">{chapter.number}. {chapter.title}</a>'
            story.append(Paragraph(toc_text, self.styles['toc_entry']))
        
        # Page break to chapters
        story.append(PageBreak())
    
    def _add_chapters(self, story: List, chapters: List[Chapter]):
        """Add all chapters to the document."""
        for i, chapter in enumerate(chapters):
            self.logger.info(f"Adding chapter {chapter.number} to PDF")
            
            # Add chapter anchor for TOC links
            anchor = f'<a name="{self._get_chapter_anchor(chapter)}"/>'
            story.append(Paragraph(anchor, self.styles['body']))
            
            # Chapter title
            story.append(Paragraph(f"Chapter {chapter.number}", self.styles['chapter_title']))
            story.append(Paragraph(chapter.title, self.styles['chapter_title']))
            story.append(Spacer(1, 0.2 * inch))
            
            # Chapter content
            self._add_chapter_content(story, chapter)
            
            # Page break between chapters (except for last chapter)
            if i < len(chapters) - 1:
                story.append(PageBreak())
    
    def _add_chapter_content(self, story: List, chapter: Chapter):
        """Add formatted chapter content to the document."""
        if not chapter.content:
            return
        
        # Split content into paragraphs and process markdown
        content_parts = self._process_markdown_content(chapter.content)
        
        for part in content_parts:
            if part['type'] == 'heading2':
                story.append(Paragraph(part['text'], self.styles['heading2']))
            elif part['type'] == 'heading3':
                story.append(Paragraph(part['text'], self.styles['heading3']))
            elif part['type'] == 'paragraph':
                # Process inline markdown (bold, italic)
                formatted_text = self._process_inline_markdown(part['text'])
                story.append(Paragraph(formatted_text, self.styles['body']))
            elif part['type'] == 'list_item':
                # Format as indented paragraph
                formatted_text = f"• {self._process_inline_markdown(part['text'])}"
                story.append(Paragraph(formatted_text, self.styles['body']))
    
    def _process_markdown_content(self, content: str) -> List[Dict[str, str]]:
        """Process markdown content into structured parts."""
        parts = []
        lines = content.split('\n')
        current_paragraph = []
        
        for line in lines:
            line = line.strip()
            
            if not line:
                # Empty line - end current paragraph
                if current_paragraph:
                    parts.append({
                        'type': 'paragraph',
                        'text': ' '.join(current_paragraph)
                    })
                    current_paragraph = []
                continue
            
            # Check for headers (handle multiple # levels)
            if line.startswith('#### '):
                # End current paragraph
                if current_paragraph:
                    parts.append({
                        'type': 'paragraph',
                        'text': ' '.join(current_paragraph)
                    })
                    current_paragraph = []
                
                parts.append({
                    'type': 'heading3',  # Treat #### as heading3
                    'text': line[5:].strip()
                })
            elif line.startswith('### '):
                # End current paragraph
                if current_paragraph:
                    parts.append({
                        'type': 'paragraph',
                        'text': ' '.join(current_paragraph)
                    })
                    current_paragraph = []
                
                parts.append({
                    'type': 'heading3',
                    'text': line[4:].strip()
                })
            elif line.startswith('## '):
                # End current paragraph
                if current_paragraph:
                    parts.append({
                        'type': 'paragraph',
                        'text': ' '.join(current_paragraph)
                    })
                    current_paragraph = []
                
                parts.append({
                    'type': 'heading2',
                    'text': line[3:].strip()
                })
            elif line.startswith('- ') or line.startswith('* '):
                # End current paragraph
                if current_paragraph:
                    parts.append({
                        'type': 'paragraph',
                        'text': ' '.join(current_paragraph)
                    })
                    current_paragraph = []
                
                parts.append({
                    'type': 'list_item',
                    'text': line[2:].strip()
                })
            else:
                # Regular text - add to current paragraph
                current_paragraph.append(line)
        
        # Add final paragraph if exists
        if current_paragraph:
            parts.append({
                'type': 'paragraph',
                'text': ' '.join(current_paragraph)
            })
        
        return parts
    
    def _process_inline_markdown(self, text: str) -> str:
        """Process inline markdown formatting."""
        # Bold text
        text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
        
        # Italic text
        text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
        
        # Code text (monospace)
        text = re.sub(r'`(.*?)`', r'<font name="Courier">\1</font>', text)
        
        return text
    
    def _add_copyright_page(self, story: List, book_data: BookData):
        """Add copyright page to the document."""
        # Page break to start copyright on new page
        story.append(PageBreak())
        
        # Add vertical spacing to center content
        story.append(Spacer(1, 1.5 * inch))
        
        # Copyright title
        story.append(Paragraph("Copyright", self.styles['copyright_title']))
        story.append(Spacer(1, 0.5 * inch))
        
        # Get current year
        from utils.datetime_utils import get_current_year
        current_year = get_current_year()
        
        # Main copyright notice
        copyright_text = f"Copyright © {current_year} {book_data.author}"
        story.append(Paragraph(copyright_text, self.styles['copyright']))
        story.append(Spacer(1, 0.3 * inch))
        
        # All rights reserved
        story.append(Paragraph("All rights reserved.", self.styles['copyright']))
        story.append(Spacer(1, 0.3 * inch))
        
        # Standard copyright disclaimer
        disclaimer_text = """No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the author, except in the case of brief quotations embodied in critical reviews and certain other noncommercial uses permitted by copyright law."""
        story.append(Paragraph(disclaimer_text, self.styles['copyright']))
        story.append(Spacer(1, 0.3 * inch))
        
        # Contact information placeholder
        contact_text = f"For permission requests, contact the author."
        story.append(Paragraph(contact_text, self.styles['copyright']))
        story.append(Spacer(1, 0.5 * inch))
        
        # Publication info
        pub_info = f"First Edition {current_year}"
        story.append(Paragraph(pub_info, self.styles['copyright']))
        story.append(Spacer(1, 0.2 * inch))
    
    def _get_chapter_anchor(self, chapter: Chapter) -> str:
        """Generate anchor name for chapter."""
        return f"chapter_{chapter.number}"
    
    def _validate_pdf_output(self, pdf_path: str):
        """Validate the generated PDF file."""
        if not os.path.exists(pdf_path):
            raise PDFGenerationError("PDF file was not created")
        
        file_size = os.path.getsize(pdf_path)
        if file_size < 1000:  # Less than 1KB is suspicious
            raise PDFGenerationError("Generated PDF file is too small")
        
        self.logger.info(f"PDF validation passed: {file_size:,} bytes")
    
    def get_pdf_info(self, pdf_path: str) -> Dict[str, Any]:
        """Get information about the generated PDF."""
        if not os.path.exists(pdf_path):
            return {}
        
        file_size = os.path.getsize(pdf_path)
        
        return {
            'file_path': pdf_path,
            'file_size': file_size,
            'file_size_mb': round(file_size / (1024 * 1024), 2),
            'page_dimensions': f"{Config.PDF_PAGE_WIDTH}x{Config.PDF_PAGE_HEIGHT} inches",
            'margins': {
                'inside': f"{Config.PDF_MARGIN_INSIDE} inches",
                'outside': f"{Config.PDF_MARGIN_OUTSIDE} inches",
                'top': f"{Config.PDF_MARGIN_TOP} inches",
                'bottom': f"{Config.PDF_MARGIN_BOTTOM} inches"
            },
            'font': Config.PDF_FONT
        }