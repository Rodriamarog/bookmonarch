"""
Comprehensive input validation and sanitization for Flask API.
"""

import re
import html
import logging
from typing import Dict, List, Any, Optional, Union
from functools import wraps
from flask import request, jsonify


logger = logging.getLogger(__name__)


class ValidationError(Exception):
    """Custom exception for validation errors."""
    
    def __init__(self, message: str, field: str = None, code: str = None):
        self.message = message
        self.field = field
        self.code = code or 'VALIDATION_ERROR'
        super().__init__(self.message)


class InputSanitizer:
    """Input sanitization utilities."""
    
    @staticmethod
    def sanitize_string(value: str, max_length: int = None, allow_html: bool = False) -> str:
        """
        Sanitize string input.
        
        Args:
            value: Input string
            max_length: Maximum allowed length
            allow_html: Whether to allow HTML tags
            
        Returns:
            Sanitized string
        """
        if not isinstance(value, str):
            return str(value)
        
        # Remove null bytes and control characters
        value = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', value)
        
        # Strip whitespace
        value = value.strip()
        
        # HTML escape if HTML not allowed
        if not allow_html:
            value = html.escape(value)
        
        # Truncate if max_length specified
        if max_length and len(value) > max_length:
            value = value[:max_length]
        
        return value
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """
        Sanitize filename to prevent path traversal attacks.
        
        Args:
            filename: Input filename
            
        Returns:
            Sanitized filename
        """
        if not filename:
            return ""
        
        # Remove path separators and dangerous characters
        filename = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', filename)
        
        # Remove leading/trailing dots and spaces
        filename = filename.strip('. ')
        
        # Prevent reserved names on Windows
        reserved_names = {
            'CON', 'PRN', 'AUX', 'NUL',
            'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
            'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
        }
        
        if filename.upper() in reserved_names:
            filename = f"_{filename}"
        
        return filename
    
    @staticmethod
    def sanitize_book_title(title: str) -> str:
        """
        Sanitize book title with specific rules.
        
        Args:
            title: Book title
            
        Returns:
            Sanitized title
        """
        if not title:
            return ""
        
        # Basic sanitization
        title = InputSanitizer.sanitize_string(title, max_length=200)
        
        # Remove excessive whitespace
        title = re.sub(r'\s+', ' ', title)
        
        # Remove leading/trailing punctuation
        title = title.strip('.,;:!?-_')
        
        return title
    
    @staticmethod
    def sanitize_author_name(author: str) -> str:
        """
        Sanitize author name with specific rules.
        
        Args:
            author: Author name
            
        Returns:
            Sanitized author name
        """
        if not author:
            return ""
        
        # Basic sanitization
        author = InputSanitizer.sanitize_string(author, max_length=100)
        
        # Allow only letters, spaces, hyphens, apostrophes, and periods
        author = re.sub(r"[^a-zA-Z\s\-'.]+", '', author)
        
        # Remove excessive whitespace
        author = re.sub(r'\s+', ' ', author)
        
        # Capitalize properly
        author = ' '.join(word.capitalize() for word in author.split())
        
        return author


