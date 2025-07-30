"""
Rate limiting service for Flask API endpoints.
"""

import os
import logging
from flask import request, jsonify, g
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from typing import Optional, Callable


logger = logging.getLogger(__name__)


def get_user_id_for_rate_limit() -> str:
    """
    Get user ID for rate limiting.
    Falls back to IP address if user is not authenticated.
    """
    # Try to get user ID from Flask's g object (set by auth middleware)
    user_id = getattr(g, 'user_id', None)
    if user_id:
        return f"user:{user_id}"
    
    # Fall back to IP address
    return f"ip:{get_remote_address()}"


def create_limiter(app) -> Limiter:
    """
    Create and configure Flask-Limiter instance.
    
    Args:
        app: Flask application instance
        
    Returns:
        Configured Limiter instance
    """
    
    # Get storage URL for rate limiting (Redis if available, in-memory otherwise)
    storage_uri = os.getenv('REDIS_URL') or os.getenv('RATE_LIMIT_STORAGE_URL')
    
    if storage_uri:
        logger.info(f"Using Redis for rate limiting: {storage_uri.split('@')[-1]}")  # Hide credentials
    else:
        logger.warning("Using in-memory storage for rate limiting (not suitable for production)")
    
    # Create limiter
    limiter = Limiter(
        app=app,
        key_func=get_user_id_for_rate_limit,
        storage_uri=storage_uri,
        default_limits=["1000 per hour", "100 per minute"],
        headers_enabled=True,
        retry_after="http-date",
        swallow_errors=True,  # Don't crash on rate limit errors
        strategy="fixed-window"
    )
    
    # Custom error handler for rate limit exceeded
    @limiter.request_filter
    def rate_limit_filter():
        """Filter requests that should not be rate limited."""
        # Don't rate limit health checks
        if request.endpoint in ['api.health_check', 'api.liveness_check', 'api.readiness_check']:
            return True
        return False
    
    @app.errorhandler(429)
    def rate_limit_exceeded(error):
        """Handle rate limit exceeded errors."""
        logger.warning(f"Rate limit exceeded for {get_user_id_for_rate_limit()}: {request.method} {request.path}")
        
        return jsonify({
            'success': False,
            'error': 'Rate limit exceeded',
            'code': 'RATE_LIMIT_EXCEEDED',
            'message': 'Too many requests. Please try again later.',
            'retry_after': error.retry_after
        }), 429
    
    logger.info("Rate limiter initialized")
    return limiter


class RateLimitConfig:
    """Rate limiting configuration constants."""
    
    # General API limits
    DEFAULT_LIMIT = "100 per hour"
    BURST_LIMIT = "10 per minute"
    
    # Book generation limits (more restrictive)
    GENERATION_LIMIT = "5 per hour"
    GENERATION_BURST_LIMIT = "2 per 10 minutes"
    
    # File access limits
    FILE_ACCESS_LIMIT = "50 per hour"
    FILE_ACCESS_BURST_LIMIT = "10 per minute"
    
    # Authentication limits
    AUTH_LIMIT = "20 per hour"
    AUTH_BURST_LIMIT = "5 per minute"


def apply_rate_limits(limiter: Limiter):
    """
    Apply rate limits to API endpoints.
    
    Args:
        limiter: Flask-Limiter instance
    """
    
    # Import here to avoid circular imports
    from api.book_generation import generate_book, get_book_status
    from api.file_management import get_book_files, delete_book
    
    # Book generation endpoints (most restrictive)
    limiter.limit(RateLimitConfig.GENERATION_LIMIT)(generate_book)
    limiter.limit(RateLimitConfig.GENERATION_BURST_LIMIT)(generate_book)
    
    # Status checking (less restrictive)
    limiter.limit("200 per hour")(get_book_status)
    limiter.limit("20 per minute")(get_book_status)
    
    # File access
    limiter.limit(RateLimitConfig.FILE_ACCESS_LIMIT)(get_book_files)
    limiter.limit(RateLimitConfig.FILE_ACCESS_BURST_LIMIT)(get_book_files)
    
    # Book deletion
    limiter.limit("10 per hour")(delete_book)
    limiter.limit("2 per minute")(delete_book)
    
    logger.info("Rate limits applied to API endpoints")


def get_rate_limit_info(user_id: str = None) -> dict:
    """
    Get current rate limit information for a user.
    
    Args:
        user_id: User ID (optional)
        
    Returns:
        Dictionary with rate limit information
    """
    try:
        # This would require access to the limiter's storage
        # For now, return static information
        return {
            'limits': {
                'book_generation': RateLimitConfig.GENERATION_LIMIT,
                'file_access': RateLimitConfig.FILE_ACCESS_LIMIT,
                'general_api': RateLimitConfig.DEFAULT_LIMIT
            },
            'user_id': user_id or 'anonymous'
        }
    except Exception as e:
        logger.error(f"Error getting rate limit info: {str(e)}")
        return {'error': 'Unable to retrieve rate limit information'}


def is_rate_limited(endpoint: str, user_id: str = None) -> bool:
    """
    Check if a user is currently rate limited for an endpoint.
    
    Args:
        endpoint: API endpoint name
        user_id: User ID (optional)
        
    Returns:
        True if rate limited, False otherwise
    """
    try:
        # This would require integration with the limiter's storage
        # For now, return False (not rate limited)
        return False
    except Exception as e:
        logger.error(f"Error checking rate limit status: {str(e)}")
        return False


def reset_rate_limit(user_id: str, endpoint: str = None) -> bool:
    """
    Reset rate limit for a user (admin function).
    
    Args:
        user_id: User ID
        endpoint: Specific endpoint (optional, resets all if None)
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # This would require admin privileges and limiter storage access
        logger.info(f"Rate limit reset requested for user {user_id}, endpoint {endpoint}")
        return True
    except Exception as e:
        logger.error(f"Error resetting rate limit: {str(e)}")
        return False


class RateLimitBypass:
    """Context manager for bypassing rate limits (for testing/admin)."""
    
    def __init__(self, limiter: Limiter):
        self.limiter = limiter
        self.original_enabled = None
    
    def __enter__(self):
        """Disable rate limiting."""
        self.original_enabled = self.limiter.enabled
        self.limiter.enabled = False
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Re-enable rate limiting."""
        if self.original_enabled is not None:
            self.limiter.enabled = self.original_enabled


# Decorator for custom rate limiting
def custom_rate_limit(limit: str, per_user: bool = True):
    """
    Custom rate limiting decorator.
    
    Args:
        limit: Rate limit string (e.g., "5 per hour")
        per_user: If True, limit per user; if False, limit globally
        
    Returns:
        Decorator function
    """
    def decorator(f):
        def wrapper(*args, **kwargs):
            # This would implement custom rate limiting logic
            # For now, just call the original function
            return f(*args, **kwargs)
        return wrapper
    return decorator