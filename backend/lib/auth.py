"""
Supabase authentication middleware for Flask API.
"""

import os
import logging
import time
import hashlib
from functools import wraps
from flask import request, jsonify, g
from typing import Optional, Dict, Any
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()


class AuthenticationError(Exception):
    """Custom exception for authentication failures."""
    pass


class SupabaseAuthService:
    """Service for handling Supabase authentication."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Get Supabase credentials from environment
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY environment variables are required")
        
        # Create Supabase client
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        # Authentication cache
        self._token_cache: Dict[str, Dict[str, Any]] = {}
        self._cache_duration = 300  # 5 minutes in seconds
        self._cache_stats = {'hits': 0, 'misses': 0, 'cleanups': 0}
        
        self.logger.info("Supabase authentication service initialized with caching enabled")
    
    def extract_token_from_request(self, request) -> Optional[str]:
        """
        Extract JWT token from Flask request.
        
        Args:
            request: Flask request object
            
        Returns:
            JWT token string or None if not found
        """
        # Check Authorization header
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            return auth_header.split(' ')[1]
        
        # Check query parameter (fallback)
        token = request.args.get('token')
        if token:
            return token
        
        return None
    
    def get_user_from_token(self, token: str) -> Dict[str, Any]:
        """
        Get user information from JWT token using Supabase client with caching.
        
        Args:
            token: JWT token string
            
        Returns:
            Dict containing user information
            
        Raises:
            AuthenticationError: If token is invalid
        """
        # Check cache first
        cache_key = self._get_cache_key(token)
        cached_result = self._get_cached_token(cache_key)
        
        if cached_result:
            self._cache_stats['hits'] += 1
            # Use debug level for cached validations to reduce log spam
            self.logger.debug(f"Token validated from cache for user: {cached_result['user_id']}")
            return cached_result
        
        self._cache_stats['misses'] += 1
        
        try:
            # Use Supabase client to get user from token
            user = self.supabase.auth.get_user(token)
            
            if not user or not user.user:
                raise AuthenticationError("Invalid token or user not found")
            
            # Extract user information
            user_data = user.user
            
            user_info = {
                'user_id': user_data.id,
                'email': user_data.email,
                'role': 'authenticated',  # Default role
                'exp': None,  # Supabase handles expiration internally
                'iat': None,
                'user_metadata': user_data.user_metadata,
                'app_metadata': user_data.app_metadata
            }
            
            # Cache the result
            self._cache_token_result(cache_key, user_info)
            
            self.logger.debug(f"Token validated and cached for user: {user_data.id}")
            return user_info
            
        except Exception as e:
            self.logger.error(f"Supabase auth error: {str(e)}")
            raise AuthenticationError(f"Authentication failed: {str(e)}")
    
    def _get_cache_key(self, token: str) -> str:
        """Generate cache key from token."""
        return hashlib.sha256(token.encode()).hexdigest()[:16]
    
    def _get_cached_token(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached token validation result if still valid."""
        if cache_key not in self._token_cache:
            return None
        
        cached_entry = self._token_cache[cache_key]
        
        # Check if cache entry has expired
        if time.time() - cached_entry['timestamp'] > self._cache_duration:
            del self._token_cache[cache_key]
            return None
        
        return cached_entry['user_info']
    
    def _cache_token_result(self, cache_key: str, user_info: Dict[str, Any]) -> None:
        """Cache token validation result."""
        self._token_cache[cache_key] = {
            'user_info': user_info,
            'timestamp': time.time()
        }
        
        # Periodically clean up expired entries
        if len(self._token_cache) % 50 == 0:
            self._cleanup_expired_cache()
    
    def _cleanup_expired_cache(self) -> None:
        """Remove expired entries from cache."""
        current_time = time.time()
        expired_keys = []
        
        for cache_key, entry in self._token_cache.items():
            if current_time - entry['timestamp'] > self._cache_duration:
                expired_keys.append(cache_key)
        
        for key in expired_keys:
            del self._token_cache[key]
        
        if expired_keys:
            self._cache_stats['cleanups'] += 1
            self.logger.debug(f"Cleaned up {len(expired_keys)} expired cache entries")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics for monitoring."""
        return {
            **self._cache_stats,
            'cache_size': len(self._token_cache),
            'hit_rate': self._cache_stats['hits'] / (self._cache_stats['hits'] + self._cache_stats['misses']) if (self._cache_stats['hits'] + self._cache_stats['misses']) > 0 else 0
        }
    
    def validate_token(self, token: str) -> Dict[str, Any]:
        """
        Validate a JWT token and return the payload.
        This method is kept for backward compatibility.
        
        Args:
            token: JWT token string
            
        Returns:
            Dict containing the token payload
            
        Raises:
            AuthenticationError: If token is invalid
        """
        return self.get_user_from_token(token)


# Global auth service instance
auth_service = SupabaseAuthService()


def require_auth(f):
    """
    Decorator to require Supabase authentication for API endpoints.
    
    Usage:
        @app.route('/api/protected')
        @require_auth
        def protected_endpoint():
            user_id = g.user_id
            return jsonify({'message': f'Hello user {user_id}'})
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Extract token from request
            token = auth_service.extract_token_from_request(request)
            
            if not token:
                return jsonify({
                    'success': False,
                    'error': 'Authorization token required',
                    'code': 'AUTH_TOKEN_MISSING'
                }), 401
            
            # Validate token and get user info using Supabase
            user_info = auth_service.get_user_from_token(token)
            
            # Store user info in Flask's g object for use in the endpoint
            g.user_id = user_info['user_id']
            g.user_email = user_info.get('email')
            g.user_role = user_info.get('role')
            g.token_payload = user_info
            
            # Ensure user profile exists (for database foreign key constraints)
            try:
                from lib.user_profile_service import get_profile_service
                profile_service = get_profile_service()
                profile_service.ensure_profile_exists(
                    user_id=g.user_id,
                    user_email=g.user_email,
                    user_metadata=user_info.get('user_metadata', {}),
                    jwt_token=token  # Pass JWT token for authenticated profile operations
                )
            except Exception as profile_error:
                # Log profile creation error but don't fail the request
                # This ensures backward compatibility while adding profile management
                auth_service.logger.warning(f"Profile creation failed for user {g.user_id}: {str(profile_error)}")
            
            # Call the original function
            return f(*args, **kwargs)
            
        except AuthenticationError as e:
            auth_service.logger.warning(f"Authentication failed: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Authentication failed',
                'code': 'AUTH_INVALID_TOKEN',
                'message': str(e)
            }), 401
        except Exception as e:
            auth_service.logger.error(f"Unexpected authentication error: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Authentication error',
                'code': 'AUTH_ERROR',
                'message': 'An unexpected authentication error occurred'
            }), 500
    
    return decorated_function


