"""
Production-ready logging configuration for the Flask Book Generator API.
"""

import logging
import logging.handlers
import os
import sys
import json
from pathlib import Path
from typing import Dict, Any
from utils.datetime_utils import utc_now_iso


class StructuredFormatter(logging.Formatter):
    """Custom formatter for structured JSON logging."""
    
    def format(self, record):
        """Format log record as structured JSON."""
        log_entry = {
            'timestamp': utc_now_iso(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }
        
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
        
        # Add extra fields if present
        if hasattr(record, 'user_id'):
            log_entry['user_id'] = record.user_id
        if hasattr(record, 'book_id'):
            log_entry['book_id'] = record.book_id
        if hasattr(record, 'request_id'):
            log_entry['request_id'] = record.request_id
        
        return json.dumps(log_entry)


class ProductionFormatter(logging.Formatter):
    """Production formatter with consistent format."""
    
    def __init__(self):
        super().__init__(
            fmt='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )


def setup_logging(config_class=None):
    """
    Configure production-ready logging for the application.
    
    Args:
        config_class: Configuration class with logging settings
    """
    
    # Get configuration
    if config_class is None:
        from config import Config
        config_class = Config
    
    # Determine log level
    log_level = getattr(logging, config_class.LOG_LEVEL, logging.INFO)
    
    # Clear any existing handlers
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    
    # Create formatters
    use_json_logging = os.getenv('JSON_LOGGING', 'false').lower() == 'true'
    
    if use_json_logging:
        formatter = StructuredFormatter()
    else:
        formatter = ProductionFormatter()
    
    # Console handler (always present)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(log_level)
    
    handlers = [console_handler]
    
    # File handler (if not in container environment)
    if not os.getenv('CONTAINER_ENV', 'false').lower() == 'true':
        # Create logs directory
        logs_dir = Path('logs')
        logs_dir.mkdir(exist_ok=True)
        
        # Main application log
        file_handler = logging.handlers.RotatingFileHandler(
            'logs/flask_book_generator.log',
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5
        )
        file_handler.setFormatter(formatter)
        file_handler.setLevel(log_level)
        handlers.append(file_handler)
        
        # Error log (ERROR and above only)
        error_handler = logging.handlers.RotatingFileHandler(
            'logs/flask_book_generator_errors.log',
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=10
        )
        error_handler.setFormatter(formatter)
        error_handler.setLevel(logging.ERROR)
        handlers.append(error_handler)
    
    # Configure root logger
    root_logger.setLevel(log_level)
    for handler in handlers:
        root_logger.addHandler(handler)
    
    # Configure specific loggers
    _configure_third_party_loggers(log_level)
    
    # Log startup information
    logger = logging.getLogger(__name__)
    logger.info(f"Logging configured - Level: {config_class.LOG_LEVEL}, JSON: {use_json_logging}")
    
    return logger


def _configure_third_party_loggers(base_level):
    """Configure third-party library loggers."""
    
    # Reduce noise from third-party libraries
    third_party_loggers = {
        'werkzeug': logging.WARNING,
        'urllib3': logging.WARNING,
        'requests': logging.WARNING,
        'supabase': logging.INFO,
        'google': logging.WARNING,
        'reportlab': logging.WARNING,
        'ebooklib': logging.WARNING
    }
    
    for logger_name, level in third_party_loggers.items():
        logging.getLogger(logger_name).setLevel(level)


def get_logger(name: str, **context) -> logging.Logger:
    """
    Get a logger with optional context.
    
    Args:
        name: Logger name
        **context: Additional context to include in logs
    
    Returns:
        Configured logger
    """
    logger = logging.getLogger(name)
    
    # Add context to logger if provided
    if context:
        logger = logging.LoggerAdapter(logger, context)
    
    return logger


def log_request_context(user_id: str = None, book_id: str = None, request_id: str = None):
    """
    Context manager for adding request context to logs.
    
    Args:
        user_id: User ID
        book_id: Book ID
        request_id: Request ID
    
    Usage:
        with log_request_context(user_id="123", book_id="456"):
            logger.info("Processing request")
    """
    import contextvars
    
    # Store context in context variables
    context = {}
    if user_id:
        context['user_id'] = user_id
    if book_id:
        context['book_id'] = book_id
    if request_id:
        context['request_id'] = request_id
    
    return context


class RequestLoggingMiddleware:
    """Middleware for logging HTTP requests."""
    
    def __init__(self, app):
        self.app = app
        self.logger = logging.getLogger('request')
    
    def __call__(self, environ, start_response):
        """Log request information."""
        from flask import request, g
        import time
        import uuid
        
        # Generate request ID
        request_id = str(uuid.uuid4())
        g.request_id = request_id
        
        # Log request start
        start_time = time.time()
        self.logger.info(
            f"Request started",
            extra={
                'request_id': request_id,
                'method': environ.get('REQUEST_METHOD'),
                'path': environ.get('PATH_INFO'),
                'remote_addr': environ.get('REMOTE_ADDR'),
                'user_agent': environ.get('HTTP_USER_AGENT')
            }
        )
        
        def new_start_response(status, response_headers, exc_info=None):
            # Log response
            duration = time.time() - start_time
            status_code = int(status.split()[0])
            
            log_level = logging.INFO
            if status_code >= 400:
                log_level = logging.WARNING
            if status_code >= 500:
                log_level = logging.ERROR
            
            self.logger.log(
                log_level,
                f"Request completed",
                extra={
                    'request_id': request_id,
                    'status_code': status_code,
                    'duration_ms': round(duration * 1000, 2),
                    'method': environ.get('REQUEST_METHOD'),
                    'path': environ.get('PATH_INFO')
                }
            )
            
            return start_response(status, response_headers, exc_info)
        
        return self.app(environ, new_start_response)


def setup_error_monitoring():
    """Set up error monitoring and alerting."""
    
    # Sentry integration (if configured)
    sentry_dsn = os.getenv('SENTRY_DSN')
    if sentry_dsn:
        try:
            import sentry_sdk
            from sentry_sdk.integrations.flask import FlaskIntegration
            from sentry_sdk.integrations.logging import LoggingIntegration
            
            sentry_logging = LoggingIntegration(
                level=logging.INFO,
                event_level=logging.ERROR
            )
            
            sentry_sdk.init(
                dsn=sentry_dsn,
                integrations=[FlaskIntegration(), sentry_logging],
                traces_sample_rate=0.1,
                environment=os.getenv('FLASK_ENV', 'production')
            )
            
            logging.getLogger(__name__).info("Sentry error monitoring initialized")
            
        except ImportError:
            logging.getLogger(__name__).warning("Sentry SDK not installed, skipping error monitoring")
    
    # Custom error handler
    def handle_exception(exc_type, exc_value, exc_traceback):
        """Handle uncaught exceptions."""
        if issubclass(exc_type, KeyboardInterrupt):
            sys.__excepthook__(exc_type, exc_value, exc_traceback)
            return
        
        logger = logging.getLogger('exception')
        logger.error(
            "Uncaught exception",
            exc_info=(exc_type, exc_value, exc_traceback)
        )
    
    sys.excepthook = handle_exception


def create_health_check_logger():
    """Create a separate logger for health checks to reduce noise."""
    health_logger = logging.getLogger('health')
    health_logger.setLevel(logging.WARNING)  # Only log warnings and errors
    return health_logger