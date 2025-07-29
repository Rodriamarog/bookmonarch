"""
Book generation API endpoints.
"""

import logging
import threading
import uuid
from datetime import timedelta
from flask import request, jsonify, g
from typing import Dict, Any

from api import api_bp
from lib.auth import require_auth, get_current_user_id
from lib.validation import validate_book_generation_request
from lib.database_service import get_database_service, DatabaseError
from lib.user_profile_service import get_profile_service, ProfileError
from utils.datetime_utils import utc_now_iso, utc_now, format_for_database
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

# Initialize database and profile services
db_service = get_database_service()
profile_service = get_profile_service()


@api_bp.route('/generate-book', methods=['POST'])
@require_auth
@validate_book_generation_request
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
        
        # Check generation limits before proceeding
        try:
            limit_check = profile_service.check_generation_limit(user_id)
            if not limit_check['allowed']:
                return jsonify({
                    'success': False,
                    'error': 'Daily generation limit exceeded',
                    'code': 'GENERATION_LIMIT_EXCEEDED',
                    'message': f"You have reached your daily limit of {limit_check['daily_limit']} books. Please try again tomorrow.",
                    'limit_info': limit_check
                }), 429
        except ProfileError as e:
            logger.warning(f"Could not check generation limit for user {user_id}: {str(e)}")
            # Continue anyway to maintain backward compatibility
        
        # Get validated data from the decorator
        data = g.validated_data
        title = data['title']
        author = data['author']
        book_type = data['book_type']
        
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
            'created_at': utc_now_iso(),
            'updated_at': utc_now_iso(),
            'error': None,
            'files': {
                'pdf_url': None,
                'epub_url': None,
                'metadata_url': None
            }
        }
        
        # Create initial book record in database
        try:
            book_data = {
                'id': book_id,
                'user_id': user_id,
                'title': title,
                'author_name': author,
                'genre': book_type,
                'status': 'pending',
                'progress': 0,
                'total_chapters': 15,
                'created_at': format_for_database()
            }
            db_service.create_book(book_data)
            logger.info(f"Created book record in database: {book_id}")
        except DatabaseError as e:
            logger.error(f"Failed to create book record in database: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Failed to create book record',
                'code': 'DATABASE_ERROR',
                'message': str(e)
            }), 500
        
        # Increment user's daily book count
        try:
            profile_service.increment_daily_book_count(user_id)
        except ProfileError as e:
            logger.warning(f"Could not increment book count for user {user_id}: {str(e)}")
        
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
        
        # First check in-memory status (for active generations)
        if book_id in generation_status:
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
        
        # If not in memory, check database for completed books
        try:
            book_data = db_service.get_book(book_id, user_id)
            
            if book_data:
                # Return book data from database
                response_data = {
                    'success': True,
                    'book_id': book_id,
                    'status': book_data['status'],
                    'progress': book_data['progress'] or 100,
                    'current_step': 'Book generation completed',
                    'title': book_data['title'],
                    'author': book_data['author_name'],
                    'created_at': book_data['created_at']
                }
                
                # Include error if present
                if book_data.get('error_message'):
                    response_data['error'] = book_data['error_message']
                
                # Include file URLs if completed
                if book_data['status'] == 'completed':
                    response_data['files'] = {
                        'pdf_url': book_data.get('content_url'),
                        'epub_url': book_data.get('epub_url'),
                        'metadata_url': book_data.get('metadata_url')
                    }
                
                return jsonify(response_data), 200
                
        except DatabaseError as e:
            logger.error(f"Database error getting book status: {str(e)}")
        
        # Book not found in memory or database
        return jsonify({
            'success': False,
            'error': 'Book not found',
            'code': 'BOOK_NOT_FOUND'
        }), 404
        
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
        final_status = {
            'status': 'completed',
            'progress': 100,
            'current_step': 'Book generation completed successfully!',
            'updated_at': utc_now_iso(),
            'files': {
                'pdf_url': pdf_url,
                'epub_url': epub_url,
                'metadata_url': metadata_url
            }
        }
        
        # Update in-memory status
        if book_id in generation_status:
            generation_status[book_id].update(final_status)
        
        # Update database record with ALL file URLs
        try:
            db_service.update_book_file_urls(
                book_id=book_id,
                user_id=user_id,
                pdf_url=pdf_url,
                epub_url=epub_url,
                metadata_url=metadata_url
            )
            
            # Also update status and progress
            db_service.update_book(book_id, user_id, {
                'status': 'completed',
                'progress': 100
            })
            
            logger.info(f"Updated book record with all file URLs in database: {book_id}")
        except DatabaseError as e:
            logger.error(f"Failed to update book record in database: {str(e)}")
        
        logger.info(f"Successfully completed book generation for '{title}' (book_id: {book_id})")
        
    except Exception as e:
        error_msg = f"Book generation failed: {str(e)}"
        logger.error(f"Error in async book generation for {book_id}: {error_msg}")
        
        # Update status with error
        error_status = {
            'status': 'failed',
            'progress': 0,
            'current_step': 'Book generation failed',
            'updated_at': utc_now_iso(),
            'error': str(e)
        }
        
        if book_id in generation_status:
            generation_status[book_id].update(error_status)
        
        # Update database record with error
        try:
            db_service.update_book(book_id, user_id, {
                'status': 'failed',
                'progress': 0,
                'error_message': str(e)
            })
            logger.info(f"Updated book record with error in database: {book_id}")
        except DatabaseError as db_error:
            logger.error(f"Failed to update book record with error in database: {str(db_error)}")


def _update_generation_status(book_id: str, status: str, progress: int, current_step: str):
    """
    Update generation status in memory and database.
    
    Args:
        book_id: Book ID
        status: Current status
        progress: Progress percentage
        current_step: Current step description
    """
    # Update in-memory status
    if book_id in generation_status:
        generation_status[book_id].update({
            'status': status,
            'progress': progress,
            'current_step': current_step,
            'updated_at': utc_now_iso()
        })
    
    # Update database record
    try:
        # Extract user_id from generation_status if available
        user_id = generation_status[book_id]['user_id'] if book_id in generation_status else None
        if user_id:
            db_service.update_book(book_id, user_id, {
                'status': status,
                'progress': progress
            })
    except DatabaseError as e:
        logger.error(f"Failed to update book status in database: {str(e)}")


def cleanup_old_generation_status(max_age_hours: int = 24):
    """
    Clean up old generation status entries from memory.
    
    Args:
        max_age_hours: Maximum age in hours before cleanup
    """
    cutoff_time = utc_now() - timedelta(hours=max_age_hours)
    
    # Remove old entries from memory
    from utils.datetime_utils import from_iso_string
    
    old_entries = [
        book_id for book_id, status in generation_status.items()
        if from_iso_string(status['created_at']) < cutoff_time
    ]
    
    for book_id in old_entries:
        del generation_status[book_id]
    
    if old_entries:
        logger.info(f"Cleaned up {len(old_entries)} old generation status entries")