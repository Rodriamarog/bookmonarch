"""
Configuration settings for the Flask Book Generator API.
"""

import os
import logging
from pathlib import Path


class Config:
    """Base configuration class."""
    
    # Flask settings
    SECRET_KEY = os.environ.get('SECRET_KEY')
    DEBUG = False
    TESTING = False
    
    # Supabase settings
    SUPABASE_URL = os.environ.get('SUPABASE_URL')
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY')  # Anonymous key for client-side
    SUPABASE_SERVICE_KEY = os.environ.get('SECRET_KEY')  # Service role key
    SUPABASE_JWT_SECRET = os.environ.get('SUPABASE_JWT_SECRET') or os.environ.get('PUBLIC_KEY')
    
    # Gemini API settings
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
    
    # CORS settings
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',')
    
    # File settings
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB max file size
    ALLOWED_EXTENSIONS = {'.pdf', '.epub', '.json', '.txt', '.md'}
    
    # Book generation settings
    TARGET_CHAPTER_WORD_COUNT = 1400
    TOTAL_CHAPTERS = 15
    
    # PDF settings
    PDF_PAGE_WIDTH = 5  # inches
    PDF_PAGE_HEIGHT = 8  # inches
    PDF_MARGIN_INSIDE = 0.375  # inches
    PDF_MARGIN_OUTSIDE = 0.375  # inches
    PDF_MARGIN_TOP = 0.5  # inches
    PDF_MARGIN_BOTTOM = 0.5  # inches
    PDF_FONT = 'Times New Roman'
    
    # API retry settings
    MAX_API_RETRIES = 3
    RETRY_DELAY_BASE = 1  # seconds
    GEMINI_RATE_LIMIT_DELAY = 30  # seconds
    
    # Logging settings
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO').upper()
    LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    # Application settings
    APP_VERSION = os.environ.get('APP_VERSION', '1.0.0')
    APP_NAME = 'Flask Book Generator API'
    
    # Rate limiting settings
    RATE_LIMIT_STORAGE_URL = os.environ.get('REDIS_URL')  # Optional Redis for rate limiting
    DEFAULT_RATE_LIMIT = "100 per hour"
    GENERATION_RATE_LIMIT = "5 per hour"
    
    # Health check settings
    HEALTH_CHECK_TIMEOUT = 5  # seconds
    
    @classmethod
    def validate_config(cls):
        """Validate required configuration variables."""
        required_vars = [
            'SECRET_KEY',
            'SUPABASE_URL',
            'GEMINI_API_KEY'
        ]
        
        missing_vars = []
        for var in required_vars:
            if not getattr(cls, var) or not os.environ.get(var):
                missing_vars.append(var)
        
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {missing_vars}")
        
        # Validate URLs
        if cls.SUPABASE_URL and not cls.SUPABASE_URL.startswith('https://'):
            raise ValueError("SUPABASE_URL must be a valid HTTPS URL")
        
        # Validate API key lengths
        if cls.GEMINI_API_KEY and len(cls.GEMINI_API_KEY) < 10:
            raise ValueError("GEMINI_API_KEY appears to be invalid (too short)")
    
    @staticmethod
    def init_app(app):
        """Initialize application with configuration."""
        # Validate configuration
        Config.validate_config()
        
        # Setup logging
        logging.basicConfig(
            level=getattr(logging, Config.LOG_LEVEL),
            format=Config.LOG_FORMAT
        )
        
        logger = logging.getLogger(__name__)
        logger.info(f"Initialized {Config.APP_NAME} v{Config.APP_VERSION}")


class DevelopmentConfig(Config):
    """Development configuration."""
    
    DEBUG = True
    LOG_LEVEL = 'DEBUG'
    
    # More verbose logging in development
    LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
    
    # Relaxed rate limits for development
    DEFAULT_RATE_LIMIT = "1000 per hour"
    GENERATION_RATE_LIMIT = "50 per hour"
    
    # Shorter timeouts for faster development
    HEALTH_CHECK_TIMEOUT = 2
    
    @staticmethod
    def init_app(app):
        """Initialize development application."""
        Config.init_app(app)
        
        logger = logging.getLogger(__name__)
        logger.warning("Running in DEVELOPMENT mode - not suitable for production")


class ProductionConfig(Config):
    """Production configuration."""
    
    DEBUG = False
    TESTING = False
    
    # Production logging
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'WARNING').upper()
    
    # Strict rate limits in production
    DEFAULT_RATE_LIMIT = "100 per hour"
    GENERATION_RATE_LIMIT = "5 per hour"
    
    # Production timeouts
    HEALTH_CHECK_TIMEOUT = 10
    
    # Security headers
    SECURITY_HEADERS = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'"
    }
    
    @classmethod
    def validate_config(cls):
        """Additional production validation."""
        super().validate_config()
        
        # Production-specific validations
        if not cls.SECRET_KEY or cls.SECRET_KEY == 'dev-secret-key-change-in-production':
            raise ValueError("SECRET_KEY must be set to a secure value in production")
        
        if len(cls.SECRET_KEY) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long in production")
        
        # Ensure HTTPS in production
        if cls.SUPABASE_URL and not cls.SUPABASE_URL.startswith('https://'):
            raise ValueError("SUPABASE_URL must use HTTPS in production")
    
    @staticmethod
    def init_app(app):
        """Initialize production application."""
        Config.init_app(app)
        
        # Additional production setup
        logger = logging.getLogger(__name__)
        logger.info("Running in PRODUCTION mode")
        
        # Validate production config
        ProductionConfig.validate_config()


class TestingConfig(Config):
    """Testing configuration."""
    
    TESTING = True
    DEBUG = True
    
    # Use in-memory storage for testing
    LOG_LEVEL = 'DEBUG'
    
    # Disable rate limiting in tests
    DEFAULT_RATE_LIMIT = None
    GENERATION_RATE_LIMIT = None
    
    # Fast timeouts for tests
    HEALTH_CHECK_TIMEOUT = 1
    MAX_API_RETRIES = 1
    RETRY_DELAY_BASE = 0.1
    
    @staticmethod
    def init_app(app):
        """Initialize testing application."""
        Config.init_app(app)
        
        logger = logging.getLogger(__name__)
        logger.info("Running in TESTING mode")


# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


def get_config():
    """Get configuration based on environment."""
    env = os.environ.get('FLASK_ENV', 'development').lower()
    return config.get(env, config['default'])


# Export the current configuration
Config = get_config()