def optional_auth(f):
    """
    Decorator for optional Supabase authentication.
    Sets user info in g if token is present and valid, but doesn't require it.
    
    Usage:
        @app.route('/api/public')
        @optional_auth
        def public_endpoint():
            user_id = getattr(g, 'user_id', None)
            if user_id:
                return jsonify({'message': f'Hello user {user_id}'})
            else:
                return jsonify({'message': 'Hello anonymous user'})
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Extract token from request
            token = auth_service.extract_token_from_request(request)
            
            if token:
                # Validate token and get user info using Supabase
                user_info = auth_service.get_user_from_token(token)
                
                # Store user info in Flask's g object
                g.user_id = user_info['user_id']
                g.user_email = user_info.get('email')
                g.user_role = user_info.get('role')
                g.token_payload = user_info
                
                # Ensure user profile exists (for database foreign key constraints)
                try:
                    from lib.user_profile_service import get_profile_service
                    profile_service = get_profile_service()
                    profile_service.ensure_profile_exists(
                        user_id=g.user_id,
                        user_email=g.user_email,
                        user_metadata=user_info.get('user_metadata', {}),
                        jwt_token=token  # Pass JWT token for authenticated profile operations
                    )
                except Exception as profile_error:
                    # Log profile creation error but don't fail the request
                    auth_service.logger.warning(f"Profile creation failed for user {g.user_id}: {str(profile_error)}")
            else:
                # No token provided - set defaults
                g.user_id = None
                g.user_email = None
                g.user_role = None
                g.token_payload = None
            
            # Call the original function
            return f(*args, **kwargs)
            
        except AuthenticationError as e:
            # For optional auth, log the error but don't fail the request
            auth_service.logger.warning(f"Optional authentication failed: {str(e)}")
            g.user_id = None
            g.user_email = None
            g.user_role = None
            g.token_payload = None
            
            return f(*args, **kwargs)
        except Exception as e:
            auth_service.logger.error(f"Unexpected optional authentication error: {str(e)}")
            g.user_id = None
            g.user_email = None
            g.user_role = None
            g.token_payload = None
            
            return f(*args, **kwargs)
    
    return decorated_function


def status_auth(f):
    """
    Lightweight decorator for status endpoints that need authentication without profile validation.
    Sets user info in g if token is present and valid, but doesn't require it and skips profile operations.
    
    This decorator is optimized for frequently-called endpoints like status checks where
    profile validation is unnecessary and creates excessive database calls.
    
    Usage:
        @app.route('/api/book-status/<book_id>')
        @status_auth
        def get_book_status(book_id):
            user_id = getattr(g, 'user_id', None)
            # ... status logic without profile validation
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Extract token from request
            token = auth_service.extract_token_from_request(request)
            
            if token:
                # Validate token and get user info (with caching)
                user_info = auth_service.get_user_from_token(token)
                
                # Store user info in Flask's g object (no profile validation)
                g.user_id = user_info['user_id']
                g.user_email = user_info.get('email')
                g.user_role = user_info.get('role')
                g.token_payload = user_info
            else:
                # No token provided - set defaults
                g.user_id = None
                g.user_email = None
                g.user_role = None
                g.token_payload = None
            
            # Call the original function
            return f(*args, **kwargs)
            
        except AuthenticationError as e:
            # For status auth, log the error but don't fail the request
            auth_service.logger.warning(f"Status authentication failed: {str(e)}")
            g.user_id = None
            g.user_email = None
            g.user_role = None
            g.token_payload = None
            
            return f(*args, **kwargs)
        except Exception as e:
            auth_service.logger.error(f"Unexpected status authentication error: {str(e)}")
            g.user_id = None
            g.user_email = None
            g.user_role = None
            g.token_payload = None
            
            return f(*args, **kwargs)
    
    return decorated_function


