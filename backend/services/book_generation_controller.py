"""
Main controller for orchestrating the book generation process.
"""

from flask import render_template, request, redirect, url_for, send_file, session, jsonify
import os
import logging
import threading
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional

from models.book_models import BookData
from services.outline_generator_service import OutlineGeneratorService
from services.chapter_generator_service import ChapterGeneratorService
from services.pdf_generator_service import PDFGeneratorService
from services.epub_generator_service import EPUBGeneratorService
from services.metadata_generator_service import MetadataGeneratorService
from config import Config


class BookGenerationController:
    """Controller that handles web requests and orchestrates book generation."""
    
    def __init__(self):
        self.generated_files = {}
        self.generation_status = {}
        self.logger = logging.getLogger(__name__)
        
        # Initialize services
        self.outline_service = OutlineGeneratorService()
        self.chapter_service = ChapterGeneratorService()
        self.pdf_service = PDFGeneratorService()
        self.epub_service = EPUBGeneratorService()
        self.metadata_service = MetadataGeneratorService()
        
        # Ensure output directory exists
        self.output_dir = Path(Config.UPLOAD_FOLDER)
        self.output_dir.mkdir(exist_ok=True)
    
    def index(self):
        """Display the main form for book generation."""
        return render_template('index.html')
    
    def generate_book(self):
        """Handle book generation request."""
        # Get form data
        title = request.form.get('title', '').strip()
        author = request.form.get('author', '').strip()
        book_type = request.form.get('book_type', '').strip()
        
        # Validate input
        errors = {}
        if not title:
            errors['title'] = 'Book title is required'
        if not author:
            errors['author'] = 'Author name is required'
        if not book_type or book_type != 'non-fiction':
            errors['book_type'] = 'Only non-fiction books are supported'
        
        # Additional validation
        if len(title) > 200:
            errors['title'] = 'Book title cannot exceed 200 characters'
        if len(author) > 100:
            errors['author'] = 'Author name cannot exceed 100 characters'
        
        if errors:
            return render_template('index.html', errors=errors, title=title, author=author)
        
        # Generate unique session ID for this generation
        from utils.datetime_utils import get_timestamp_for_filename
        generation_id = f"{title.replace(' ', '_').lower()}_{get_timestamp_for_filename()}"
        session['generation_id'] = generation_id
        session['book_title'] = title
        session['author'] = author
        
        # Initialize status
        self.generation_status[generation_id] = {
            'status': 'Starting book generation...',
            'progress': 0,
            'complete': False,
            'error': None,
            'files': {}
        }
        
        # Start book generation in background thread
        thread = threading.Thread(
            target=self._generate_book_async,
            args=(generation_id, title, author, book_type)
        )
        thread.daemon = True
        thread.start()
        
        return render_template('progress.html', status="Starting book generation...")
    
    def progress(self):
        """Return current progress status as JSON."""
        generation_id = session.get('generation_id')
        if not generation_id or generation_id not in self.generation_status:
            return jsonify({'status': 'No active generation', 'progress': 0, 'complete': False})
        
        status = self.generation_status[generation_id]
        return jsonify(status)
    
    def results(self):
        """Display results page with download links."""
        generation_id = session.get('generation_id')
        if not generation_id or generation_id not in self.generation_status:
            return redirect(url_for('index'))
        
        status = self.generation_status[generation_id]
        if not status['complete'] or status['error']:
            return redirect(url_for('index'))
        
        return render_template('results.html',
                             book_title=session.get('book_title'),
                             author=session.get('author'),
                             pdf_filename=status['files'].get('pdf'),
                             epub_filename=status['files'].get('epub'),
                             metadata_filename=status['files'].get('metadata'))
    
    def download_file(self, filename):
        """Handle file download requests."""
        try:
            file_path = self.output_dir / filename
            if not file_path.exists():
                self.logger.error(f"File not found: {filename}")
                return "File not found", 404
            
            # Log the download
            self.logger.info(f"Serving file download: {filename}")
            
            # Determine the correct mimetype
            if filename.endswith('.pdf'):
                mimetype = 'application/pdf'
            elif filename.endswith('.epub'):
                mimetype = 'application/epub+zip'
            elif filename.endswith('.md'):
                mimetype = 'text/markdown'
            else:
                mimetype = 'application/octet-stream'
            
            return send_file(
                str(file_path), 
                as_attachment=True,
                download_name=filename,
                mimetype=mimetype
            )
            
        except Exception as e:
            self.logger.error(f"Error serving file {filename}: {str(e)}")
            return "Error serving file", 500
    
    def cleanup_old_files(self, max_age_hours: int = 24):
        """Clean up old generated files."""
        try:
            import time
            current_time = time.time()
            max_age_seconds = max_age_hours * 3600
            
            cleaned_count = 0
            for file_path in self.output_dir.iterdir():
                if file_path.is_file():
                    file_age = current_time - file_path.stat().st_mtime
                    if file_age > max_age_seconds:
                        file_path.unlink()
                        cleaned_count += 1
                        self.logger.info(f"Cleaned up old file: {file_path.name}")
            
            if cleaned_count > 0:
                self.logger.info(f"Cleaned up {cleaned_count} old files")
            
        except Exception as e:
            self.logger.error(f"Error during file cleanup: {str(e)}")
    
    def get_file_info(self, filename: str) -> Dict[str, Any]:
        """Get information about a generated file."""
        try:
            file_path = self.output_dir / filename
            if not file_path.exists():
                return {}
            
            file_stats = file_path.stat()
            file_size = file_stats.st_size
            
            return {
                'filename': filename,
                'size_bytes': file_size,
                'size_mb': round(file_size / (1024 * 1024), 2),
                'created': datetime.fromtimestamp(file_stats.st_ctime).isoformat(),
                'modified': datetime.fromtimestamp(file_stats.st_mtime).isoformat(),
                'exists': True
            }
            
        except Exception as e:
            self.logger.error(f"Error getting file info for {filename}: {str(e)}")
            return {'exists': False, 'error': str(e)}
    
    def _generate_book_async(self, generation_id: str, title: str, author: str, book_type: str):
        """Generate book asynchronously in background thread."""
        try:
            self.logger.info(f"Starting async book generation for '{title}' by {author}")
            
            # Step 1: Generate outline (20% progress)
            self._update_status(generation_id, "Generating book outline...", 10)
            outline = self.outline_service.generate_book_outline(title)
            self._update_status(generation_id, "Outline generated successfully", 20)
            
            # Step 2: Generate chapters (60% progress)
            self._update_status(generation_id, "Generating chapters (this may take several minutes)...", 25)
            chapters = self.chapter_service.generate_all_chapters(outline)
            self._update_status(generation_id, "All chapters generated successfully", 60)
            
            # Step 3: Create book data
            book_data = BookData(
                title=title,
                author=author,
                book_type=book_type,
                outline=outline,
                chapters=chapters
            )
            
            # Step 4: Generate PDF (75% progress)
            self._update_status(generation_id, "Creating PDF file...", 65)
            pdf_filename = f"{generation_id}.pdf"
            pdf_path = self.output_dir / pdf_filename
            self.pdf_service.create_book_pdf(book_data, str(pdf_path))
            self._update_status(generation_id, "PDF created successfully", 75)
            
            # Step 5: Generate EPUB (85% progress)
            self._update_status(generation_id, "Creating EPUB file...", 80)
            epub_filename = f"{generation_id}.epub"
            epub_path = self.output_dir / epub_filename
            self.epub_service.create_book_epub(book_data, str(epub_path))
            self._update_status(generation_id, "EPUB created successfully", 85)
            
            # Step 6: Generate metadata (95% progress)
            self._update_status(generation_id, "Generating marketing metadata...", 90)
            content_summary = self.metadata_service.create_content_summary(book_data)
            metadata = self.metadata_service.generate_book_metadata(title, author, content_summary)
            
            # Create metadata PDF document
            metadata_filename = f"{generation_id}_metadata.pdf"
            metadata_path = self.output_dir / metadata_filename
            self.metadata_service.create_metadata_document(metadata, title, author, str(metadata_path))
            
            # Step 7: Complete (100% progress)
            self._update_status(generation_id, "Book generation completed successfully!", 100, True, {
                'pdf': pdf_filename,
                'epub': epub_filename,
                'metadata': metadata_filename
            })
            
            self.logger.info(f"Successfully completed book generation for '{title}'")
            
        except Exception as e:
            error_msg = f"Book generation failed: {str(e)}"
            self.logger.error(error_msg)
            self._update_status(generation_id, error_msg, 0, False, error=str(e))
    
    # Note: Book deletion is now handled by the file_management API endpoint
    # The delete_book method has been removed to avoid duplication and use the
    # centralized database service for consistent operations.

    def _update_status(self, generation_id: str, status: str, progress: int, complete: bool = False, files: Dict[str, str] = None, error: str = None):
        """Update generation status."""
        if generation_id in self.generation_status:
            self.generation_status[generation_id].update({
                'status': status,
                'progress': progress,
                'complete': complete,
                'error': error,
                'files': files or self.generation_status[generation_id]['files']
            })
            self.logger.info(f"Status update for {generation_id}: {status} ({progress}%)")