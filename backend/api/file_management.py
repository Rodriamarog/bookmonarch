"""
File management API endpoints.
"""

import logging
from flask import jsonify, request
from typing import Dict, Any

from api import api_bp
from lib.auth import require_auth, get_current_user_id
from lib.supabase_storage import SupabaseStorageService, SupabaseStorageError


logger = logging.getLogger(__name__)

# Initialize storage service
storage_service = SupabaseStorageService()


@api_bp.route('/book-files/<book_id>', methods=['GET'])
@require_auth
def get_book_files(book_id: str):
    """
    Get signed URLs for book files (PDF, EPUB, metadata).
    
    Args:
        book_id: Book ID
    
    Query Parameters:
        expires_in: URL expiration time in seconds (default: 3600)
    
    Returns:
        JSON response with signed URLs for file downloads
    """
    try:
        user_id = get_current_user_id()
        
        # Get expiration time from query parameters
        expires_in = request.args.get('expires_in', 3600, type=int)
        
        # Validate expiration time
        if expires_in < 60 or expires_in > 86400:  # 1 minute to 24 hours
            return jsonify({
                'success': False,
                'error': 'Invalid expires_in value (must be between 60 and 86400 seconds)',
                'code': 'INVALID_EXPIRATION'
            }), 400
        
        # Get file URLs
        file_urls = storage_service.get_book_file_urls(user_id, book_id, expires_in)
        
        # Check if any files exist
        if not any(file_urls.values()):
            return jsonify({
                'success': False,
                'error': 'No files found for this book',
                'code': 'FILES_NOT_FOUND'
            }), 404
        
        logger.info(f"Generated file URLs for book {book_id} (user {user_id})")
        
        return jsonify({
            'success': True,
            'book_id': book_id,
            'expires_in': expires_in,
            'files': {
                'pdf_url': file_urls.get('pdf'),
                'epub_url': file_urls.get('epub'),
                'metadata_url': file_urls.get('metadata')
            }
        }), 200
        
    except SupabaseStorageError as e:
        logger.error(f"Storage error getting files for book {book_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Storage error',
            'code': 'STORAGE_ERROR',
            'message': str(e)
        }), 500
    except Exception as e:
        logger.error(f"Error getting files for book {book_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get book files',
            'code': 'FILE_ACCESS_ERROR',
            'message': str(e)
        }), 500


@api_bp.route('/book-delete/<book_id>', methods=['DELETE'])
@require_auth
def delete_book(book_id: str):
    """
    Delete a book and all associated files.
    
    Args:
        book_id: Book ID to delete
    
    Returns:
        JSON response confirming deletion
    """
    try:
        user_id = get_current_user_id()
        
        # First, try to delete files from storage
        files_deleted = storage_service.cleanup_book_files(user_id, book_id)
        
        # TODO: Delete book record from Supabase database
        # This would be implemented when we have the database integration
        # For now, we just delete the files
        
        if files_deleted:
            logger.info(f"Successfully deleted book {book_id} and files for user {user_id}")
            return jsonify({
                'success': True,
                'book_id': book_id,
                'message': 'Book and associated files deleted successfully'
            }), 200
        else:
            logger.warning(f"No files found to delete for book {book_id} (user {user_id})")
            return jsonify({
                'success': True,
                'book_id': book_id,
                'message': 'Book deletion completed (no files found)'
            }), 200
        
    except SupabaseStorageError as e:
        logger.error(f"Storage error deleting book {book_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Storage error during deletion',
            'code': 'STORAGE_DELETE_ERROR',
            'message': str(e)
        }), 500
    except Exception as e:
        logger.error(f"Error deleting book {book_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to delete book',
            'code': 'DELETE_ERROR',
            'message': str(e)
        }), 500


@api_bp.route('/file-info/<book_id>/<file_type>', methods=['GET'])
@require_auth
def get_file_info(book_id: str, file_type: str):
    """
    Get information about a specific book file.
    
    Args:
        book_id: Book ID
        file_type: Type of file ('pdf', 'epub', 'metadata')
    
    Returns:
        JSON response with file information
    """
    try:
        user_id = get_current_user_id()
        
        # Validate file type
        valid_file_types = {
            'pdf': 'book.pdf',
            'epub': 'book.epub',
            'metadata': 'metadata.pdf'
        }
        
        if file_type not in valid_file_types:
            return jsonify({
                'success': False,
                'error': f'Invalid file type. Must be one of: {list(valid_file_types.keys())}',
                'code': 'INVALID_FILE_TYPE'
            }), 400
        
        # Generate storage path
        filename = valid_file_types[file_type]
        storage_path = storage_service.generate_storage_path(user_id, book_id, filename)
        
        # Get file information
        file_info = storage_service.get_file_info(storage_path)
        
        if not file_info:
            return jsonify({
                'success': False,
                'error': 'File not found',
                'code': 'FILE_NOT_FOUND'
            }), 404
        
        logger.info(f"Retrieved file info for {file_type} of book {book_id} (user {user_id})")
        
        return jsonify({
            'success': True,
            'book_id': book_id,
            'file_type': file_type,
            'file_info': file_info
        }), 200
        
    except SupabaseStorageError as e:
        logger.error(f"Storage error getting file info for {book_id}/{file_type}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Storage error',
            'code': 'STORAGE_ERROR',
            'message': str(e)
        }), 500
    except Exception as e:
        logger.error(f"Error getting file info for {book_id}/{file_type}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get file information',
            'code': 'FILE_INFO_ERROR',
            'message': str(e)
        }), 500


@api_bp.route('/storage-status', methods=['GET'])
@require_auth
def get_storage_status():
    """
    Get storage service status and configuration.
    
    Returns:
        JSON response with storage service information
    """
    try:
        user_id = get_current_user_id()
        
        # Basic storage service info
        status_info = {
            'success': True,
            'storage_service': 'supabase',
            'bucket_name': storage_service.bucket_name,
            'service_status': 'operational'
        }
        
        logger.info(f"Storage status requested by user {user_id}")
        
        return jsonify(status_info), 200
        
    except Exception as e:
        logger.error(f"Error getting storage status: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get storage status',
            'code': 'STORAGE_STATUS_ERROR',
            'message': str(e)
        }), 500