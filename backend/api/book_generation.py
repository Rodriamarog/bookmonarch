"""
Book generation API endpoints.
"""

import logging
import threading
import uuid
from datetime import datetime
from flask import request, jsonify, g
from typing import Dict, Any

from api import api_bp
from lib.auth import require_auth, get_current_user_id
from models.book_models import BookData
from services.outline_generator_service import OutlineGeneratorService
from services.chapter_generator_service import ChapterGeneratorService
from services.pdf_generator_service import PDFGeneratorService
from services.epub_generator_service import EPUBGeneratorService
from services.metadata_generator_service import MetadataGeneratorService


logger = logging.getLogger(__name__)

# Global storage for generation status (in production, use Redis or database)
generation_status = {}

# Initialize services
outline_service = OutlineGeneratorService()
chapter_service = ChapterGeneratorService()
pdf_service = PDFGeneratorService()
epub_service = EPUBGeneratorService()
metadata_service = MetadataGeneratorService()


@api_bp.route('/generate-book', methods=['POST'])
@require_auth
def generate_book():
    """
    Start book generation process.
    
    Request JSON:
        {
            "title": "Book Title",
            "author": "Author Name",
            "book_type": "non-fiction"
        }
    
    Returns:
        JSON response with book_id for tracking progress
    """
    try:
        user_id = get_current_user_id()
        
        # Validate request data
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON',
                'code': 'INVALID_REQUEST_FORMAT'
            }), 400
        
        data = request.get_json()
        
        # Validate required fields
        title = data.get('title', '').strip()
        author = data.get('author', '').strip()
        book_type = data.get('book_type', '').strip()
        
        validation_errors = []
        
        if not title:
            validation_errors.append('Book title is required')
        elif len(title) > 200:
            validation_errors.append('Book title cannot exceed 200 characters')
        
        if not author:
            validation_errors.append('Author name is required')
        elif len(author) > 100:
            validation_errors.append('Author name cannot exceed 100 characters')
        
        if not book_type or book_type != 'non-fiction':
            validation_errors.append('Only non-fiction books are supported')
        
        if validation_errors:
            return jsonify({
                'success': False,
                'error': 'Validation failed',
                'code': 'VALIDATION_ERROR',
                'details': validation_errors
            }), 400
        
        # Generate unique book ID
        book_id = str(uuid.uuid4())
        
        # Initialize generation status
        generation_status[book_id] = {
            'book_id': book_id,
            'user_id': user_id,
            'title': title,
            'author': author,
            'book_type': book_type,
            'status': 'pending',
            'progress': 0,
            'current_step': 'Starting book generation...',
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
            'error': None,
            'files': {
                'pdf_url': None,
                'epub_url': None,
                'metadata_url': None
            }
        }
        
        # Start book generation in background thread
        thread = threading.Thread(
            target=_generate_book_async,
            args=(book_id, user_id, title, author, book_type)
        )
        thread.daemon = True
        thread.start()
        
        logger.info(f"Started book generation for user {user_id}: '{title}' (book_id: {book_id})")
        
        return jsonify({
            'success': True,
            'book_id': book_id,
            'message': 'Book generation started successfully',
            'status': 'pending'
        }), 202
        
    except Exception as e:
        logger.error(f"Error starting book generation: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to start book generation',
            'code': 'GENERATION_START_ERROR',
            'message': str(e)
        }), 500


@api_bp.route('/book-status/<book_id>', methods=['GET'])
@require_auth
def get_book_status(book_id: str):
    """
    Get book generation status and progress.
    
    Args:
        book_id: Book ID from generation request
    
    Returns:
        JSON response with current status and progress
    """
    try:
        user_id = get_current_user_id()
        
        # Check if book exists
        if book_id not in generation_status:
            return jsonify({
                'success': False,
                'error': 'Book not found',
                'code': 'BOOK_NOT_FOUND'
            }), 404
        
        status = generation_status[book_id]
        
        # Check if user owns this book
        if status['user_id'] != user_id:
            return jsonify({
                'success': False,
                'error': 'Access denied',
                'code': 'ACCESS_DENIED'
            }), 403
        
        # Return status information
        response_data = {
            'success': True,
            'book_id': book_id,
            'status': status['status'],
            'progress': status['progress'],
            'current_step': status['current_step'],
            'title': status['title'],
            'author': status['author'],
            'created_at': status['created_at'],
            'updated_at': status['updated_at']
        }
        
        # Include error if present
        if status['error']:
            response_data['error'] = status['error']
        
        # Include file URLs if generation is complete
        if status['status'] == 'completed':
            response_data['files'] = status['files']
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error getting book status for {book_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get book status',
            'code': 'STATUS_ERROR',
            'message': str(e)
        }), 500