class InputValidator:
    """Input validation utilities."""
    
    @staticmethod
    def validate_required(value: Any, field_name: str) -> Any:
        """
        Validate that a field is present and not empty.
        
        Args:
            value: Field value
            field_name: Name of the field
            
        Returns:
            The value if valid
            
        Raises:
            ValidationError: If validation fails
        """
        if value is None or (isinstance(value, str) and not value.strip()):
            raise ValidationError(f"{field_name} is required", field_name, 'REQUIRED_FIELD')
        return value
    
    @staticmethod
    def validate_string_length(value: str, field_name: str, min_length: int = 0, max_length: int = None) -> str:
        """
        Validate string length.
        
        Args:
            value: String value
            field_name: Name of the field
            min_length: Minimum length
            max_length: Maximum length
            
        Returns:
            The value if valid
            
        Raises:
            ValidationError: If validation fails
        """
        if not isinstance(value, str):
            raise ValidationError(f"{field_name} must be a string", field_name, 'INVALID_TYPE')
        
        length = len(value.strip())
        
        if length < min_length:
            raise ValidationError(
                f"{field_name} must be at least {min_length} characters long",
                field_name,
                'TOO_SHORT'
            )
        
        if max_length and length > max_length:
            raise ValidationError(
                f"{field_name} cannot exceed {max_length} characters",
                field_name,
                'TOO_LONG'
            )
        
        return value
    
    @staticmethod
    def validate_book_title(title: str) -> str:
        """
        Validate book title with specific business rules.
        
        Args:
            title: Book title
            
        Returns:
            Sanitized and validated title
            
        Raises:
            ValidationError: If validation fails
        """
        # Required validation
        InputValidator.validate_required(title, 'Book title')
        
        # Sanitize
        title = InputSanitizer.sanitize_book_title(title)
        
        # Length validation
        InputValidator.validate_string_length(title, 'Book title', min_length=1, max_length=200)
        
        # Content validation
        if not re.search(r'[a-zA-Z]', title):
            raise ValidationError(
                'Book title must contain at least one letter',
                'title',
                'INVALID_CONTENT'
            )
        
        # Prevent common spam patterns
        spam_patterns = [
            r'(.)\1{10,}',  # Repeated characters
            r'[!@#$%^&*]{5,}',  # Excessive special characters
            r'^\s*test\s*$',  # Just "test"
        ]
        
        for pattern in spam_patterns:
            if re.search(pattern, title, re.IGNORECASE):
                raise ValidationError(
                    'Book title contains invalid content',
                    'title',
                    'SPAM_DETECTED'
                )
        
        return title
    
    @staticmethod
    def validate_author_name(author: str) -> str:
        """
        Validate author name with specific business rules.
        
        Args:
            author: Author name
            
        Returns:
            Sanitized and validated author name
            
        Raises:
            ValidationError: If validation fails
        """
        # Required validation
        InputValidator.validate_required(author, 'Author name')
        
        # Sanitize
        author = InputSanitizer.sanitize_author_name(author)
        
        # Length validation
        InputValidator.validate_string_length(author, 'Author name', min_length=1, max_length=100)
        
        # Content validation - must contain at least one letter
        if not re.search(r'[a-zA-Z]', author):
            raise ValidationError(
                'Author name must contain at least one letter',
                'author',
                'INVALID_CONTENT'
            )
        
        # Prevent obviously fake names
        fake_patterns = [
            r'^\s*test\s*$',
            r'^\s*admin\s*$',
            r'^\s*user\s*$',
            r'^\s*anonymous\s*$',
        ]
        
        for pattern in fake_patterns:
            if re.search(pattern, author, re.IGNORECASE):
                raise ValidationError(
                    'Please provide a valid author name',
                    'author',
                    'INVALID_AUTHOR'
                )
        
        return author
    
    @staticmethod
    def validate_book_type(book_type: str) -> str:
        """
        Validate book type.
        
        Args:
            book_type: Book type
            
        Returns:
            Validated book type
            
        Raises:
            ValidationError: If validation fails
        """
        InputValidator.validate_required(book_type, 'Book type')
        
        valid_types = ['non-fiction']
        
        if book_type not in valid_types:
            raise ValidationError(
                f'Book type must be one of: {", ".join(valid_types)}',
                'book_type',
                'INVALID_BOOK_TYPE'
            )
        
        return book_type
    
    @staticmethod
    def validate_uuid(value: str, field_name: str) -> str:
        """
        Validate UUID format.
        
        Args:
            value: UUID string
            field_name: Name of the field
            
        Returns:
            The UUID if valid
            
        Raises:
            ValidationError: If validation fails
        """
        if not value:
            raise ValidationError(f"{field_name} is required", field_name, 'REQUIRED_FIELD')
        
        uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        
        if not re.match(uuid_pattern, value, re.IGNORECASE):
            raise ValidationError(
                f"{field_name} must be a valid UUID",
                field_name,
                'INVALID_UUID'
            )
        
        return value.lower()
    
    @staticmethod
    def validate_integer(value: Any, field_name: str, min_value: int = None, max_value: int = None) -> int:
        """
        Validate integer value.
        
        Args:
            value: Value to validate
            field_name: Name of the field
            min_value: Minimum allowed value
            max_value: Maximum allowed value
            
        Returns:
            The integer if valid
            
        Raises:
            ValidationError: If validation fails
        """
        try:
            int_value = int(value)
        except (ValueError, TypeError):
            raise ValidationError(
                f"{field_name} must be a valid integer",
                field_name,
                'INVALID_INTEGER'
            )
        
        if min_value is not None and int_value < min_value:
            raise ValidationError(
                f"{field_name} must be at least {min_value}",
                field_name,
                'VALUE_TOO_SMALL'
            )
        
        if max_value is not None and int_value > max_value:
            raise ValidationError(
                f"{field_name} cannot exceed {max_value}",
                field_name,
                'VALUE_TOO_LARGE'
            )
        
        return int_value


