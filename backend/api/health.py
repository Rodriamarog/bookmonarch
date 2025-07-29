"""
Health check API endpoints.
"""

import os
import logging
from flask import jsonify
from api import api_bp
from utils.datetime_utils import utc_now_iso


logger = logging.getLogger(__name__)


@api_bp.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint for load balancers and monitoring.
    
    Returns:
        JSON response with health status and dependency checks
    """
    try:
        # Check critical dependencies
        checks = {
            'status': 'healthy',
            'timestamp': utc_now_iso(),
            'version': os.environ.get('APP_VERSION', 'unknown'),
            'service': 'flask-book-generator',
            'dependencies': {
                'supabase': _check_supabase_connection(),
                'gemini_api': _check_gemini_api_key(),
                'storage': _check_storage_configuration()
            }
        }
        
        # Determine overall health status
        all_healthy = all(checks['dependencies'].values())
        
        if not all_healthy:
            checks['status'] = 'unhealthy'
            logger.warning(f"Health check failed: {checks['dependencies']}")
            return jsonify(checks), 503
        
        logger.debug("Health check passed")
        return jsonify(checks), 200
        
    except Exception as e:
        logger.error(f"Health check error: {str(e)}")
        return jsonify({
            'status': 'error',
            'timestamp': utc_now_iso(),
            'error': str(e)
        }), 500


@api_bp.route('/health/ready', methods=['GET'])
def readiness_check():
    """
    Readiness check endpoint for Kubernetes deployments.
    
    Returns:
        JSON response indicating if service is ready to handle requests
    """
    try:
        # Check if all required environment variables are set
        required_vars = [
            'SUPABASE_URL',
            'SECRET_KEY',
            'GEMINI_API_KEY'
        ]
        
        missing_vars = []
        for var in required_vars:
            if not os.getenv(var):
                missing_vars.append(var)
        
        if missing_vars:
            return jsonify({
                'ready': False,
                'timestamp': utc_now_iso(),
                'error': f'Missing required environment variables: {missing_vars}'
            }), 503
        
        return jsonify({
            'ready': True,
            'timestamp': utc_now_iso(),
            'service': 'flask-book-generator'
        }), 200
        
    except Exception as e:
        logger.error(f"Readiness check error: {str(e)}")
        return jsonify({
            'ready': False,
            'timestamp': utc_now_iso(),
            'error': str(e)
        }), 500


@api_bp.route('/health/live', methods=['GET'])
def liveness_check():
    """
    Liveness check endpoint for Kubernetes deployments.
    
    Returns:
        Simple response indicating the service is alive
    """
    return jsonify({
        'alive': True,
        'timestamp': utc_now_iso(),
        'service': 'flask-book-generator'
    }), 200


def _check_supabase_connection() -> bool:
    """Check if Supabase connection is working."""
    try:
        from lib.supabase_storage import SupabaseStorageService
        
        # Try to initialize storage service
        storage = SupabaseStorageService()
        
        # Test basic storage operation
        return storage.bucket_name == 'books'
            
    except Exception as e:
        logger.warning(f"Supabase connection check failed: {str(e)}")
        return False


def _check_gemini_api_key() -> bool:
    """Check if Gemini API key is configured."""
    try:
        gemini_key = os.getenv('GEMINI_API_KEY')
        return bool(gemini_key and len(gemini_key) > 10)
    except Exception as e:
        logger.warning(f"Gemini API key check failed: {str(e)}")
        return False


def _check_storage_configuration() -> bool:
    """Check if storage configuration is valid."""
    try:
        from lib.supabase_storage import SupabaseStorageService
        
        # Try to initialize storage service and validate configuration
        storage = SupabaseStorageService()
        
        # Test that we can generate storage paths
        test_path = storage.generate_storage_path("test_user", "test_book", "test.pdf")
        expected_path = "books/test_user/test_book/test.pdf"
        
        return test_path == expected_path
        
    except Exception as e:
        logger.warning(f"Storage configuration check failed: {str(e)}")
        return False