def get_current_user() -> Optional[Dict[str, Any]]:
    """
    Get current authenticated user from Flask's g object.
    
    Returns:
        Dict with user info or None if not authenticated
    """
    if hasattr(g, 'user_id') and g.user_id:
        return {
            'user_id': g.user_id,
            'email': g.user_email,
            'role': g.user_role,
            'token_payload': g.token_payload
        }
    return None


def get_current_user_id() -> Optional[str]:
    """
    Get current authenticated user ID.
    
    Returns:
        User ID string or None if not authenticated
    """
    return getattr(g, 'user_id', None)


# Utility functions for testing
def create_test_token(user_id: str, email: str = "test@example.com") -> str:
    """
    Create a test JWT token for development/testing.
    Note: This is for testing purposes only. In production, tokens should come from Supabase auth.
    
    Args:
        user_id: User ID
        email: User email
        
    Returns:
        JWT token string
    """
    # For testing, you can create a token using Supabase auth
    # This is a placeholder - in real usage, tokens come from Supabase auth flow
    return f"test_token_{user_id}_{email}"


def validate_test_setup() -> bool:
    """
    Validate that Supabase authentication is properly configured.
    
    Returns:
        True if configuration is valid
    """
    try:
        # Test Supabase connection
        response = auth_service.supabase.table('books').select('*').limit(1).execute()
        auth_service.logger.info("Supabase connection test successful")
        return True
    except Exception as e:
        auth_service.logger.error(f"Supabase setup validation failed: {str(e)}")
        return False