class RequestValidator:
    """Request-level validation utilities."""
    
    @staticmethod
    def validate_json_request(required_fields: List[str] = None) -> Dict[str, Any]:
        """
        Validate that request is JSON and contains required fields.
        
        Args:
            required_fields: List of required field names
            
        Returns:
            Request JSON data
            
        Raises:
            ValidationError: If validation fails
        """
        if not request.is_json:
            raise ValidationError(
                'Request must be JSON',
                code='INVALID_REQUEST_FORMAT'
            )
        
        try:
            data = request.get_json()
        except Exception as e:
            raise ValidationError(
                f'Invalid JSON: {str(e)}',
                code='INVALID_JSON'
            )
        
        if not isinstance(data, dict):
            raise ValidationError(
                'Request JSON must be an object',
                code='INVALID_JSON_TYPE'
            )
        
        # Check required fields
        if required_fields:
            missing_fields = []
            for field in required_fields:
                if field not in data or data[field] is None:
                    missing_fields.append(field)
            
            if missing_fields:
                raise ValidationError(
                    f'Missing required fields: {", ".join(missing_fields)}',
                    code='MISSING_REQUIRED_FIELDS'
                )
        
        return data
    
    @staticmethod
    def validate_book_generation_request() -> Dict[str, str]:
        """
        Validate book generation request.
        
        Returns:
            Validated request data
            
        Raises:
            ValidationError: If validation fails
        """
        data = RequestValidator.validate_json_request(['title', 'author', 'book_type'])
        
        # Validate and sanitize each field
        validated_data = {
            'title': InputValidator.validate_book_title(data['title']),
            'author': InputValidator.validate_author_name(data['author']),
            'book_type': InputValidator.validate_book_type(data['book_type'])
        }
        
        return validated_data


def validate_request(validation_func):
    """
    Decorator for request validation.
    
    Args:
        validation_func: Function that validates and returns request data
        
    Returns:
        Decorator function
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            try:
                # Validate request
                validated_data = validation_func()
                
                # Store validated data in Flask's g object
                from flask import g
                g.validated_data = validated_data
                
                return f(*args, **kwargs)
                
            except ValidationError as e:
                logger.warning(f"Validation error: {e.message} (field: {e.field}, code: {e.code})")
                
                error_response = {
                    'success': False,
                    'error': 'Validation failed',
                    'code': e.code,
                    'message': e.message
                }
                
                if e.field:
                    error_response['field'] = e.field
                
                return jsonify(error_response), 400
            
            except Exception as e:
                logger.error(f"Unexpected validation error: {str(e)}")
                return jsonify({
                    'success': False,
                    'error': 'Validation error',
                    'code': 'VALIDATION_ERROR',
                    'message': 'An unexpected validation error occurred'
                }), 400
        
        return wrapper
    return decorator


# Common validation decorators
def validate_book_generation_request(f):
    """Decorator for validating book generation requests."""
    return validate_request(RequestValidator.validate_book_generation_request)(f)


def validate_json_request(required_fields: List[str] = None):
    """Decorator for validating JSON requests."""
    def decorator(f):
        return validate_request(lambda: RequestValidator.validate_json_request(required_fields))(f)
    return decorator