def _generate_book_async(book_id: str, user_id: str, title: str, author: str, book_type: str):
    """
    Generate book asynchronously in background thread.
    
    Args:
        book_id: Unique book identifier
        user_id: User ID
        title: Book title
        author: Author name
        book_type: Type of book (non-fiction)
    """
    try:
        logger.info(f"Starting async book generation for '{title}' by {author} (book_id: {book_id})")
        
        # Step 1: Generate outline (20% progress)
        _update_generation_status(book_id, 'outline_generated', 10, "Generating book outline...")
        outline = outline_service.generate_book_outline(title)
        _update_generation_status(book_id, 'outline_generated', 20, "Outline generated successfully")
        
        # Step 2: Generate chapters (60% progress)
        _update_generation_status(book_id, 'generating_content', 25, "Generating chapters (this may take several minutes)...")
        chapters = chapter_service.generate_all_chapters(outline)
        _update_generation_status(book_id, 'generating_content', 60, "All chapters generated successfully")
        
        # Step 3: Create book data
        book_data = BookData(
            title=title,
            author=author,
            book_type=book_type,
            outline=outline,
            chapters=chapters
        )
        
        # Step 4: Generate PDF (75% progress)
        _update_generation_status(book_id, 'generating_content', 65, "Creating PDF file...")
        pdf_url = pdf_service.create_book_pdf(book_data, user_id, book_id)
        _update_generation_status(book_id, 'generating_content', 75, "PDF created successfully")
        
        # Step 5: Generate EPUB (85% progress)
        _update_generation_status(book_id, 'generating_content', 80, "Creating EPUB file...")
        epub_url = epub_service.create_book_epub(book_data, user_id, book_id)
        _update_generation_status(book_id, 'generating_content', 85, "EPUB created successfully")
        
        # Step 6: Generate metadata (95% progress)
        _update_generation_status(book_id, 'generating_content', 90, "Generating marketing metadata...")
        content_summary = metadata_service.create_content_summary(book_data)
        metadata = metadata_service.generate_book_metadata(title, author, content_summary)
        
        # Create metadata PDF document
        metadata_url = metadata_service.create_metadata_document(metadata, title, author, user_id, book_id)
        
        # Step 7: Complete (100% progress)
        generation_status[book_id].update({
            'status': 'completed',
            'progress': 100,
            'current_step': 'Book generation completed successfully!',
            'updated_at': datetime.utcnow().isoformat(),
            'files': {
                'pdf_url': pdf_url,
                'epub_url': epub_url,
                'metadata_url': metadata_url
            }
        })
        
        logger.info(f"Successfully completed book generation for '{title}' (book_id: {book_id})")
        
    except Exception as e:
        error_msg = f"Book generation failed: {str(e)}"
        logger.error(f"Error in async book generation for {book_id}: {error_msg}")
        
        # Update status with error
        if book_id in generation_status:
            generation_status[book_id].update({
                'status': 'failed',
                'progress': 0,
                'current_step': 'Book generation failed',
                'updated_at': datetime.utcnow().isoformat(),
                'error': str(e)
            })


def _update_generation_status(book_id: str, status: str, progress: int, current_step: str):
    """
    Update generation status for a book.
    
    Args:
        book_id: Book identifier
        status: Current status
        progress: Progress percentage (0-100)
        current_step: Description of current step
    """
    if book_id in generation_status:
        generation_status[book_id].update({
            'status': status,
            'progress': progress,
            'current_step': current_step,
            'updated_at': datetime.utcnow().isoformat()
        })
        logger.info(f"Status update for {book_id}: {current_step} ({progress}%)")


# Utility function to clean up old generation status (call periodically)
def cleanup_old_generation_status(max_age_hours: int = 24):
    """
    Clean up old generation status entries.
    
    Args:
        max_age_hours: Maximum age in hours before cleanup
    """
    try:
        from datetime import timedelta
        
        cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)
        
        to_remove = []
        for book_id, status in generation_status.items():
            created_at = datetime.fromisoformat(status['created_at'])
            if created_at < cutoff_time:
                to_remove.append(book_id)
        
        for book_id in to_remove:
            del generation_status[book_id]
            logger.info(f"Cleaned up old generation status for book {book_id}")
        
        if to_remove:
            logger.info(f"Cleaned up {len(to_remove)} old generation status entries")
            
    except Exception as e:
        logger.error(f"Error during generation status cleanup: {str(e)}")